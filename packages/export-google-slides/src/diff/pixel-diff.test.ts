// packages/export-google-slides/src/diff/pixel-diff.test.ts
// Pins per-pixel diff: identical PNGs → zero diff; rect insertion produces
// the expected diff count; perceptual diff scales with pixel-area changes.
// Underwrites B1 / AC #5 / AC #17 (whole-slide perceptual gate).

import { describe, expect, it } from 'vitest';
import { makePngWithRect, makeUniformPng } from '../../test-helpers/index.js';
import { computePixelDiff } from './pixel-diff.js';

describe('computePixelDiff', () => {
  it('identical PNGs produce zero diff', () => {
    const a = makeUniformPng(100, 80);
    const b = makeUniformPng(100, 80);
    const r = computePixelDiff(a, b);
    expect(r.perceptualDiff).toBe(0);
    expect(r.width).toBe(100);
    expect(r.height).toBe(80);
    // mask should be entirely zero.
    expect(Array.from(r.diffMask).every((v) => v === 0)).toBe(true);
  });

  it('throws when dimensions differ', () => {
    const a = makeUniformPng(100, 80);
    const b = makeUniformPng(120, 80);
    expect(() => computePixelDiff(a, b)).toThrow(/dimensions differ/);
  });

  it('insert a 10×10 rect on a uniform background → 100 diff pixels', () => {
    const bg: [number, number, number] = [200, 200, 200];
    const fg: [number, number, number] = [40, 40, 40];
    const a = makePngWithRect({ width: 100, height: 80, bgColor: bg });
    const b = makePngWithRect({
      width: 100,
      height: 80,
      bgColor: bg,
      rect: { x: 10, y: 10, width: 10, height: 10, color: fg },
    });
    const r = computePixelDiff(a, b);
    // 10*10 = 100 pixels different.
    let count = 0;
    for (const v of r.diffMask) if (v) count += 1;
    expect(count).toBe(100);
    expect(r.perceptualDiff).toBeCloseTo(100 / (100 * 80), 5);
  });

  it('respects channelDelta threshold (small differences ignored)', () => {
    const bg: [number, number, number] = [200, 200, 200];
    const subtle: [number, number, number] = [202, 202, 202];
    const a = makePngWithRect({ width: 50, height: 50, bgColor: bg });
    const b = makePngWithRect({
      width: 50,
      height: 50,
      bgColor: bg,
      rect: { x: 0, y: 0, width: 50, height: 50, color: subtle },
    });
    // Default channelDelta is 8 → 2-unit difference is below threshold.
    const r = computePixelDiff(a, b);
    expect(r.perceptualDiff).toBe(0);
  });
});
