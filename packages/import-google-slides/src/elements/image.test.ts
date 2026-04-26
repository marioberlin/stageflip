// packages/import-google-slides/src/elements/image.test.ts
// Pin AC #31: image emits ParsedImageElement.src = ParsedAssetRef.unresolved
// carrying the contentUrl as oocxmlPath.

import { describe, expect, it } from 'vitest';
import { emitImageElement } from './image.js';

const bbox = { x: 0, y: 0, width: 200, height: 100 };

describe('emitImageElement (AC #31)', () => {
  it('emits ImageElement with src.kind="unresolved" and oocxmlPath = contentUrl', () => {
    const out = emitImageElement({
      apiElement: {
        objectId: 'img1',
        image: { contentUrl: 'https://lh3.googleusercontent.com/short-lived/foo' },
      },
      worldBbox: bbox,
      slideId: 's1',
      fallback: 'fb',
    });
    expect(out.element.type).toBe('image');
    expect(out.element.src).toEqual({
      kind: 'unresolved',
      oocxmlPath: 'https://lh3.googleusercontent.com/short-lived/foo',
    });
    expect(out.flags).toHaveLength(0);
  });

  it('image with no contentUrl → emits placeholder + LF-GSLIDES-IMAGE-FALLBACK', () => {
    const out = emitImageElement({
      apiElement: { objectId: 'img2', image: {} },
      worldBbox: bbox,
      slideId: 's1',
      fallback: 'fb',
    });
    expect(out.flags[0]?.code).toBe('LF-GSLIDES-IMAGE-FALLBACK');
  });
});
