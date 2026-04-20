// packages/testing/src/smoke.test.ts
// Vitest pipeline smoke test. Proves that `pnpm test` resolves through turbo
// -> @stageflip/testing -> vitest -> this file. Intentionally trivial; actual
// shared test helpers land in T-011 and beyond.

import { describe, expect, it } from 'vitest';

describe('vitest pipeline smoke', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('has globals=false (must import from vitest)', () => {
    // If globals were on, `describe` and `it` would be ambient. Our base config
    // sets globals=false, so the explicit import above is required. This test
    // succeeds by the fact that this file compiled and ran.
    expect(typeof describe).toBe('function');
  });
});
