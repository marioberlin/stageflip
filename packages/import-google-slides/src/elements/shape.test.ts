// packages/import-google-slides/src/elements/shape.test.ts
// Pin AC #30 (RECTANGLE → 'rect') + placeholder.parentObjectId resolution
// (AC #28 / AC #23 LF-GSLIDES-PLACEHOLDER-INLINED) + text-content branch.

import { describe, expect, it } from 'vitest';
import { emitShapeElement } from './shape.js';

const bbox = { x: 10, y: 20, width: 100, height: 50 };

describe('emitShapeElement', () => {
  it('AC #30: RECTANGLE → ShapeElement with shape="rect"', () => {
    const out = emitShapeElement({
      apiElement: { objectId: 'r1', shape: { shapeType: 'RECTANGLE' } },
      worldBbox: bbox,
      layoutIds: new Set(),
      masterIds: new Set(),
      slideId: 's1',
      fallback: 'fb',
    });
    expect(out.element.type).toBe('shape');
    if (out.element.type === 'shape') {
      expect(out.element.shape).toBe('rect');
    }
    expect(out.flags).toHaveLength(0);
  });

  it('text-bearing shape → TextElement variant', () => {
    const out = emitShapeElement({
      apiElement: {
        objectId: 'tb1',
        shape: {
          shapeType: 'TEXT_BOX',
          text: { textElements: [{ textRun: { content: 'Hi' } }] },
        },
      },
      worldBbox: bbox,
      layoutIds: new Set(),
      masterIds: new Set(),
      slideId: 's1',
      fallback: 'fb',
    });
    expect(out.element.type).toBe('text');
    if (out.element.type === 'text') {
      expect(out.element.text).toBe('Hi');
    }
  });

  it('AC #28: placeholder.parentObjectId resolves to a parsed layout → inheritsFrom set', () => {
    const out = emitShapeElement({
      apiElement: {
        objectId: 'ph1',
        shape: {
          shapeType: 'TEXT_BOX',
          placeholder: { type: 'TITLE', index: 0, parentObjectId: 'layout-A' },
        },
      },
      worldBbox: bbox,
      layoutIds: new Set(['layout-A']),
      masterIds: new Set(),
      slideId: 's1',
      fallback: 'fb',
    });
    expect(out.element.inheritsFrom).toEqual({ templateId: 'layout-A', placeholderIdx: 0 });
    expect(out.flags).toHaveLength(0);
  });

  it('AC #23: placeholder.parentObjectId unresolved → LF-GSLIDES-PLACEHOLDER-INLINED, no inheritsFrom, geometry inlined', () => {
    const out = emitShapeElement({
      apiElement: {
        objectId: 'ph2',
        shape: {
          shapeType: 'RECTANGLE',
          placeholder: { type: 'BODY', index: 1, parentObjectId: 'unknown-template' },
        },
      },
      worldBbox: bbox,
      layoutIds: new Set(['layout-A']),
      masterIds: new Set(),
      slideId: 's1',
      fallback: 'fb',
    });
    expect(out.element.inheritsFrom).toBeUndefined();
    expect(out.flags).toHaveLength(1);
    expect(out.flags[0]?.code).toBe('LF-GSLIDES-PLACEHOLDER-INLINED');
    expect(out.flags[0]?.severity).toBe('warn');
    expect(out.element.transform.width).toBe(100);
  });

  it('unknown shapeType → falls back to rect + LF-GSLIDES-IMAGE-FALLBACK', () => {
    const out = emitShapeElement({
      apiElement: { objectId: 'x', shape: { shapeType: 'UNKNOWN_KIND' } },
      worldBbox: bbox,
      layoutIds: new Set(),
      masterIds: new Set(),
      slideId: 's1',
      fallback: 'fb',
    });
    expect(out.element.type).toBe('shape');
    if (out.element.type === 'shape') expect(out.element.shape).toBe('rect');
    expect(out.flags[0]?.code).toBe('LF-GSLIDES-IMAGE-FALLBACK');
  });
});
