// scripts/invoke-type-design-consultant.ts
// Orchestrator-side tooling for invoking the type-design-consultant agent
// (see skills/stageflip/agents/type-design-consultant/SKILL.md). This script
// does NOT call any LLM — it assembles the agent's inputs (cluster preset
// manifest + license-cleared font registry + compass file pointer), writes a
// review-document skeleton, and prints next-step instructions.
//
// Per ADR-004 §D4 the type-design-consultant operates as a per-cluster batch
// review for clusters A (news), B (sports), D (titles), F (captions), G (CTAs).
// Clusters C (weather), E (data), H (AR) are exempt — invoking them errors.
//
// Re-trigger guard (T-311 AC #3): if the review file already exists, the
// caller must pass `--reason=<text>` to overwrite. The reason is captured at
// the top of the regenerated skeleton.
//
// Manifest stability (AC #7, #8): per-preset entries are sorted by id so the
// output is byte-stable across runs. No timestamps in the manifest itself —
// the `reviewedAt` frontmatter date is the only date-bearing field, and it's
// pulled from a caller-supplied option (defaults to today's UTC date).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type Preset,
  loadAllPresets,
  resetLoaderCache,
} from '../packages/schema/src/presets/loader.js';
import type { PresetCluster } from '../packages/schema/src/presets/frontmatter.js';

// ---------- cluster mapping ----------

/** Cluster letters that REQUIRE batch review per ADR-004 §D4. */
export const REVIEWABLE_CLUSTER_LETTERS = ['A', 'B', 'D', 'F', 'G'] as const;
export type ReviewableClusterLetter = (typeof REVIEWABLE_CLUSTER_LETTERS)[number];

/** Cluster letters that are EXEMPT from batch review per ADR-004 §D4. */
export const EXEMPT_CLUSTER_LETTERS = ['C', 'E', 'H'] as const;
export type ExemptClusterLetter = (typeof EXEMPT_CLUSTER_LETTERS)[number];

export type ClusterLetter = ReviewableClusterLetter | ExemptClusterLetter;

const LETTER_TO_NAME: Record<ClusterLetter, PresetCluster> = {
  A: 'news',
  B: 'sports',
  C: 'weather',
  D: 'titles',
  E: 'data',
  F: 'captions',
  G: 'ctas',
  H: 'ar',
};

const NAME_TO_LETTER: Record<PresetCluster, ClusterLetter> = {
  news: 'A',
  sports: 'B',
  weather: 'C',
  titles: 'D',
  data: 'E',
  captions: 'F',
  ctas: 'G',
  ar: 'H',
};

/** All known cluster identifiers, used for error-message enumeration. */
export const ALL_CLUSTER_IDENTIFIERS: readonly string[] = [
  ...(Object.keys(LETTER_TO_NAME) as ClusterLetter[]),
  ...(Object.keys(NAME_TO_LETTER) as PresetCluster[]),
];

/**
 * Resolve a caller-provided cluster identifier (letter, lowercase name, or
 * mixed-case name) to a canonical `{ letter, name }` pair. Returns
 * `{ kind: 'unknown' }` for unrecognised inputs. Distinguishes EXEMPT from
 * REVIEWABLE so the caller can produce the right error message.
 */
export function resolveCluster(
  input: string,
):
  | { kind: 'reviewable'; letter: ReviewableClusterLetter; name: PresetCluster }
  | { kind: 'exempt'; letter: ExemptClusterLetter; name: PresetCluster }
  | { kind: 'unknown' } {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { kind: 'unknown' };

  // Single-letter form (case-insensitive).
  if (trimmed.length === 1) {
    const upper = trimmed.toUpperCase();
    if (isReviewableLetter(upper)) {
      return { kind: 'reviewable', letter: upper, name: LETTER_TO_NAME[upper] };
    }
    if (isExemptLetter(upper)) {
      return { kind: 'exempt', letter: upper, name: LETTER_TO_NAME[upper] };
    }
    return { kind: 'unknown' };
  }

  // Cluster-name form (case-insensitive).
  const lower = trimmed.toLowerCase();
  if (isPresetClusterName(lower)) {
    const letter = NAME_TO_LETTER[lower];
    if (isReviewableLetter(letter)) {
      return { kind: 'reviewable', letter, name: lower };
    }
    return { kind: 'exempt', letter: letter as ExemptClusterLetter, name: lower };
  }

  return { kind: 'unknown' };
}

function isReviewableLetter(s: string): s is ReviewableClusterLetter {
  return (REVIEWABLE_CLUSTER_LETTERS as readonly string[]).includes(s);
}

function isExemptLetter(s: string): s is ExemptClusterLetter {
  return (EXEMPT_CLUSTER_LETTERS as readonly string[]).includes(s);
}

function isPresetClusterName(s: string): s is PresetCluster {
  return s in NAME_TO_LETTER;
}

// ---------- manifest assembly ----------

/** A single preset's contribution to the consultant's input manifest. */
export interface ManifestEntry {
  /** Preset id (kebab-slug). */
  readonly id: string;
  /** Preferred font block from the preset frontmatter. */
  readonly preferredFont: { readonly family: string; readonly license: string };
  /** Fallback font block, if declared. */
  readonly fallbackFont:
    | { readonly family: string; readonly weight: number; readonly license: string }
    | undefined;
  /** `source` field — typically `docs/compass_artifact.md#<anchor>`. */
  readonly source: string;
  /** Status atom from the preset frontmatter. */
  readonly status: 'stub' | 'substantive';
}

/** Default presets root — workspace-relative, matches `check-preset-integrity`. */
export const PRESETS_ROOT_DEFAULT = 'skills/stageflip/presets';

/**
 * Build the consultant's preset-manifest input for a cluster. Sorts by id so
 * the manifest is byte-stable across runs (AC #7, #8). Empty clusters return
 * an empty array without erroring (AC #9).
 *
 * Accepts cluster identifiers that resolve via {@link resolveCluster} —
 * letter, name, or mixed-case name. Throws when the identifier is exempt or
 * unknown.
 */
export function getClusterPresetManifest(
  clusterIdentifier: string,
  opts: { presetsRoot?: string } = {},
): ManifestEntry[] {
  const resolved = resolveCluster(clusterIdentifier);
  if (resolved.kind === 'unknown') {
    throw new Error(
      `unknown cluster '${clusterIdentifier}'. Known: ${ALL_CLUSTER_IDENTIFIERS.join(', ')}`,
    );
  }
  if (resolved.kind === 'exempt') {
    throw new Error(
      `cluster ${resolved.letter} (${resolved.name}) does not require batch type-design review per ADR-004 §D4`,
    );
  }

  const presetsRoot = opts.presetsRoot ?? PRESETS_ROOT_DEFAULT;
  resetLoaderCache();
  const registry = loadAllPresets(presetsRoot);
  const presets = registry.list(resolved.name);
  return [...presets]
    .sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id))
    .map(toManifestEntry);
}

function toManifestEntry(preset: Preset): ManifestEntry {
  const fm = preset.frontmatter;
  return {
    id: fm.id,
    preferredFont: {
      family: fm.preferredFont.family,
      license: fm.preferredFont.license,
    },
    fallbackFont:
      fm.fallbackFont !== undefined
        ? {
            family: fm.fallbackFont.family,
            weight: fm.fallbackFont.weight,
            license: fm.fallbackFont.license,
          }
        : undefined,
    source: fm.source,
    status: fm.status,
  };
}

/**
 * Render a {@link ManifestEntry} array as the YAML the consultant prompt
 * embeds. Format-stable across runs: 2-space indent, alphabetical-by-id order
 * is the caller's responsibility (the manifest builder already sorts), no
 * timestamps.
 */
export function renderManifestYaml(entries: readonly ManifestEntry[]): string {
  const lines: string[] = [];
  for (const e of entries) {
    lines.push(`- id: ${e.id}`);
    lines.push(
      `  preferredFont: { family: '${escapeSingleQuoted(e.preferredFont.family)}', license: '${escapeSingleQuoted(e.preferredFont.license)}' }`,
    );
    if (e.fallbackFont !== undefined) {
      lines.push(
        `  fallbackFont: { family: '${escapeSingleQuoted(e.fallbackFont.family)}', weight: ${e.fallbackFont.weight}, license: '${escapeSingleQuoted(e.fallbackFont.license)}' }`,
      );
    } else {
      lines.push('  fallbackFont: ~');
    }
    lines.push(`  source: ${e.source}`);
    lines.push(`  status: ${e.status}`);
  }
  return lines.join('\n');
}

function escapeSingleQuoted(s: string): string {
  return s.replace(/'/g, "''");
}

// ---------- compass loading ----------

/** Default compass file path. Per the agent SKILL.md (authoritative for T-311). */
export const COMPASS_PATH_DEFAULT = 'docs/compass_artifact.md';

/**
 * Load the compass-file body if present. Returns `undefined` (with a stable
 * warning string surfaced to the caller) when missing — the script tolerates
 * a missing compass file because the canonical path is still under churn
 * across the spec docs.
 */
export function loadCompassBody(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

// ---------- prompt + skeleton assembly ----------

export interface AssembledPrompt {
  /** Cluster letter, e.g. 'A'. */
  letter: ReviewableClusterLetter;
  /** Cluster name, e.g. 'news'. */
  name: PresetCluster;
  /** Manifest YAML block. */
  manifestYaml: string;
  /** Markdown of the prompt (for `--write-prompt`). */
  text: string;
  /** Compass present? (For diagnostics only.) */
  compassPresent: boolean;
}

/**
 * Assemble the consultant prompt. Pure — no I/O beyond the read of the
 * compass file via `compassBody`. Used by both the `--write-prompt` path and
 * the skeleton (the skeleton embeds the manifest block).
 */
export function assemblePrompt(args: {
  letter: ReviewableClusterLetter;
  name: PresetCluster;
  manifest: readonly ManifestEntry[];
  compassPath: string;
  compassBody: string | undefined;
}): AssembledPrompt {
  const manifestYaml = renderManifestYaml(args.manifest);
  const compassPresent = args.compassBody !== undefined;
  const compassNote = compassPresent
    ? `Compass source: ${args.compassPath} (located).`
    : `Compass source: ${args.compassPath} (NOT FOUND — operator must provide the relevant section to the consultant manually).`;

  const text = [
    `# Type-design consultant — Cluster ${args.letter} (${args.name})`,
    '',
    'You are the type-design consultant per skills/stageflip/agents/type-design-consultant/SKILL.md.',
    `Review the fallback-font choices for cluster ${args.letter} (${args.name}) as a single batch.`,
    '',
    '## Inputs',
    '',
    '### 1. Preset manifest',
    '',
    '```yaml',
    manifestYaml,
    '```',
    '',
    '### 2. License-cleared font registry',
    '',
    'See `packages/schema/src/presets/font-registry.ts` and the cluster-wide whitelist',
    'in ADR-001 §D4. Recommendations MUST come from the whitelist.',
    '',
    '### 3. Compass source',
    '',
    compassNote,
    '',
    '## Required outputs',
    '',
    'Produce a markdown document at `reviews/type-design-consultant-cluster-' +
      args.letter +
      '.md` with the structure documented in the agent SKILL.md §"Outputs".',
    '',
    'Do not silently ship a weak fallback. Escalate per CLAUDE.md §6 when no candidate meets the quality thresholds.',
    '',
  ].join('\n');

  return {
    letter: args.letter,
    name: args.name,
    manifestYaml,
    text,
    compassPresent,
  };
}

/**
 * Build the per-cluster skeleton review document. Pure markdown — no I/O.
 * Stable across runs given identical (manifest, reviewedAt, reason) input.
 */
export function buildSkeleton(args: {
  letter: ReviewableClusterLetter;
  name: PresetCluster;
  manifest: readonly ManifestEntry[];
  reviewedAt: string;
  reason: string | undefined;
}): string {
  const ids = args.manifest.map((m) => m.id);
  const idsYaml = ids.length === 0 ? '[]' : `[${ids.join(', ')}]`;

  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: Type-design consultant — Cluster ${args.letter} (${args.name})`);
  lines.push(`id: reviews/type-design-consultant-cluster-${args.letter}`);
  lines.push(`reviewedAt: ${args.reviewedAt}`);
  lines.push(`clusterPresets: ${idsYaml}`);
  lines.push('signedOff: false');
  lines.push('---');
  lines.push('');
  lines.push(`# Cluster ${args.letter} — ${args.name} — Fallback review`);
  lines.push('');
  if (args.reason !== undefined) {
    lines.push('## Re-review reason');
    lines.push('');
    lines.push(args.reason);
    lines.push('');
  }
  lines.push('## Cluster context');
  lines.push('');
  lines.push(
    `_Auto-populate from skills/stageflip/presets/${args.name}/SKILL.md when the consultant fills this in._`,
  );
  lines.push('');
  lines.push('## Per-preset reviews');
  lines.push('');

  if (args.manifest.length === 0) {
    lines.push('_No presets in this cluster._');
    lines.push('');
  } else {
    for (const entry of args.manifest) {
      lines.push(`### ${entry.id}`);
      lines.push('');
      lines.push(`**Bespoke**: ${entry.preferredFont.family} (${entry.preferredFont.license})`);
      const fb =
        entry.fallbackFont !== undefined
          ? `${entry.fallbackFont.family} (weight ${entry.fallbackFont.weight}, ${entry.fallbackFont.license})`
          : 'none';
      lines.push(`**Current fallback**: ${fb}`);
      lines.push('');
      lines.push('#### Three ranked candidates');
      lines.push('1. _TBD by consultant_');
      lines.push('2. _TBD by consultant_');
      lines.push('3. _TBD by consultant_');
      lines.push('');
      lines.push('#### Kerning / x-height / weight deltas');
      lines.push('_TBD by consultant_');
      lines.push('');
      lines.push('#### Rationale');
      lines.push('_TBD by consultant_');
      lines.push('');
      lines.push('#### Reference-frame recommendation');
      lines.push('_TBD by consultant_');
      lines.push('');
      lines.push('#### Final recommendation');
      lines.push('_TBD by consultant_');
      lines.push('');
    }
  }

  lines.push('## Cross-preset coherence');
  lines.push('');
  lines.push('_TBD by consultant_');
  lines.push('');
  lines.push('## Escalations');
  lines.push('');
  lines.push('_TBD by consultant_');
  lines.push('');

  return lines.join('\n');
}

// ---------- CLI ----------

/** Parsed CLI flags. */
export interface CliArgs {
  cluster: string | undefined;
  reason: string | undefined;
  writePrompt: boolean;
  writeReviewSkeleton: boolean;
  reviewedAt: string | undefined;
  presetsRoot: string;
  reviewsRoot: string;
  compassPath: string;
  help: boolean;
}

const DEFAULT_CLI_ARGS: CliArgs = {
  cluster: undefined,
  reason: undefined,
  writePrompt: false,
  writeReviewSkeleton: true,
  reviewedAt: undefined,
  presetsRoot: PRESETS_ROOT_DEFAULT,
  reviewsRoot: 'reviews',
  compassPath: COMPASS_PATH_DEFAULT,
  help: false,
};

/**
 * Parse argv form (`['--cluster=A', '--reason=foo', ...]`). Pure — never reads
 * env, never throws. Unknown flags raise a soft error returned alongside the
 * partial parse.
 */
export function parseArgs(argv: readonly string[]): {
  args: CliArgs;
  errors: string[];
} {
  const args: CliArgs = { ...DEFAULT_CLI_ARGS };
  const errors: string[] = [];

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }
    if (raw === '--write-prompt') {
      args.writePrompt = true;
      continue;
    }
    if (raw === '--no-write-review-skeleton') {
      args.writeReviewSkeleton = false;
      continue;
    }
    if (raw === '--write-review-skeleton') {
      args.writeReviewSkeleton = true;
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
      case 'cluster':
        args.cluster = value;
        break;
      case 'reason':
        args.reason = value;
        break;
      case 'reviewed-at':
        args.reviewedAt = value;
        break;
      case 'presets-root':
        args.presetsRoot = value;
        break;
      case 'reviews-root':
        args.reviewsRoot = value;
        break;
      case 'compass-path':
        args.compassPath = value;
        break;
      default:
        errors.push(`unknown flag '--${key}'`);
    }
  }

  return { args, errors };
}

/** Output of {@link runInvocation} — structured so tests can assert on it. */
export interface InvocationResult {
  exitCode: 0 | 1 | 2;
  /** lines for stdout. */
  stdout: string[];
  /** lines for stderr. */
  stderr: string[];
  /** Files written (absolute paths). */
  written: string[];
}

/**
 * Pure run: parse → resolve cluster → re-trigger guard → manifest → write.
 * The CLI entry point (below) is a thin wrapper that prints the result.
 *
 * Errors are returned as a non-zero `exitCode` + stderr lines; the function
 * never throws on a known-error path. Unknown errors (e.g., loader crashes)
 * are caught at the CLI boundary.
 */
export function runInvocation(
  argv: readonly string[],
  opts: {
    /** A 'today' provider so tests can pin the date. Returns YYYY-MM-DD. */
    today?: () => string;
  } = {},
): InvocationResult {
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
    stderr.push('--cluster=<A|B|D|F|G|news|sports|titles|captions|ctas> is required');
    stderr.push(usage());
    return { exitCode: 2, stdout, stderr, written };
  }

  const resolved = resolveCluster(args.cluster);
  if (resolved.kind === 'unknown') {
    stderr.push(`unknown cluster '${args.cluster}'. Known: ${ALL_CLUSTER_IDENTIFIERS.join(', ')}`);
    return { exitCode: 1, stdout, stderr, written };
  }
  if (resolved.kind === 'exempt') {
    stderr.push(
      `cluster ${resolved.letter} (${resolved.name}) does not require batch type-design review per ADR-004 §D4. Individual presets in this cluster may escalate one-off.`,
    );
    return { exitCode: 1, stdout, stderr, written };
  }

  // Build the manifest.
  let manifest: ManifestEntry[];
  try {
    manifest = getClusterPresetManifest(resolved.name, { presetsRoot: args.presetsRoot });
  } catch (err) {
    stderr.push(
      `failed to load presets for cluster ${resolved.letter} (${resolved.name}): ${err instanceof Error ? err.message : String(err)}`,
    );
    return { exitCode: 1, stdout, stderr, written };
  }

  const compassBody = loadCompassBody(args.compassPath);
  if (compassBody === undefined) {
    stdout.push(
      `WARN: compass file '${args.compassPath}' not found — proceeding (operator must supply the relevant section manually).`,
    );
  }

  const reviewPath = resolve(
    args.reviewsRoot,
    `type-design-consultant-cluster-${resolved.letter}.md`,
  );

  // Re-trigger guard: AC #3.
  if (args.writeReviewSkeleton && existsSync(reviewPath) && args.reason === undefined) {
    stderr.push(
      `review file already exists at '${reviewPath}'. Pass --reason="<text>" to overwrite (per type-design-consultant SKILL.md §"Gate" re-trigger conditions).`,
    );
    return { exitCode: 1, stdout, stderr, written };
  }

  const today = (opts.today ?? defaultToday)();
  const reviewedAt = args.reviewedAt ?? today;

  if (args.writeReviewSkeleton) {
    const body = buildSkeleton({
      letter: resolved.letter,
      name: resolved.name,
      manifest,
      reviewedAt,
      reason: args.reason,
    });
    mkdirSync(dirname(reviewPath), { recursive: true });
    writeFileSync(reviewPath, body, 'utf8');
    written.push(reviewPath);
    stdout.push(`wrote ${reviewPath}`);
  }

  if (args.writePrompt) {
    const prompt = assemblePrompt({
      letter: resolved.letter,
      name: resolved.name,
      manifest,
      compassPath: args.compassPath,
      compassBody,
    });
    const promptDir = resolve(args.reviewsRoot, '.prompts');
    const promptPath = resolve(promptDir, `cluster-${resolved.letter}-${today}.md`);
    mkdirSync(promptDir, { recursive: true });
    writeFileSync(promptPath, prompt.text, 'utf8');
    written.push(promptPath);
    stdout.push(`wrote ${promptPath}`);
  }

  stdout.push(
    `cluster ${resolved.letter} (${resolved.name}) — ${manifest.length} preset${manifest.length === 1 ? '' : 's'} ready for consultant review.`,
  );
  stdout.push(
    'Next: run the type-design-consultant agent against the prompt and fill in the skeleton document.',
  );
  return { exitCode: 0, stdout, stderr, written };
}

function defaultToday(): string {
  // Determinism is not in scope for `scripts/**` (CLAUDE.md §3 lists clip /
  // runtime / renderer-core paths only). The CLI is operationally invoked.
  // determinism-safe: scripts/** is outside the determinism-gated scope; the
  //   reviewedAt date is operator-facing.
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function usage(): string {
  return [
    'Usage: pnpm invoke-type-design-consultant --cluster=<A|B|D|F|G|news|sports|titles|captions|ctas>',
    '                                          [--reason=<text>]',
    '                                          [--write-prompt]',
    '                                          [--no-write-review-skeleton]',
    '                                          [--reviewed-at=<YYYY-MM-DD>]',
    '                                          [--presets-root=<path>]',
    '                                          [--reviews-root=<path>]',
    '                                          [--compass-path=<path>]',
    '',
    'Per ADR-004 §D4, batch review is required for clusters A/B/D/F/G.',
    'Clusters C (weather), E (data), H (AR) are exempt.',
  ].join('\n');
}

/* v8 ignore start */
// CLI bootstrap — only runs when invoked as a process.
function main(): void {
  const argv = process.argv.slice(2);
  const result = runInvocation(argv);
  for (const line of result.stdout) process.stdout.write(`${line}\n`);
  for (const line of result.stderr) process.stderr.write(`${line}\n`);
  process.exit(result.exitCode);
}

const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'invoke-type-design-consultant.ts')
) {
  try {
    main();
  } catch (err) {
    process.stderr.write(
      `invoke-type-design-consultant: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exit(2);
  }
}
/* v8 ignore stop */
