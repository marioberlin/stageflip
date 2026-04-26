// packages/import-pptx/src/geometries/index.test.ts
// Pin the registry coverage and the contract every preset generator
// upholds. T-242c batch 1 grew the list to 25; batch 2 takes it to 33;
// T-242d closes out at 36.

import { describe, expect, it } from 'vitest';
import { COVERED_PRESETS, HONORED_ADJUSTMENTS, PRESET_GENERATORS, geometryFor } from './index.js';

const T_242C_BATCH2_PRESETS = [
  // T-242a (6)
  'rightArrow',
  'wedgeRectCallout',
  'ribbon',
  'parallelogram',
  'leftBracket',
  'cloud',
  // T-242b first-wave (10)
  'leftArrow',
  'upArrow',
  'downArrow',
  'trapezoid',
  'chevron',
  'rightBracket',
  'leftBrace',
  'rightBrace',
  'sun',
  'heart',
  // T-242c batch 1 (9)
  'leftRightArrow',
  'upDownArrow',
  'bentArrow',
  'curvedRightArrow',
  'wedgeRoundRectCallout',
  'wedgeEllipseCallout',
  'cloudCallout',
  'borderCallout1',
  'borderCallout2',
  // T-242c batch 2 (8)
  'ribbon2',
  'verticalScroll',
  'horizontalScroll',
  'star10',
  'star12',
  'moon',
  'lightningBolt',
  'noSmoking',
];

describe('preset registry', () => {
  it('covers exactly the T-242a + T-242b first-wave + T-242c (batch 1 + batch 2) presets (33 total)', () => {
    expect(COVERED_PRESETS.slice().sort()).toEqual(T_242C_BATCH2_PRESETS.slice().sort());
  });

  it('every generator returns a non-empty SVG path string for a 100x100 box', () => {
    for (const name of COVERED_PRESETS) {
      const path = geometryFor(name, { w: 100, h: 100 });
      expect(path).toBeDefined();
      expect(path).not.toBe('');
      expect(path).toMatch(/^M /);
    }
  });

  it('every generator is deterministic (same inputs → identical output)', () => {
    for (const name of COVERED_PRESETS) {
      const a = geometryFor(name, { w: 200, h: 100 });
      const b = geometryFor(name, { w: 200, h: 100 });
      expect(a).toBe(b);
    }
  });

  it('returns undefined for an unmapped preset name', () => {
    // `chord`, `pie`, `donut` ship in T-242d (need <a:arcTo> / SVG `A`).
    expect(geometryFor('chord', { w: 100, h: 100 })).toBeUndefined();
    expect(geometryFor('pie', { w: 100, h: 100 })).toBeUndefined();
    expect(geometryFor('donut', { w: 100, h: 100 })).toBeUndefined();
  });

  it('every generator is callable directly', () => {
    for (const [, gen] of Object.entries(PRESET_GENERATORS)) {
      expect(typeof gen).toBe('function');
      expect(gen({ w: 50, h: 50 })).toBeTruthy();
    }
  });

  it('HONORED_ADJUSTMENTS lists every covered preset with an empty array', () => {
    // T-242b first-wave: every generator uses spec defaults; adj1 honoring
    // for `roundRect` happens outside this registry (in elements/shape.ts).
    for (const name of COVERED_PRESETS) {
      expect(HONORED_ADJUSTMENTS[name]).toEqual([]);
    }
  });
});

describe('rightArrow', () => {
  it('puts the head tip at (w, h/2)', () => {
    const d = geometryFor('rightArrow', { w: 200, h: 100 });
    expect(d).toContain('L 200 50');
  });
});

describe('leftArrow', () => {
  it('puts the head tip at (0, h/2)', () => {
    const d = geometryFor('leftArrow', { w: 200, h: 100 });
    expect(d).toContain('L 0 50');
  });
});

describe('upArrow', () => {
  it('puts the head tip at (w/2, 0)', () => {
    const d = geometryFor('upArrow', { w: 200, h: 100 });
    expect(d).toContain('L 100 0');
  });
});

describe('downArrow', () => {
  it('puts the head tip at (w/2, h)', () => {
    const d = geometryFor('downArrow', { w: 200, h: 100 });
    expect(d).toContain('L 100 100');
  });
});

describe('parallelogram', () => {
  it('slants the top-left corner by 25% of width', () => {
    const d = geometryFor('parallelogram', { w: 100, h: 50 });
    expect(d).toMatch(/^M 25 0 /);
  });
});

describe('trapezoid', () => {
  it('insets the top edge by 25% on each side', () => {
    const d = geometryFor('trapezoid', { w: 100, h: 50 });
    expect(d).toMatch(/^M 25 0 L 75 0 /);
  });
});

describe('chevron', () => {
  it('produces a 6-vertex notched-arrow path', () => {
    const d = geometryFor('chevron', { w: 100, h: 50 });
    // 1 M + 5 L + Z = 7 commands (M, then 5 L lines, then Z).
    const lCount = (d?.match(/L /g) ?? []).length;
    expect(lCount).toBe(5);
  });
});

describe('leftBracket / rightBracket', () => {
  it('leftBracket starts at top-right and runs counter-clockwise', () => {
    const d = geometryFor('leftBracket', { w: 20, h: 100 });
    expect(d).toBe('M 20 0 L 0 0 L 0 100 L 20 100');
  });

  it('rightBracket is the mirror', () => {
    const d = geometryFor('rightBracket', { w: 20, h: 100 });
    expect(d).toBe('M 0 0 L 20 0 L 20 100 L 0 100');
  });
});

describe('leftBrace / rightBrace', () => {
  it('leftBrace uses cubic Béziers for the curls', () => {
    const d = geometryFor('leftBrace', { w: 20, h: 100 });
    const cCount = (d?.match(/C /g) ?? []).length;
    expect(cCount).toBe(2);
  });

  it('rightBrace likewise uses 2 cubic Béziers', () => {
    const d = geometryFor('rightBrace', { w: 20, h: 100 });
    const cCount = (d?.match(/C /g) ?? []).length;
    expect(cCount).toBe(2);
  });
});

describe('sun', () => {
  it('produces 16 alternating-radius vertices (8 rays)', () => {
    const d = geometryFor('sun', { w: 100, h: 100 });
    // 1 M + 15 L + Z = 16 vertex commands.
    const total = (d?.match(/[ML] /g) ?? []).length;
    expect(total).toBe(16);
  });
});

describe('heart', () => {
  it('uses 4 cubic Béziers (two arches, two tip approaches)', () => {
    const d = geometryFor('heart', { w: 100, h: 100 });
    const cCount = (d?.match(/C /g) ?? []).length;
    expect(cCount).toBe(4);
  });
});

describe('cloud', () => {
  it('uses cubic-bezier humps (multiple C commands)', () => {
    const d = geometryFor('cloud', { w: 100, h: 80 });
    const cCount = (d?.match(/C /g) ?? []).length;
    expect(cCount).toBeGreaterThanOrEqual(6);
  });
});

// --- T-242c batch 1 ---------------------------------------------------------

describe('leftRightArrow', () => {
  it('puts the left tip at (0, h/2) and right tip at (w, h/2)', () => {
    const d = geometryFor('leftRightArrow', { w: 200, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    expect(d).toContain('M 0 50');
    expect(d).toContain('L 200 50');
  });

  it('produces a 10-vertex closed polygon (M + 9 L + Z)', () => {
    const d = geometryFor('leftRightArrow', { w: 200, h: 100 });
    const lCount = (d?.match(/L /g) ?? []).length;
    expect(lCount).toBe(9);
    expect(d?.endsWith('Z')).toBe(true);
  });
});

describe('upDownArrow', () => {
  it('puts the top tip at (w/2, 0) and bottom tip at (w/2, h)', () => {
    const d = geometryFor('upDownArrow', { w: 100, h: 200 });
    expect(d).toBeDefined();
    expect(d).toContain('M 50 0');
    expect(d).toContain('L 50 200');
  });

  it('produces a 10-vertex closed polygon (M + 9 L + Z)', () => {
    const d = geometryFor('upDownArrow', { w: 100, h: 200 });
    const lCount = (d?.match(/L /g) ?? []).length;
    expect(lCount).toBe(9);
    expect(d?.endsWith('Z')).toBe(true);
  });
});

describe('bentArrow', () => {
  it('produces a closed polygon with the head tip at the right edge', () => {
    const d = geometryFor('bentArrow', { w: 200, h: 200 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    // Head tip at (w, h/2).
    expect(d).toContain('L 200 100');
    expect(d?.endsWith('Z')).toBe(true);
  });
});

describe('curvedRightArrow', () => {
  it('uses cubic-Bezier segments for the curved body and ends with the head tip on the right', () => {
    const d = geometryFor('curvedRightArrow', { w: 200, h: 200 });
    expect(d).toBeDefined();
    const cCount = (d?.match(/C /g) ?? []).length;
    expect(cCount).toBeGreaterThanOrEqual(2);
    // Head tip lands at (w, h/2).
    expect(d).toContain('L 200 100');
  });
});

describe('wedgeRoundRectCallout', () => {
  it('uses cubic-Bezier segments for the rounded corners and includes a triangular tail', () => {
    const d = geometryFor('wedgeRoundRectCallout', { w: 200, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    // 4 rounded corners → 4 C commands minimum.
    const cCount = (d?.match(/C /g) ?? []).length;
    expect(cCount).toBeGreaterThanOrEqual(4);
    expect(d?.endsWith('Z')).toBe(true);
  });
});

describe('wedgeEllipseCallout', () => {
  it('uses cubic-Bezier segments for the ellipse boundary and includes a tail', () => {
    const d = geometryFor('wedgeEllipseCallout', { w: 200, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    // Ellipse-from-Bezier idiom = 4 C commands.
    const cCount = (d?.match(/C /g) ?? []).length;
    expect(cCount).toBeGreaterThanOrEqual(4);
  });
});

describe('cloudCallout', () => {
  it('reuses the cubic-Bezier lobed boundary pattern from cloud', () => {
    const d = geometryFor('cloudCallout', { w: 200, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    const cCount = (d?.match(/C /g) ?? []).length;
    // 6+ humps for the cloud body, more if the tail subpath uses curves.
    expect(cCount).toBeGreaterThanOrEqual(6);
  });
});

describe('borderCallout1', () => {
  it('produces a rectangle plus a separate single-segment leader line subpath', () => {
    const d = geometryFor('borderCallout1', { w: 200, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    // Two `M` commands → two subpaths (rectangle + leader).
    const mCount = (d?.match(/M /g) ?? []).length;
    expect(mCount).toBe(2);
  });
});

describe('borderCallout2', () => {
  it('produces a rectangle plus a separate two-segment (bent) leader line subpath', () => {
    const d = geometryFor('borderCallout2', { w: 200, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    const mCount = (d?.match(/M /g) ?? []).length;
    expect(mCount).toBe(2);
    // Bent leader: one M + two L commands in the leader subpath.
    // Rectangle has 3 L commands → total ≥ 5.
    const lCount = (d?.match(/L /g) ?? []).length;
    expect(lCount).toBeGreaterThanOrEqual(5);
  });
});

// --- T-242c batch 2 ---------------------------------------------------------

describe('ribbon2', () => {
  it('mirrors `ribbon` with the tabs at the top instead of the bottom', () => {
    const d = geometryFor('ribbon2', { w: 200, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    expect(d?.endsWith('Z')).toBe(true);
    // 8-vertex closed polygon mirroring `ribbon`'s topology (M + 7 L + Z).
    const lCount = (d?.match(/L /g) ?? []).length;
    expect(lCount).toBe(7);
  });
});

describe('verticalScroll', () => {
  it('uses cubic Béziers to approximate the two rolled-paper curls', () => {
    const d = geometryFor('verticalScroll', { w: 100, h: 200 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    expect(d?.endsWith('Z')).toBe(true);
    const cCount = (d?.match(/C /g) ?? []).length;
    // Two curls (top-left + bottom-right), each a half-circle built from
    // two cubic-Bezier quarters → 4 cubic segments total.
    expect(cCount).toBe(4);
  });
});

describe('horizontalScroll', () => {
  it('uses cubic Béziers to approximate the two rolled-paper curls', () => {
    const d = geometryFor('horizontalScroll', { w: 200, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    expect(d?.endsWith('Z')).toBe(true);
    const cCount = (d?.match(/C /g) ?? []).length;
    expect(cCount).toBe(4);
  });
});

describe('star10', () => {
  it('produces a 20-vertex alternating polygon (10 outer + 10 inner)', () => {
    const d = geometryFor('star10', { w: 100, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    const total = (d?.match(/[ML] /g) ?? []).length;
    expect(total).toBe(20);
    expect(d?.endsWith('Z')).toBe(true);
  });
});

describe('star12', () => {
  it('produces a 24-vertex alternating polygon (12 outer + 12 inner)', () => {
    const d = geometryFor('star12', { w: 100, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    const total = (d?.match(/[ML] /g) ?? []).length;
    expect(total).toBe(24);
    expect(d?.endsWith('Z')).toBe(true);
  });
});

describe('moon', () => {
  it('uses cubic Béziers for the outer + inner crescent arcs', () => {
    const d = geometryFor('moon', { w: 100, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    const cCount = (d?.match(/C /g) ?? []).length;
    // Two arcs (outer convex + inner concave) → 2 cubic-Bezier segments
    // each at minimum (semicircle = 2 cubic Béziers per side).
    expect(cCount).toBeGreaterThanOrEqual(4);
    expect(d?.endsWith('Z')).toBe(true);
  });
});

describe('lightningBolt', () => {
  it('produces a closed multi-segment zigzag polygon', () => {
    const d = geometryFor('lightningBolt', { w: 100, h: 200 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    expect(d?.endsWith('Z')).toBe(true);
    const lCount = (d?.match(/L /g) ?? []).length;
    // ECMA-376 §20.1.9 lightningBolt: 12-vertex polygon (M + 11 L + Z).
    expect(lCount).toBe(11);
  });
});

describe('noSmoking', () => {
  it('produces an outer ring + inner cutout + diagonal bar (3 subpaths, all cubic Bézier circles)', () => {
    const d = geometryFor('noSmoking', { w: 100, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    // 3 subpaths: outer circle, inner circle (hole), prohibition bar.
    const mCount = (d?.match(/M /g) ?? []).length;
    expect(mCount).toBe(3);
    // 2 circles × 4 cubic Béziers each = 8 minimum.
    const cCount = (d?.match(/C /g) ?? []).length;
    expect(cCount).toBeGreaterThanOrEqual(8);
  });
});
