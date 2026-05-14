// scripts/generate-cluster-skill.ts
// T-315 — per-cluster SKILL.md generator. Sibling to T-314's preset generator.
// Two modes:
//   1. create  — emit a stub SKILL.md for a cluster directory from a template.
//   2. refresh — regenerate only the `## Presets` bulleted list inside an
//                existing SKILL.md (alphabetical; preserves human-written
//                descriptions to the right of the `—` separator).
//
// CLI:
//   pnpm -w run generate-cluster-skill \
//     --cluster=<name>              (required — one of PRESET_CLUSTERS)
//     [--letter=<A..I>]             (optional — auto-derived from cluster)
//     [--title="<display title>"]   (required in create mode)
//     [--owner-task=<T-XXX>]        (required in create mode)
//     [--out=<path>]                (default: skills/stageflip/presets/<cluster>/SKILL.md)
//     [--force]                     (overwrite existing target in create mode)
//     [--refresh-presets-list]      (mode switch — refresh existing file's
//                                    Presets section only)
//
// Determinism: scripts/** is OUT of CLAUDE.md §3 scope.

import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';

import {
  type ClusterSkillFrontmatter,
  PRESET_CLUSTERS,
  type PresetCluster,
  clusterSkillFrontmatterSchema,
} from '../packages/schema/src/presets/frontmatter.js';
import { writeFileAtomic } from './generate-preset-from-compass.js';

// ---------- constants ----------

/** Default presets root — workspace-relative. Mirrors T-314. */
export const PRESETS_ROOT_DEFAULT = 'skills/stageflip/presets';

/** Cluster letter map — mirrors scripts/check-cluster-eligibility.ts. */
export const CLUSTER_LETTER_BY_NAME: Record<PresetCluster, string> = {
  news: 'A',
  sports: 'B',
  weather: 'C',
  titles: 'D',
  data: 'E',
  captions: 'F',
  ctas: 'G',
  ar: 'H',
  audience: 'I',
};

const VALID_LETTERS: ReadonlySet<string> = new Set(Object.values(CLUSTER_LETTER_BY_NAME));

// ---------- helpers ----------

/** Today as YYYY-MM-DD. determinism-safe: scripts/** is outside the gated scope. */
function todayIso(now: Date = new Date()): string {
  // determinism-safe: scripts/** is outside the determinism-gated scope.
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * List preset files (alphabetical, basenames without .md) under a cluster dir.
 * Excludes SKILL.md. Returns an empty array if the dir has no matching files.
 */
export function listPresetIds(clusterDir: string): string[] {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(clusterDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const ids: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name === 'SKILL.md') continue;
    if (!entry.name.endsWith('.md')) continue;
    ids.push(entry.name.slice(0, -'.md'.length));
  }
  ids.sort((a, b) => a.localeCompare(b));
  return ids;
}

// ---------- frontmatter ----------

export interface BuildFrontmatterArgs {
  cluster: PresetCluster;
  letter: string;
  title: string;
  ownerTask: string;
  lastUpdated: string;
}

export function buildClusterFrontmatter(args: BuildFrontmatterArgs): ClusterSkillFrontmatter {
  return {
    title: `Cluster ${args.letter} — ${args.title}`,
    id: `skills/stageflip/presets/${args.cluster}`,
    tier: 'cluster',
    status: 'stub',
    last_updated: args.lastUpdated,
    owner_task: args.ownerTask,
    related: [
      'skills/stageflip/agents/type-design-consultant/SKILL.md',
      'skills/stageflip/clips/catalog/SKILL.md',
    ],
  };
}

/** Thrown when generated frontmatter fails Zod validation. */
export class FrontmatterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrontmatterValidationError';
  }
}

// ---------- markdown synthesis (create mode) ----------

export interface BuildClusterMarkdownArgs extends BuildFrontmatterArgs {
  presetIds: readonly string[];
}

const PRESETS_HEADING = '## Presets';

const EMPTY_PRESETS_PLACEHOLDER =
  '_(no presets yet — populate `<cluster>/<id>.md` files and re-run with `--refresh-presets-list`)_';

/**
 * Build the on-disk markdown for a stub cluster SKILL.md. Throws
 * FrontmatterValidationError if generated frontmatter fails schema validation.
 */
export function buildClusterMarkdown(args: BuildClusterMarkdownArgs): string {
  const fm = buildClusterFrontmatter(args);
  const parsed = clusterSkillFrontmatterSchema.safeParse(fm);
  if (!parsed.success) {
    throw new FrontmatterValidationError(parsed.error.issues.map((i) => i.message).join('; '));
  }

  const headerComment = `<!-- skills/stageflip/presets/${args.cluster}/SKILL.md - Cluster ${args.letter} skill — generated stub via T-315 tooling. -->`;
  const presetsList =
    args.presetIds.length === 0
      ? EMPTY_PRESETS_PLACEHOLDER
      : args.presetIds
          .map((id) => `- [\`${id}\`](${id}.md) — TODO: one-line description`)
          .join('\n');

  const body = [
    headerComment,
    '',
    `# Cluster ${args.letter} — ${args.title}`,
    '',
    '> TODO: one-paragraph cluster intent.',
    '',
    '## When to invoke',
    '',
    '> TODO: bulleted list of trigger phrases.',
    '',
    PRESETS_HEADING,
    '',
    presetsList,
    '',
    '## Do not invoke for',
    '',
    '> TODO: cross-cluster guidance.',
    '',
    '## Compose tools',
    '',
    '> TODO: list compose_<verb>_* handler-bundle tools, if any.',
    '',
    '## References',
    '',
    '> TODO: ADR / compass anchors.',
    '',
  ].join('\n');

  return matter.stringify(body, fm, { lineWidth: -1 } as never);
}

// ---------- refresh-mode: presets-list regeneration ----------

interface ExistingBullet {
  id: string;
  description: string | undefined;
}

/**
 * Parse an existing bullet line of the form
 *   `- [\`<id>\`](<id>.md) — <description>`
 * Returns undefined on no match. Accepts both em-dash (canonical) and hyphen
 * as the description separator.
 */
export function parsePresetBullet(line: string): ExistingBullet | undefined {
  const re = /^- \[`([a-z0-9][a-z0-9-]*)`\]\(([^)]+)\)(?:\s*[—-]\s*(.*))?$/;
  const m = re.exec(line.trim());
  if (m === null) return undefined;
  const id = m[1];
  const href = m[2];
  if (id === undefined || href === undefined) return undefined;
  if (href !== `${id}.md`) return undefined;
  const description = m[3];
  return {
    id,
    description:
      description === undefined || description.trim().length === 0 ? undefined : description.trim(),
  };
}

/**
 * Regenerate the `## Presets` bullet list. Walks `existingSectionLines` for
 * descriptions to preserve; new ids get the TODO placeholder. Output preserves
 * alphabetical order from `presetIds`.
 */
export function regeneratePresetsSection(
  existingSectionLines: readonly string[],
  presetIds: readonly string[],
): string[] {
  const existingByName = new Map<string, string>();
  for (const line of existingSectionLines) {
    const parsed = parsePresetBullet(line);
    if (parsed && parsed.description !== undefined) {
      existingByName.set(parsed.id, parsed.description);
    }
  }

  if (presetIds.length === 0) {
    return [EMPTY_PRESETS_PLACEHOLDER];
  }
  return presetIds.map((id) => {
    const desc = existingByName.get(id) ?? 'TODO: one-line description';
    return `- [\`${id}\`](${id}.md) — ${desc}`;
  });
}

/**
 * Rewrite the `## Presets` section in `fullContent`, preserving all other
 * sections byte-for-byte. The section is delimited by the heading `## Presets`
 * and the next ATX heading (any level), or EOF.
 *
 * Trailing prose between the bullet block and the next heading is preserved.
 * Throws Error when the heading is missing — refresh-mode requires it.
 */
export function rewritePresetsSection(fullContent: string, presetIds: readonly string[]): string {
  const lines = fullContent.split('\n');
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.trim() === PRESETS_HEADING) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) {
    throw new Error(`SKILL.md is missing the '${PRESETS_HEADING}' heading; cannot refresh`);
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^#{1,6}\s+/.test(line.trim())) {
      endIdx = i;
      break;
    }
  }

  const body = lines.slice(startIdx + 1, endIdx);

  // Trim leading + trailing blank lines from body to isolate the bullet block.
  let bodyStart = 0;
  while (bodyStart < body.length && (body[bodyStart] ?? '').trim() === '') bodyStart += 1;
  let bodyEnd = body.length;
  while (bodyEnd > bodyStart && (body[bodyEnd - 1] ?? '').trim() === '') bodyEnd -= 1;

  // Find the contiguous bullet block at bodyStart. Bullets MAY be followed by
  // free prose; preserve that prose verbatim.
  let bulletBlockEnd = bodyStart;
  while (bulletBlockEnd < bodyEnd) {
    const line = (body[bulletBlockEnd] ?? '').trim();
    if (parsePresetBullet(line) === undefined && line !== EMPTY_PRESETS_PLACEHOLDER) {
      break;
    }
    bulletBlockEnd += 1;
  }
  const existingBullets = body.slice(bodyStart, bulletBlockEnd);
  const trailingProse = body.slice(bulletBlockEnd, bodyEnd);

  const newBullets = regeneratePresetsSection(existingBullets, presetIds);

  const newSectionLines: string[] = [PRESETS_HEADING, '', ...newBullets];
  if (trailingProse.length > 0) {
    newSectionLines.push('', ...trailingProse);
  }
  newSectionLines.push('');

  // Avoid double-blank against whatever followed in the original.
  while (
    newSectionLines.length > 0 &&
    newSectionLines[newSectionLines.length - 1] === '' &&
    endIdx < lines.length &&
    (lines[endIdx] ?? '').trim() === ''
  ) {
    newSectionLines.pop();
  }

  const out = [...lines.slice(0, startIdx), ...newSectionLines, ...lines.slice(endIdx)];
  return out.join('\n');
}

// ---------- CLI ----------

export interface CliArgs {
  cluster: PresetCluster | undefined;
  letter: string | undefined;
  title: string | undefined;
  ownerTask: string | undefined;
  out: string | undefined;
  force: boolean;
  refreshPresetsList: boolean;
  help: boolean;
}

const DEFAULT_CLI_ARGS: CliArgs = {
  cluster: undefined,
  letter: undefined,
  title: undefined,
  ownerTask: undefined,
  out: undefined,
  force: false,
  refreshPresetsList: false,
  help: false,
};

export function parseArgs(argv: readonly string[]): { args: CliArgs; errors: string[] } {
  const args: CliArgs = { ...DEFAULT_CLI_ARGS };
  const errors: string[] = [];

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }
    if (raw === '--force') {
      args.force = true;
      continue;
    }
    if (raw === '--refresh-presets-list') {
      args.refreshPresetsList = true;
      continue;
    }
    const eq = raw.indexOf('=');
    if (!raw.startsWith('--') || eq < 0) {
      errors.push(`unrecognised argument '${raw}'`);
      continue;
    }
    const key = raw.slice(2, eq);
    const value = raw.slice(eq + 1);
    switch (key) {
      case 'cluster': {
        if ((PRESET_CLUSTERS as readonly string[]).includes(value)) {
          args.cluster = value as PresetCluster;
        } else {
          errors.push(`--cluster must be one of ${PRESET_CLUSTERS.join('|')} (got '${value}')`);
        }
        break;
      }
      case 'letter': {
        const upper = value.toUpperCase();
        if (VALID_LETTERS.has(upper)) {
          args.letter = upper;
        } else {
          errors.push(
            `--letter must be one of ${[...VALID_LETTERS].sort().join('|')} (got '${value}')`,
          );
        }
        break;
      }
      case 'title':
        args.title = value;
        break;
      case 'owner-task':
        args.ownerTask = value;
        break;
      case 'out':
        args.out = value;
        break;
      default:
        errors.push(`unknown flag '--${key}'`);
    }
  }

  return { args, errors };
}

export function usage(): string {
  return [
    'Usage: pnpm -w run generate-cluster-skill \\',
    `         --cluster=<name>          (required — one of: ${PRESET_CLUSTERS.join('|')})`,
    '         [--letter=<A..I>]         (optional — auto-derived from cluster)',
    '         [--title="<display>"]     (required in create mode)',
    '         [--owner-task=<T-XXX>]    (required in create mode)',
    '         [--out=<path>]            (default: skills/stageflip/presets/<cluster>/SKILL.md)',
    '         [--force]                 (overwrite existing target in create mode)',
    '         [--refresh-presets-list]  (refresh existing file’s Presets section only)',
  ].join('\n');
}

export interface RunResult {
  exitCode: 0 | 1 | 2;
  stdout: string[];
  stderr: string[];
  written: string[];
}

/**
 * Pure orchestration. Errors return non-zero; never throws on a known-error
 * path. Injectable `now` lets tests pin `last_updated`.
 */
export async function runGenerate(
  argv: readonly string[],
  opts: { now?: Date } = {},
): Promise<RunResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const written: string[] = [];

  const { args, errors } = parseArgs(argv);

  if (args.help) {
    stdout.push(usage());
    return { exitCode: 0, stdout, stderr, written };
  }

  if (errors.length > 0) {
    for (const e of errors) stderr.push(e);
    stderr.push(usage());
    return { exitCode: 2, stdout, stderr, written };
  }

  if (args.cluster === undefined) {
    stderr.push('missing required flag(s): --cluster');
    stderr.push(usage());
    return { exitCode: 1, stdout, stderr, written };
  }
  const cluster = args.cluster;
  const letter = args.letter ?? CLUSTER_LETTER_BY_NAME[cluster];

  const outRel = args.out ?? `${PRESETS_ROOT_DEFAULT}/${cluster}/SKILL.md`;
  const outAbs = resolve(outRel);
  const clusterDir = dirname(outAbs);

  // ---------- refresh-presets-list mode ----------
  if (args.refreshPresetsList) {
    if (!existsSync(outAbs)) {
      stderr.push(`refresh mode requires an existing SKILL.md at: ${outAbs}`);
      return { exitCode: 1, stdout, stderr, written };
    }
    let original: string;
    try {
      original = readFileSync(outAbs, 'utf8');
    } catch (err) {
      stderr.push(`cannot read ${outAbs}: ${err instanceof Error ? err.message : String(err)}`);
      return { exitCode: 1, stdout, stderr, written };
    }
    const presetIds = listPresetIds(clusterDir);
    let updated: string;
    try {
      updated = rewritePresetsSection(original, presetIds);
    } catch (err) {
      stderr.push(err instanceof Error ? err.message : String(err));
      return { exitCode: 1, stdout, stderr, written };
    }
    if (updated === original) {
      stdout.push(`no changes: ${outAbs}`);
      return { exitCode: 0, stdout, stderr, written };
    }
    try {
      writeFileAtomic(outAbs, updated);
    } catch (err) {
      stderr.push(`write failed: ${err instanceof Error ? err.message : String(err)}`);
      return { exitCode: 1, stdout, stderr, written };
    }
    written.push(outAbs);
    stdout.push(`refreshed presets list: ${outAbs}`);
    return { exitCode: 0, stdout, stderr, written };
  }

  // ---------- create mode ----------
  const missing: string[] = [];
  if (args.title === undefined) missing.push('--title');
  if (args.ownerTask === undefined) missing.push('--owner-task');
  if (missing.length > 0) {
    stderr.push(`missing required flag(s): ${missing.join(', ')}`);
    stderr.push(usage());
    return { exitCode: 1, stdout, stderr, written };
  }

  if (existsSync(outAbs) && !args.force) {
    stderr.push(`file exists: ${outAbs} (pass --force to overwrite)`);
    return { exitCode: 1, stdout, stderr, written };
  }

  const presetIds = listPresetIds(clusterDir);

  let markdown: string;
  try {
    markdown = buildClusterMarkdown({
      cluster,
      letter,
      title: args.title as string,
      ownerTask: args.ownerTask as string,
      lastUpdated: todayIso(opts.now),
      presetIds,
    });
  } catch (err) {
    if (err instanceof FrontmatterValidationError) {
      stderr.push(`frontmatter validation failed: ${err.message}`);
      return { exitCode: 1, stdout, stderr, written };
    }
    stderr.push(err instanceof Error ? err.message : String(err));
    return { exitCode: 1, stdout, stderr, written };
  }

  mkdirSync(clusterDir, { recursive: true });

  try {
    writeFileAtomic(outAbs, markdown);
  } catch (err) {
    stderr.push(`write failed: ${err instanceof Error ? err.message : String(err)}`);
    return { exitCode: 1, stdout, stderr, written };
  }
  written.push(outAbs);
  stdout.push(`wrote ${outAbs}`);

  return { exitCode: 0, stdout, stderr, written };
}

/* v8 ignore start */
function main(): Promise<void> {
  const argv = process.argv.slice(2);
  return runGenerate(argv).then((result) => {
    for (const line of result.stdout) process.stdout.write(`${line}\n`);
    for (const line of result.stderr) process.stderr.write(`${line}\n`);
    process.exit(result.exitCode);
  });
}

const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'generate-cluster-skill.ts')
) {
  main().catch((err) => {
    process.stderr.write(
      `generate-cluster-skill: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exit(2);
  });
}
/* v8 ignore stop */
