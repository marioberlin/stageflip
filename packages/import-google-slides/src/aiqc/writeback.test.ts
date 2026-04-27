// packages/import-google-slides/src/aiqc/writeback.test.ts
// Writeback semantics. ACs #17, #18, #19, #20.

import type { ShapeElement, TextElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { ParsedElement, ParsedSlide } from '../types.js';
import type { GeminiResolutionResponse } from './types.js';
import { applyResolutionToElement, mapShapeKind, replaceElementInSlide } from './writeback.js';

const BASE_SHAPE: ShapeElement = {
  id: 'el_1',
  type: 'shape',
  shape: 'rect',
  transform: { x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
};

describe('mapShapeKind', () => {
  it('AC #18: rounded-rect with cornerRadiusPx maps to rect + cornerRadius', () => {
    expect(mapShapeKind('rounded-rect', 8)).toEqual({ shape: 'rect', cornerRadius: 8 });
  });
  it('AC #18: rounded-rect without cornerRadiusPx maps to rect (no cornerRadius)', () => {
    expect(mapShapeKind('rounded-rect', undefined)).toEqual({ shape: 'rect' });
  });
  it('AC #18: non-rounded shapeKinds pass through unchanged', () => {
    expect(mapShapeKind('ellipse', undefined)).toEqual({ shape: 'ellipse' });
    expect(mapShapeKind('star', undefined)).toEqual({ shape: 'star' });
  });
});

describe('applyResolutionToElement', () => {
  it('AC #17: text resolution replaces ShapeElement with TextElement, preserving id/transform/inheritsFrom', () => {
    const original: ParsedElement = {
      ...BASE_SHAPE,
      inheritsFrom: { templateId: 'layout_1', placeholderIdx: 2 },
      name: 'Title',
    };
    const resolution: GeminiResolutionResponse = {
      confidence: 0.9,
      resolvedKind: 'text',
      text: 'Quarterly Goals',
      fillColor: null,
      shapeKind: null,
      reasoning: 'OCR matched text region',
    };
    const replaced = applyResolutionToElement(original, resolution);
    expect(replaced.type).toBe('text');
    if (replaced.type !== 'text') throw new Error();
    expect(replaced.id).toBe('el_1');
    expect(replaced.transform).toEqual(original.transform);
    expect(replaced.text).toBe('Quarterly Goals');
    expect(replaced.runs).toEqual([{ text: 'Quarterly Goals' }]);
    expect(replaced.inheritsFrom).toEqual({ templateId: 'layout_1', placeholderIdx: 2 });
    expect(replaced.name).toBe('Title');
    // Dropped: shape, fill, stroke, cornerRadius
    expect((replaced as TextElement & { shape?: unknown }).shape).toBeUndefined();
  });

  it('AC #18: shape resolution + rounded-rect updates ShapeElement.shape and cornerRadius', () => {
    const resolution: GeminiResolutionResponse = {
      confidence: 0.92,
      resolvedKind: 'shape',
      text: null,
      fillColor: null,
      shapeKind: 'rounded-rect',
      cornerRadiusPx: 12,
      reasoning: 'rounded corners visible',
    };
    const updated = applyResolutionToElement(BASE_SHAPE, resolution);
    expect(updated.type).toBe('shape');
    if (updated.type !== 'shape') throw new Error();
    expect(updated.shape).toBe('rect');
    expect(updated.cornerRadius).toBe(12);
  });

  it('AC #18: shape resolution + non-rounded shape leaves cornerRadius unset', () => {
    const resolution: GeminiResolutionResponse = {
      confidence: 0.92,
      resolvedKind: 'shape',
      text: null,
      fillColor: null,
      shapeKind: 'ellipse',
      reasoning: 'oval shape',
    };
    const updated = applyResolutionToElement(BASE_SHAPE, resolution);
    if (updated.type !== 'shape') throw new Error();
    expect(updated.shape).toBe('ellipse');
    expect(updated.cornerRadius).toBeUndefined();
  });

  it('AC #19: shape resolution with fillColor updates ShapeElement.fill', () => {
    const resolution: GeminiResolutionResponse = {
      confidence: 0.9,
      resolvedKind: 'shape',
      text: null,
      fillColor: '#FF0000',
      shapeKind: 'rect',
      reasoning: 'red fill',
    };
    const updated = applyResolutionToElement(BASE_SHAPE, resolution);
    if (updated.type !== 'shape') throw new Error();
    expect(updated.fill).toBe('#FF0000');
  });

  it('AC #20: inheritsFrom is preserved across the ShapeElement → TextElement replacement', () => {
    const original: ParsedElement = {
      ...BASE_SHAPE,
      inheritsFrom: { templateId: 'master_1', placeholderIdx: 0 },
    };
    const resolution: GeminiResolutionResponse = {
      confidence: 0.95,
      resolvedKind: 'text',
      text: 'Hello',
      fillColor: null,
      shapeKind: null,
      reasoning: 'text',
    };
    const replaced = applyResolutionToElement(original, resolution);
    expect(replaced.inheritsFrom).toEqual({ templateId: 'master_1', placeholderIdx: 0 });
  });

  it('returns the original element unchanged when no field updated', () => {
    const resolution: GeminiResolutionResponse = {
      confidence: 0.9,
      resolvedKind: 'image',
      text: null,
      fillColor: null,
      shapeKind: null,
      reasoning: 'image-on-image not yet wired',
    };
    const result = applyResolutionToElement(BASE_SHAPE, resolution);
    expect(result).toBe(BASE_SHAPE);
  });
});

describe('replaceElementInSlide', () => {
  it('replaces element at the same index, preserving order', () => {
    const slide: ParsedSlide = {
      id: 'slide_1',
      elements: [
        { ...BASE_SHAPE, id: 'a' },
        { ...BASE_SHAPE, id: 'b' },
        { ...BASE_SHAPE, id: 'c' },
      ],
    };
    const replacement: ParsedElement = { ...BASE_SHAPE, id: 'b', shape: 'star' };
    const out = replaceElementInSlide(slide, 'b', replacement);
    expect(out.elements.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    const middle = out.elements[1];
    expect(middle?.type).toBe('shape');
    if (middle?.type === 'shape') expect(middle.shape).toBe('star');
  });

  it('returns the slide unchanged when the elementId is not found', () => {
    const slide: ParsedSlide = {
      id: 'slide_1',
      elements: [{ ...BASE_SHAPE, id: 'a' }],
    };
    const replacement: ParsedElement = { ...BASE_SHAPE, id: 'z' };
    const out = replaceElementInSlide(slide, 'missing', replacement);
    expect(out).toBe(slide);
  });
});
