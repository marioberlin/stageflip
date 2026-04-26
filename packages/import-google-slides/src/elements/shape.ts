// packages/import-google-slides/src/elements/shape.ts
// Convert Slides API `pageElement.shape` (rectangle / ellipse / text-only
// shapes) into a canonical ShapeElement OR a ParsedElement (TextElement when
// there's text content). Honors the placeholder.parentObjectId →
// inheritsFrom mapping when the parent template resolves.

import type { ShapeElement } from '@stageflip/schema';
import type { ApiPageElement } from '../api/types.js';
import type { BboxPx } from '../geometry/affine.js';
import { emitLossFlag } from '../loss-flags.js';
import { extractApiText } from '../matching/match.js';
import type { LossFlag, ParsedElement } from '../types.js';
import { makeElementId, resolveInheritsFrom, transformFromBbox } from './shared.js';

/** Subset of Slides API `shape.shapeType` values that map cleanly to ShapeKind. */
const SHAPE_TYPE_TO_KIND: Record<string, ShapeElement['shape']> = {
  RECTANGLE: 'rect',
  ROUND_RECTANGLE: 'rect',
  TEXT_BOX: 'rect',
  ELLIPSE: 'ellipse',
  TRIANGLE: 'polygon',
  RIGHT_TRIANGLE: 'polygon',
  DIAMOND: 'polygon',
  PENTAGON: 'polygon',
  HEXAGON: 'polygon',
  OCTAGON: 'polygon',
  STAR_5: 'star',
  STAR_4: 'star',
  STAR_6: 'star',
  STAR_7: 'star',
  STAR_8: 'star',
  STAR_10: 'star',
  STAR_12: 'star',
  STAR_16: 'star',
  STAR_24: 'star',
  STAR_32: 'star',
};

export interface ShapeEmitContext {
  apiElement: ApiPageElement;
  worldBbox: BboxPx;
  layoutIds: ReadonlySet<string>;
  masterIds: ReadonlySet<string>;
  slideId: string;
  fallback: string;
}

export function emitShapeElement(ctx: ShapeEmitContext): {
  element: ParsedElement;
  flags: LossFlag[];
} {
  const { apiElement, worldBbox, layoutIds, masterIds, slideId, fallback } = ctx;
  const id = makeElementId(apiElement.objectId, fallback);
  const transform = transformFromBbox(worldBbox);
  const flags: LossFlag[] = [];

  const inheritsFrom = resolveInheritsFrom(apiElement, layoutIds, masterIds);
  if (apiElement.shape?.placeholder?.parentObjectId !== undefined && !inheritsFrom) {
    // Placeholder targets a template we didn't parse — inline the API geometry.
    flags.push(
      emitLossFlag({
        code: 'LF-GSLIDES-PLACEHOLDER-INLINED',
        location: { slideId, elementId: id },
        message: `placeholder.parentObjectId "${apiElement.shape.placeholder.parentObjectId}" did not resolve to a parsed layout/master`,
      }),
    );
  }

  const apiText = extractApiText(apiElement.shape?.text);
  if (apiText !== null) {
    // Text-bearing shape → emit as TextElement variant (closest canonical
    // mapping). Schema's TextElement is the right type for text-content
    // shapes; styling extraction is best-effort.
    const element: ParsedElement = {
      id,
      transform,
      visible: true,
      locked: false,
      animations: [],
      type: 'text',
      text: apiText,
      align: 'left',
      ...(inheritsFrom ? { inheritsFrom } : {}),
    };
    return { element, flags };
  }

  // Geometry-only shape.
  const shapeType = apiElement.shape?.shapeType;
  const kind = shapeType ? SHAPE_TYPE_TO_KIND[shapeType] : undefined;
  if (kind === undefined) {
    // Unknown shape kind — emit as a rect fallback + a loss flag so callers
    // see the silent coercion. Use IMAGE-FALLBACK code (per spec §8: emitted
    // when an element can't be modeled cleanly).
    flags.push(
      emitLossFlag({
        code: 'LF-GSLIDES-IMAGE-FALLBACK',
        location: { slideId, elementId: id },
        message: `unknown shape.shapeType "${shapeType ?? '<unset>'}"; defaulting to rect`,
      }),
    );
  }
  const element: ShapeElement & { inheritsFrom?: { templateId: string; placeholderIdx: number } } =
    {
      id,
      transform,
      visible: true,
      locked: false,
      animations: [],
      type: 'shape',
      shape: kind ?? 'rect',
      ...(inheritsFrom ? { inheritsFrom } : {}),
    };
  return { element, flags };
}
