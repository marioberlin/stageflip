// packages/runtimes/interactive/src/clips/three-scene/prng.ts
// Re-export shim — the canonical implementation moved to
// `packages/runtimes/interactive/src/prng.ts` per T-388 D-T388-3 (third
// application of the primitive earned extraction). This file preserves
// the legacy import path `from './prng.js'` for T-384 call sites under
// `clips/three-scene/` (factory.ts, the subpath index re-export). T-388
// AC #11 pins this backward-compat surface.
//
// The shim re-exports identifiers — there is no logic here. Byte-for-byte
// sequence equivalence is pinned by `packages/runtimes/interactive/src/
// prng.test.ts` (T-388 AC #10).

export { createSeededPRNG, type SeededPRNG } from '../../prng.js';
