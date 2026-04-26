// packages/rasterize/src/decode.test.ts
// Unit-level coverage for the PNG decode wrapper. Top-level integration
// tests exercise the same paths via `rasterizeFromThumbnail`; these unit
// tests pin the per-error-shape behavior (AC #10, #11).

import { describe, expect, it } from 'vitest';
import { decodePng } from './decode.js';
import { buildPng } from './fixtures/build-png.js';
import { RasterizeError } from './types.js';

describe('decodePng', () => {
  it('decodes a valid PNG into width/height/data', () => {
    const bytes = buildPng(4, 3, () => [10, 20, 30, 255]);
    const decoded = decodePng(bytes);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(3);
    expect(decoded.data.length).toBe(4 * 3 * 4);
    expect(decoded.data[0]).toBe(10);
    expect(decoded.data[1]).toBe(20);
    expect(decoded.data[2]).toBe(30);
    expect(decoded.data[3]).toBe(255);
  });

  it('throws INVALID_PNG on empty bytes (AC #11)', () => {
    expect(() => decodePng(new Uint8Array(0))).toThrow(RasterizeError);
    try {
      decodePng(new Uint8Array(0));
    } catch (err) {
      expect(err).toBeInstanceOf(RasterizeError);
      expect((err as RasterizeError).code).toBe('INVALID_PNG');
    }
  });

  it('throws INVALID_PNG on bytes shorter than the PNG signature', () => {
    expect(() => decodePng(Uint8Array.of(0x89, 0x50, 0x4e))).toThrow(RasterizeError);
    try {
      decodePng(Uint8Array.of(0x89, 0x50, 0x4e));
    } catch (err) {
      expect((err as RasterizeError).code).toBe('INVALID_PNG');
    }
  });

  it('throws INVALID_PNG on signature mismatch (AC #10)', () => {
    // Looks like a JPEG (FF D8 FF E0 ...) but length is fine.
    const bogus = new Uint8Array(64);
    bogus[0] = 0xff;
    bogus[1] = 0xd8;
    bogus[2] = 0xff;
    bogus[3] = 0xe0;
    expect(() => decodePng(bogus)).toThrow(RasterizeError);
    try {
      decodePng(bogus);
    } catch (err) {
      expect((err as RasterizeError).code).toBe('INVALID_PNG');
      expect((err as Error).message).toMatch(/89 50 4E 47/);
    }
  });

  it('throws INVALID_PNG when pngjs rejects a corrupt body', () => {
    // Valid signature + garbage afterwards. pngjs throws on missing IHDR.
    const corrupt = new Uint8Array(64);
    corrupt.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => decodePng(corrupt)).toThrow(RasterizeError);
    try {
      decodePng(corrupt);
    } catch (err) {
      expect((err as RasterizeError).code).toBe('INVALID_PNG');
      // cause is the wrapped pngjs error
      expect((err as RasterizeError).cause).toBeDefined();
    }
  });
});
