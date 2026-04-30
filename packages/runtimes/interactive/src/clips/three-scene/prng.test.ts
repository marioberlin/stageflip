// packages/runtimes/interactive/src/clips/three-scene/prng.test.ts
// T-388 AC #11 — the legacy import path `from './prng.js'` inside
// `clips/three-scene/` continues to resolve after the implementation moved
// to `packages/runtimes/interactive/src/prng.ts`. The shim at this path
// re-exports the canonical implementation; the byte-for-byte equality test
// pins that no algorithmic drift occurred.
//
// The full T-384 / T-388 AC #18–#20 + #10 PRNG behaviour-tests now live at
// `packages/runtimes/interactive/src/prng.test.ts`; this file holds only
// the backward-compat surface.

import { describe, expect, it } from 'vitest';

import { createSeededPRNG as fromPackageRoot } from '../../prng.js';
import { createSeededPRNG as fromLegacyShim } from './prng.js';

describe('clips/three-scene/prng.js — re-export shim (T-388 AC #11)', () => {
  it('legacy import resolves to the same callable as the package-root export', () => {
    expect(fromLegacyShim).toBe(fromPackageRoot);
  });

  it('legacy shim preserves byte-for-byte sequences (T-388 AC #10 regression)', () => {
    // If the shim somehow re-implemented or re-bound to a different
    // function, this test would diverge from the post-extraction snapshot.
    const a = fromLegacyShim(0);
    const b = fromPackageRoot(0);
    for (let i = 0; i < 64; i += 1) {
      expect(a.random()).toBe(b.random());
    }
  });
});
