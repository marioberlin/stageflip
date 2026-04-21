// packages/parity/src/score.ts
// Aggregates per-frame PSNR + SSIM into a fixture-level pass/fail.
//
// The shape mirrors how the parity CLI (T-101) and CI gate (T-103)
// consume the results: one row per frame with both metrics, plus a
// fixture-level verdict derived from the threshold budget.
//
// We deliberately keep the surface synchronous and pure once the
// images are loaded — IO lives at the caller boundary (tests,
// CLI). That makes the scorer trivially testable without any
// filesystem or harness plumbing.

import { type ParityImageData, type Region, crop } from './image-data';
import { type PsnrOptions, psnr } from './psnr';
import { type SsimOptions, ssim } from './ssim';
import { type ParityThresholds, resolveThresholds } from './thresholds';

export interface FrameInput {
  /** Frame number in the source composition — surfaced unchanged in the report. */
  readonly frame: number;
  /** Candidate frame produced by the backend under test. */
  readonly candidate: ParityImageData;
  /** Golden reference frame to score against. */
  readonly golden: ParityImageData;
  /**
   * Optional region focus — narrows SSIM + PSNR to a sub-rectangle.
   * Primary use: text-heavy regions where the plan mandates SSIM ≥ 0.97.
   */
  readonly region?: Region;
}

export interface FrameScore {
  readonly frame: number;
  readonly psnr: number;
  readonly ssim: number;
  readonly passed: boolean;
  /** Per-frame failure reasons (empty on pass). */
  readonly reasons: readonly string[];
}

export interface ScoreReport {
  readonly frames: readonly FrameScore[];
  /** Count of frames whose own `passed` flag was `false`. */
  readonly failingFrames: number;
  /** Lowest PSNR observed across scored frames. `Infinity` if no frames. */
  readonly minPsnr: number;
  /** Lowest SSIM observed across scored frames. `1` if no frames. */
  readonly minSsim: number;
  /**
   * Overall verdict after the `maxFailingFrames` budget is applied.
   *
   * **Empty-batch footgun**: an empty `frames` array trivially yields
   * `passed: true`. `scoreFrames` does not guard against this — the
   * caller (T-101 CLI / T-103 CI gate) is responsible for ensuring at
   * least one frame was scored before trusting a pass verdict.
   */
  readonly passed: boolean;
  /** Aggregate reasons — e.g. "3 frames failed; budget is 0". */
  readonly reasons: readonly string[];
  /** Resolved thresholds applied during scoring (post-merge with defaults). */
  readonly thresholds: ParityThresholds;
}

export interface ScoreOptions {
  /** Threshold overrides; unspecified keys use `DEFAULT_THRESHOLDS`. */
  readonly thresholds?: Partial<ParityThresholds>;
  /** Forwarded to every per-frame PSNR call. */
  readonly psnrOptions?: PsnrOptions;
  /**
   * Forwarded to every per-frame SSIM call. Per-frame `region` from
   * `FrameInput.region` takes precedence over `ssimOptions.region`.
   *
   * **Cross-metric coupling**: whichever region resolves (per-frame or
   * ssimOptions) also gates PSNR scoring for that frame — otherwise
   * cross-frame drift outside the focused area would dominate the PSNR
   * score while SSIM only cared about the region. Setting
   * `ssimOptions.region` therefore affects both metrics, not just SSIM.
   */
  readonly ssimOptions?: SsimOptions;
}

/**
 * Score a batch of frames against their goldens. Every frame is scored
 * independently; the aggregate verdict derives from the per-frame flags
 * and the `maxFailingFrames` budget.
 *
 * Throws only on upstream errors (dimension mismatch, empty image) —
 * threshold violations are reported as `passed: false`, never thrown.
 *
 * **Empty-input semantic**: `scoreFrames([])` returns
 * `{passed: true, frames: [], failingFrames: 0, minPsnr: Infinity,
 * minSsim: 1, reasons: []}` — there are no frames to fail. This is a
 * footgun for consumers whose fixture loaders can silently yield an
 * empty slice (path mismatch, renamed golden directory, swallowed IO
 * error). T-101 CLI and T-103 CI gate should verify at least one
 * frame was scored before treating `passed` as meaningful.
 */
export function scoreFrames(inputs: readonly FrameInput[], options?: ScoreOptions): ScoreReport {
  const thresholds = resolveThresholds(options?.thresholds);
  const frames: FrameScore[] = [];
  let minPsnr = Number.POSITIVE_INFINITY;
  let minSsim = 1;
  let failingFrames = 0;

  for (const input of inputs) {
    const region = input.region ?? options?.ssimOptions?.region;
    const framePsnr = region
      ? // PSNR respects the region too — otherwise cross-frame drift
        // outside the focused area would dominate the score.
        psnrWithRegion(input.candidate, input.golden, region, options?.psnrOptions)
      : psnr(input.candidate, input.golden, options?.psnrOptions);
    const frameSsim = ssim(input.candidate, input.golden, {
      ...options?.ssimOptions,
      ...(region ? { region } : {}),
    });
    const reasons: string[] = [];
    if (framePsnr < thresholds.minPsnr) {
      reasons.push(`PSNR ${framePsnr.toFixed(2)} < ${thresholds.minPsnr}`);
    }
    if (frameSsim < thresholds.minSsim) {
      reasons.push(`SSIM ${frameSsim.toFixed(4)} < ${thresholds.minSsim}`);
    }
    const passed = reasons.length === 0;
    if (!passed) failingFrames++;
    if (framePsnr < minPsnr) minPsnr = framePsnr;
    if (frameSsim < minSsim) minSsim = frameSsim;
    frames.push({ frame: input.frame, psnr: framePsnr, ssim: frameSsim, passed, reasons });
  }

  const aggregateReasons: string[] = [];
  if (failingFrames > thresholds.maxFailingFrames) {
    aggregateReasons.push(
      `${failingFrames} frame(s) failed; budget is ${thresholds.maxFailingFrames}`,
    );
  }

  return {
    frames,
    failingFrames,
    minPsnr,
    minSsim,
    passed: aggregateReasons.length === 0,
    reasons: aggregateReasons,
    thresholds,
  };
}

// Local helper — PSNR with the same region-crop semantics as SSIM.
// Kept private because the public PSNR function is pure per-pixel and
// region handling is a fixture-scoring concern.
function psnrWithRegion(
  a: ParityImageData,
  b: ParityImageData,
  region: Region,
  opts?: PsnrOptions,
): number {
  return psnr(crop(a, region), crop(b, region), opts);
}
