// packages/schema/src/presets/loader.ts
// Three-tier loader API for the preset SKILL.md tree:
//   loadPreset       — one file
//   loadCluster      — one cluster directory (its SKILL.md + every preset *.md)
//   loadAllPresets   — recursively walk a presets-root, build a registry
//
// Synchronous I/O per T-304 §D-T304-7 — schema-helper precedent (inheritance.ts)
// is pure-functional + sync; we keep that posture so consumers can call the
// loader from any context (test setup, build scripts, CI gates) without async
// plumbing. The walks here are bounded (50 files at full preset count), so
// sync I/O has no practical cost.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import matter from 'gray-matter';
import { ZodError } from 'zod';

import { type PresetBody, extractPresetBody } from './body.js';
import {
  PresetParseError,
  PresetRegistryLoadError,
  type PresetRegistryLoadIssue,
  PresetValidationError,
} from './errors.js';
import {
  type ClusterSkillFrontmatter,
  type PresetCluster,
  type PresetFrontmatter,
  clusterSkillFrontmatterSchema,
  presetFrontmatterSchema,
} from './frontmatter.js';
import { PresetRegistry } from './registry.js';

/** A fully parsed preset SKILL.md file. */
export interface Preset {
  /** Workspace-relative or absolute path (whatever the caller passed in). */
  filePath: string;
  /** Validated frontmatter. */
  frontmatter: PresetFrontmatter;
  /** Section-extracted body. */
  body: PresetBody;
}

/** A fully parsed cluster SKILL.md file. */
export interface ClusterSkill {
  filePath: string;
  frontmatter: ClusterSkillFrontmatter;
  /** Raw markdown body — cluster bodies are not section-extracted in T-304. */
  body: string;
}

/**
 * Read + parse + validate a single preset file. Throws on any failure.
 *
 * @throws PresetParseError when gray-matter cannot parse the file or the file
 *   has no frontmatter block.
 * @throws PresetValidationError when the frontmatter fails Zod validation.
 * @throws Standard Node ENOENT error when `filePath` does not exist (NOT
 *   wrapped — consumers branch on `err.code === 'ENOENT'`).
 */
export function loadPreset(filePath: string): Preset {
  const raw = readFileSync(filePath, 'utf8');
  const { data, body } = parseFrontmatter(filePath, raw);
  const frontmatter = validateOrThrow(
    filePath,
    data,
    presetFrontmatterSchema.parse.bind(presetFrontmatterSchema),
  );
  return {
    filePath,
    frontmatter,
    body: extractPresetBody(body),
  };
}

/** Read + parse + validate a cluster `SKILL.md`. Same error semantics as loadPreset. */
export function loadClusterSkill(filePath: string): ClusterSkill {
  const raw = readFileSync(filePath, 'utf8');
  const { data, body } = parseFrontmatter(filePath, raw);
  const frontmatter = validateOrThrow(
    filePath,
    data,
    clusterSkillFrontmatterSchema.parse.bind(clusterSkillFrontmatterSchema),
  );
  return { filePath, frontmatter, body };
}

/** Result of `loadCluster`: the cluster skill + every preset in the directory. */
export interface LoadClusterResult {
  skill: ClusterSkill;
  presets: Preset[];
}

/**
 * Read every `*.md` in a cluster directory:
 *   - `SKILL.md` parses with the cluster-skill schema.
 *   - Every other `.md` parses with the preset schema.
 *
 * Non-`.md` files (e.g., README.txt, .DS_Store) are ignored. Subdirectories
 * are not descended — clusters are flat by spec.
 *
 * @throws Standard Node ENOENT when `clusterPath` is missing or has no
 *   `SKILL.md` inside it.
 * @throws PresetParseError / PresetValidationError fail-on-first for any
 *   preset file. Use `loadAllPresets` for aggregated multi-cluster errors.
 */
export function loadCluster(clusterPath: string): LoadClusterResult {
  const skillPath = join(clusterPath, 'SKILL.md');
  // Trigger ENOENT explicitly so the error is shaped like Node's stat error
  // (the raw readdir would mask "missing SKILL.md" behind a directory-listing
  // success). Spec: AC #19.
  statSync(skillPath);
  const skill = loadClusterSkill(skillPath);

  const entries = readdirSync(clusterPath, { withFileTypes: true });
  const presets: Preset[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name === 'SKILL.md') continue;
    if (!entry.name.endsWith('.md')) continue;
    presets.push(loadPreset(join(clusterPath, entry.name)));
  }

  // Stable ordering — sort by frontmatter id (which we know is a kebab slug).
  presets.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));

  return { skill, presets };
}

/** Memoization cache: `rootPath` → built PresetRegistry. */
const registryCache = new Map<string, PresetRegistry>();

/**
 * Walk a root directory of cluster directories and build a `PresetRegistry`.
 *
 * - Each immediate subdirectory of `rootPath` whose name matches a known
 *   cluster is loaded via `loadCluster`. Other subdirectories are ignored.
 * - Errors from individual files AGGREGATE: every parse / validate failure
 *   across all clusters is collected into a single `PresetRegistryLoadError`
 *   (AC #21). Fail-on-first would mask subsequent issues.
 * - The result is memoized by `rootPath` (AC #22). Tests / scripts that need
 *   to re-load can call `presetRegistry.reset()` first.
 */
export function loadAllPresets(rootPath: string): PresetRegistry {
  const cached = registryCache.get(rootPath);
  if (cached !== undefined) {
    return cached;
  }

  const issues: PresetRegistryLoadIssue[] = [];
  const registry = new PresetRegistry();

  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(rootPath, { withFileTypes: true });
  } catch (err) {
    // Surface the directory-level read failure as a single registry issue —
    // we still return an empty registry (callers can choose to continue).
    throw new PresetRegistryLoadError([
      { filePath: rootPath, error: err instanceof Error ? err : new Error(String(err)) },
    ]);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const clusterPath = join(rootPath, entry.name);
    const skillPath = join(clusterPath, 'SKILL.md');

    // Cluster skill: validate first; any failure aggregates into the registry
    // error rather than aborting the whole walk.
    let skill: ClusterSkill;
    try {
      skill = loadClusterSkill(skillPath);
    } catch (err) {
      issues.push({
        filePath: skillPath,
        error: toAggregatableError(err),
      });
      continue;
    }

    // Per-preset files: walk the directory; aggregate per-file failures.
    const fileEntries = readdirSync(clusterPath, { withFileTypes: true });
    const presets: Preset[] = [];
    for (const fileEntry of fileEntries) {
      if (!fileEntry.isFile()) continue;
      if (fileEntry.name === 'SKILL.md') continue;
      if (!fileEntry.name.endsWith('.md')) continue;
      const presetPath = join(clusterPath, fileEntry.name);
      try {
        presets.push(loadPreset(presetPath));
      } catch (err) {
        issues.push({ filePath: presetPath, error: toAggregatableError(err) });
      }
    }
    presets.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));

    registry.addCluster(skill.frontmatter.id.split('/').pop() as PresetCluster, {
      skill,
      presets,
    });
  }

  if (issues.length > 0) {
    throw new PresetRegistryLoadError(issues);
  }

  registry.freeze();
  registryCache.set(rootPath, registry);
  return registry;
}

/**
 * Test-only: clear the memoization cache. Production code should NOT call
 * this — `loadAllPresets` is a build-time / startup-time loader, not a
 * runtime cache.
 */
export function resetLoaderCache(): void {
  registryCache.clear();
}

// ---------- internals ----------

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

function parseFrontmatter(filePath: string, raw: string): ParsedFrontmatter {
  if (!raw.startsWith('---')) {
    throw new PresetParseError(
      filePath,
      new Error("file must start with '---' frontmatter delimiter"),
    );
  }
  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(raw);
  } catch (err) {
    throw new PresetParseError(filePath, err);
  }
  return {
    data: (parsed.data as Record<string, unknown>) ?? {},
    body: parsed.content,
  };
}

function validateOrThrow<T>(filePath: string, data: unknown, parser: (input: unknown) => T): T {
  try {
    return parser(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstField = err.issues[0]?.path[0];
      const field = typeof firstField === 'string' ? firstField : undefined;
      throw new PresetValidationError(filePath, err.issues, field);
    }
    throw err;
  }
}

function toAggregatableError(err: unknown): PresetValidationError | PresetParseError | Error {
  if (err instanceof PresetValidationError) return err;
  if (err instanceof PresetParseError) return err;
  if (err instanceof Error) return err;
  return new Error(String(err));
}
