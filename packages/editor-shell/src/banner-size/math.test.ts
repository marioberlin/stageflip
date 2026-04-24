// packages/editor-shell/src/banner-size/math.test.ts
// T-201 — layoutBannerSizes pure-math coverage.

import { describe, expect, it } from 'vitest';

import { type BannerSize, layoutBannerSizes } from './math';

const IAB: BannerSize[] = [
  { width: 300, height: 250, id: 'mpu' },
  { width: 728, height: 90, id: 'lb' },
  { width: 160, height: 600, id: 'skyscraper' },
];

describe('layoutBannerSizes', () => {
  it('returns an empty array for empty input', () => {
    expect(layoutBannerSizes([], { width: 1000, height: 600 })).toEqual([]);
  });

  it('returns zero-sized placements for zero-width container', () => {
    const out = layoutBannerSizes(IAB, { width: 0, height: 600 });
    expect(out).toHaveLength(3);
    for (const p of out) expect(p.widthPx).toBe(0);
  });

  it('returns zero-sized placements for zero-height container', () => {
    const out = layoutBannerSizes(IAB, { width: 1000, height: 0 });
    expect(out).toHaveLength(3);
    for (const p of out) expect(p.heightPx).toBe(0);
  });

  it('applies the same uniform scale to every cell', () => {
    const out = layoutBannerSizes(IAB, { width: 1500, height: 800 });
    const scales = new Set(out.map((p) => p.scale));
    expect(scales.size).toBe(1);
  });

  it('caps scale at maxScale (default 1) for over-large containers', () => {
    const out = layoutBannerSizes(IAB, { width: 10_000, height: 10_000 });
    expect(out[0]?.scale).toBe(1);
    expect(out[0]?.widthPx).toBe(300);
    expect(out[0]?.heightPx).toBe(250);
  });

  it('scales down when the row would overflow container.width', () => {
    // Sum of IAB widths = 1188 + 2*16 gap = 1220. Container 600 wide → scale ≈ 0.466
    const out = layoutBannerSizes(IAB, { width: 600, height: 800 }, { gapPx: 16 });
    const scale = out[0]?.scale ?? 0;
    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThan(0.4);
    // Scaled widths + gaps should equal container.width (within rounding)
    const totalWidth = out.reduce((acc, p) => acc + p.widthPx, 0) + 16 * 2;
    expect(totalWidth).toBeCloseTo(600, 0);
  });

  it('scales down when the tallest banner would overflow container.height', () => {
    // 160x600 is the tallest; container 600 wide × 200 tall → height-constrained
    const out = layoutBannerSizes(IAB, { width: 1500, height: 200 });
    const scale = out[0]?.scale ?? 0;
    const scaledMaxHeight = Math.max(...out.map((p) => p.heightPx));
    expect(scaledMaxHeight).toBeLessThanOrEqual(200 + 0.001);
    expect(scale).toBeLessThan(1);
  });

  it('respects a caller-supplied maxScale > 1', () => {
    const out = layoutBannerSizes(IAB, { width: 10_000, height: 10_000 }, { maxScale: 2 });
    expect(out[0]?.scale).toBe(2);
  });

  it('clamps to minScale when the container is impossibly small', () => {
    const out = layoutBannerSizes(IAB, { width: 1, height: 1 }, { minScale: 0.05 });
    expect(out[0]?.scale).toBe(0.05);
  });

  it('preserves banner proportions regardless of scale', () => {
    const out = layoutBannerSizes(IAB, { width: 600, height: 300 });
    for (const p of out) {
      const widthRatio = p.widthPx / p.size.width;
      const heightRatio = p.heightPx / p.size.height;
      expect(widthRatio).toBeCloseTo(heightRatio, 4);
    }
  });

  it('is deterministic for identical input', () => {
    const a = layoutBannerSizes(IAB, { width: 800, height: 400 });
    const b = layoutBannerSizes(IAB, { width: 800, height: 400 });
    expect(a).toEqual(b);
  });

  it('handles a single-banner row (zero gap contribution)', () => {
    const out = layoutBannerSizes([{ width: 300, height: 250 }], { width: 150, height: 600 });
    expect(out).toHaveLength(1);
    expect(out[0]?.widthPx).toBeCloseTo(150, 1);
  });

  it('skips zero-width banners cleanly', () => {
    const out = layoutBannerSizes([{ width: 0, height: 0 }, ...IAB], { width: 1000, height: 600 });
    expect(out).toHaveLength(4);
    // A zero-width banner should stay at 0×0 after scaling.
    expect(out[0]?.widthPx).toBe(0);
    expect(out[0]?.heightPx).toBe(0);
  });
});
