// packages/parity/src/image-data.test.ts
// image-data loader + crop + dimension assertion.

import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { type ParityImageData, assertSameDimensions, crop, loadPng } from './image-data';

/** Encode a raw RGBA buffer as a PNG byte blob using pngjs (synchronous). */
function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const png = new PNG({ width, height, colorType: 6 });
  // PNG() allocates its own Buffer; write RGBA bytes into it.
  png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  const packed = PNG.sync.write(png);
  return new Uint8Array(packed.buffer, packed.byteOffset, packed.byteLength);
}

/** Produce a 2x2 RGBA PNG where each pixel is a distinct colour. */
function makeTestPng(): Uint8Array {
  const rgba = Uint8Array.from([
    255,
    0,
    0,
    255, // (0,0) red
    0,
    255,
    0,
    255, // (1,0) green
    0,
    0,
    255,
    255, // (0,1) blue
    255,
    255,
    0,
    255, // (1,1) yellow
  ]);
  return encodePng(2, 2, rgba);
}

function makeSolid(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number],
): ParityImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width, height, data };
}

describe('loadPng', () => {
  it('decodes a 2x2 RGBA PNG from a byte buffer', async () => {
    const png = makeTestPng();
    const img = await loadPng(png);
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    expect(img.data.length).toBe(2 * 2 * 4);
    // Pixel (0,0) is red.
    expect(Array.from(img.data.subarray(0, 4))).toEqual([255, 0, 0, 255]);
    // Pixel (1,1) is yellow.
    expect(Array.from(img.data.subarray(12, 16))).toEqual([255, 255, 0, 255]);
  });

  it('surfaces alpha channel unchanged when present in source', async () => {
    const rgba = Uint8Array.from([10, 20, 30, 128]); // 1x1 semi-transparent pixel
    const png = encodePng(1, 1, rgba);
    const img = await loadPng(png);
    expect(img.data.length).toBe(4);
    expect(Array.from(img.data)).toEqual([10, 20, 30, 128]);
  });

  it('rejects when the source buffer is not a valid PNG', async () => {
    const bogus = new Uint8Array([1, 2, 3, 4]);
    await expect(loadPng(bogus)).rejects.toThrow();
  });
});

describe('assertSameDimensions', () => {
  it('returns silently on matching dimensions', () => {
    const a = makeSolid(4, 4, [0, 0, 0, 255]);
    const b = makeSolid(4, 4, [255, 255, 255, 255]);
    expect(() => assertSameDimensions(a, b)).not.toThrow();
  });

  it('throws with both sizes quoted on mismatch', () => {
    const a = makeSolid(4, 4, [0, 0, 0, 255]);
    const b = makeSolid(8, 4, [0, 0, 0, 255]);
    expect(() => assertSameDimensions(a, b)).toThrow(/4x4 vs 8x4/);
  });
});

describe('crop', () => {
  it('copies a sub-rectangle out of the source image', async () => {
    const png = makeTestPng();
    const img = await loadPng(png);
    const topRight = crop(img, { x: 1, y: 0, width: 1, height: 1 });
    expect(topRight.width).toBe(1);
    expect(topRight.height).toBe(1);
    expect(Array.from(topRight.data)).toEqual([0, 255, 0, 255]); // green
  });

  it('copies a multi-row region with row stride correctness', async () => {
    const png = makeTestPng();
    const img = await loadPng(png);
    const right = crop(img, { x: 1, y: 0, width: 1, height: 2 });
    expect(right.width).toBe(1);
    expect(right.height).toBe(2);
    // Expected: green at (0,0), yellow at (0,1).
    expect(Array.from(right.data)).toEqual([0, 255, 0, 255, 255, 255, 0, 255]);
  });

  it('throws when region escapes bounds', () => {
    const img = makeSolid(4, 4, [0, 0, 0, 255]);
    expect(() => crop(img, { x: 2, y: 0, width: 4, height: 1 })).toThrow(/escapes image bounds/);
    expect(() => crop(img, { x: -1, y: 0, width: 1, height: 1 })).toThrow(/escapes image bounds/);
  });

  it('throws when region has non-positive size', () => {
    const img = makeSolid(4, 4, [0, 0, 0, 255]);
    expect(() => crop(img, { x: 0, y: 0, width: 0, height: 1 })).toThrow(/positive width\/height/);
    expect(() => crop(img, { x: 0, y: 0, width: 1, height: -1 })).toThrow(/positive width\/height/);
  });
});
