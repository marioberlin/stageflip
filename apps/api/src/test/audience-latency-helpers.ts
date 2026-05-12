// apps/api/src/test/audience-latency-helpers.ts
// T-475 — Pure helpers shared by the opt-in audience-latency vitest
// suite. Two functions:
//   - `synthesizeVoterTaps(count)` builds a deterministic batch of
//     synthetic voter taps (voterToken + sessionId + payload + a
//     monotonically-increasing wall-clock-ish timestamp).
//   - `computePercentile(samples, pct)` is a pure stats helper used by
//     the latency suite to assert percentile budgets per ADR-009 §D4.
//
// Both helpers are pure — no Date / random / network. The latency
// suite uses them to keep the assertion math obvious in the test code
// and to make the helpers themselves trivially unit-testable.

import type { VotePayload } from '@stageflip/audience-contract';

/**
 * One deterministic synthetic voter tap. The `payload` is always a
 * `live-poll-multiple-choice` vote (the simplest schema-valid
 * variant) cycled across three option indices so the aggregator
 * sees a non-degenerate vote distribution.
 */
export interface SynthVoterTap {
  readonly voterToken: string;
  readonly sessionId: string;
  readonly payload: VotePayload;
  readonly timestampMs: number;
}

/** Session id every synthetic tap shares. */
const SYNTH_SESSION_ID = 's-bench';

/**
 * Build `count` deterministic synthetic voter taps. The i-th tap has
 * `voterToken = 'voter-${i}'`, payload cycles `optionIndex` across
 * `[0, 1, 2]`, and `timestampMs = i * 10` (so callers can use the
 * timestamp as a stable input-event clock without crossing the
 * determinism perimeter — the helper itself never reads `Date.now`).
 *
 * @throws RangeError if `count` is negative or non-integer.
 */
export function synthesizeVoterTaps(count: number): readonly SynthVoterTap[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`synthesizeVoterTaps: count must be a non-negative integer; got ${count}`);
  }
  const out: SynthVoterTap[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      voterToken: `voter-${i}`,
      sessionId: SYNTH_SESSION_ID,
      payload: { kind: 'live-poll-multiple-choice', optionIndex: i % 3 },
      timestampMs: i * 10,
    });
  }
  return out;
}

/**
 * Compute the closest-sample percentile of a numeric sample array.
 * Convention: NO interpolation — samples are sorted ascending and the
 * percentile-`pct` value is returned at index
 * `Math.floor((sorted.length - 1) * pct)`. This matches the audience
 * backend's documented percentile convention per ADR-009 §D4 footnote
 * (closest-sample / nearest-rank).
 *
 * @param samples - latency observations (any unit; helper does not care).
 *   Caller MUST supply at least one sample.
 * @param pct - fractional percentile in `[0, 1]` (e.g. 0.5 for p50,
 *   0.95 for p95). Out-of-range values throw `RangeError`.
 * @returns the sample at the percentile rank. Original ordering is
 *   preserved (the helper sorts a copy).
 */
export function computePercentile(samples: readonly number[], pct: number): number {
  if (samples.length === 0) {
    throw new RangeError('computePercentile: samples must be non-empty');
  }
  if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
    throw new RangeError(`computePercentile: pct must be in [0, 1]; got ${pct}`);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * pct);
  // Cast is safe: `sorted.length >= 1` AND `idx` is a Math.floor of a
  // non-negative real in [0, length - 1], so `sorted[idx]` is defined.
  // noUncheckedIndexedAccess narrows to T | undefined; guard it.
  const value = sorted[idx];
  if (value === undefined) {
    // Defensive — the algebra above guarantees this branch is dead.
    throw new Error(`computePercentile: unexpected undefined at index ${idx}`);
  }
  return value;
}
