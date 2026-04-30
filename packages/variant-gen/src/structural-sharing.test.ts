// packages/variant-gen/src/structural-sharing.test.ts
// Structural sharing helpers (T-386 D-T386-5).

import { describe, expect, it } from 'vitest';
import {
  replaceElementInDocument,
  setNestedProperty,
} from './structural-sharing.js';

interface FakeDoc {
  meta: { id: string };
  content:
    | { mode: 'slide'; slides: Array<{ id: string; elements: Array<{ id: string; text?: string }> }> }
    | { mode: 'video'; tracks: ReadonlyArray<unknown> };
}

function makeDoc(elementCount: number): FakeDoc {
  const elements: Array<{ id: string; text?: string }> = [];
  for (let i = 0; i < elementCount; i += 1) {
    elements.push({ id: `el-${i}`, text: `text-${i}` });
  }
  return {
    meta: { id: 'doc-1' },
    content: { mode: 'slide', slides: [{ id: 'slide-1', elements }] },
  };
}

describe('setNestedProperty', () => {
  it('returns a new object with the path replaced', () => {
    const original = { a: { b: { c: 1 } } };
    const updated = setNestedProperty(original, ['a', 'b', 'c'], 99);
    expect(updated).toEqual({ a: { b: { c: 99 } } });
    expect(original.a.b.c).toBe(1); // immutability
  });

  it('handles a one-level path', () => {
    const updated = setNestedProperty({ x: 1, y: 2 }, ['x'], 9);
    expect(updated).toEqual({ x: 9, y: 2 });
  });

  it('throws on an empty path', () => {
    expect(() => setNestedProperty({ a: 1 }, [], 9)).toThrow();
  });
});

describe('replaceElementInDocument — structural sharing (AC #21)', () => {
  it('substitutes one element while keeping every other element ref-equal', () => {
    const source = makeDoc(100);
    const updated = replaceElementInDocument(source, 'el-50', { text: 'updated' }) as FakeDoc;
    if (source.content.mode !== 'slide' || updated.content.mode !== 'slide') {
      throw new Error('mode mismatch');
    }
    const sourceEls = source.content.slides[0]!.elements;
    const updatedEls = updated.content.slides[0]!.elements;
    expect(updatedEls).toHaveLength(100);
    for (let i = 0; i < 100; i += 1) {
      if (i === 50) {
        expect(updatedEls[i]).not.toBe(sourceEls[i]);
        expect(updatedEls[i]?.text).toBe('updated');
      } else {
        // ref-equality: structural sharing
        expect(updatedEls[i]).toBe(sourceEls[i]);
      }
    }
  });

  it('produces a new top-level object even when nothing else changes', () => {
    const source = makeDoc(3);
    const updated = replaceElementInDocument(source, 'el-1', { text: 'x' }) as FakeDoc;
    expect(updated).not.toBe(source);
    expect(updated.meta).toBe(source.meta); // unchanged subtree shared
  });

  it('returns the source unchanged when the element id is missing', () => {
    const source = makeDoc(3);
    const updated = replaceElementInDocument(source, 'el-ghost', { text: 'x' });
    expect(updated).toBe(source);
  });
});
