// packages/parity/src/psnr.ts
// Peak signal-to-noise ratio between two `ParityImageData`s.
//
// Reported in decibels. Higher is better. Identical images yield
// `Infinity`. Pure arithmetic — no sharp, no async, no IO.
//
// We compute on RGB channels by default (alpha ignored) because the
// parity harness scores rendered output where alpha is almost always
// fully opaque and including it would hide channel drift. An
// `includeAlpha` option lifts the restriction for cases where the
// harness does care about transparency (e.g. export-PDF paths with
// semi-transparent elements — future work).

import { type ParityImageData, assertSameDimensions } from './image-data';

export interface PsnrOptions {
  /** Include the alpha channel in the mean-squared-error. Default: false. */
  readonly includeAlpha?: boolean;
}

/**
 * Compute PSNR (dB) between two equally-sized RGBA images. Throws on
 * dimension mismatch. Returns `Infinity` when the images are
 * bit-identical on the compared channels.
 */
export function psnr(a: ParityImageData, b: ParityImageData, opts?: PsnrOptions): number {
  assertSameDimensions(a, b);
  const includeAlpha = opts?.includeAlpha ?? false;
  const channelsPerPixel = includeAlpha ? 4 : 3;
  const pixels = a.width * a.height;
  const totalSamples = pixels * channelsPerPixel;
  if (totalSamples === 0) {
    throw new Error('parity: cannot compute PSNR on an empty image');
  }
  let sumSquaredError = 0;
  const step = 4;
  const end = a.data.length;
  for (let i = 0; i < end; i += step) {
    const dr = (a.data[i] ?? 0) - (b.data[i] ?? 0);
    const dg = (a.data[i + 1] ?? 0) - (b.data[i + 1] ?? 0);
    const db = (a.data[i + 2] ?? 0) - (b.data[i + 2] ?? 0);
    sumSquaredError += dr * dr + dg * dg + db * db;
    if (includeAlpha) {
      const da = (a.data[i + 3] ?? 0) - (b.data[i + 3] ?? 0);
      sumSquaredError += da * da;
    }
  }
  if (sumSquaredError === 0) return Number.POSITIVE_INFINITY;
  const mse = sumSquaredError / totalSamples;
  const MAX = 255;
  return 10 * Math.log10((MAX * MAX) / mse);
}
