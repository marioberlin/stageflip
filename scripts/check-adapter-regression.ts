// scripts/check-adapter-regression.ts
// CI gate (T-435 — Phase 14 β closer): every reference adapter shipped
// from the workspace must produce stub-mode output that matches a
// recorded per-adapter snapshot at
// `packages/adapter-regression/snapshots/<adapter-id>.json`.
//
// For each of the 9 reference adapters (T-426..T-434):
//   1. Read the committed snapshot.
//   2. Build a `RegressableAdapter` for the live provider class.
//   3. Drive it through each `sampleInputs[]` entry; compare the
//      live `cacheKey` + canonicalized-output SHA-256 against the
//      recorded values.
//   4. Verify the live descriptor's canonicalized SHA-256 matches
//      the recorded `descriptorSha256`.
//
// Exit 0 = every adapter PASS; non-zero = at least one drift detected.
// The report names each adapter + the specific field that drifted.
//
// **Inaugural state**: the 9 snapshot files are committed alongside this
// script; the inaugural gate run is byte-equal because the regen script
// wrote them from the same live adapter output.
//
// Determinism: pure script (apart from filesystem + dynamic-import I/O).
// No `Date.now()`, `Math.random()`, `fetch()`. SHA-256 via Web Crypto
// SubtleCrypto. CLAUDE.md §3 determinism rules scope to clip/runtime
// code; gates at `scripts/` are explicitly out of scope (same posture
// as `check-asset-licenses.ts`).

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADAPTER_IDS,
  type AdapterId,
  type AdapterRegressionVerdict,
  type AdapterRegressionSnapshot,
  buildAdapter,
  formatVerdict,
  parseAdapterRegressionSnapshot,
  runAdapterAgainstSnapshot,
} from '../packages/adapter-regression/src/index.js';

// ---------------------------------------------------------------------------
// Report shape
// ---------------------------------------------------------------------------

export interface AdapterRegressionReport {
  readonly adaptersInspected: number;
  readonly verdicts: ReadonlyMap<AdapterId, AdapterRegressionVerdict>;
  readonly missingSnapshots: ReadonlyArray<AdapterId>;
  readonly snapshotParseErrors: ReadonlyArray<{
    readonly adapterId: AdapterId;
    readonly cause: string;
  }>;
  readonly exitCode: 0 | 1;
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const SNAPSHOTS_DIR_DEFAULT = resolve(
  REPO_ROOT,
  'packages',
  'adapter-regression',
  'snapshots',
);

/** Snapshot file path for an adapter id. Exported for tests. */
export function snapshotPathFor(snapshotsDir: string, adapterId: AdapterId): string {
  return join(snapshotsDir, `${adapterId}.json`);
}

/**
 * Read and parse a per-adapter snapshot. Returns `{ kind: 'missing' }`
 * when the file doesn't exist; `{ kind: 'parse-error', cause }` on
 * malformed shape; `{ kind: 'ok', snapshot }` on success.
 */
export function readSnapshot(
  snapshotsDir: string,
  adapterId: AdapterId,
):
  | { readonly kind: 'missing' }
  | { readonly kind: 'parse-error'; readonly cause: string }
  | { readonly kind: 'ok'; readonly snapshot: AdapterRegressionSnapshot } {
  const path = snapshotPathFor(snapshotsDir, adapterId);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { kind: 'missing' };
    }
    return {
      kind: 'parse-error',
      cause: `read failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      kind: 'parse-error',
      cause: `JSON.parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  try {
    const snapshot = parseAdapterRegressionSnapshot(parsed);
    return { kind: 'ok', snapshot };
  } catch (err) {
    return {
      kind: 'parse-error',
      cause: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// runRegressions — core verification, no I/O beyond the readSnapshot call
// ---------------------------------------------------------------------------

/**
 * Drive every adapter id through its committed snapshot. Returns a
 * full report. Pure aside from the per-snapshot file read + per-adapter
 * stub-mode invocation (which the providers themselves keep pure).
 */
export async function runRegressions(
  snapshotsDir: string = SNAPSHOTS_DIR_DEFAULT,
  adapterIds: ReadonlyArray<AdapterId> = ADAPTER_IDS,
): Promise<AdapterRegressionReport> {
  const verdicts = new Map<AdapterId, AdapterRegressionVerdict>();
  const missingSnapshots: AdapterId[] = [];
  const snapshotParseErrors: { adapterId: AdapterId; cause: string }[] = [];

  for (const adapterId of adapterIds) {
    const read = readSnapshot(snapshotsDir, adapterId);
    if (read.kind === 'missing') {
      missingSnapshots.push(adapterId);
      continue;
    }
    if (read.kind === 'parse-error') {
      snapshotParseErrors.push({ adapterId, cause: read.cause });
      continue;
    }
    const adapter = buildAdapter(adapterId);
    const verdict = await runAdapterAgainstSnapshot(adapter, read.snapshot);
    verdicts.set(adapterId, verdict);
  }

  const anyDrift = Array.from(verdicts.values()).some((v) => !v.ok);
  const exitCode: 0 | 1 =
    anyDrift || missingSnapshots.length > 0 || snapshotParseErrors.length > 0 ? 1 : 0;

  return {
    adaptersInspected: adapterIds.length,
    verdicts,
    missingSnapshots,
    snapshotParseErrors,
    exitCode,
  };
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

export function formatReport(report: AdapterRegressionReport): string {
  const lines: string[] = [];
  lines.push(`check-adapter-regression: inspected ${report.adaptersInspected} adapters`);

  // Adapter verdicts in stable id order.
  const orderedVerdicts: [AdapterId, AdapterRegressionVerdict][] = [];
  for (const id of ADAPTER_IDS) {
    const v = report.verdicts.get(id);
    if (v !== undefined) orderedVerdicts.push([id, v]);
  }
  if (orderedVerdicts.length > 0) {
    lines.push('');
    for (const [id, verdict] of orderedVerdicts) {
      lines.push(formatVerdict(id, verdict));
    }
  }

  if (report.missingSnapshots.length > 0) {
    lines.push('');
    lines.push(`  MISSING-SNAPSHOT (${report.missingSnapshots.length}):`);
    for (const id of report.missingSnapshots) {
      lines.push(`    ${id}`);
    }
    lines.push(
      '  -> regenerate via `pnpm regenerate-adapter-snapshots` and commit the result.',
    );
  }

  if (report.snapshotParseErrors.length > 0) {
    lines.push('');
    lines.push(`  PARSE-ERROR (${report.snapshotParseErrors.length}):`);
    for (const entry of report.snapshotParseErrors) {
      lines.push(`    ${entry.adapterId}`);
      lines.push(`      cause: ${entry.cause}`);
    }
  }

  lines.push('');
  if (report.exitCode === 0) {
    lines.push('check-adapter-regression: PASS');
  } else {
    lines.push('check-adapter-regression: FAIL');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

export async function main(
  snapshotsDir: string = SNAPSHOTS_DIR_DEFAULT,
): Promise<number> {
  const report = await runRegressions(snapshotsDir);
  const out = formatReport(report);
  if (report.exitCode === 0) {
    process.stdout.write(`${out}\n`);
  } else {
    process.stderr.write(`${out}\n`);
  }
  return report.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((err: unknown) => {
      process.stderr.write(
        `check-adapter-regression: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    });
}
