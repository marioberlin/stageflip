// scripts/check-skill-drift.ts
// CI gate for invariant I-8 (CLAUDE.md §5): the skills tree is the source of
// truth and cannot drift from the conventions every SKILL.md declares.
//
// Four checks run on every push (T-014 + T-310):
//   1. link-integrity            — every cross-skill reference resolves.
//   2. tier-coverage             — every tier in SKILL_TIERS has ≥1 SKILL.md.
//   3. preset-cluster-coverage   — every cluster directory has a SKILL.md and
//                                  every preset's `cluster` field matches its
//                                  parent directory (T-310 AC #1–#4).
//   4. preset-id-coherence       — every preset's `id` matches its filename
//                                  and every cluster skill's `id` matches its
//                                  filesystem location (T-310 AC #5–#7).
//
// Generator-output diffing arrives with @stageflip/skills-sync (T-220), which
// will register itself here.
//
// Uses the source files of @stageflip/skills-core directly via a relative
// import so the gate does not require a prior build. tsx resolves .js imports
// against their .ts source. If @stageflip/skills-core ever gains build-time
// codegen (generated types, compiled Zod schemas, etc.), this direct import
// will miss them — at that point, switch to importing `@stageflip/skills-core`
// (the built package) and add a `pnpm --filter=@stageflip/skills-core build`
// step before invoking this script.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';

import {
  PresetRegistryLoadError,
  clusterSkillFrontmatterSchema,
  presetFrontmatterSchema,
} from '../packages/schema/src/presets/index.js';
import { loadAllPresets, resetLoaderCache } from '../packages/schema/src/presets/loader.js';
import { SKILL_TIERS, loadSkillTree, validateTree } from '../packages/skills-core/src/index.js';
import type { SkillTree } from '../packages/skills-core/src/index.js';

const SKILLS_ROOT_DEFAULT = 'skills/stageflip';
const PRESETS_ROOT_DEFAULT = 'skills/stageflip/presets';

// ---------- types ----------

export interface CheckResult {
  name: string;
  errors: string[];
  warnings: string[];
}

export interface PresetCoverageResult extends CheckResult {
  /** Number of cluster directories visited under presetsRoot. */
  scannedClusters: number;
  /** Number of preset `*.md` files (excluding `SKILL.md`) visited. */
  scannedPresets: number;
}

export interface DriftReport {
  results: CheckResult[];
  exitCode: 0 | 1;
}

// ---------- existing checks (T-014) ----------

function linkIntegrityCheck(tree: SkillTree): CheckResult {
  const issues = validateTree(tree);
  return {
    name: 'link-integrity',
    errors: issues.filter((i) => i.severity === 'error').map((i) => `${i.skillPath}: ${i.message}`),
    warnings: issues
      .filter((i) => i.severity === 'warn')
      .map((i) => `${i.skillPath}: ${i.message}`),
  };
}

export function tierCoverageCheck(tree: SkillTree, root: string): CheckResult {
  const errors: string[] = [];
  for (const tier of SKILL_TIERS) {
    if (!tree.byTier.has(tier) || (tree.byTier.get(tier) ?? []).length === 0) {
      errors.push(`${root}: tier "${tier}" has no SKILL.md files`);
    }
  }
  return { name: 'tier-coverage', errors, warnings: [] };
}

// ---------- T-310 — preset-cluster-coverage ----------

interface PresetCheckOpts {
  presetsRoot: string;
}

/**
 * Walks `presetsRoot/`, identifies cluster directories, verifies every
 * cluster has a `SKILL.md`, and verifies every preset's `cluster` frontmatter
 * field matches its parent directory.
 *
 * Aggregates: every violation surfaces in `errors`; we never abort early.
 *
 * Implementation note: we deliberately do NOT call `loadAllPresets` for this
 * check, because the loader's "missing SKILL.md" error mode is a thrown
 * `ENOENT` that aborts the cluster's preset walk. T-310 AC #2 + #3 require
 * that we report BOTH a missing cluster skill AND any preset-level mismatches
 * inside the same cluster in one pass. Direct directory-walk + per-file
 * gray-matter parse gives us the aggregating posture the AC demands.
 */
export function presetClusterCoverageCheck(opts: PresetCheckOpts): PresetCoverageResult {
  const errors: string[] = [];
  let scannedClusters = 0;
  let scannedPresets = 0;

  let dirEntries: import('node:fs').Dirent[];
  try {
    dirEntries = readdirSync(opts.presetsRoot, { withFileTypes: true });
  } catch (err) {
    return {
      name: 'preset-cluster-coverage',
      errors: [`${opts.presetsRoot}: cannot read presets root: ${String(err)}`],
      warnings: [],
      scannedClusters: 0,
      scannedPresets: 0,
    };
  }

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    scannedClusters += 1;
    const clusterDir = join(opts.presetsRoot, entry.name);
    const skillPath = join(clusterDir, 'SKILL.md');

    // AC #2 — every cluster must have a SKILL.md.
    let skillExists = true;
    try {
      statSync(skillPath);
    } catch {
      skillExists = false;
      errors.push(`${clusterDir}: missing SKILL.md (cluster '${entry.name}')`);
    }

    // AC #3 — every preset's frontmatter `cluster` must match its directory.
    let fileEntries: import('node:fs').Dirent[];
    try {
      fileEntries = readdirSync(clusterDir, { withFileTypes: true });
      /* v8 ignore start — defensive: parent walk just enumerated this entry
         as a directory; race-condition safety. */
    } catch (err) {
      errors.push(`${clusterDir}: cannot read cluster directory: ${String(err)}`);
      continue;
    }
    /* v8 ignore stop */
    for (const fileEntry of fileEntries) {
      if (!fileEntry.isFile()) continue;
      if (fileEntry.name === 'SKILL.md') continue;
      if (!fileEntry.name.endsWith('.md')) continue;
      scannedPresets += 1;
      const presetPath = join(clusterDir, fileEntry.name);
      const declared = readDeclaredCluster(presetPath);
      if (declared === undefined) {
        errors.push(`${presetPath}: missing or unparseable 'cluster' frontmatter field`);
        continue;
      }
      if (declared !== entry.name) {
        errors.push(
          `${presetPath}: frontmatter cluster '${declared}' does not match directory '${entry.name}'`,
        );
      }
    }

    // Helpful note when SKILL.md was missing: also encourage the user.
    void skillExists;
  }

  return {
    name: 'preset-cluster-coverage',
    errors,
    warnings: [],
    scannedClusters,
    scannedPresets,
  };
}

/**
 * Read the raw frontmatter `cluster` field from a preset file. Returns
 * `undefined` when the file cannot be parsed or the field is missing /
 * non-string. Used only by `presetClusterCoverageCheck`; the heavy
 * Zod-validated parse lives in the loader (and runs in
 * `presetIdCoherenceCheck`).
 */
function readDeclaredCluster(filePath: string): string | undefined {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
    /* v8 ignore start — defensive (race-condition safety). */
  } catch {
    return undefined;
  }
  /* v8 ignore stop */
  try {
    const parsed = matter(raw);
    const data = (parsed.data as Record<string, unknown>) ?? {};
    const cluster = data.cluster;
    return typeof cluster === 'string' ? cluster : undefined;
    /* v8 ignore start — defensive: gray-matter swallows yaml errors. */
  } catch {
    return undefined;
  }
  /* v8 ignore stop */
}

// ---------- T-310 — preset-id-coherence ----------

/**
 * Verifies every preset's frontmatter `id` matches its filename (sans `.md`)
 * and every cluster skill's `id` matches its filesystem location
 * (`skills/stageflip/presets/<cluster>`).
 *
 * Uses gray-matter + the schema's Zod parsers so we never depend on the
 * loader's aggregating error path (which throws on the first cluster-skill
 * failure and stops walking the rest). Per-file try/catch keeps us in
 * AC #10's aggregating posture.
 *
 * AC scope:
 *   - AC #5 — preset id ↔ filename (positive + negative).
 *   - AC #6 — cluster skill id ↔ directory location.
 *   - AC #7 — PASS at HEAD against real on-disk presets.
 */
export function presetIdCoherenceCheck(opts: PresetCheckOpts): CheckResult {
  const errors: string[] = [];

  let dirEntries: import('node:fs').Dirent[];
  try {
    dirEntries = readdirSync(opts.presetsRoot, { withFileTypes: true });
  } catch (err) {
    return {
      name: 'preset-id-coherence',
      errors: [`${opts.presetsRoot}: cannot read presets root: ${String(err)}`],
      warnings: [],
    };
  }

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    const clusterDir = join(opts.presetsRoot, entry.name);
    const skillPath = join(clusterDir, 'SKILL.md');

    // Cluster skill id ↔ directory location.
    const expectedClusterId = `skills/stageflip/presets/${entry.name}`;
    const skillId = readClusterSkillId(skillPath);
    if (skillId !== undefined && skillId !== expectedClusterId) {
      errors.push(
        `${skillPath}: cluster skill id '${skillId}' does not match expected '${expectedClusterId}'`,
      );
    }

    // Preset id ↔ filename.
    let fileEntries: import('node:fs').Dirent[];
    try {
      fileEntries = readdirSync(clusterDir, { withFileTypes: true });
      /* v8 ignore start — defensive: the parent directory walk just enumerated
         this entry as a directory; a race where it disappears between the two
         readdir calls would land here. */
    } catch {
      continue;
    }
    /* v8 ignore stop */
    for (const fileEntry of fileEntries) {
      if (!fileEntry.isFile()) continue;
      if (fileEntry.name === 'SKILL.md') continue;
      if (!fileEntry.name.endsWith('.md')) continue;
      const presetPath = join(clusterDir, fileEntry.name);
      const expectedId = fileEntry.name.slice(0, -'.md'.length);
      const presetId = readPresetId(presetPath);
      if (presetId === undefined) {
        // Cluster-coverage check already reports unparseable files; skip
        // here to avoid double-reporting.
        continue;
      }
      if (presetId !== expectedId) {
        errors.push(
          `${presetPath}: preset id '${presetId}' does not match filename '${expectedId}'`,
        );
      }
    }
  }

  return { name: 'preset-id-coherence', errors, warnings: [] };
}

function readPresetId(filePath: string): string | undefined {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
    /* v8 ignore start — defensive: caller already enumerated this file via
       readdir; race-condition safety. */
  } catch {
    return undefined;
  }
  /* v8 ignore stop */
  try {
    const parsed = matter(raw);
    const data = (parsed.data as Record<string, unknown>) ?? {};
    // Use the schema parser only to confirm the id is a valid kebab slug;
    // a parse failure means the file is malformed and another check will
    // surface it.
    const result = presetFrontmatterSchema.safeParse(data);
    if (result.success) return result.data.id;
    // Fall back to raw-string id when the rest of the schema is broken.
    return typeof data.id === 'string' ? data.id : undefined;
    /* v8 ignore start — defensive: gray-matter swallows YAML errors
       internally and returns `data: {}`; the catch is here so an upstream
       gray-matter behavior change can't crash the gate. */
  } catch {
    return undefined;
  }
  /* v8 ignore stop */
}

function readClusterSkillId(filePath: string): string | undefined {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
    /* v8 ignore start — defensive (see readPresetId). */
  } catch {
    return undefined;
  }
  /* v8 ignore stop */
  try {
    const parsed = matter(raw);
    const data = (parsed.data as Record<string, unknown>) ?? {};
    const result = clusterSkillFrontmatterSchema.safeParse(data);
    if (result.success) return result.data.id;
    return typeof data.id === 'string' ? data.id : undefined;
    /* v8 ignore start — defensive (see readPresetId). */
  } catch {
    return undefined;
  }
  /* v8 ignore stop */
}

// ---------- aggregator ----------

interface RunOpts {
  skillsRoot?: string;
  presetsRoot?: string;
  /** Base path used to relativize skill paths inside the loader. Defaults to cwd. */
  basePath?: string;
}

/**
 * Run every check + return a structured report. Aggregates: never aborts on
 * the first failure (AC #10).
 */
export async function runChecks(opts: RunOpts = {}): Promise<DriftReport> {
  const skillsRoot = opts.skillsRoot ?? SKILLS_ROOT_DEFAULT;
  const presetsRoot = opts.presetsRoot ?? PRESETS_ROOT_DEFAULT;

  const results: CheckResult[] = [];

  // T-014 — load skill tree once for both link-integrity + tier-coverage.
  let tree: SkillTree | undefined;
  try {
    tree = await loadSkillTree(
      skillsRoot,
      opts.basePath !== undefined ? { basePath: opts.basePath } : {},
    );
  } catch (err) {
    results.push({
      name: 'link-integrity',
      errors: [`failed to load skills tree at ${skillsRoot}: ${String(err)}`],
      warnings: [],
    });
    results.push({
      name: 'tier-coverage',
      errors: [`failed to load skills tree at ${skillsRoot}: ${String(err)}`],
      warnings: [],
    });
  }
  if (tree !== undefined) {
    results.push(linkIntegrityCheck(tree));
    results.push(tierCoverageCheck(tree, skillsRoot));
  }

  // T-310 — preset-tree drift checks. Each is self-contained.
  results.push(presetClusterCoverageCheck({ presetsRoot }));
  results.push(presetIdCoherenceCheck({ presetsRoot }));

  // Pre-warm the loader cache to surface any aggregated parse failures the
  // gate hasn't already caught. Loader errors are advisory at this layer
  // (check-preset-integrity owns the hard gate); we surface them as warnings
  // on the link-integrity bucket so the report stays single-pane.
  resetLoaderCache();
  try {
    loadAllPresets(presetsRoot);
  } catch (err) {
    if (err instanceof PresetRegistryLoadError) {
      const link = results.find((r) => r.name === 'link-integrity');
      if (link !== undefined) {
        for (const issue of err.issues) {
          link.warnings.push(`preset loader: ${issue.filePath}: ${issue.error.message}`);
        }
      }
    }
    // Other errors (e.g., presetsRoot missing) are already reported by the
    // direct-walk checks above; suppress here to avoid double-reporting.
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  return { results, exitCode: totalErrors > 0 ? 1 : 0 };
}

// ---------- formatting ----------

export function formatReport(report: DriftReport): { stdout: string; stderr: string } {
  let stdout = '';
  let stderr = '';
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const r of report.results) {
    if (r.errors.length === 0 && r.warnings.length === 0) {
      stdout += `check-skill-drift [${r.name}]: PASS`;
      // Annotate the preset-cluster-coverage line with scan counts (AC parity
      // with the spec's example output).
      const scanned = (r as Partial<PresetCoverageResult>).scannedClusters;
      if (
        r.name === 'preset-cluster-coverage' &&
        scanned !== undefined &&
        (r as PresetCoverageResult).scannedPresets !== undefined
      ) {
        const cov = r as PresetCoverageResult;
        stdout += ` (${cov.scannedClusters} clusters, ${cov.scannedPresets} presets)`;
      }
      stdout += '\n';
      continue;
    }
    stdout += `check-skill-drift [${r.name}]: ${r.errors.length} error(s), ${r.warnings.length} warning(s)\n`;
    for (const e of r.errors) stderr += `  ERROR: ${e}\n`;
    for (const w of r.warnings) stderr += `  warn:  ${w}\n`;
    totalErrors += r.errors.length;
    totalWarnings += r.warnings.length;
  }

  if (totalErrors > 0) {
    stderr += `\ncheck-skill-drift: FAIL (${totalErrors} error${totalErrors === 1 ? '' : 's'})\n`;
  } else if (totalWarnings > 0) {
    stdout += `\ncheck-skill-drift: PASS with ${totalWarnings} warnings\n`;
  } else {
    stdout += '\ncheck-skill-drift: PASS\n';
  }
  return { stdout, stderr };
}

// ---------- CLI entry ----------

/* v8 ignore start */
async function main(): Promise<void> {
  const report = await runChecks();
  const { stdout, stderr } = formatReport(report);
  if (stdout.length > 0) process.stdout.write(stdout);
  if (stderr.length > 0) process.stderr.write(stderr);
  process.exit(report.exitCode);
}

// CLI guard — only run main when invoked directly. Lets tests import the
// module without triggering process.exit. Mirrors check-preset-integrity.ts.
const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'check-skill-drift.ts')
) {
  main().catch((err: unknown) => {
    process.stderr.write(`check-skill-drift: crashed: ${String(err)}\n`);
    if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
    process.exit(2);
  });
}
/* v8 ignore stop */
