// packages/import-pptx/src/geometries/index.test.ts
// Pin the registry coverage and the contract every preset generator
// upholds. T-242b adds rows; this file keeps the eventual count honest.

import { describe, expect, it } from 'vitest';
import { COVERED_PRESETS, PRESET_GENERATORS, geometryFor } from './index.js';

describe('preset registry', () => {
  it('covers exactly the 6 first-wave presets', () => {
    expect(COVERED_PRESETS.slice().sort()).toEqual(
      ['cloud', 'leftBracket', 'parallelogram', 'ribbon', 'rightArrow', 'wedgeRectCallout'].sort(),
    );
  });

  it('every generator returns a non-empty SVG path string for a 100x100 box', () => {
    for (const name of COVERED_PRESETS) {
      const path = geometryFor(name, { w: 100, h: 100 });
      expect(path).toBeDefined();
      expect(path).not.toBe('');
      expect(path).toMatch(/^M /); // SVG path starts with a move-to
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
  });

  it('every generator is callable directly', () => {
    for (const [, gen] of Object.entries(PRESET_GENERATORS)) {
      expect(typeof gen).toBe('function');
      expect(gen({ w: 50, h: 50 })).toBeTruthy();
    }
  });
});

describe('rightArrow', () => {
  it('puts the head tip at (w, h/2)', () => {
    const d = geometryFor('rightArrow', { w: 200, h: 100 });
    expect(d).toContain('L 200 50');
  });
});

describe('parallelogram', () => {
  it('slants the top-left corner by 25% of width', () => {
    const d = geometryFor('parallelogram', { w: 100, h: 50 });
    expect(d).toMatch(/^M 25 0 /);
  });
});

describe('cloud', () => {
  it('uses cubic-bezier humps (multiple C commands)', () => {
    const d = geometryFor('cloud', { w: 100, h: 80 });
    const cCount = (d?.match(/C /g) ?? []).length;
    expect(cCount).toBeGreaterThanOrEqual(6);
  });
});
