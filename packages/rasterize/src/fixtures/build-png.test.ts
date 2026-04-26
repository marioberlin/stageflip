// packages/rasterize/src/fixtures/build-png.test.ts
// Fixture-builder sanity. Confirms the `buildPng` / `buildCheckerboard` /
// `readPixel` helpers round-trip pixel data through pngjs. If these break,
// every other test file's signal is unreliable.

import { describe, expect, it } from 'vitest';
import { buildCheckerboard, buildPng, readDimensions, readPixel } from './build-png.js';

const RED = [255, 0, 0, 255] as const;
const BLUE = [0, 0, 255, 255] as const;

describe('buildPng', () => {
  it('produces a valid PNG with the expected dimensions', () => {
    const bytes = buildPng(8, 8, () => [...RED]);
    expect(readDimensions(bytes)).toEqual({ width: 8, height: 8 });
    expect(readPixel(bytes, 0, 0)).toEqual([...RED]);
    expect(readPixel(bytes, 7, 7)).toEqual([...RED]);
  });

  it('honors per-pixel color via the callback', () => {
    const bytes = buildPng(2, 2, (x, y) => (x === y ? [...RED] : [...BLUE]));
    expect(readPixel(bytes, 0, 0)).toEqual([...RED]);
    expect(readPixel(bytes, 1, 1)).toEqual([...RED]);
    expect(readPixel(bytes, 0, 1)).toEqual([...BLUE]);
    expect(readPixel(bytes, 1, 0)).toEqual([...BLUE]);
  });
});

describe('buildCheckerboard', () => {
  it('alternates colors on tile boundaries', () => {
    const bytes = buildCheckerboard(8, 4, [...RED], [...BLUE]);
    // top-left tile: RED
    expect(readPixel(bytes, 0, 0)).toEqual([...RED]);
    expect(readPixel(bytes, 3, 3)).toEqual([...RED]);
    // top-right tile (tx=1, ty=0 → BLUE)
    expect(readPixel(bytes, 4, 0)).toEqual([...BLUE]);
    expect(readPixel(bytes, 7, 3)).toEqual([...BLUE]);
    // bottom-left tile (tx=0, ty=1 → BLUE)
    expect(readPixel(bytes, 0, 4)).toEqual([...BLUE]);
    // bottom-right tile (tx=1, ty=1 → RED)
    expect(readPixel(bytes, 4, 4)).toEqual([...RED]);
  });
});

describe('readPixel', () => {
  it('throws when reading past the image extent', () => {
    const bytes = buildPng(2, 2, () => [...RED]);
    expect(() => readPixel(bytes, 5, 5)).toThrow(/out of range/);
  });
});
