// packages/export-html5-zip/src/fallback/render-png.ts
// RGBA → PNG encoder via pngjs (MIT). Deterministic — identical input
// bytes produce byte-identical PNG output under pngjs's sync writer.

import { PNG } from 'pngjs';

import type { RgbaFrame } from './types.js';

/** Encode an RGBA frame as PNG bytes. */
export function encodePng(frame: RgbaFrame): Uint8Array {
  if (frame.bytes.length !== frame.width * frame.height * 4) {
    throw new Error(
      `RgbaFrame byte length ${frame.bytes.length} does not match width*height*4 ` +
        `(${frame.width * frame.height * 4})`,
    );
  }
  const png = new PNG({ width: frame.width, height: frame.height });
  png.data = Buffer.from(frame.bytes);
  // `PNG.sync.write` is deterministic: no compression level entropy, no
  // wall-clock time in the output stream.
  const buffer = PNG.sync.write(png);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
