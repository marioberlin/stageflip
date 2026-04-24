// packages/export-html5-zip/src/fallback/render-gif.ts
// RGBA[] → animated GIF encoder via gifenc (MIT). The encoder quantises
// each frame's palette on the fly and produces a single looping GIF.
//
// Determinism: gifenc's palette quantisation is deterministic for
// identical input bytes — same pixels → same palette → same output.

import { GIFEncoder, applyPalette, quantize } from 'gifenc';

import type { RgbaFrame } from './types.js';

export interface EncodeGifOptions {
  /** Per-frame delay in milliseconds. Default 250. */
  readonly frameDelayMs?: number;
  /** Palette size, up to 256 colours. Default 128 — smaller files. */
  readonly paletteSize?: number;
}

/**
 * Encode a list of RGBA frames as an animated GIF. Every frame must
 * share the same dimensions (enforced). The returned buffer is a
 * byte-exact GIF89a with a `NETSCAPE2.0` looping extension.
 */
export function encodeGif(frames: readonly RgbaFrame[], opts: EncodeGifOptions = {}): Uint8Array {
  if (frames.length === 0) {
    throw new Error('encodeGif requires at least one frame');
  }
  const first = frames[0] as RgbaFrame;
  const width = first.width;
  const height = first.height;
  for (const frame of frames) {
    if (frame.width !== width || frame.height !== height) {
      throw new Error(
        `GIF frames must all share dimensions — first is ${width}x${height}, ` +
          `later frame is ${frame.width}x${frame.height}`,
      );
    }
    if (frame.bytes.length !== width * height * 4) {
      throw new Error(`RgbaFrame byte length ${frame.bytes.length} does not match width*height*4`);
    }
  }

  const frameDelayMs = opts.frameDelayMs ?? 250;
  const paletteSize = Math.min(Math.max(opts.paletteSize ?? 128, 2), 256);

  const gif = GIFEncoder();
  for (const frame of frames) {
    const palette = quantize(frame.bytes, paletteSize);
    const indexed = applyPalette(frame.bytes, palette);
    gif.writeFrame(indexed, width, height, {
      palette,
      delay: frameDelayMs,
    });
  }
  gif.finish();
  return gif.bytes();
}
