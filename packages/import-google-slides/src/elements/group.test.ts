// packages/import-google-slides/src/elements/group.test.ts
// Pin AC #33: 2-deep nested group → ParsedGroupElement with 2-deep tree.

import { describe, expect, it } from 'vitest';
import type { ApiPageElement } from '../api/types.js';
import { emitGroupElement } from './group.js';
import { emitShapeElement } from './shape.js';

const bbox = { x: 0, y: 0, width: 100, height: 100 };

describe('emitGroupElement (AC #33)', () => {
  it('a 2-deep nested group produces a 2-deep tree (no flattening)', () => {
    const inner: ApiPageElement = {
      objectId: 'leaf',
      shape: { shapeType: 'RECTANGLE' },
    };
    const middle: ApiPageElement = {
      objectId: 'g2',
      elementGroup: { children: [inner] },
    };
    const outer: ApiPageElement = {
      objectId: 'g1',
      elementGroup: { children: [middle] },
    };
    // Caller-side: emit recursively. Tests use a small dispatcher.
    const dispatch = (
      el: ApiPageElement,
      childBbox: { x: number; y: number; width: number; height: number },
      fb: string,
    ): {
      element: import('../types.js').ParsedElement;
      flags: import('../types.js').LossFlag[];
    } => {
      if (el.elementGroup) {
        const out = emitGroupElement({
          apiElement: el,
          worldBbox: childBbox,
          slideId: 's1',
          fallback: fb,
          childWorldBboxes: (el.elementGroup.children ?? []).map(() => childBbox),
          emitChild: dispatch,
        });
        return out;
      }
      return emitShapeElement({
        apiElement: el,
        worldBbox: childBbox,
        layoutIds: new Set(),
        masterIds: new Set(),
        slideId: 's1',
        fallback: fb,
      });
    };
    const out = emitGroupElement({
      apiElement: outer,
      worldBbox: bbox,
      slideId: 's1',
      fallback: 'fb',
      childWorldBboxes: [bbox],
      emitChild: dispatch,
    });
    expect(out.element.type).toBe('group');
    expect(out.element.children).toHaveLength(1);
    const middleEl = out.element.children[0];
    expect(middleEl?.type).toBe('group');
    if (middleEl?.type === 'group') {
      expect(middleEl.children).toHaveLength(1);
      const leafEl = middleEl.children[0];
      expect(leafEl?.type).toBe('shape');
    }
  });
});
