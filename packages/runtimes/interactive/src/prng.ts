// packages/runtimes/interactive/src/prng.ts
// Seeded PRNG primitive — package-root location after T-388 D-T388-3
// extraction. Originally shipped at `clips/three-scene/prng.ts` (T-384);
// the third application of the primitive (T-388 default-poster
// silhouette generator) earned its place per CLAUDE.md "three similar
// lines beat a premature abstraction".
//
// The legacy import path `clips/three-scene/prng.js` continues to resolve
// via a re-export shim so T-384's existing call sites are unaffected
// (T-388 AC #11). Byte-for-byte sequences are pinned by the regression
// test in `prng.test.ts` (T-388 AC #10).
//
// Algorithm: xorshift32. Reference:
//   Marsaglia, G. (2003). "Xorshift RNGs". Journal of Statistical Software 8(14).
//   https://www.jstatsoft.org/article/view/v008i14
//
// Why xorshift32 (vs. sfc32 / mulberry32 / pcg):
//   - Single 32-bit state — trivial to reset.
//   - Period 2^32 - 1 — comfortably exceeds N=1000 draws per frame at 60fps
//     for a clip duration measured in minutes.
//   - Bit-identical across V8 / SpiderMonkey / WebKit because every operation
//     stays inside `(value | 0)` 32-bit signed arithmetic.
//
// DETERMINISM: pure integer arithmetic. No `Date.now`, no `Math.random`,
// no time / network / random APIs. Browser-safe and Node-safe — no Node
// imports, no Web APIs. Suitable for use inside both the broad-rule
// exempt interactive tier and any future deterministic consumer.

/**
 * Public surface of the seeded PRNG handed to author setup callbacks
 * (three-scene) and to the default-poster silhouette generator (voice).
 */
export interface SeededPRNG {
  /**
   * Returns a deterministic float in `[0, 1)`. Identical seed → identical
   * sequence across runs / nodes / OSes (T-384 AC #18; T-388 AC #4 / #10).
   */
  random(): number;
  /**
   * Reset to the original seed. Useful for replay scenarios — record-mode
   * scrub-back or convergence comparison runs (T-384 AC #19).
   */
  reset(): void;
}

/**
 * Build a {@link SeededPRNG} bound to `seed`. Seeds outside the 32-bit
 * unsigned range are coerced via `>>> 0`; seed=0 is replaced by a non-zero
 * constant because xorshift cannot escape the all-zero state.
 *
 * The constant `0x9e3779b9` is the golden-ratio reciprocal, a standard
 * non-zero substitute used in numeric-recipes contexts. Pinned here so a
 * future seed-init refactor cannot silently change byte-identical output.
 */
export function createSeededPRNG(seed: number): SeededPRNG {
  const initialState = seed >>> 0 === 0 ? 0x9e3779b9 : seed >>> 0;
  let state = initialState;

  return {
    random(): number {
      // xorshift32 — three left/right shifts on a 32-bit signed integer.
      let x = state;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      // Normalize to a 32-bit unsigned integer, then map to [0, 1).
      state = x >>> 0;
      return state / 0x100000000;
    },
    reset(): void {
      state = initialState;
    },
  };
}
