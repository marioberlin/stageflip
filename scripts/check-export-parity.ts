// scripts/check-export-parity.ts
// CI gate (T-409, Phase γ closeout) — preset × export parity verification.
//
// Iterates the cross-product of every ratified preset under
// `skills/stageflip/presets/**/*.md` × every member of the `ExportTarget`
// enum, drives each pair through `routeExport()` from
// `@stageflip/export-router` (T-408), and asserts:
//
//   1. route-shape          — decision is a well-formed `RoutingDecision`
//                             (kind ∈ {'route','fallback'}; mode ∈
//                             {'live','static'}; required fields present).
//   2. exporter-package-exists
//                           — `decision.exporterPackage` resolves to a real
//                             `packages/export-*/package.json` on disk.
//   3. matrix-mode-consistency
//                           — `decision.mode` matches `EXPORT_MATRIX[target]`
//                             for both the 'route' and 'fallback' branches.
//   4. fallback-branch-coverage
//                           — A synthetic Document carrying one
//                             `type: 'interactive-clip'` element produces
//                             `kind: 'fallback'` for every static target,
//                             with a non-empty `liveClipsOmitted` array.
//
// The gate is a STRUCTURAL check, NOT an execution check. Pixel-level
// verification of exporter output is out of scope (covered by the existing
// `parity (fixture scoring)` CI job). Running the seven exporters on every
// preset would inflate CI time substantially.
//
// Pure script: input = filesystem (preset markdown + the
// `packages/export-*/package.json` layout), output = stdout report + exit
// code (0 = pass, non-zero = fail). No `Date.now()`, no `Math.random()`,
// no network. Mirrors `check-cluster-eligibility.ts` and
// `check-preset-integrity.ts` posture verbatim.

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { routeExport } from '../packages/export-router/src/router.js';
import type { RoutingDecision } from '../packages/export-router/src/types.js';
import {
  type Document,
  EXPORT_MATRIX,
  type Element,
  type ExportTarget,
  exportTargetSchema,
} from '../packages/schema/src/index.js';
import {
  type Preset,
  loadAllPresets,
  resetLoaderCache,
} from '../packages/schema/src/presets/loader.js';

// ---------- script-level constants ----------

const PRESETS_ROOT_DEFAULT = 'skills/stageflip/presets';
const PACKAGES_ROOT_DEFAULT = 'packages';

/**
 * The eight export targets the matrix routes. Sourced from the schema's Zod
 * enum so adding a target in the schema (an ADR-003 §D3 amendment) is picked
 * up automatically — no second source-of-truth to keep in sync.
 */
const ALL_EXPORT_TARGETS: ReadonlyArray<ExportTarget> = exportTargetSchema.options;

/**
 * Map an `ExporterPackage` string (e.g. `'@stageflip/export-pptx'`) to the
 * directory name under `packages/` (`'export-pptx'`). The router's package
 * names follow the convention `@stageflip/<dir-name>`, so the strip is a
 * simple prefix removal — no per-package table to maintain.
 */
export function exporterPackageToDirName(pkg: string): string {
  const PREFIX = '@stageflip/';
  if (!pkg.startsWith(PREFIX)) {
    throw new Error(
      `expected exporterPackage to start with '${PREFIX}', got: ${JSON.stringify(pkg)}`,
    );
  }
  return pkg.slice(PREFIX.length);
}

// ---------- types ----------

const INVARIANT_KEYS = [
  'route-shape',
  'exporter-package-exists',
  'matrix-mode-consistency',
  'fallback-branch-coverage',
] as const;
export type InvariantKey = (typeof INVARIANT_KEYS)[number];

export interface InvariantBucket {
  errors: string[];
}

export interface ParityReport {
  scannedPresets: number;
  totalPairs: number;
  byInvariant: Record<InvariantKey, InvariantBucket>;
  loaderError: string | undefined;
  exitCode: 0 | 1;
}

// ---------- synthetic Document construction ----------

/**
 * Build a minimal slide-mode `Document` that the router can walk for a given
 * preset. Today every ratified preset has a static clipKind, so the
 * synthetic doc carries one text element per preset and zero live clips.
 *
 * The doc is NOT round-tripped through the schema's Zod validator (that's
 * `check-preset-integrity`'s job; double-validation would conflate the two
 * gates). Cast via `as unknown as Document` matches the established pattern
 * in `packages/export-router/src/test-fixtures.ts`.
 */
export function buildSyntheticDocumentForPreset(preset: Preset): Document {
  const id = preset.frontmatter.id;
  const textEl: Element = {
    id: `${id}-text`,
    type: 'text',
    transform: { x: 0, y: 0, width: 100, height: 20, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    runs: [{ text: id, style: {} }],
  } as unknown as Element;
  return {
    meta: {
      id: `doc-${id}`,
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: {} as never,
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: {
      mode: 'slide',
      slides: [
        {
          id: `slide-${id}`,
          elements: [textEl],
        },
      ],
    },
  } as unknown as Document;
}

/**
 * Build a synthetic Document with one `type: 'interactive-clip'` element so
 * the gate can exercise the router's `'fallback'` discriminator branch on
 * every static target. Today's preset corpus is entirely static-clipKind, so
 * this synthetic doc is the only path to fallback-branch coverage.
 */
export function buildSyntheticLiveClipDocument(): Document {
  const liveClip: Element = {
    id: 'synthetic-live-clip',
    type: 'interactive-clip',
    family: 'shader',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    staticFallback: [
      {
        id: 'synthetic-live-clip-fallback-text',
        type: 'text',
        transform: { x: 0, y: 0, width: 100, height: 20, rotation: 0, opacity: 1 },
        visible: true,
        locked: false,
        animations: [],
        runs: [{ text: 'fallback', style: {} }],
      },
    ],
    liveMount: {
      component: { module: '@stageflip/runtimes-interactive/clips/shader#ShaderClip' },
      props: {},
      permissions: [],
    },
  } as unknown as Element;
  return {
    meta: {
      id: 'doc-synthetic-live',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: {} as never,
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: {
      mode: 'slide',
      slides: [
        {
          id: 'slide-synthetic-live',
          elements: [liveClip],
        },
      ],
    },
  } as unknown as Document;
}

// ---------- per-pair invariant checks ----------

export type CheckResult = { ok: true } | { ok: false; message: string };

/**
 * Invariant 1 — route-shape. The decision must be a well-formed
 * `RoutingDecision` with the correct discriminator and required fields per
 * branch.
 */
export function checkRouteShape(decision: RoutingDecision): CheckResult {
  // Inspect the decision via an `unknown` cast so the runtime checks below
  // run against the raw shape rather than against TypeScript's narrowed type
  // (which would mark every branch as unreachable). The gate's job is to
  // catch malformed decisions a future router amendment might emit, even if
  // the type signature still says they're well-formed.
  const raw = decision as unknown as Record<string, unknown>;
  const kind = raw.kind;
  const mode = raw.mode;
  const exporterPackage = raw.exporterPackage;
  const target = raw.target;
  const reason = raw.reason;

  if (kind === 'route') {
    if (mode !== 'live' && mode !== 'static') {
      return { ok: false, message: `route decision has invalid mode '${String(mode)}'` };
    }
    if (typeof exporterPackage !== 'string' || exporterPackage.length === 0) {
      return { ok: false, message: 'route decision has empty exporterPackage' };
    }
    if (typeof target !== 'string' || target.length === 0) {
      return { ok: false, message: 'route decision has empty target' };
    }
    if (mode === 'live' && reason !== 'target_is_live_capable') {
      return {
        ok: false,
        message: `route+live decision has wrong reason '${String(reason)}' (expected 'target_is_live_capable')`,
      };
    }
    if (mode === 'static' && reason !== 'target_is_static_only_no_live_clips') {
      return {
        ok: false,
        message: `route+static decision has wrong reason '${String(reason)}' (expected 'target_is_static_only_no_live_clips')`,
      };
    }
    return { ok: true };
  }
  if (kind === 'fallback') {
    if (mode !== 'static') {
      return {
        ok: false,
        message: `fallback decision has invalid mode '${String(mode)}' (expected 'static')`,
      };
    }
    if (reason !== 'target_is_static_only') {
      return {
        ok: false,
        message: `fallback decision has wrong reason '${String(reason)}' (expected 'target_is_static_only')`,
      };
    }
    if (!Array.isArray(raw.liveClipsOmitted)) {
      return {
        ok: false,
        message: 'fallback decision is missing liveClipsOmitted array',
      };
    }
    return { ok: true };
  }
  // Exhaustiveness — the discriminator is closed today; this branch fires if
  // a future amendment adds a third `kind` without updating this gate.
  return {
    ok: false,
    message: `unknown decision kind '${String(kind)}'`,
  };
}

/**
 * Invariant 2 — exporter-package-exists. `decision.exporterPackage` must
 * resolve to a real `packages/<dir>/package.json` on disk under
 * `packagesRoot`.
 */
export function checkExporterPackageExists(args: {
  decision: RoutingDecision;
  packagesRoot: string;
}): CheckResult {
  let dirName: string;
  try {
    dirName = exporterPackageToDirName(args.decision.exporterPackage);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
  const pkgJsonPath = join(args.packagesRoot, dirName, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    return {
      ok: false,
      message: `exporterPackage '${args.decision.exporterPackage}' has no package.json at ${pkgJsonPath}`,
    };
  }
  return { ok: true };
}

/**
 * Invariant 3 — matrix-mode-consistency. `decision.mode` must match the
 * `EXPORT_MATRIX` entry for the target.
 */
export function checkMatrixModeConsistency(args: {
  target: ExportTarget;
  decision: RoutingDecision;
}): CheckResult {
  const expected = EXPORT_MATRIX[args.target];
  if (args.decision.mode !== expected) {
    return {
      ok: false,
      message: `decision mode '${args.decision.mode}' disagrees with EXPORT_MATRIX['${args.target}'] = '${expected}'`,
    };
  }
  return { ok: true };
}

/**
 * Invariant 4 — fallback-branch-coverage. A synthetic Document with a live
 * clip routed to a static target MUST produce `kind: 'fallback'` with a
 * non-empty `liveClipsOmitted` array. Live targets MUST still produce
 * `kind: 'route'` + `mode: 'live'` (no fallback semantics on a live-capable
 * target, regardless of document content).
 */
export function checkFallbackBranchCoverage(args: {
  target: ExportTarget;
  decision: RoutingDecision;
}): CheckResult {
  const matrixMode = EXPORT_MATRIX[args.target];
  if (matrixMode === 'static') {
    if (args.decision.kind !== 'fallback') {
      return {
        ok: false,
        message: `synthetic-live-clip doc on static target '${args.target}' produced kind '${args.decision.kind}' (expected 'fallback')`,
      };
    }
    if (args.decision.liveClipsOmitted.length === 0) {
      return {
        ok: false,
        message: `synthetic-live-clip doc on static target '${args.target}' produced empty liveClipsOmitted`,
      };
    }
    return { ok: true };
  }
  // matrixMode === 'live' — live-capable target should always route live.
  if (args.decision.kind !== 'route' || args.decision.mode !== 'live') {
    return {
      ok: false,
      message: `synthetic-live-clip doc on live target '${args.target}' produced kind '${args.decision.kind}' / mode '${String((args.decision as { mode?: string }).mode)}' (expected route+live)`,
    };
  }
  return { ok: true };
}

// ---------- aggregation ----------

function emptyBuckets(): Record<InvariantKey, InvariantBucket> {
  const buckets = {} as Record<InvariantKey, InvariantBucket>;
  for (const k of INVARIANT_KEYS) {
    buckets[k] = { errors: [] };
  }
  return buckets;
}

export interface RunOpts {
  presetsRoot: string;
  packagesRoot: string;
}

/**
 * Walk every preset × every export target through `routeExport` and aggregate
 * invariant violations. Never throws — loader errors are folded into the
 * report's `loaderError` field.
 */
export function runParityChecks(opts: RunOpts): ParityReport {
  const buckets = emptyBuckets();
  resetLoaderCache();

  let presets: Preset[] = [];
  let loaderError: string | undefined;

  try {
    const registry = loadAllPresets(opts.presetsRoot);
    presets = registry.list();
  } catch (err) {
    loaderError = err instanceof Error ? err.message : String(err);
    buckets['route-shape'].errors.push(
      `failed to load presets from '${opts.presetsRoot}': ${loaderError}`,
    );
    return {
      scannedPresets: 0,
      totalPairs: 0,
      byInvariant: buckets,
      loaderError,
      exitCode: 1,
    };
  }

  // Sort presets by id for deterministic output.
  const sortedPresets = [...presets].sort((a, b) =>
    a.frontmatter.id.localeCompare(b.frontmatter.id),
  );

  // ----- per-preset × per-target sweep (invariants 1-3) -----
  for (const preset of sortedPresets) {
    const document = buildSyntheticDocumentForPreset(preset);
    for (const target of ALL_EXPORT_TARGETS) {
      const decision = routeExport(target, document);
      const presetId = preset.frontmatter.id;

      const r1 = checkRouteShape(decision);
      if (!r1.ok) {
        buckets['route-shape'].errors.push(`(${presetId}, ${target}): ${r1.message}`);
      }
      const r2 = checkExporterPackageExists({ decision, packagesRoot: opts.packagesRoot });
      if (!r2.ok) {
        buckets['exporter-package-exists'].errors.push(`(${presetId}, ${target}): ${r2.message}`);
      }
      const r3 = checkMatrixModeConsistency({ target, decision });
      if (!r3.ok) {
        buckets['matrix-mode-consistency'].errors.push(`(${presetId}, ${target}): ${r3.message}`);
      }
    }
  }

  // ----- synthetic live-clip doc × every target (invariant 4) -----
  const liveDoc = buildSyntheticLiveClipDocument();
  for (const target of ALL_EXPORT_TARGETS) {
    const decision = routeExport(target, liveDoc);
    const r4 = checkFallbackBranchCoverage({ target, decision });
    if (!r4.ok) {
      buckets['fallback-branch-coverage'].errors.push(
        `(synthetic-live-clip, ${target}): ${r4.message}`,
      );
    }
  }

  const totalPairs = sortedPresets.length * ALL_EXPORT_TARGETS.length;
  const hasErrors = Object.values(buckets).some((b) => b.errors.length > 0);

  return {
    scannedPresets: sortedPresets.length,
    totalPairs,
    byInvariant: buckets,
    loaderError,
    exitCode: hasErrors ? 1 : 0,
  };
}

// ---------- formatting ----------

function formatPassFail(bucket: InvariantBucket): string {
  if (bucket.errors.length > 0) {
    return `FAIL (${bucket.errors.length} error${bucket.errors.length === 1 ? '' : 's'})`;
  }
  return 'PASS';
}

/**
 * Render a {@link ParityReport} into the user-facing stdout/stderr text.
 * Pure — exposed for tests so the format strings are asserted against the
 * report shape, not against captured I/O.
 */
export function formatReport(report: ParityReport): { stdout: string; stderr: string } {
  let stdout = '';
  let stderr = '';

  stdout += `check-export-parity: ${report.scannedPresets} preset${report.scannedPresets === 1 ? '' : 's'} × ${ALL_EXPORT_TARGETS.length} targets = ${report.totalPairs} pair${report.totalPairs === 1 ? '' : 's'} verified\n`;
  if (report.loaderError !== undefined) {
    stderr += `check-export-parity: loader error: ${report.loaderError}\n`;
  }

  for (const key of INVARIANT_KEYS) {
    stdout += `check-export-parity [${key}]: ${formatPassFail(report.byInvariant[key])}\n`;
  }

  for (const key of INVARIANT_KEYS) {
    const bucket = report.byInvariant[key];
    if (bucket.errors.length === 0) continue;
    stderr += `\ncheck-export-parity [${key}]: FAIL\n`;
    for (const e of bucket.errors) {
      stderr += `  - ${e}\n`;
    }
  }

  if (report.exitCode === 0) {
    stdout += '\ncheck-export-parity: PASS\n';
  } else {
    const totalErrors = Object.values(report.byInvariant).reduce(
      (acc, b) => acc + b.errors.length,
      0,
    );
    stderr += `\ncheck-export-parity: FAIL (${totalErrors} violation${totalErrors === 1 ? '' : 's'})\n`;
  }

  return { stdout, stderr };
}

// ---------- CLI plumbing ----------

export interface CliArgs {
  presetsRoot: string;
  packagesRoot: string;
  help: boolean;
}

const DEFAULT_CLI_ARGS: CliArgs = {
  presetsRoot: PRESETS_ROOT_DEFAULT,
  packagesRoot: PACKAGES_ROOT_DEFAULT,
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
      case 'presets-root':
        args.presetsRoot = value;
        break;
      case 'packages-root':
        args.packagesRoot = value;
        break;
      default:
        errors.push(`unknown flag '--${key}'`);
    }
  }
  return { args, errors };
}

export function usage(): string {
  return [
    'Usage: pnpm check-export-parity [--presets-root=<path>] [--packages-root=<path>]',
    '',
    'Iterates every (preset, ExportTarget) pair through routeExport() and asserts',
    'that each routing decision is well-formed and points at a real exporter package.',
    'Exit 0 when every pair passes; exit 1 when any invariant fails.',
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

  const report = runParityChecks({
    presetsRoot: args.presetsRoot,
    packagesRoot: args.packagesRoot,
  });
  const formatted = formatReport(report);
  if (formatted.stdout.length > 0) stdout.push(formatted.stdout.replace(/\n$/, ''));
  if (formatted.stderr.length > 0) stderr.push(formatted.stderr.replace(/\n$/, ''));
  return { exitCode: report.exitCode, stdout, stderr };
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
  argvEntry === resolve(dirname(moduleEntry), 'check-export-parity.ts')
) {
  try {
    main();
  } catch (err) {
    process.stderr.write(
      `check-export-parity: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exit(2);
  }
}
/* v8 ignore stop */
