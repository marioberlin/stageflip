// packages/pack-parity-validator/src/validator/validate-pack.ts
// T-549 — Multi-fixture pack walker. Takes the pre-loaded list of
// pack-shipped parity fixtures (callers do the IO; this stays pure) and
// aggregates per-fixture results into a `PackParityReport`.
//
// IO is pushed to the caller for two reasons:
//   1. The marketplace publish handler (T-536, future) reads from a
//      tar.zst stream; it cannot use `fs/promises`.
//   2. The pack-loader install gate (T-495) already opens the pack
//      directory; passing pre-decoded buffers avoids a second walk.
//
// The walker therefore takes a flat array of `PackFixtureManifest`
// entries — each one names its own cluster, candidate PNG, and reference
// PNG — and produces a structured aggregate.

import { type FixtureValidationResult, validateFixture } from './validate-fixture.js';

/** A single pre-loaded pack fixture ready for validation. */
export interface PackFixtureManifest {
  /** Path-as-shipped, e.g. `pack/fixtures/cluster-a/intro-01.png`. */
  readonly path: string;
  readonly clusterId: string;
  readonly actualPngBytes: Uint8Array;
  readonly referencePngBytes: Uint8Array;
}

export interface PackFixtureValidationInput {
  readonly fixtures: readonly PackFixtureManifest[];
}

export interface PackParityReportEntry {
  readonly fixturePath: string;
  readonly result: FixtureValidationResult;
}

export interface PackParityReportSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  /** Failure-reason histogram. Keys correspond to `FixtureValidationReason`. */
  readonly byReason: Readonly<Record<string, number>>;
}

export interface PackParityReport {
  readonly results: readonly PackParityReportEntry[];
  readonly summary: PackParityReportSummary;
}

/**
 * Validate every fixture in a pack and aggregate the results. Pure —
 * delegates per-fixture scoring to `validateFixture` and combines the
 * outcomes into a `PackParityReport`. Empty `fixtures` yields an empty
 * report with `total: 0` (callers decide whether the absence of any
 * shipped fixture is itself a failure — that policy lives in T-550 /
 * pack-loader, not here).
 */
export function validatePackFixtures(input: PackFixtureValidationInput): PackParityReport {
  const results: PackParityReportEntry[] = [];
  const byReason: Record<string, number> = {};
  let passed = 0;
  let failed = 0;

  for (const fixture of input.fixtures) {
    const result = validateFixture({
      clusterId: fixture.clusterId,
      actualPngBytes: fixture.actualPngBytes,
      referencePngBytes: fixture.referencePngBytes,
    });
    results.push({ fixturePath: fixture.path, result });
    if (result.ok) {
      passed++;
    } else {
      failed++;
      const key = result.reason ?? 'unknown';
      byReason[key] = (byReason[key] ?? 0) + 1;
    }
  }

  return {
    results,
    summary: {
      total: input.fixtures.length,
      passed,
      failed,
      byReason,
    },
  };
}
