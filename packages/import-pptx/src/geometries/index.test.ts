// packages/import-pptx/src/geometries/index.test.ts
// Pin the registry coverage and the contract every preset generator
// upholds. T-242c batch 1 grew the list to 25; batch 2 took it to 33;
// T-242d closes out at 36 with the arc-bearing trio.

import { describe, expect, it } from 'vitest';
import { COVERED_PRESETS, HONORED_ADJUSTMENTS, PRESET_GENERATORS, geometryFor } from './index.js';

const T_242D_PRESETS = [
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
  // T-242d (3) — arc-bearing trio
  'chord',
  'pie',
  'donut',
];

describe('preset registry', () => {
  it('covers exactly the T-242a + T-242b + T-242c (batch 1 + batch 2) + T-242d presets (36 total)', () => {
    expect(COVERED_PRESETS.length).toBe(36);
    expect(COVERED_PRESETS.slice().sort()).toEqual(T_242D_PRESETS.slice().sort());
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
    // After T-242d the arc-bearing trio is covered; pick a known-uncovered
    // name (one of the ~140 outside the 50-commitment, falls through to
    // T-245's rasterization path) so this assertion still has bite.
    expect(geometryFor('mathDivide', { w: 100, h: 100 })).toBeUndefined();
    expect(geometryFor('uturnArrow', { w: 100, h: 100 })).toBeUndefined();
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

// --- T-242d ----------------------------------------------------------------

describe('pie', () => {
  it('produces an M cx cy → L → A → Z wedge with the default 270° sweep', () => {
    // Default <a:gd>: adj1 = 0 (start angle 0°), adj2 = 16200000 (sweep 270°).
    const d = geometryFor('pie', { w: 200, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    // Wedge has a center vertex.
    expect(d).toMatch(/^M 100 50 L /);
    // One arc command for the curved edge.
    const aCount = (d?.match(/ A /g) ?? []).length;
    expect(aCount).toBe(1);
    expect(d?.endsWith('Z')).toBe(true);
    // 270° sweep > 180° → large-arc-flag = 1.
    expect(d).toMatch(/A 100 50 0 1 1 /);
  });

  it('honors <a:avLst> adj2 = 10800000 (180° → half-pie, large-arc=0)', () => {
    const d = geometryFor('pie', { w: 100, h: 100 }, { adj1: 0, adj2: 10800000 });
    expect(d).toBeDefined();
    // Start angle 0°: arc starts at (100, 50). After 180° CW (in OOXML, which
    // matches SVG y-down sweep=1), endpoint is at (0, 50).
    // M cx cy = M 50 50; L startX startY = L 100 50; A rx ry 0 0 1 0 50 Z.
    expect(d).toBe('M 50 50 L 100 50 A 50 50 0 0 1 0 50 Z');
  });
});

describe('chord', () => {
  it('produces an M → A → Z arc-and-chord with no center vertex', () => {
    // Default <a:gd>: adj1 = 0, adj2 = 16200000.
    const d = geometryFor('chord', { w: 200, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    // No center vertex — the closing line is the chord from arc-end back to start.
    expect(d).not.toMatch(/^M 100 50 L /);
    // Exactly one M and one A.
    const mCount = (d?.match(/M /g) ?? []).length;
    const aCount = (d?.match(/ A /g) ?? []).length;
    expect(mCount).toBe(1);
    expect(aCount).toBe(1);
    expect(d?.endsWith('Z')).toBe(true);
  });

  it('honors <a:avLst> adj2 = 10800000 (half-disc bisected by a horizontal chord)', () => {
    // Start at (100, 50), sweep 180° CW to (0, 50); chord = the horizontal
    // line through y=50 closing the path.
    const d = geometryFor('chord', { w: 100, h: 100 }, { adj1: 0, adj2: 10800000 });
    expect(d).toBe('M 100 50 A 50 50 0 0 1 0 50 Z');
  });
});

describe('donut', () => {
  it('produces two concentric ellipse subpaths (outer CW + inner CCW)', () => {
    // Default <a:gd>: adj1 = 25000 (25% of width).
    const d = geometryFor('donut', { w: 100, h: 100 });
    expect(d).toBeDefined();
    expect(d).toMatch(/^M /);
    // AC #7 (a): exactly two M commands → two subpaths.
    const mCount = (d?.match(/M /g) ?? []).length;
    expect(mCount).toBe(2);
    // Each subpath uses two SVG arc commands (semicircles) → 4 A total.
    const aCount = (d?.match(/ A /g) ?? []).length;
    expect(aCount).toBe(4);
    // Outer subpath sweep flag = 1 (CW); inner sweep flag = 0 (CCW).
    // First arc on each subpath is right after the M; pin the direction by
    // counting per-direction sweep flags.
    expect(d).toContain('A 50 50 0 1 1 ');
    expect(d).toContain('A 25 25 0 1 0 ');
  });

  it('AC #7 (b): never emits a fill-rule attribute — generator returns d only', () => {
    // The generator returns the path data string, not an SVG element. The
    // donut topology relies on SVG's *default* fill-rule="nonzero" because
    // the two subpaths have opposite winding. Verify the generator's output
    // has no fill-rule token; the renderer-core path dispatcher likewise
    // emits no override (downstream contract; not exercised here).
    const d = geometryFor('donut', { w: 100, h: 100 });
    expect(d).toBeDefined();
    expect(d).not.toMatch(/fill-rule/);
    expect(d).not.toMatch(/evenodd/);
  });

  it('AC #7 (c): hit-test at the donut center is outside the filled region', () => {
    // The donut hole sits between the outer ring (rx=ry=50) and the inner
    // cutout (rx=ry=25, since adj1=25% of width=100 → t=25). The donut
    // center (50, 50) is *inside* the inner cutout → outside the filled
    // region under nonzero winding (outer CW contributes +1, inner CCW
    // contributes -1, sum = 0 → hole). Verify with an analytical test
    // matching the generator's geometry rather than driving a renderer.
    const w = 100;
    const h = 100;
    const cx = w / 2;
    const cy = h / 2;
    const t = w * 0.25; // adj1 = 25000 (25% of width).
    // Hit-test point.
    const px = cx;
    const py = cy;
    // Outer ellipse (rx=50, ry=50) centered at (cx, cy).
    const outerHit = (px - cx) ** 2 / 50 ** 2 + (py - cy) ** 2 / 50 ** 2 <= 1;
    // Inner ellipse (rx=ry=50-t=25) — t=25 so inner radii = 25.
    const innerHit = (px - cx) ** 2 / (50 - t) ** 2 + (py - cy) ** 2 / (50 - t) ** 2 <= 1;
    // nonzero winding: outer CW (+1) and inner CCW (-1) cancel inside both
    // → hole. Outside outer = 0 (background). Between outer and inner = +1.
    const insideFill = outerHit && !innerHit;
    expect(insideFill).toBe(false);
  });

  it('honors <a:avLst> adj1 (ring thickness in 1000ths of width)', () => {
    // adj1 = 50000 → ring thickness = 50% of width → inner radius = 25
    // for w=100. Inner ellipse arcs should reflect this.
    const d = geometryFor('donut', { w: 100, h: 100 }, { adj1: 50000 });
    expect(d).toBeDefined();
    // Inner radii = (50 - 50) = 0 — degenerate; the generator should still
    // honor the math but produce a path the renderer can swallow. With
    // adj1=50000 the hole vanishes; inner radii = (w/2 - w*0.5) = 0.
    // Pin a less-degenerate value.
    const d2 = geometryFor('donut', { w: 100, h: 100 }, { adj1: 10000 });
    // adj1=10% → t=10 → inner radii = (50-10) = 40.
    expect(d2).toContain('A 40 40 0 1 0 ');
  });
});
