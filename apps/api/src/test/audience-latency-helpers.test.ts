// apps/api/src/test/audience-latency-helpers.test.ts
// T-475 — Unit tests for the pure helpers consumed by the opt-in
// audience-latency vitest suite. Verifies determinism, schema-valid
// payload shape, and percentile math (closest-sample convention).

import { describe, expect, it } from 'vitest';

import { votePayloadSchema } from '@stageflip/audience-contract';

import { computePercentile, synthesizeVoterTaps } from './audience-latency-helpers.js';

describe('synthesizeVoterTaps', () => {
  it('returns the empty list for count=0', () => {
    expect(synthesizeVoterTaps(0)).toEqual([]);
  });

  it('throws RangeError for negative counts', () => {
    expect(() => synthesizeVoterTaps(-1)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer counts', () => {
    expect(() => synthesizeVoterTaps(1.5)).toThrow(RangeError);
  });

  it('is deterministic: two calls with the same count produce identical output', () => {
    const a = synthesizeVoterTaps(5);
    const b = synthesizeVoterTaps(5);
    expect(a).toEqual(b);
  });

  it('assigns voterToken `voter-${i}` and timestamp i*10 ms per tap', () => {
    const taps = synthesizeVoterTaps(3);
    expect(taps).toHaveLength(3);
    expect(taps[0]).toMatchObject({ voterToken: 'voter-0', timestampMs: 0 });
    expect(taps[1]).toMatchObject({ voterToken: 'voter-1', timestampMs: 10 });
    expect(taps[2]).toMatchObject({ voterToken: 'voter-2', timestampMs: 20 });
  });

  it('cycles optionIndex across [0, 1, 2]', () => {
    const taps = synthesizeVoterTaps(7);
    const opts = taps.map((t) =>
      t.payload.kind === 'live-poll-multiple-choice' ? t.payload.optionIndex : -1,
    );
    expect(opts).toEqual([0, 1, 2, 0, 1, 2, 0]);
  });

  it('shares the same sessionId across every tap', () => {
    const taps = synthesizeVoterTaps(4);
    const uniqueSessionIds = new Set(taps.map((t) => t.sessionId));
    expect(uniqueSessionIds.size).toBe(1);
  });

  it('produces schema-valid VotePayload values (votePayloadSchema parses)', () => {
    for (const tap of synthesizeVoterTaps(5)) {
      expect(() => votePayloadSchema.parse(tap.payload)).not.toThrow();
    }
  });
});

describe('computePercentile', () => {
  it('throws RangeError on empty samples', () => {
    expect(() => computePercentile([], 0.5)).toThrow(RangeError);
  });

  it('throws RangeError on pct < 0', () => {
    expect(() => computePercentile([1, 2, 3], -0.01)).toThrow(RangeError);
  });

  it('throws RangeError on pct > 1', () => {
    expect(() => computePercentile([1, 2, 3], 1.01)).toThrow(RangeError);
  });

  it('throws RangeError on NaN pct', () => {
    expect(() => computePercentile([1, 2, 3], Number.NaN)).toThrow(RangeError);
  });

  it('returns the single sample when length=1 regardless of pct', () => {
    expect(computePercentile([42], 0)).toBe(42);
    expect(computePercentile([42], 0.5)).toBe(42);
    expect(computePercentile([42], 1)).toBe(42);
  });

  it('returns min at pct=0 and max at pct=1', () => {
    const samples = [5, 1, 4, 2, 3];
    expect(computePercentile(samples, 0)).toBe(1);
    expect(computePercentile(samples, 1)).toBe(5);
  });

  it('uses closest-sample (no interpolation) for p50 on a 5-element list', () => {
    // sorted [1,2,3,4,5], (5-1)*0.5 = 2 → index 2 → 3
    expect(computePercentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it('returns the p95 sample by closest-rank on a 100-element list', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1); // [1..100]
    // (100-1)*0.95 = 94.05 → floor → 94 → value 95
    expect(computePercentile(samples, 0.95)).toBe(95);
  });

  it('does not mutate the input array', () => {
    const samples = [5, 1, 4, 2, 3];
    const before = [...samples];
    computePercentile(samples, 0.5);
    expect(samples).toEqual(before);
  });
});
