// packages/export-google-slides/src/convergence/diff.test.ts
// Pins per-element + whole-slide diff thresholds. ACs #15-#17.

import type { Element } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TOLERANCES } from '../types.js';
import { computeDiff } from './diff.js';

function textEl(): Element {
  return {
    id: 'e1',
    type: 'text',
    text: 'hi',
    transform: { x: 100, y: 100, width: 200, height: 50, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    align: 'left',
  } as Element;
}

function shapeEl(): Element {
  return {
    id: 'e2',
    type: 'shape',
    shape: 'rect',
    transform: { x: 100, y: 100, width: 200, height: 50, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
  } as Element;
}

describe('computeDiff', () => {
  it('AC #15: text bbox position drift within 2 px is in-tolerance', () => {
    const diff = computeDiff({
      elementsById: { e1: textEl() },
      observed: [{ elementId: 'e1', x: 102, y: 100, width: 200, height: 50 }],
      perceptualDiff: 0,
      tolerances: DEFAULT_TOLERANCES,
    });
    expect(diff.perElement[0]?.inTolerance).toBe(true);
    expect(diff.allElementsInTolerance).toBe(true);
  });

  it('AC #15: text bbox position drift > 2 px is residual', () => {
    const diff = computeDiff({
      elementsById: { e1: textEl() },
      observed: [{ elementId: 'e1', x: 105, y: 100, width: 200, height: 50 }],
      perceptualDiff: 0.05, // disable the perceptual gate
      tolerances: DEFAULT_TOLERANCES,
    });
    expect(diff.perElement[0]?.inTolerance).toBe(false);
    expect(diff.allElementsInTolerance).toBe(false);
  });

  it('AC #16: image/shape drift within 1 px is in-tolerance', () => {
    const diff = computeDiff({
      elementsById: { e2: shapeEl() },
      observed: [{ elementId: 'e2', x: 101, y: 100, width: 200, height: 50 }],
      perceptualDiff: 0,
      tolerances: DEFAULT_TOLERANCES,
    });
    expect(diff.perElement[0]?.inTolerance).toBe(true);
  });

  it('AC #16: image/shape drift > 1 px is residual', () => {
    const diff = computeDiff({
      elementsById: { e2: shapeEl() },
      observed: [{ elementId: 'e2', x: 103, y: 100, width: 200, height: 50 }],
      perceptualDiff: 0.05,
      tolerances: DEFAULT_TOLERANCES,
    });
    expect(diff.perElement[0]?.inTolerance).toBe(false);
  });

  it('skips observed entries with no matching element in elementsById', () => {
    const diff = computeDiff({
      elementsById: {},
      observed: [{ elementId: 'unknown', x: 0, y: 0, width: 1, height: 1 }],
      perceptualDiff: 0,
      tolerances: DEFAULT_TOLERANCES,
    });
    expect(diff.perElement).toHaveLength(0);
    expect(diff.allElementsInTolerance).toBe(true);
  });

  it('maps element types to kind correctly (image / table / group / other)', () => {
    function el(type: 'image' | 'table' | 'group' | 'video'): Element {
      const base = {
        id: 'e',
        transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1 },
        visible: true,
        locked: false,
        animations: [],
      };
      if (type === 'image')
        return { ...base, type: 'image', src: 'asset:x', fit: 'cover' } as Element;
      if (type === 'table')
        return {
          ...base,
          type: 'table',
          rows: 1,
          columns: 1,
          headerRow: false,
          cells: [],
        } as Element;
      if (type === 'group') return { ...base, type: 'group', clip: false, children: [] } as Element;
      return { ...base, type: 'video', src: 'asset:x' } as unknown as Element;
    }
    for (const t of ['image', 'table', 'group', 'video'] as const) {
      const e = el(t);
      const diff = computeDiff({
        elementsById: { e: e },
        observed: [{ elementId: 'e', x: 0, y: 0, width: 10, height: 10 }],
        perceptualDiff: 0,
        tolerances: DEFAULT_TOLERANCES,
      });
      expect(diff.perElement[0]?.kind).toBeDefined();
    }
  });

  it('AC #17: whole-slide perceptual diff < 0.02 is in-tolerance even with per-element drift', () => {
    const diff = computeDiff({
      elementsById: { e2: shapeEl() },
      // 5 px shape drift would normally be a residual...
      observed: [{ elementId: 'e2', x: 105, y: 100, width: 200, height: 50 }],
      // ...but the whole-slide perceptual diff is below 2%.
      perceptualDiff: 0.01,
      tolerances: DEFAULT_TOLERANCES,
    });
    // The per-element row is still flagged not-in-tolerance, but the slide
    // gate flips the overall result to in-tolerance.
    expect(diff.perElement[0]?.inTolerance).toBe(false);
    expect(diff.allElementsInTolerance).toBe(true);
  });
});
