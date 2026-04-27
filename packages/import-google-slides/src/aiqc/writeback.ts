// packages/import-google-slides/src/aiqc/writeback.ts
// Apply a Gemini-resolved value to the canonical tree. Schema-aligned shape
// mapping (rounded-rect → rect + cornerRadius). Element-replacement (not
// in-place mutation) for ShapeElement → TextElement conversion per spec
// AC #17.
//
// The writeback APIs return new tree values (not in-place edits); the caller
// (`runAiQcConvergence`) builds up a fresh tree slide-by-slide.

import type { ShapeElement, ShapeKind, TextElement } from '@stageflip/schema';
import type { ParsedElement, ParsedSlide } from '../types.js';
import type { GeminiResolutionResponse } from './types.js';

/** Map Gemini's shapeKind onto schema ShapeKind + an optional cornerRadius. */
export function mapShapeKind(
  geminiKind: NonNullable<GeminiResolutionResponse['shapeKind']>,
  cornerRadiusPx: number | undefined,
): { shape: ShapeKind; cornerRadius?: number } {
  if (geminiKind === 'rounded-rect') {
    // Schema has no 'roundRect' kind — rounded rectangles are rect + cornerRadius.
    return cornerRadiusPx !== undefined && cornerRadiusPx > 0
      ? { shape: 'rect', cornerRadius: cornerRadiusPx }
      : { shape: 'rect' };
  }
  return { shape: geminiKind };
}

/**
 * Apply a Gemini resolution to one element. Returns a fresh element value
 * (or the original unchanged when no field updated). For text-resolution on
 * a shape element, the original is REPLACED with a fresh TextElement
 * carrying the preserved-fields set defined in spec AC #17.
 */
export function applyResolutionToElement(
  original: ParsedElement,
  resolution: GeminiResolutionResponse,
): ParsedElement {
  // Text resolution → ShapeElement → TextElement REPLACEMENT (AC #17).
  if (resolution.resolvedKind === 'text' && resolution.text !== null && original.type === 'shape') {
    const replaced: TextElement = {
      id: original.id,
      transform: original.transform,
      visible: original.visible,
      locked: original.locked,
      animations: original.animations,
      ...(original.name !== undefined ? { name: original.name } : {}),
      ...(original.inheritsFrom !== undefined ? { inheritsFrom: original.inheritsFrom } : {}),
      type: 'text',
      text: resolution.text,
      runs: [{ text: resolution.text }],
      align: 'left',
    };
    return replaced;
  }

  // Shape resolution → update fields on an existing ShapeElement (AC #18, #19).
  if (resolution.resolvedKind === 'shape' && original.type === 'shape') {
    const updates: Partial<ShapeElement> = {};
    if (resolution.shapeKind !== null) {
      const mapped = mapShapeKind(resolution.shapeKind, resolution.cornerRadiusPx);
      updates.shape = mapped.shape;
      if (mapped.cornerRadius !== undefined) {
        updates.cornerRadius = mapped.cornerRadius;
      } else {
        // Explicitly clear cornerRadius if mapping says no rounding.
        // (Use undefined; Object.assign with undefined leaves the field unset.)
      }
    }
    if (resolution.fillColor !== null) {
      updates.fill = resolution.fillColor;
    }
    return { ...original, ...updates };
  }

  // Other resolvedKind values are accepted but not yet wired (text-color on
  // text elements, image-on-image, etc. are OOS for v1 — see spec §4).
  return original;
}

/**
 * Replace an element in a ParsedSlide.elements[] at the index where
 * `elementId` matches. Returns a new slide; original is unchanged. When the
 * element is not found, returns the slide unchanged.
 */
export function replaceElementInSlide(
  slide: ParsedSlide,
  elementId: string,
  replacement: ParsedElement,
): ParsedSlide {
  const index = slide.elements.findIndex((e) => e.id === elementId);
  if (index === -1) return slide;
  const newElements = slide.elements.slice();
  newElements[index] = replacement;
  return { ...slide, elements: newElements };
}
