// packages/editor-shell/src/find-replace/replace-all.test.ts
// Unit tests for the pure replaceAll function (T-139c).

import type { Document, Slide, TextElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { replaceAll } from './replace-all';

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

describe('replaceAll', () => {
  it('throws on null document', () => {
    expect(() => replaceAll(null, 'a', 'b')).toThrow();
  });

  it('returns the same doc reference when there are no matches', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'hello')] }]);
    expect(replaceAll(doc, 'zzz', 'yyy')).toBe(doc);
  });

  it('returns the same doc reference for empty query', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'hello')] }]);
    expect(replaceAll(doc, '', 'yyy')).toBe(doc);
  });

  it('rewrites single occurrence', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'hello world')] }]);
    const next = replaceAll(doc, 'world', 'there');
    if (next.content.mode !== 'slide') throw new Error('unexpected mode');
    const el = next.content.slides[0]?.elements[0] as TextElement;
    expect(el.text).toBe('hello there');
    expect(el.id).toBe('e1');
  });

  it('rewrites multiple occurrences in one element rightmost-first', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'abc abc abc')] }]);
    const next = replaceAll(doc, 'abc', 'X');
    if (next.content.mode !== 'slide') throw new Error();
    expect((next.content.slides[0]?.elements[0] as TextElement).text).toBe('X X X');
  });

  it('case-insensitive by default; respects case-sensitive flag', () => {
    const doc = makeDoc([{ id: 's1', elements: [textEl('e1', 'Foo foo FOO')] }]);
    const caseInsensitive = replaceAll(doc, 'foo', 'bar');
    if (caseInsensitive.content.mode !== 'slide') throw new Error();
    expect((caseInsensitive.content.slides[0]?.elements[0] as TextElement).text).toBe(
      'bar bar bar',
    );

    const caseSensitive = replaceAll(doc, 'foo', 'bar', { caseSensitive: true });
    if (caseSensitive.content.mode !== 'slide') throw new Error();
    expect((caseSensitive.content.slides[0]?.elements[0] as TextElement).text).toBe(
      'Foo bar FOO',
    );
  });

  it('preserves non-matched element identity (structural sharing)', () => {
    const match = textEl('e1', 'foo');
    const untouched = textEl('e2', 'bar');
    const doc = makeDoc([{ id: 's1', elements: [match, untouched] }]);
    const next = replaceAll(doc, 'foo', 'baz');
    if (next.content.mode !== 'slide') throw new Error();
    expect(next.content.slides[0]?.elements[1]).toBe(untouched);
  });

  it('preserves element ordering', () => {
    const doc = makeDoc([
      { id: 's1', elements: [textEl('a', 'x'), textEl('b', 'foo'), textEl('c', 'y')] },
    ]);
    const next = replaceAll(doc, 'foo', 'bar');
    if (next.content.mode !== 'slide') throw new Error();
    const ids = next.content.slides[0]?.elements.map((e) => e.id);
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('returns doc unchanged for non-slide modes', () => {
    const videoDoc: Document = {
      ...makeDoc([]),
      content: {
        mode: 'video',
        aspectRatio: '16:9',
        durationMs: 2000,
        frameRate: 30,
        tracks: [{ id: 't1', kind: 'visual', muted: false, elements: [] }],
      },
    };
    expect(replaceAll(videoDoc, 'any', 'thing')).toBe(videoDoc);
  });
});
