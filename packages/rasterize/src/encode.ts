// packages/rasterize/src/encode.ts
// PNG encode wrapper around pngjs's sync writer. Pins compressionLevel +
// filterType so output bytes are byte-deterministic across calls (T-245
// spec §3 + AC #17). Different option values produce different bytes — the
// determinism contract is per-(input, options) tuple, not absolute.

import { PNG } from 'pngjs';
import { RasterizeError } from './types.js';

/**
 * Default filter type. T-245 spec §3 names this `pngjs.constants.PNG_ALL_FILTERS`
 * — i.e. adaptive per-row filter selection across the 5 filter algorithms
 * defined by ISO/IEC 15948:2003 §9.2. In pngjs 7.x the canonical value for
 * "use all filters / pick the best per row" is `-1` (see
 * `node_modules/pngjs/lib/filter-pack.js` line 132–135: when the option is
 * absent OR equals `-1`, `filterTypes = [0, 1, 2, 3, 4]`). pngjs 7 doesn't
 * publish a `constants.PNG_ALL_FILTERS` symbol; `-1` is the equivalent
 * sentinel and is what we pin so the value is explicit at the call site.
 */
export const DEFAULT_FILTER_TYPE = -1;

/**
 * Pinned default compression level (0–9). T-245 spec §1 + AC #3 fix this at
 * 6. Note this differs from pngjs 7's bare default of 9 — pinning makes the
 * compression cost explicit and matches the spec's "reasonable size/speed
 * compromise" rationale. Different levels produce different bytes; consumers
 * relying on byte-stable hashes should not override unless they pin the
 * value themselves.
 */
export const DEFAULT_COMPRESSION_LEVEL = 6;

export interface EncodeOptions {
  width: number;
  height: number;
  /** RGBA bytes (length = width * height * 4). */
  rgba: Buffer;
  compressionLevel: number;
  filterType: number;
}

/**
 * Encode an RGBA buffer to PNG bytes. Throws `RasterizeError` with code
 * `ENCODE_FAILED` if pngjs's sync writer throws — surfaces unexpected
 * upstream failures rather than silently emitting empty bytes.
 */
export function encodePng(opts: EncodeOptions): Uint8Array {
  const png = new PNG({
    width: opts.width,
    height: opts.height,
    deflateLevel: opts.compressionLevel,
    filterType: opts.filterType,
  });
  png.data = opts.rgba;
  let buffer: Buffer;
  try {
    buffer = PNG.sync.write(png, {
      deflateLevel: opts.compressionLevel,
      filterType: opts.filterType,
    });
  } catch (cause) {
    throw new RasterizeError('ENCODE_FAILED', 'pngjs failed to encode cropped buffer', cause);
  }
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
