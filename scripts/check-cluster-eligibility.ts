// scripts/check-cluster-eligibility.ts
// Cluster-batch merge gate (ADR-004 §D5, T-313 §D-T313-2).
//
// Walks every preset in a single cluster, asserts each one's
// `signOff.parityFixture` is `signed:YYYY-MM-DD`, and emits a per-preset
// table. Exit 0 when all signed; 1 when any is pending; 1 when the
// cluster identifier is unknown.
//
// Cluster identifier may be a single letter (A through H) or a cluster name
// (`news` / `sports` / ...) — case-insensitive. Matches the resolver style
// of `invoke-type-design-consultant.ts` (T-311) so operators have one mental
// model across the two CLIs.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PresetCluster } from '../packages/schema/src/presets/frontmatter.js';
import {
  type Preset,
  loadAllPresets,
  resetLoaderCache,
} from '../packages/schema/src/presets/loader.js';

// ---------- cluster mapping ----------

/** All known cluster letters (A through H). */
export const ALL_CLUSTER_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type ClusterLetter = (typeof ALL_CLUSTER_LETTERS)[number];

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

export const ALL_CLUSTER_IDENTIFIERS: readonly string[] = [
  ...(Object.keys(LETTER_TO_NAME) as ClusterLetter[]),
  ...(Object.keys(NAME_TO_LETTER) as PresetCluster[]),
];

/**
 * Resolve a caller-provided cluster id (letter, name, or mixed-case name) to
 * `{ letter, name }`. Returns `{ kind: 'unknown' }` for unrecognised inputs.
 *
 * Unlike `invoke-type-design-consultant`, T-313's gate applies to ALL eight
 * clusters — there is no "exempt" tier (every preset has a parity fixture
 * regardless of typographic identity).
 */
export function resolveCluster(
  input: string,
): { kind: 'known'; letter: ClusterLetter; name: PresetCluster } | { kind: 'unknown' } {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { kind: 'unknown' };

  if (trimmed.length === 1) {
    const upper = trimmed.toUpperCase();
    if (isClusterLetter(upper)) {
      return { kind: 'known', letter: upper, name: LETTER_TO_NAME[upper] };
    }
    return { kind: 'unknown' };
  }

  const lower = trimmed.toLowerCase();
  if (isClusterName(lower)) {
    return { kind: 'known', letter: NAME_TO_LETTER[lower], name: lower };
  }
  return { kind: 'unknown' };
}

function isClusterLetter(s: string): s is ClusterLetter {
  return (ALL_CLUSTER_LETTERS as readonly string[]).includes(s);
}

function isClusterName(s: string): s is PresetCluster {
  return s in NAME_TO_LETTER;
}

// ---------- eligibility check ----------

/** Per-preset eligibility status. */
export type PresetEligibility =
  | { kind: 'signed'; presetId: string; signedDate: string }
  | { kind: 'pending'; presetId: string }
  | { kind: 'na'; presetId: string }
  | { kind: 'malformed'; presetId: string; raw: string };

export interface ClusterEligibilityReport {
  letter: ClusterLetter;
  name: PresetCluster;
  /** Per-preset rows, sorted by id (alphabetical). */
  presets: PresetEligibility[];
  /** Number of presets in `signed` or `na` state (eligible to merge). */
  signedCount: number;
  /** Number of presets in `pending` or `malformed` state. */
  pendingCount: number;
  /** Total presets in the cluster. */
  total: number;
  /** True iff every preset is signed (or `na`) — cluster mergeable. */
  eligible: boolean;
}

/**
 * Classify a single preset's `signOff.parityFixture` value. The loader's Zod
 * schema already restricts the value to one of three forms, but we re-check
 * defensively so a future schema relaxation doesn't bypass the gate.
 */
export function classifyPreset(preset: Preset): PresetEligibility {
  const id = preset.frontmatter.id;
  const value = preset.frontmatter.signOff.parityFixture;
  if (value === 'pending-user-review') {
    return { kind: 'pending', presetId: id };
  }
  if (value === 'na') {
    return { kind: 'na', presetId: id };
  }
  const m = /^signed:(\d{4}-\d{2}-\d{2})$/.exec(value);
  if (m && m[1] !== undefined) {
    return { kind: 'signed', presetId: id, signedDate: m[1] };
  }
  return { kind: 'malformed', presetId: id, raw: value };
}

/**
 * Build the eligibility report for a cluster. Pure (modulo the loader's
 * filesystem read).
 */
export function checkClusterEligibility(args: {
  letter: ClusterLetter;
  name: PresetCluster;
  presetsRoot: string;
}): ClusterEligibilityReport {
  resetLoaderCache();
  const registry = loadAllPresets(args.presetsRoot);
  const presets = registry.list(args.name);
  const sorted = [...presets].sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));

  const rows = sorted.map(classifyPreset);
  let signedCount = 0;
  let pendingCount = 0;
  for (const row of rows) {
    if (row.kind === 'signed' || row.kind === 'na') signedCount += 1;
    else pendingCount += 1;
  }

  return {
    letter: args.letter,
    name: args.name,
    presets: rows,
    signedCount,
    pendingCount,
    total: rows.length,
    // Empty cluster is a degenerate "eligible" — there's nothing to merge.
    // Operators reading the table will see total=0 and act accordingly.
    eligible: pendingCount === 0,
  };
}

/**
 * Render an eligibility report as the user-facing stdout text. Pure — exposed
 * for tests so the format string is asserted against, not the I/O.
 */
export function formatReport(report: ClusterEligibilityReport): string {
  const header = `Cluster ${report.letter} — ${report.name} (${report.total} preset${report.total === 1 ? '' : 's'})`;
  const lines: string[] = [header];
  for (const row of report.presets) {
    switch (row.kind) {
      case 'signed':
        lines.push(`  PASS ${row.presetId} (signed:${row.signedDate})`);
        break;
      case 'na':
        lines.push(`  PASS ${row.presetId} (na — text-free preset)`);
        break;
      case 'pending':
        lines.push(`  FAIL ${row.presetId} (pending-user-review)`);
        break;
      case 'malformed':
        lines.push(`  FAIL ${row.presetId} (malformed signOff.parityFixture: '${row.raw}')`);
        break;
    }
  }
  if (report.eligible) {
    if (report.total === 0) {
      lines.push(`Cluster ${report.letter}: ELIGIBLE — empty cluster (nothing to merge).`);
    } else {
      lines.push(`Cluster ${report.letter}: ELIGIBLE — all ${report.total} preset(s) signed.`);
    }
  } else {
    lines.push(
      `Cluster ${report.letter}: NOT ELIGIBLE — ${report.pendingCount} preset(s) pending sign-off.`,
    );
  }
  return lines.join('\n');
}

// ---------- CLI plumbing ----------

export interface CliArgs {
  cluster: string | undefined;
  presetsRoot: string;
  help: boolean;
}

const DEFAULT_CLI_ARGS: CliArgs = {
  cluster: undefined,
  presetsRoot: 'skills/stageflip/presets',
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
      case 'presets-root':
        args.presetsRoot = value;
        break;
      default:
        errors.push(`unknown flag '--${key}'`);
    }
  }
  return { args, errors };
}

export function usage(): string {
  return [
    'Usage: pnpm check-cluster-eligibility --cluster=<A|B|C|D|E|F|G|H|news|sports|...>',
    '                                      [--presets-root=<path>]',
    '',
    'Asserts every preset in the cluster has signOff.parityFixture: signed:<date>',
    'or na. Exit 0 when eligible; exit 1 when any preset is pending or malformed.',
  ].join('\n');
}

export interface RunResult {
  exitCode: 0 | 1 | 2;
  stdout: string[];
  stderr: string[];
}

export function runCheck(argv: readonly string[]): RunResult {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const { args, errors } = parseArgs(argv);

  if (args.help) {
    stdout.push(usage());
    return { exitCode: 0, stdout, stderr };
  }

  if (errors.length > 0) {
    for (const e of errors) stderr.push(e);
    stderr.push(usage());
    return { exitCode: 2, stdout, stderr };
  }

  if (args.cluster === undefined) {
    stderr.push('--cluster=<letter|name> is required');
    stderr.push(usage());
    return { exitCode: 2, stdout, stderr };
  }

  const resolved = resolveCluster(args.cluster);
  if (resolved.kind === 'unknown') {
    stderr.push(`unknown cluster '${args.cluster}'. Known: ${ALL_CLUSTER_IDENTIFIERS.join(', ')}`);
    return { exitCode: 1, stdout, stderr };
  }

  let report: ClusterEligibilityReport;
  try {
    report = checkClusterEligibility({
      letter: resolved.letter,
      name: resolved.name,
      presetsRoot: args.presetsRoot,
    });
  } catch (err) {
    stderr.push(
      `failed to load presets from '${args.presetsRoot}': ${err instanceof Error ? err.message : String(err)}`,
    );
    return { exitCode: 1, stdout, stderr };
  }

  stdout.push(formatReport(report));
  return { exitCode: report.eligible ? 0 : 1, stdout, stderr };
}

/* v8 ignore start */
function main(): void {
  const result = runCheck(process.argv.slice(2));
  for (const line of result.stdout) process.stdout.write(`${line}\n`);
  for (const line of result.stderr) process.stderr.write(`${line}\n`);
  process.exit(result.exitCode);
}

const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'check-cluster-eligibility.ts')
) {
  try {
    main();
  } catch (err) {
    process.stderr.write(
      `check-cluster-eligibility: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exit(2);
  }
}
/* v8 ignore stop */
