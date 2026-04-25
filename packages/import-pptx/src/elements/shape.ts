// packages/import-pptx/src/elements/shape.ts
// Convert <p:sp> into one of: TextElement (when <p:txBody> is present),
// ShapeElement (when geometry maps to schema's `shapeKind`), or
// UnsupportedShapeElement (preset-geom we cannot represent yet — T-242 / T-245
// follow-up).

import type { ShapeElement } from '@stageflip/schema';
import { emitLossFlag } from '../loss-flags.js';
import { makeElementId, readTransform } from '../parts/sp-tree.js';
import type { LossFlag, ParsedElement, UnsupportedShapeElement } from '../types.js';
import { asArray, isRecord, pickAttr, pickRecord } from './shared.js';
import type { ElementContext } from './shared.js';
import { buildText } from './text.js';

/** Subset of OOXML `prstGeom@prst` values that map cleanly to schema kinds. */
const PRESET_TO_SCHEMA: Record<string, ShapeElement['shape']> = {
  rect: 'rect',
  roundRect: 'rect',
  ellipse: 'ellipse',
  oval: 'ellipse',
  line: 'line',
  triangle: 'polygon',
  diamond: 'polygon',
  pentagon: 'polygon',
  hexagon: 'polygon',
  octagon: 'polygon',
  star5: 'star',
  star4: 'star',
  star6: 'star',
  star8: 'star',
  star10: 'star',
  star12: 'star',
  star16: 'star',
  star24: 'star',
  star32: 'star',
};

export function parseShape(
  sp: unknown,
  ctx: ElementContext,
): { element?: ParsedElement; flags: LossFlag[] } {
  if (!isRecord(sp)) return { flags: [] };
  const flags: LossFlag[] = [];

  const nv = pickRecord(sp, 'p:nvSpPr');
  const cNvPr = pickRecord(nv, 'p:cNvPr');
  const id = makeElementId(pickAttr(cNvPr, 'id'));
  const name = pickAttr(cNvPr, 'name');

  const spPr = pickRecord(sp, 'p:spPr');
  const xfrm = pickRecord(spPr, 'a:xfrm');
  const transform = readTransform(xfrm);

  const txBody = pickRecord(sp, 'p:txBody');
  if (txBody !== undefined && hasAnyText(txBody)) {
    const element = buildText({
      txBody,
      id,
      transform,
      ...(name !== undefined ? { name } : {}),
    });
    return { element, flags };
  }

  // No text body — interpret geometry.
  const prstGeom = pickRecord(spPr, 'a:prstGeom');
  const custGeom = pickRecord(spPr, 'a:custGeom');

  if (custGeom !== undefined) {
    flags.push(
      emitLossFlag({
        code: 'LF-PPTX-CUSTOM-GEOMETRY',
        location: { slideId: ctx.slideId, elementId: id, oocxmlPath: ctx.oocxmlPath },
        message: 'custom geometry deferred to T-242 / T-245',
        originalSnippet: 'a:custGeom',
      }),
    );
    const element: UnsupportedShapeElement = {
      id,
      transform,
      visible: true,
      locked: false,
      animations: [],
      type: 'unsupported-shape',
      custGeom: 'a:custGeom',
      oocxmlPath: ctx.oocxmlPath,
    };
    if (name !== undefined) (element as { name: string }).name = name;
    return { element, flags };
  }

  if (prstGeom !== undefined) {
    const prst = pickAttr(prstGeom, 'prst');
    const schemaKind = prst === undefined ? undefined : PRESET_TO_SCHEMA[prst];
    if (schemaKind !== undefined) {
      const element: ShapeElement = {
        id,
        transform,
        visible: true,
        locked: false,
        animations: [],
        type: 'shape',
        shape: schemaKind,
      };
      if (name !== undefined) element.name = name;
      return { element, flags };
    }

    // Recognised PPTX preset but no schema mapping — emit info flag + placeholder.
    flags.push(
      emitLossFlag({
        code: 'LF-PPTX-PRESET-GEOMETRY',
        location: { slideId: ctx.slideId, elementId: id, oocxmlPath: ctx.oocxmlPath },
        message: `preset geometry "${prst ?? '<unknown>'}" deferred to T-242`,
        originalSnippet: prst ?? '<unknown>',
      }),
    );
    const element: UnsupportedShapeElement = {
      id,
      transform,
      visible: true,
      locked: false,
      animations: [],
      type: 'unsupported-shape',
      oocxmlPath: ctx.oocxmlPath,
    };
    if (prst !== undefined) element.presetGeom = prst;
    if (name !== undefined) (element as { name: string }).name = name;
    return { element, flags };
  }

  // No geometry at all — placeholder element.
  flags.push(
    emitLossFlag({
      code: 'LF-PPTX-UNSUPPORTED-ELEMENT',
      location: { slideId: ctx.slideId, elementId: id, oocxmlPath: ctx.oocxmlPath },
      message: 'shape element with neither prstGeom nor custGeom',
    }),
  );
  const element: UnsupportedShapeElement = {
    id,
    transform,
    visible: true,
    locked: false,
    animations: [],
    type: 'unsupported-shape',
    oocxmlPath: ctx.oocxmlPath,
  };
  if (name !== undefined) (element as { name: string }).name = name;
  return { element, flags };
}

/** True when the txBody actually contains at least one non-empty `<a:t>`. */
function hasAnyText(txBody: Record<string, unknown>): boolean {
  for (const p of asArray(txBody['a:p'])) {
    if (!isRecord(p)) continue;
    for (const r of asArray(p['a:r'])) {
      if (!isRecord(r)) continue;
      const t = r['a:t'];
      if (typeof t === 'string' && t.length > 0) return true;
      if (isRecord(t) && typeof t['#text'] === 'string' && (t['#text'] as string).length > 0) {
        return true;
      }
    }
  }
  return false;
}
