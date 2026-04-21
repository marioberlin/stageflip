// packages/parity/src/ssim.ts
// Structural-similarity comparator — thin wrapper around `ssim.js`.
//
// `ssim.js` returns `{ mssim, ssim_map, performance }`. We surface just
// the mean SSIM (mssim) because that's what thresholds score against.
// Optional `region` trims both images to a sub-rectangle before
// scoring — used for per-region SSIM budgets ("text-heavy regions"
// per the T-100 plan row).
//
// We pass the `ssim.js` Options through untouched so callers can pick
// the variant (`'fast' | 'original' | 'bezkrovny' | 'weber'`). The
// default variant upstream is `'weber'`.

import ssimJs, { type Options as SsimJsOptions } from 'ssim.js';
import { type ParityImageData, type Region, assertSameDimensions, crop } from './image-data';

export interface SsimOptions {
  /** If provided, crop both images to this region before scoring. */
  readonly region?: Region;
  /** Forwarded to `ssim.js`. Partial — defaults picked by ssim.js. */
  readonly ssimJsOptions?: Partial<SsimJsOptions>;
}

/**
 * Compute mean SSIM between two equally-sized RGBA images. Returns a
 * value in [0, 1]; higher is more similar. Identical images score
 * `1`. Throws on dimension mismatch after the optional region crop.
 */
export function ssim(a: ParityImageData, b: ParityImageData, opts?: SsimOptions): number {
  const region = opts?.region;
  const left = region ? crop(a, region) : a;
  const right = region ? crop(b, region) : b;
  assertSameDimensions(left, right);
  const { mssim } = ssimJs(left, right, opts?.ssimJsOptions);
  return mssim;
}
