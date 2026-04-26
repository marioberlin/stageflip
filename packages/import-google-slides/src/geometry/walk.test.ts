// packages/import-google-slides/src/geometry/walk.test.ts
// Pin AC #8: 3-deep group fixture; world transforms compose correctly.

import { describe, expect, it } from 'vitest';
import type { ApiPageElement } from '../api/types.js';
import { walkPageElements } from './walk.js';

describe('walkPageElements (AC #8)', () => {
  it('flattens a 3-deep group, composing translateX along the chain', () => {
    const els: ApiPageElement[] = [
      {
        objectId: 'g1',
        transform: { translateX: 100, scaleX: 1, scaleY: 1, translateY: 0 },
        elementGroup: {
          children: [
            {
              objectId: 'g2',
              transform: { translateX: 10, scaleX: 1, scaleY: 1, translateY: 0 },
              elementGroup: {
                children: [
                  {
                    objectId: 'leaf',
                    transform: { translateX: 1, scaleX: 1, scaleY: 1, translateY: 0 },
                    shape: { shapeType: 'RECTANGLE' },
                  },
                ],
              },
            },
          ],
        },
      },
    ];
    const walked = walkPageElements(els);
    // Order: g1, g2, leaf.
    expect(walked.map((w) => w.element.objectId)).toEqual(['g1', 'g2', 'leaf']);
    expect(walked[0]?.depth).toBe(0);
    expect(walked[1]?.depth).toBe(1);
    expect(walked[2]?.depth).toBe(2);
    expect(walked[0]?.worldTransform.translateX).toBe(100);
    expect(walked[1]?.worldTransform.translateX).toBe(110);
    expect(walked[2]?.worldTransform.translateX).toBe(111);
    expect(walked[1]?.parentGroupId).toBe('g1');
    expect(walked[2]?.parentGroupId).toBe('g2');
  });

  it('top-level elements carry the seed parent transform (default IDENTITY)', () => {
    const els: ApiPageElement[] = [
      { objectId: 'a', transform: { translateX: 5 }, shape: {} },
      { objectId: 'b', transform: { translateX: 9 }, shape: {} },
    ];
    const walked = walkPageElements(els);
    expect(walked).toHaveLength(2);
    expect(walked[0]?.worldTransform.translateX).toBe(5);
    expect(walked[1]?.worldTransform.translateX).toBe(9);
    expect(walked[0]?.parentGroupId).toBeUndefined();
  });

  it('handles missing pageElements (undefined) → empty list', () => {
    expect(walkPageElements(undefined)).toEqual([]);
  });
});
