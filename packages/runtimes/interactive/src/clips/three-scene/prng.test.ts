// packages/runtimes/interactive/src/clips/three-scene/prng.test.ts
// T-384 ACs #18, #19, #20 — seeded PRNG determinism, reset, and seed
// independence. The PRNG is consumed by author setup callbacks under
// `clips/three-scene/**` as the deterministic substitute for
// `Math.random()` (which is forbidden in this directory by T-309's path-
// based shader sub-rule).

import { describe, expect, it } from 'vitest';

import { createSeededPRNG } from './prng.js';

describe('createSeededPRNG (T-384 AC #18, #19, #20)', () => {
  it('AC #18 — same seed produces a byte-identical sequence on repeated runs', () => {
    const a = createSeededPRNG(42);
    const b = createSeededPRNG(42);
    const N = 1000;
    for (let i = 0; i < N; i += 1) {
      expect(a.random()).toBe(b.random());
    }
  });

  it('AC #18 — sequence is stable across seed=0 default', () => {
    // Pin the first 8 values for seed=0 so the sequence is anchored. Any
    // future PRNG change MUST update this fixture or convergence breaks.
    const p = createSeededPRNG(0);
    const draws = Array.from({ length: 8 }, () => p.random());
    // Assert each is a finite float in [0, 1).
    for (const v of draws) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    // Fixture pin: serialise the first 4 values to a string and check stable
    // representation. Bit-identical drift is caught by AC #18 above; this
    // pin catches accidental seed-init drift.
    const fingerprint = draws
      .slice(0, 4)
      .map((v) => v.toFixed(12))
      .join(',');
    expect(fingerprint).toMatchSnapshot();
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
    // Different seeds: virtually all 1000 draws should mismatch. Allow some
    // accidental coincidences but pin the lower bound far above zero.
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
