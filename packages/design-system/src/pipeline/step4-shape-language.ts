// packages/design-system/src/pipeline/step4-shape-language.ts
// Step 4 — Shape primitive language. Read-only step: counts ShapeKind
// usage, reports a histogram + slide-coverage metric. Does NOT mutate the
// document or emit tokens (AC #14).

import type { Document, ShapeKind, Slide } from '@stageflip/schema';
import type { PipelineState, StepDiagnostic } from '../types.js';

const ALL_KINDS: readonly ShapeKind[] = [
  'rect',
  'ellipse',
  'line',
  'polygon',
  'star',
  'custom-path',
];

function getSlides(doc: Document): Slide[] {
  if (doc.content.mode === 'slide') return doc.content.slides;
  return [];
}

export interface Step4Result {
  shapeLanguage: { histogram: Record<ShapeKind, number>; coverage: number };
  diagnostic: Extract<StepDiagnostic, { step: 4 }>;
}

export function runStep4(state: PipelineState): Step4Result {
  const histogram: Record<ShapeKind, number> = Object.fromEntries(
    ALL_KINDS.map((k) => [k, 0]),
  ) as Record<ShapeKind, number>;
  let totalShapes = 0;
  let slidesWithShape = 0;
  for (const slide of getSlides(state.doc)) {
    let hasShape = false;
    for (const el of slide.elements) {
      if (el.type !== 'shape') continue;
      histogram[el.shape] = (histogram[el.shape] ?? 0) + 1;
      totalShapes += 1;
      hasShape = true;
    }
    if (hasShape) slidesWithShape += 1;
  }
  const slideCount = getSlides(state.doc).length;
  const coverage = slideCount === 0 ? 0 : slidesWithShape / slideCount;
  return {
    shapeLanguage: { histogram, coverage },
    diagnostic: {
      step: 4,
      kind: 'shape-language',
      histogram,
      coverage,
    },
  };
}

export { ALL_KINDS as _ALL_SHAPE_KINDS };
