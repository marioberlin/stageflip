// packages/import-google-slides/src/elements/line.test.ts
// Pin AC #34: line emits a ShapeElement with shape='line'.

import { describe, expect, it } from 'vitest';
import { emitLineElement } from './line.js';

describe('emitLineElement (AC #34)', () => {
  it('emits ShapeElement with shape="line" derived from worldBbox extents', () => {
    const out = emitLineElement({
      apiElement: { objectId: 'l1', line: { lineCategory: 'STRAIGHT' } },
      worldBbox: { x: 10, y: 20, width: 100, height: 0.0001 },
      slideId: 's1',
      fallback: 'fb',
    });
    expect(out.element.type).toBe('shape');
    expect(out.element.shape).toBe('line');
    expect(out.element.transform.x).toBe(10);
    expect(out.element.transform.width).toBeGreaterThanOrEqual(1);
  });
});
