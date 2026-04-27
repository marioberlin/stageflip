// packages/export-google-slides/src/diff/connected-components.test.ts
// Pins 4-connectivity labeling, bbox extraction, and minPixelCount filter.
// Underwrites the production observation pipeline (B1).

import { describe, expect, it } from 'vitest';
import { findRegions } from './connected-components.js';

function maskFrom(rows: string[]): { mask: Uint8Array; width: number; height: number } {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < width; x++) {
      if (row[x] === '#') mask[y * width + x] = 1;
    }
  }
  return { mask, width, height };
}

describe('findRegions', () => {
  it('empty mask → no regions', () => {
    const { mask, width, height } = maskFrom(['.....', '.....']);
    expect(findRegions(mask, width, height)).toEqual([]);
  });

  it('single-pixel region produces a 1×1 bbox', () => {
    const { mask, width, height } = maskFrom(['..#..', '.....']);
    const regions = findRegions(mask, width, height);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ x: 2, y: 0, width: 1, height: 1, pixelCount: 1 });
  });

  it('two diagonally-touching pixels are TWO regions (4-connectivity)', () => {
    const { mask, width, height } = maskFrom(['#....', '.#...']);
    const regions = findRegions(mask, width, height);
    expect(regions).toHaveLength(2);
  });

  it('rectangular block produces a single bbox-matching region', () => {
    const { mask, width, height } = maskFrom(['..####.', '..####.', '..####.', '.......']);
    const regions = findRegions(mask, width, height);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ x: 2, y: 0, width: 4, height: 3, pixelCount: 12 });
  });

  it('multiple disjoint regions are returned in scan order', () => {
    const { mask, width, height } = maskFrom(['#..##', '#....', '...##']);
    const regions = findRegions(mask, width, height);
    expect(regions).toHaveLength(3);
    // Scan-order: top-left vertical pair, top-right pair, bottom-right pair.
    expect(regions[0]).toMatchObject({ x: 0, y: 0, width: 1, height: 2 });
    expect(regions[1]).toMatchObject({ x: 3, y: 0, width: 2, height: 1 });
    expect(regions[2]).toMatchObject({ x: 3, y: 2, width: 2, height: 1 });
  });

  it('minPixelCount filter drops small regions', () => {
    const { mask, width, height } = maskFrom(['#.##.', '..##.', '.....']);
    const regions = findRegions(mask, width, height, { minPixelCount: 3 });
    expect(regions).toHaveLength(1);
    expect(regions[0]?.pixelCount).toBe(4);
  });
});
