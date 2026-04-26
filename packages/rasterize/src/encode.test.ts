// packages/rasterize/src/encode.test.ts
// Unit coverage for the PNG encode wrapper. Pins the default constants and
// exercises the ENCODE_FAILED path. Pixel-level round-trip lives at the
// rasterize-level integration tests.

import { describe, expect, it } from 'vitest';
import { decodePng } from './decode.js';
import { DEFAULT_COMPRESSION_LEVEL, DEFAULT_FILTER_TYPE, encodePng } from './encode.js';
import { RasterizeError } from './types.js';

describe('encode constants', () => {
  it('pins DEFAULT_COMPRESSION_LEVEL = 6 (T-245 spec §3, AC #3)', () => {
    expect(DEFAULT_COMPRESSION_LEVEL).toBe(6);
  });

  it('pins DEFAULT_FILTER_TYPE = -1 (pngjs 7 sentinel for "use all filters") (AC #4)', () => {
    // pngjs 7 doesn't publish a `constants.PNG_ALL_FILTERS`. The canonical
    // value for adaptive per-row filter selection is -1 (see filter-pack.js).
    expect(DEFAULT_FILTER_TYPE).toBe(-1);
  });
});

describe('encodePng', () => {
  it('round-trips a simple RGBA buffer through encode + decode', () => {
    const rgba = Buffer.alloc(4 * 4 * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 100;
      rgba[i + 1] = 150;
      rgba[i + 2] = 200;
      rgba[i + 3] = 255;
    }
    const png = encodePng({
      width: 4,
      height: 4,
      rgba,
      compressionLevel: DEFAULT_COMPRESSION_LEVEL,
      filterType: DEFAULT_FILTER_TYPE,
    });
    const decoded = decodePng(png);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);
    expect(decoded.data[0]).toBe(100);
    expect(decoded.data[1]).toBe(150);
    expect(decoded.data[2]).toBe(200);
    expect(decoded.data[3]).toBe(255);
  });

  it('produces byte-identical output for the same RGBA + same options', () => {
    const rgba = Buffer.from(Array.from({ length: 64 }, (_v, i) => i % 256));
    const opts = {
      width: 4,
      height: 4,
      rgba,
      compressionLevel: DEFAULT_COMPRESSION_LEVEL,
      filterType: DEFAULT_FILTER_TYPE,
    };
    const a = encodePng(opts);
    const b = encodePng(opts);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('produces different bytes for different compressionLevel (AC #18)', () => {
    const rgba = Buffer.alloc(8 * 8 * 4);
    for (let i = 0; i < rgba.length; i++) rgba[i] = i % 256;
    const a = encodePng({
      width: 8,
      height: 8,
      rgba,
      compressionLevel: 0,
      filterType: DEFAULT_FILTER_TYPE,
    });
    const b = encodePng({
      width: 8,
      height: 8,
      rgba,
      compressionLevel: 9,
      filterType: DEFAULT_FILTER_TYPE,
    });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('throws ENCODE_FAILED when pngjs rejects a malformed option', () => {
    // The rasterize entry function validates filterType before reaching
    // here, but encodePng itself trusts its caller. An invalid filter type
    // makes pngjs's per-row filter dispatch fall through (`filters[sel]`
    // is not a function) — the throw is wrapped as ENCODE_FAILED.
    const rgba = Buffer.alloc(8 * 8 * 4);
    let thrown: unknown = null;
    try {
      encodePng({
        width: 8,
        height: 8,
        rgba,
        compressionLevel: DEFAULT_COMPRESSION_LEVEL,
        filterType: 100, // invalid — only -1 or 0..4 are accepted
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(RasterizeError);
    expect((thrown as RasterizeError).code).toBe('ENCODE_FAILED');
    expect((thrown as RasterizeError).cause).toBeDefined();
  });
});
