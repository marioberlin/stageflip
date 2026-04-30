// packages/runtimes/interactive/src/prng.test.ts
// T-384 ACs #18, #19, #20 — seeded PRNG determinism, reset, and seed
// independence. Moved from `clips/three-scene/prng.test.ts` per T-388
// D-T388-3 (third application of the primitive earns extraction).
//
// T-388 AC #10 — same seed produces an identical sequence to the pre-
// extraction location (regression pin against accidental algorithm drift).
// T-388 AC #11 — the legacy import path inside `clips/three-scene/` still
// resolves to this implementation (verified by the re-export shim test
// in `clips/three-scene/prng.test.ts`).

import { describe, expect, it } from 'vitest';

import { createSeededPRNG } from './prng.js';

describe('createSeededPRNG (T-384 AC #18, #19, #20; T-388 AC #10)', () => {
  it('AC #18 — same seed produces a byte-identical sequence on repeated runs', () => {
    const a = createSeededPRNG(42);
    const b = createSeededPRNG(42);
    const N = 1000;
    for (let i = 0; i < N; i += 1) {
      expect(a.random()).toBe(b.random());
    }
  });

  it('AC #18 / T-388 AC #10 — sequence is stable across seed=0 default (regression pin)', () => {
    // Pin the first 8 values for seed=0 so the sequence is anchored. Any
    // future PRNG change MUST update this fixture or convergence breaks.
    // T-388 AC #10 — the post-extraction implementation MUST emit the same
    // values as the pre-extraction location did. The fingerprint below is
    // copied verbatim from the original `clips/three-scene/prng.test.ts`
    // snapshot; if it drifts, the extraction broke determinism.
    const p = createSeededPRNG(0);
    const draws = Array.from({ length: 8 }, () => p.random());
    for (const v of draws) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const fingerprint = draws
      .slice(0, 4)
      .map((v) => v.toFixed(12))
      .join(',');
    expect(fingerprint).toBe('0.316593533615,0.875706985127,0.483300162945,0.005915207090');
  });

  it('AC #19 — reset() returns to the original seed sequence', () => {
    const p = createSeededPRNG(7);
    const first = Array.from({ length: 16 }, () => p.random());
    p.reset();
    const second = Array.from({ length: 16 }, () => p.random());
    expect(second).toEqual(first);
  });

  it('AC #20 — same seed yields identical sequences across two PRNGs (N=1000)', () => {
    const a = createSeededPRNG(99);
    const b = createSeededPRNG(99);
    const aDraws: number[] = [];
    const bDraws: number[] = [];
    for (let i = 0; i < 1000; i += 1) {
      aDraws.push(a.random());
      bDraws.push(b.random());
    }
    expect(aDraws).toEqual(bDraws);
  });

  it('AC #20 — different seeds produce different sequences (statistical)', () => {
    const a = createSeededPRNG(1);
    const b = createSeededPRNG(2);
    let mismatch = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (a.random() !== b.random()) mismatch += 1;
    }
    expect(mismatch).toBeGreaterThan(990);
  });

  it('returns floats in [0, 1) for a wide seed range', () => {
    for (const seed of [0, 1, 7, 42, 99, 12345, 0x7fffffff]) {
      const p = createSeededPRNG(seed);
      for (let i = 0; i < 64; i += 1) {
        const v = p.random();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });
});
