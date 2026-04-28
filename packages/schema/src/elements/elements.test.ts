// packages/schema/src/elements/elements.test.ts
// Unit tests for every element type in the canonical schema. Exhaustive
// round-trip tests (across all animations × all timings) are T-024's scope;
// this file covers shape, defaults, discrimination, and the group recursion.

import { describe, expect, it } from 'vitest';

import {
  ELEMENT_TYPES,
  type Element,
  audioElementSchema,
  chartElementSchema,
  clipElementSchema,
  codeElementSchema,
  elementSchema,
  embedElementSchema,
  groupElementSchema,
  imageElementSchema,
  shapeElementSchema,
  tableElementSchema,
  textElementSchema,
  videoElementSchema,
} from './index.js';
import { validateShapeElement } from './shape.js';

const BASE = {
  id: 'el_01abc',
  transform: { x: 0, y: 0, width: 100, height: 100 },
} as const;

describe('text element', () => {
  it('parses a minimal valid text element', () => {
    const parsed = textElementSchema.parse({ ...BASE, type: 'text', text: 'Hello' });
    expect(parsed.align).toBe('left');
    expect(parsed.visible).toBe(true);
  });
  it('rejects missing text', () => {
    expect(() => textElementSchema.parse({ ...BASE, type: 'text' })).toThrow();
  });
  it('rejects invalid align', () => {
    expect(() =>
      textElementSchema.parse({ ...BASE, type: 'text', text: 'x', align: 'crooked' }),
    ).toThrow();
  });
});

describe('image element', () => {
  it('parses a minimal valid image element', () => {
    const parsed = imageElementSchema.parse({
      ...BASE,
      type: 'image',
      src: 'asset:abc123',
    });
    expect(parsed.fit).toBe('cover');
  });
  it('rejects a non-asset src', () => {
    expect(() =>
      imageElementSchema.parse({ ...BASE, type: 'image', src: 'http://example.com/x.png' }),
    ).toThrow(/asset ref/);
  });
});

describe('video element', () => {
  it('parses minimal + enforces trim.endMs > startMs', () => {
    const ok = videoElementSchema.parse({ ...BASE, type: 'video', src: 'asset:v1' });
    expect(ok.muted).toBe(false);
    expect(() =>
      videoElementSchema.parse({
        ...BASE,
        type: 'video',
        src: 'asset:v1',
        trim: { startMs: 500, endMs: 100 },
      }),
    ).toThrow(/endMs must exceed startMs/);
  });
});

describe('audio element', () => {
  it('parses with mix defaults', () => {
    const parsed = audioElementSchema.parse({
      ...BASE,
      type: 'audio',
      src: 'asset:a1',
      mix: { gain: 2 },
    });
    expect(parsed.mix?.pan).toBe(0);
    expect(parsed.mix?.fadeInMs).toBe(0);
  });
});

describe('shape element', () => {
  it('parses rect without path', () => {
    const parsed = shapeElementSchema.parse({ ...BASE, type: 'shape', shape: 'rect' });
    expect(parsed.shape).toBe('rect');
  });
  it('parses custom-path without path at the schema level (semantic check is separate)', () => {
    const parsed = shapeElementSchema.parse({ ...BASE, type: 'shape', shape: 'custom-path' });
    expect(parsed.shape).toBe('custom-path');
    // The semantic check lives in validateShapeElement so we keep the
    // element schema compatible with z.union recursion.
    expect(validateShapeElement(parsed)).toMatch(/custom-path/);
  });
  it('validateShapeElement passes a valid custom-path shape', () => {
    const parsed = shapeElementSchema.parse({
      ...BASE,
      type: 'shape',
      shape: 'custom-path',
      path: 'M 0 0 L 10 10 Z',
    });
    expect(validateShapeElement(parsed)).toBeNull();
  });
  it('accepts theme-token fill', () => {
    const parsed = shapeElementSchema.parse({
      ...BASE,
      type: 'shape',
      shape: 'rect',
      fill: 'theme:color.primary',
    });
    expect(parsed.fill).toBe('theme:color.primary');
  });
});

describe('chart element', () => {
  it('accepts inline data', () => {
    const parsed = chartElementSchema.parse({
      ...BASE,
      type: 'chart',
      chartKind: 'bar',
      data: { labels: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] },
    });
    expect(parsed.legend).toBe(true);
  });
  it('accepts ds: reference', () => {
    chartElementSchema.parse({
      ...BASE,
      type: 'chart',
      chartKind: 'line',
      data: 'ds:quarterly_revenue',
    });
  });
});

describe('table element', () => {
  it('parses rows/columns/cells', () => {
    const parsed = tableElementSchema.parse({
      ...BASE,
      type: 'table',
      rows: 2,
      columns: 2,
      cells: [{ row: 0, col: 0, content: 'hi' }],
    });
    expect(parsed.headerRow).toBe(true);
  });
});

describe('clip element', () => {
  it('carries runtime + params + optional fonts', () => {
    const parsed = clipElementSchema.parse({
      ...BASE,
      type: 'clip',
      runtime: 'gsap',
      clipName: 'motion-text',
      params: { speed: 2 },
      fonts: [{ family: 'Inter', weight: 600 }],
    });
    expect(parsed.runtime).toBe('gsap');
    expect(parsed.fonts?.[0]?.style).toBe('normal');
  });
});

describe('embed element', () => {
  it('parses with default sandbox', () => {
    const parsed = embedElementSchema.parse({
      ...BASE,
      type: 'embed',
      src: 'https://example.com/widget',
    });
    expect(parsed.sandbox).toEqual(['allow-scripts']);
    expect(parsed.allowFullscreen).toBe(false);
  });
  it('rejects invalid URL', () => {
    expect(() => embedElementSchema.parse({ ...BASE, type: 'embed', src: 'not a url' })).toThrow();
  });
});

describe('code element', () => {
  it('parses typescript with defaults', () => {
    const parsed = codeElementSchema.parse({
      ...BASE,
      type: 'code',
      code: 'const x = 1;',
      language: 'typescript',
    });
    expect(parsed.showLineNumbers).toBe(false);
  });
});

describe('group element (recursive)', () => {
  it('parses a group containing mixed children, including a nested group', () => {
    const parsed = groupElementSchema.parse({
      ...BASE,
      type: 'group',
      children: [
        { ...BASE, id: 'child1', type: 'text', text: 'A' },
        {
          ...BASE,
          id: 'child2',
          type: 'group',
          children: [{ ...BASE, id: 'grand1', type: 'text', text: 'B' }],
        },
      ],
    });
    expect(parsed.clip).toBe(false);
    expect(parsed.children).toHaveLength(2);
    const nested = parsed.children[1];
    expect(nested?.type).toBe('group');
    if (nested?.type === 'group') expect(nested.children[0]?.type).toBe('text');
  });
});

describe('elementSchema (discriminated union)', () => {
  it('discriminates on `type`', () => {
    const t: Element = elementSchema.parse({ ...BASE, type: 'text', text: 'x' });
    expect(t.type).toBe('text');
    // TS narrowing check (no runtime effect; compilation is the test)
    if (t.type === 'text') expect(t.text).toBe('x');
  });
  it('rejects unknown type', () => {
    expect(() => elementSchema.parse({ ...BASE, type: 'unicorn' })).toThrow();
  });
  it('rejects unknown field on a known type (strict)', () => {
    expect(() =>
      elementSchema.parse({ ...BASE, type: 'text', text: 'x', hairstyle: 'mohawk' }),
    ).toThrow();
  });
  it('ELEMENT_TYPES covers all discriminant values', () => {
    // Bumped from 12 to 13 in T-305 to add 'interactive-clip' (ADR-003 §D2).
    expect(ELEMENT_TYPES).toHaveLength(13);
    expect(new Set(ELEMENT_TYPES).size).toBe(13);
  });
});
