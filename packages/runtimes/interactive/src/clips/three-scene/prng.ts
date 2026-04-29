// packages/runtimes/interactive/src/clips/three-scene/prng.ts
// Seeded PRNG for `ThreeSceneClip` author code (T-384 D-T384-5). ADR-005 §D2
// requires the wrapper to supply authors a deterministic random source so
// `Math.random()` (forbidden in this directory by T-309's tightened sub-rule)
// has a viable substitute.
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
// DETERMINISM SUB-RULE (T-309 / T-309a): this file lives under
// `packages/runtimes/interactive/src/clips/three-scene/**` and is therefore
// scanned by the path-based shader sub-rule. The body must NOT call any of
// {Date.now, performance.now, Math.random, setTimeout/setInterval,
// requestAnimationFrame/cancelAnimationFrame}. The xorshift implementation
// is pure integer arithmetic on the seeded state — sub-rule clean.
//
// Browser-safe: no Node imports, no Web APIs.

/**
 * Public surface of the seeded PRNG handed to author setup callbacks.
 */
export interface SeededPRNG {
  /**
   * Returns a deterministic float in `[0, 1)`. Identical seed → identical
   * sequence across runs / nodes / OSes (T-384 AC #18).
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
