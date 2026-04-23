// packages/editor-shell/src/find-replace/find-matches.test.ts
// Unit tests for the pure findMatches function (T-139c).

import type { Document, Slide, TextElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { findMatches } from './find-matches';

function textEl(id: string, text: string): TextElement {
  return {
    id,
    type: 'text',
    transform: { x: 0, y: 0, width: 100, height: 20, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    text,
    align: 'left',
  } satisfies TextElement;
}

function makeDoc(slides: Slide[]): Document {
  return {
    meta: {
      id: 'doc',
      version: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: { mode: 'slide', slides },
  };
}

describe('findMatches', () => {
  it('returns [] for null document', () => {
    expect(findMatches(null, 'x')).toEqual([]);
  });

  it('returns [] for empty query', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'hello world')] }]);
    expect(findMatches(doc, '')).toEqual([]);
  });

  it('finds case-insensitive by default', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'Hello World')] }]);
    const matches = findMatches(doc, 'hello');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      slideId: 's1',
      slideIndex: 0,
      elementId: 'e1',
      start: 0,
      length: 5,
    });
  });

  it('respects caseSensitive flag', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'Hello hello')] }]);
    const matches = findMatches(doc, 'hello', { caseSensitive: true });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.start).toBe(6);
  });

  it('returns multiple matches inside one element in order', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'abc abc abc')] }]);
    const matches = findMatches(doc, 'abc');
    expect(matches.map((m) => m.start)).toEqual([0, 4, 8]);
  });

  it('orders matches slide-first, then element, then position', () => {
    const doc = makeDoc([
      { id: 's1', elements: [textEl('e1', 'foo'), textEl('e2', 'foo foo')] },
      { id: 's2', elements: [textEl('e3', 'foo')] },
    ]);
    const matches = findMatches(doc, 'foo');
    expect(matches.map((m) => `${m.slideId}:${m.elementId}:${m.start}`)).toEqual([
      's1:e1:0',
      's1:e2:0',
      's1:e2:4',
      's2:e3:0',
    ]);
  });

  it('skips non-text elements', () => {
    const doc = makeDoc([
      {
        id: 's1',
        elements: [
          textEl('e1', 'foo bar'),
          {
            id: 'shape1',
            type: 'shape',
            transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
            visible: true,
            locked: false,
            animations: [],
            shape: 'rect',
          },
        ],
      },
    ]);
    const matches = findMatches(doc, 'foo');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.elementId).toBe('e1');
  });

  it('supports wholeWord', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'cat category cat')] }]);
    const matches = findMatches(doc, 'cat', { wholeWord: true });
    expect(matches.map((m) => m.start)).toEqual([0, 13]);
  });

  it('supports regex mode', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'a1 b2 c3')] }]);
    const matches = findMatches(doc, '[a-c]\\d', { regex: true });
    expect(matches.map((m) => m.start)).toEqual([0, 3, 6]);
  });

  it('returns [] for invalid regex', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'abc')] }]);
    expect(findMatches(doc, '[unterminated', { regex: true })).toEqual([]);
  });

  it('skips zero-width regex matches', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'abc')] }]);
    expect(findMatches(doc, 'x*', { regex: true })).toEqual([]);
  });

  it('is deterministic: repeated calls return equal arrays', () => {
    const doc = makeDoc([
      { id: 's1', elements: [textEl('e1', 'foo foo')] },
      { id: 's2', elements: [textEl('e2', 'foo')] },
    ]);
    const a = findMatches(doc, 'foo');
    const b = findMatches(doc, 'foo');
    expect(a).toEqual(b);
  });
});
