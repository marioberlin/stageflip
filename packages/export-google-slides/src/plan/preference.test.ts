// packages/export-google-slides/src/plan/preference.test.ts
// Pins similarity heuristic + Levenshtein math. Underwrites AC #8.

import type { TextElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { bboxesFromApi, findSimilarObject, similarity } from './preference.js';

function textEl(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'e1',
    type: 'text',
    text: 'Hello world',
    transform: { x: 100, y: 100, width: 200, height: 50, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    align: 'left',
    ...overrides,
  } as TextElement;
}

describe('similarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(similarity('hello', 'hello')).toBe(1);
  });
  it('returns 0 for empty', () => {
    expect(similarity('', 'hello')).toBe(0);
    expect(similarity('hello', '')).toBe(0);
  });
  it('returns >0.8 for "Hello world" vs "Hello World" (case diff)', () => {
    // "Hello world" vs "Hello World": 1 char swap / 11 = 1 - 1/11 ≈ 0.909
    expect(similarity('Hello world', 'Hello World')).toBeGreaterThan(0.8);
  });
  it('returns <0.8 for unrelated strings', () => {
    expect(similarity('apple', 'banana')).toBeLessThan(0.8);
  });
});

describe('findSimilarObject', () => {
  it('AC #8: finds candidate within 50px and 0.8 similarity', () => {
    const cand = [
      {
        objectId: 'apiObj1',
        kind: 'shape' as const,
        text: 'Hello world',
        centerPx: { x: 200, y: 125 }, // canonical center is (200, 125), exact match
      },
    ];
    expect(findSimilarObject(textEl(), cand)).toBe('apiObj1');
  });
  it('rejects candidate beyond 50px', () => {
    const cand = [
      {
        objectId: 'apiObj1',
        kind: 'shape' as const,
        text: 'Hello world',
        centerPx: { x: 400, y: 125 },
      },
    ];
    expect(findSimilarObject(textEl(), cand)).toBeUndefined();
  });
  it('rejects candidate with low text similarity', () => {
    const cand = [
      {
        objectId: 'apiObj1',
        kind: 'shape' as const,
        text: 'completely different text',
        centerPx: { x: 200, y: 125 },
      },
    ];
    expect(findSimilarObject(textEl(), cand)).toBeUndefined();
  });
  it('rejects when kind differs', () => {
    const cand = [
      {
        objectId: 'apiObj1',
        kind: 'image' as const,
        centerPx: { x: 200, y: 125 },
      },
    ];
    expect(findSimilarObject(textEl(), cand)).toBeUndefined();
  });
});

describe('bboxesFromApi', () => {
  it('extracts shape with text and center', () => {
    const result = bboxesFromApi([
      {
        objectId: 'apiObj1',
        size: {
          width: { magnitude: 1_905_000 }, // 200 px
          height: { magnitude: 476_250 }, // 50 px
        },
        transform: {
          translateX: 952_500, // 100 px
          translateY: 952_500,
        },
        shape: {
          text: { textElements: [{ textRun: { content: 'Hello' } }] },
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe('shape');
    expect(result[0]?.text).toBe('Hello');
    expect(result[0]?.centerPx.x).toBe(200);
    expect(result[0]?.centerPx.y).toBe(125);
  });
  it('returns empty when no objectId', () => {
    expect(bboxesFromApi([{}])).toHaveLength(0);
  });
});
