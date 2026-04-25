// packages/import-pptx/src/geometries/index.test.ts
// Pin the registry coverage and the contract every preset generator
// upholds. T-242c adds rows; this file keeps the eventual count honest.

import { describe, expect, it } from 'vitest';
import { COVERED_PRESETS, HONORED_ADJUSTMENTS, PRESET_GENERATORS, geometryFor } from './index.js';

const T_242B_PRESETS = [
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
];

describe('preset registry', () => {
  it('covers exactly the T-242a + T-242b first-wave presets (16 total)', () => {
    expect(COVERED_PRESETS.slice().sort()).toEqual(T_242B_PRESETS.slice().sort());
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
    expect(geometryFor('lightningBolt', { w: 100, h: 100 })).toBeUndefined();
    expect(geometryFor('moon', { w: 100, h: 100 })).toBeUndefined();
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
