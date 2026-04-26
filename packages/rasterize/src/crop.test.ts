// packages/rasterize/src/crop.test.ts
// Unit coverage for the clamp + RGBA-buffer crop. The visible pixel-exact
// tests live at the rasterize-level (`rasterize.test.ts`) where we can
// round-trip through encode + decode; here we pin the math directly on raw
// buffers to keep failures localized.

import { describe, expect, it } from 'vitest';
import { clampBbox, cropRgba } from './crop.js';
import { RasterizeError } from './types.js';

describe('clampBbox', () => {
  it('returns the bbox unchanged when fully inside the source', () => {
    const rect = clampBbox({ x: 10, y: 10, width: 20, height: 20 }, 0, 100, 100);
    expect(rect).toEqual({ x: 10, y: 10, width: 20, height: 20 });
  });

  it('grows by paddingPx on each side when there is room', () => {
    const rect = clampBbox({ x: 40, y: 40, width: 20, height: 20 }, 16, 100, 100);
    // 40-16=24, 40-16=24, width 20+32=52, height 20+32=52
    expect(rect).toEqual({ x: 24, y: 24, width: 52, height: 52 });
  });

  it('clamps top-left without zero-padding (AC #7)', () => {
    // bbox starting at -10,-10 with size 20×20: visible region is 0..10
    const rect = clampBbox({ x: -10, y: -10, width: 20, height: 20 }, 0, 100, 100);
    expect(rect).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('clamps bottom-right without zero-padding (AC #8)', () => {
    // 100×100 source, bbox 90,90,20,20 → visible region 90..100
    const rect = clampBbox({ x: 90, y: 90, width: 20, height: 20 }, 0, 100, 100);
    expect(rect).toEqual({ x: 90, y: 90, width: 10, height: 10 });
  });

  it('clamps padding into source bounds', () => {
    // bbox at 0,0,10,10 with paddingPx=8 → would extend to -8,-8 ; clamp to 0,0,18,18
    const rect = clampBbox({ x: 0, y: 0, width: 10, height: 10 }, 8, 100, 100);
    expect(rect).toEqual({ x: 0, y: 0, width: 18, height: 18 });
  });

  it('throws BBOX_OUT_OF_BOUNDS when there is no intersection (AC #12)', () => {
    expect(() => clampBbox({ x: 1000, y: 1000, width: 1, height: 1 }, 0, 100, 100)).toThrow(
      RasterizeError,
    );
    try {
      clampBbox({ x: 1000, y: 1000, width: 1, height: 1 }, 0, 100, 100);
    } catch (err) {
      expect((err as RasterizeError).code).toBe('BBOX_OUT_OF_BOUNDS');
    }
  });

  it('treats a bbox flush against a source edge as in-bounds', () => {
    // bbox at right edge: x=99, width=1 → cx2=100, width=1
    const rect = clampBbox({ x: 99, y: 99, width: 1, height: 1 }, 0, 100, 100);
    expect(rect).toEqual({ x: 99, y: 99, width: 1, height: 1 });
  });
});

describe('cropRgba', () => {
  it('copies the requested rectangle out of a row-major buffer', () => {
    // 4×4 source where pixel (x,y) has R = x*16 + y, others 0.
    const source = Buffer.alloc(4 * 4 * 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        source[(y * 4 + x) * 4] = x * 16 + y;
      }
    }
    const out = cropRgba(source, 4, { x: 1, y: 1, width: 2, height: 2 });
    expect(out.length).toBe(2 * 2 * 4);
    // (1,1) → R=17, (2,1) → R=33, (1,2) → R=18, (2,2) → R=34
    expect(out[0]).toBe(17);
    expect(out[4]).toBe(33);
    expect(out[8]).toBe(18);
    expect(out[12]).toBe(34);
  });

  it('returns a tightly packed buffer (length = w*h*4)', () => {
    const source = Buffer.alloc(10 * 10 * 4);
    const out = cropRgba(source, 10, { x: 2, y: 3, width: 5, height: 7 });
    expect(out.length).toBe(5 * 7 * 4);
  });
});
