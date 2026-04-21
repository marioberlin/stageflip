// packages/parity/src/thresholds.ts
// Per-fixture parity thresholds + frame-failure budget.
//
// These are the knobs a parity fixture tunes. Everything else about
// scoring (PSNR/SSIM formulas, region cropping, operand ordering) is
// fixed by the library. A fixture's thresholds answer three questions:
//
//   1. How close is "close enough" on PSNR? (`minPsnr`, dB)
//   2. How close is "close enough" on SSIM? (`minSsim`, 0..1)
//   3. How many frames may drop below the bar before the fixture
//      itself is considered failed? (`maxFailingFrames`)
//
// The defaults below come from the T-100 plan row (PSNR ≥ configured —
// so we pick a conservative 30 dB; SSIM ≥ 0.97 on text-heavy regions —
// so 0.97 as the fixture-wide floor). Per-fixture overrides are how
// codec-specific budgets land later (h265 near-lossless vs vp9 lossy).

export interface ParityThresholds {
  /** Minimum acceptable PSNR in dB. Frames below this fail. */
  readonly minPsnr: number;
  /** Minimum acceptable mean SSIM (0..1). Frames below this fail. */
  readonly minSsim: number;
  /** Absolute number of frame-level failures allowed before the fixture fails. */
  readonly maxFailingFrames: number;
}

/**
 * Default thresholds — conservative enough that a lossless pipeline
 * passes and a visibly-broken one fails. Real fixtures are expected to
 * override on a per-codec / per-runtime basis.
 */
export const DEFAULT_THRESHOLDS: ParityThresholds = {
  minPsnr: 30,
  minSsim: 0.97,
  maxFailingFrames: 0,
};

/**
 * Merge a partial override onto the defaults. Omitted keys keep their
 * default. Guards against NaN / negatives because those always indicate
 * a fixture authoring bug, not a real threshold.
 */
export function resolveThresholds(overrides?: Partial<ParityThresholds>): ParityThresholds {
  const merged: ParityThresholds = { ...DEFAULT_THRESHOLDS, ...(overrides ?? {}) };
  if (!Number.isFinite(merged.minPsnr) || merged.minPsnr < 0) {
    throw new Error(`parity: minPsnr must be a non-negative finite number — got ${merged.minPsnr}`);
  }
  if (!Number.isFinite(merged.minSsim) || merged.minSsim < 0 || merged.minSsim > 1) {
    throw new Error(`parity: minSsim must be within [0, 1] — got ${merged.minSsim}`);
  }
  if (!Number.isInteger(merged.maxFailingFrames) || merged.maxFailingFrames < 0) {
    throw new Error(
      `parity: maxFailingFrames must be a non-negative integer — got ${merged.maxFailingFrames}`,
    );
  }
  return merged;
}
