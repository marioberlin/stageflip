// packages/export-google-slides/src/diff/pixel-diff.ts
// Per-pixel diff between two PNGs. Decodes both via pngjs, walks RGBA, and
// produces a binary mask of "different" pixels using a configurable
// max-channel-delta threshold. Plus the whole-slide perceptual diff
// (count(diff) / total) consumed by the convergence loop's gating logic
// (T-252 spec §3, AC #17).
//
// Determinism: pure pixel arithmetic. No timing primitives, no randomness.

import { PNG } from 'pngjs';

/** Default per-channel delta tolerance. 8/255 ≈ 3% of intensity. */
export const DEFAULT_PIXEL_DELTA = 8;

export interface PixelDiffResult {
  /** Binary mask: 1 byte per pixel, value 1 where the pixel differs, else 0. */
  diffMask: Uint8Array;
  /** Width of the input PNGs. */
  width: number;
  /** Height of the input PNGs. */
  height: number;
  /** Whole-slide perceptual diff in [0, 1]: count(diff pixels) / total pixels. */
  perceptualDiff: number;
}

export interface PixelDiffOptions {
  /** Per-channel delta beyond which a pixel counts as different. Default 8. */
  channelDelta?: number;
}

/**
 * Compute the binary diff mask + perceptual-diff scalar for two PNGs.
 *
 * Both PNGs must be the same dimensions; mismatched inputs throw. The
 * caller (`runConvergenceLoop`) enforces this by passing the renderer the
 * exact dimensions returned from the Slides API thumbnail (B2 fix).
 */
export function computePixelDiff(
  pngA: Uint8Array,
  pngB: Uint8Array,
  options: PixelDiffOptions = {},
): PixelDiffResult {
  const channelDelta = options.channelDelta ?? DEFAULT_PIXEL_DELTA;
  const a = PNG.sync.read(Buffer.from(pngA));
  const b = PNG.sync.read(Buffer.from(pngB));
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `pixel-diff: PNG dimensions differ (${a.width}x${a.height} vs ${b.width}x${b.height})`,
    );
  }
  const width = a.width;
  const height = a.height;
  const total = width * height;
  const mask = new Uint8Array(total);
  let diffCount = 0;
  // pngjs exposes RGBA as 4 bytes per pixel (colorType 6); both PNGs are
  // expected to be RGBA. If the caller passes a colorType-2 (RGB) PNG
  // pngjs still expands to 4 bytes/pixel internally so this is safe.
  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const dr = Math.abs((a.data[off] ?? 0) - (b.data[off] ?? 0));
    const dg = Math.abs((a.data[off + 1] ?? 0) - (b.data[off + 1] ?? 0));
    const db = Math.abs((a.data[off + 2] ?? 0) - (b.data[off + 2] ?? 0));
    if (dr > channelDelta || dg > channelDelta || db > channelDelta) {
      mask[i] = 1;
      diffCount += 1;
    }
  }
  return {
    diffMask: mask,
    width,
    height,
    perceptualDiff: total > 0 ? diffCount / total : 0,
  };
}
