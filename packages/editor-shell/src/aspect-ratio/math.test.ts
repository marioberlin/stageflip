// packages/editor-shell/src/aspect-ratio/math.test.ts
// Coverage for the multi-aspect layout math (T-182).

import { describe, expect, it } from 'vitest';

import { COMMON_ASPECTS, fitAspect, layoutAspectPreviews } from './math';

describe('COMMON_ASPECTS', () => {
  it('ships 16:9, 1:1, 9:16 with labels', () => {
    expect(COMMON_ASPECTS.map((a) => a.label)).toEqual(['16:9', '1:1', '9:16']);
  });
});

describe('fitAspect', () => {
  it('returns 0×0 for zero-sized bounds', () => {
    expect(fitAspect({ w: 16, h: 9 }, { width: 0, height: 100 })).toEqual({ width: 0, height: 0 });
    expect(fitAspect({ w: 16, h: 9 }, { width: 100, height: 0 })).toEqual({ width: 0, height: 0 });
  });

  it('returns 0×0 for invalid aspect', () => {
    expect(fitAspect({ w: 0, h: 9 }, { width: 100, height: 100 })).toEqual({ width: 0, height: 0 });
    expect(fitAspect({ w: 16, h: 0 }, { width: 100, height: 100 })).toEqual({
      width: 0,
      height: 0,
    });
  });

  it('height-constrains when bounds are wider than the aspect', () => {
    // bounds 400x100 (4:1), aspect 16:9 (~1.78) — height-limited
    expect(fitAspect({ w: 16, h: 9 }, { width: 400, height: 100 })).toEqual({
      width: (100 * 16) / 9,
      height: 100,
    });
  });

  it('width-constrains when bounds are taller than the aspect', () => {
    // bounds 100x400, aspect 16:9 — width-limited
    expect(fitAspect({ w: 16, h: 9 }, { width: 100, height: 400 })).toEqual({
      width: 100,
      height: (100 * 9) / 16,
    });
  });

  it('square aspect fits a square bounds exactly', () => {
    expect(fitAspect({ w: 1, h: 1 }, { width: 200, height: 200 })).toEqual({
      width: 200,
      height: 200,
    });
  });
});

describe('layoutAspectPreviews', () => {
  it('returns [] for no aspects', () => {
    expect(layoutAspectPreviews([], { width: 1000, height: 400 })).toEqual([]);
  });

  it('returns zero-sized placements when container has no width', () => {
    const out = layoutAspectPreviews(COMMON_ASPECTS, { width: 0, height: 400 });
    expect(out.map((p) => p.widthPx)).toEqual([0, 0, 0]);
    expect(out.map((p) => p.heightPx)).toEqual([0, 0, 0]);
  });

  it('returns zero-sized placements when container has no height', () => {
    const out = layoutAspectPreviews(COMMON_ASPECTS, { width: 1000, height: 0 });
    expect(out.map((p) => p.heightPx)).toEqual([0, 0, 0]);
  });

  it('shares a common height across previews', () => {
    const out = layoutAspectPreviews(COMMON_ASPECTS, { width: 1000, height: 500 });
    const heights = out.map((p) => p.heightPx);
    expect(new Set(heights).size).toBe(1);
  });

  it('caps height at maxHeightPx', () => {
    const out = layoutAspectPreviews(
      COMMON_ASPECTS,
      { width: 100000, height: 10000 },
      {
        maxHeightPx: 200,
      },
    );
    expect(out[0]?.heightPx).toBe(200);
  });

  it('sum of widths + gaps <= container width', () => {
    const container = { width: 1000, height: 400 };
    const gapPx = 20;
    const out = layoutAspectPreviews(COMMON_ASPECTS, container, { gapPx });
    const totalWidth = out.reduce((acc, p) => acc + p.widthPx, 0) + gapPx * (out.length - 1);
    expect(totalWidth).toBeLessThanOrEqual(container.width + 1e-6);
  });

  it('respects default gap of 12px', () => {
    const out = layoutAspectPreviews(
      [
        { w: 1, h: 1 },
        { w: 1, h: 1 },
      ],
      { width: 212, height: 100 },
    );
    // Two 1:1 previews at height H → widths 2H + 12 = 212 → H = 100
    expect(out.every((p) => p.heightPx === 100)).toBe(true);
    expect(out.every((p) => p.widthPx === 100)).toBe(true);
  });

  it('skips zero-ratio aspects in the ratio sum', () => {
    const out = layoutAspectPreviews(
      [
        { w: 0, h: 0 },
        { w: 1, h: 1 },
      ],
      { width: 100, height: 100 },
      { gapPx: 0 },
    );
    expect(out[0]).toEqual({ aspect: { w: 0, h: 0 }, widthPx: 0, heightPx: 100 });
    expect(out[1]?.widthPx).toBe(100);
  });
});
