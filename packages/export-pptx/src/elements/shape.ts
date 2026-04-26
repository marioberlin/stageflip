// packages/export-pptx/src/elements/shape.ts
// Emit a `ShapeElement` as `<p:sp>` with `<a:prstGeom>`. Schema-side
// `ShapeKind` → OOXML `prst` mapping mirrors the importer's
// `PRESET_TO_SCHEMA` table inverted. `'custom-path'` falls back to a bounding
// `<a:prstGeom prst="rect"/>` and emits LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED.

import { compareToPlaceholder } from '@stageflip/schema';
import type { Element, ShapeElement } from '@stageflip/schema';
import { emitLossFlag } from '../loss-flags.js';
import type { SlideEmitContext } from './shared.js';
import { renderNvPr, renderXfrm, resolveAndFlagInheritsFrom } from './shared.js';

/**
 * Schema → OOXML preset name. Picks a single canonical preset per `ShapeKind`.
 * Round-trip note: the importer collapses `oval`→`ellipse`, `roundRect`→`rect`
 * etc., so the writer cannot fully recover the source preset; that's
 * acceptable — the round-trip predicate compares schema-level fields only.
 */
const SCHEMA_TO_PRESET: Record<ShapeElement['shape'], string | undefined> = {
  rect: 'rect',
  ellipse: 'ellipse',
  line: 'line',
  polygon: 'triangle',
  star: 'star5',
  'custom-path': undefined,
};

/** Emit a `<p:sp>` for a `ShapeElement`. */
export function emitShapeElement(el: ShapeElement, ctx: SlideEmitContext): string {
  const idAttr = escapeAttr(el.id);
  const nameAttr = escapeAttr(el.name ?? el.id);
  const resolution = resolveAndFlagInheritsFrom(el, ctx);
  const suppress =
    resolution !== null && resolution.kind === 'resolved'
      ? new Set(compareToPlaceholder(el as Element, resolution.placeholder).suppressKeys)
      : new Set<string>();
  const nvPr = renderNvPr(resolution);
  const isPlaceholderRef = resolution !== null && resolution.kind === 'resolved';

  let prst = SCHEMA_TO_PRESET[el.shape];
  if (prst === undefined) {
    // custom-path — fall back to a bounding rect and emit a degraded flag.
    prst = 'rect';
    ctx.flags.push(
      emitLossFlag({
        code: 'LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED',
        location: { slideId: ctx.slideId, elementId: el.id, oocxmlPath: ctx.oocxmlPath },
        message: 'custom-path geometry not yet round-tripped; falling back to bounding rect',
        originalSnippet: 'custom-path',
      }),
    );
  }

  // T-253-rider AC #13: every override (transform + shape) suppressed →
  // emit only the `<p:nvSpPr>` block; runtime fully inherits.
  const allSuppressed = isPlaceholderRef && suppress.has('transform') && suppress.has('shape');
  if (allSuppressed) {
    return `<p:sp>\
<p:nvSpPr><p:cNvPr id="${idAttr}" name="${nameAttr}"/><p:cNvSpPr/>${nvPr}</p:nvSpPr>\
</p:sp>`;
  }

  // `roundRect` honors `cornerRadius` via adj1; we keep the structural
  // mapping minimal here since the importer's PRESET_TO_SCHEMA collapses
  // roundRect → rect anyway.
  const prstGeom =
    isPlaceholderRef && suppress.has('shape')
      ? ''
      : `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>`;
  const xfrm = isPlaceholderRef && suppress.has('transform') ? '' : renderXfrm(el.transform);
  const spPrXml =
    xfrm.length === 0 && prstGeom.length === 0 ? '' : `<p:spPr>${xfrm}${prstGeom}</p:spPr>`;

  return `<p:sp>\
<p:nvSpPr><p:cNvPr id="${idAttr}" name="${nameAttr}"/><p:cNvSpPr/>${nvPr}</p:nvSpPr>\
${spPrXml}\
</p:sp>`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
