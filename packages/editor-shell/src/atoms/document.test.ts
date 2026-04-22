// packages/editor-shell/src/atoms/document.test.ts
// Tests the documentAtom and the fine-grained slide/element subscription
// factories. Factories must memoize by id so multiple subscribers share
// one derived atom (otherwise each call creates a new atom and the cache
// for that id never builds up).

import type { Document, Slide } from '@stageflip/schema';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { makeSlideDoc } from '../test-fixtures/document-fixture';
import {
  __clearElementByIdCacheForTest,
  __clearSlideByIdCacheForTest,
  documentAtom,
  elementByIdAtom,
  slideByIdAtom,
} from './document';

describe('documentAtom', () => {
  it('starts at null', () => {
    const store = createStore();
    expect(store.get(documentAtom)).toBeNull();
  });

  it('holds a document when written', () => {
    const store = createStore();
    const doc = makeSlideDoc({ slideCount: 2 });
    store.set(documentAtom, doc);
    expect(store.get(documentAtom)).toBe(doc);
  });
});

describe('slideByIdAtom', () => {
  it('memoizes per id — same atom reference for repeated calls', () => {
    __clearSlideByIdCacheForTest();
    const first = slideByIdAtom('slide-1');
    const second = slideByIdAtom('slide-1');
    expect(second).toBe(first);
  });

  it('distinct atoms for distinct ids', () => {
    __clearSlideByIdCacheForTest();
    const a = slideByIdAtom('slide-1');
    const b = slideByIdAtom('slide-2');
    expect(b).not.toBe(a);
  });

  it('returns undefined when no document is loaded', () => {
    const store = createStore();
    expect(store.get(slideByIdAtom('slide-1'))).toBeUndefined();
  });

  it('returns undefined when the document is not slide-mode', () => {
    const store = createStore();
    const doc = makeSlideDoc({ slideCount: 1 });
    // Shallow-clone with a mode swap for the shape assertion.
    const asVideo = {
      ...doc,
      content: { mode: 'video' as const, tracks: [] as never[] },
    } as unknown as Document;
    store.set(documentAtom, asVideo);
    expect(store.get(slideByIdAtom('slide-0'))).toBeUndefined();
  });

  it('resolves the slide by id from a slide-mode document', () => {
    const store = createStore();
    const doc = makeSlideDoc({ slideCount: 3 });
    store.set(documentAtom, doc);
    const target = (doc.content as { mode: 'slide'; slides: Slide[] }).slides[1];
    if (!target) throw new Error('test setup: slideCount=3 must produce slides[1]');
    expect(store.get(slideByIdAtom(target.id))).toBe(target);
  });

  it('returns undefined for an unknown id', () => {
    const store = createStore();
    store.set(documentAtom, makeSlideDoc({ slideCount: 1 }));
    expect(store.get(slideByIdAtom('does-not-exist'))).toBeUndefined();
  });
});

describe('elementByIdAtom', () => {
  it('memoizes per id', () => {
    __clearElementByIdCacheForTest();
    const first = elementByIdAtom('el-1');
    const second = elementByIdAtom('el-1');
    expect(second).toBe(first);
  });

  it('returns undefined when no document is loaded', () => {
    const store = createStore();
    expect(store.get(elementByIdAtom('el-1'))).toBeUndefined();
  });

  it('resolves the element across all slides', () => {
    const store = createStore();
    const doc = makeSlideDoc({ slideCount: 2, elementsPerSlide: 2 });
    store.set(documentAtom, doc);
    const slides = (doc.content as { mode: 'slide'; slides: Slide[] }).slides;
    const target = slides[1]?.elements[0];
    if (!target) throw new Error('test setup: slides[1].elements[0] must exist');
    expect(store.get(elementByIdAtom(target.id))).toBe(target);
  });

  it('returns undefined for an unknown id', () => {
    const store = createStore();
    store.set(documentAtom, makeSlideDoc({ slideCount: 1 }));
    expect(store.get(elementByIdAtom('does-not-exist'))).toBeUndefined();
  });

  it('returns undefined when the document is not slide-mode', () => {
    const store = createStore();
    const doc = makeSlideDoc({ slideCount: 1, elementsPerSlide: 1 });
    const asDisplay = {
      ...doc,
      content: { mode: 'display' as const, scenes: [] as never[] },
    } as unknown as Document;
    store.set(documentAtom, asDisplay);
    expect(store.get(elementByIdAtom('el-0'))).toBeUndefined();
  });
});
