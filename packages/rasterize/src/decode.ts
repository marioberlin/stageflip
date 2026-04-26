// packages/rasterize/src/decode.ts
// PNG decode wrapper around pngjs's sync reader. Surfaces invalid signatures
// + pngjs throws as `RasterizeError({ code: 'INVALID_PNG' })`. Returns a
// plain RGBA buffer view that the crop step can index without touching pngjs
// internals.

import { PNG } from 'pngjs';
import { RasterizeError } from './types.js';

/** Decoded PNG: dimensions + raw RGBA pixel buffer (length = w*h*4). */
export interface DecodedPng {
  width: number;
  height: number;
  /** RGBA bytes in row-major order. */
  data: Buffer;
}

/** PNG signature: first 8 bytes per ISO/IEC 15948:2003 §5.2. */
const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

/**
 * Decode PNG bytes to an RGBA pixel buffer. Throws `RasterizeError` with
 * code `INVALID_PNG` for empty input, signature mismatch, or pngjs decode
 * failure (e.g. corrupt IDAT, mismatched checksum).
 */
export function decodePng(bytes: Uint8Array): DecodedPng {
  if (bytes.length === 0) {
    throw new RasterizeError('INVALID_PNG', 'pageImage is empty');
  }
  if (bytes.length < PNG_SIGNATURE.length) {
    throw new RasterizeError(
      'INVALID_PNG',
      `pageImage too short (${bytes.length} bytes) to contain a PNG signature`,
    );
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new RasterizeError(
        'INVALID_PNG',
        'pageImage does not start with the PNG signature 89 50 4E 47 0D 0A 1A 0A',
      );
    }
  }
  let png: PNG;
  try {
    png = PNG.sync.read(Buffer.from(bytes));
  } catch (cause) {
    throw new RasterizeError('INVALID_PNG', 'pngjs failed to decode pageImage', cause);
  }
  return { width: png.width, height: png.height, data: png.data };
}
