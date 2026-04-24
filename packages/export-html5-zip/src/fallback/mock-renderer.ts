// packages/export-html5-zip/src/fallback/mock-renderer.ts
// Test / preview FrameRenderer that returns a solid-colour RGBA buffer.
// The fill colour varies with `frameIndex` so GIF frames produce a
// distinguishable palette and encoders don't elide identical frames.

import type { BannerSize } from '../types.js';
import type { FrameRenderer, RgbaFrame } from './types.js';

export interface SolidColorRendererOptions {
  /** Base colour at frame 0 as [R, G, B, A] in 0..255. Default black opaque. */
  readonly baseColor?: readonly [number, number, number, number];
  /** Per-frame R/G/B shift (mod 256). Default 8. */
  readonly frameShift?: number;
}

/**
 * Deterministic solid-colour frame renderer for tests. Fill colour =
 * `baseColor + (frameShift * frameIndex)` per channel, mod 256. Alpha
 * is fixed at `baseColor[3]`.
 */
export function createSolidColorFrameRenderer(opts: SolidColorRendererOptions = {}): FrameRenderer {
  const baseColor = opts.baseColor ?? [0, 0, 0, 255];
  const frameShift = opts.frameShift ?? 8;

  return {
    async renderFrame(size: BannerSize, frameIndex: number): Promise<RgbaFrame> {
      const width = size.width;
      const height = size.height;
      const bytes = new Uint8Array(width * height * 4);
      const r = (baseColor[0] + frameShift * frameIndex) & 0xff;
      const g = (baseColor[1] + frameShift * frameIndex) & 0xff;
      const b = (baseColor[2] + frameShift * frameIndex) & 0xff;
      const a = baseColor[3] ?? 255;
      for (let i = 0; i < bytes.length; i += 4) {
        bytes[i] = r;
        bytes[i + 1] = g;
        bytes[i + 2] = b;
        bytes[i + 3] = a;
      }
      return { width, height, bytes };
    },
  };
}
