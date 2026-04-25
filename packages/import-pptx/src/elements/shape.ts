// packages/import-pptx/src/elements/shape.ts
// Convert <p:sp> into one of: TextElement (when <p:txBody> is present),
// ShapeElement (structural kinds + T-242 path-generated `'custom-path'`), or
// UnsupportedShapeElement (preset-geom outside T-242's coverage / unparseable
// custGeom — T-245 rasterization fallback).

import type { ShapeElement } from '@stageflip/schema';
import { HONORED_ADJUSTMENTS, custGeomToSvgPath, geometryFor } from '../geometries/index.js';
import type { AdjustmentMap } from '../geometries/index.js';
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
    const path = custGeomToSvgPath(custGeom, { w: transform.width, h: transform.height });
    if (path !== undefined) {
      const element: ShapeElement = {
        id,
        transform,
        visible: true,
        locked: false,
        animations: [],
        type: 'shape',
        shape: 'custom-path',
        path,
        ...(name !== undefined ? { name } : {}),
      };
      return { element, flags };
    }
    // Could not translate (unsupported command or empty path). Fall back to
    // an unsupported-shape so T-245 rasterization can pick it up.
    flags.push(
      emitLossFlag({
        code: 'LF-PPTX-CUSTOM-GEOMETRY',
        location: { slideId: ctx.slideId, elementId: id, oocxmlPath: ctx.oocxmlPath },
        message: 'custom geometry uses unsupported commands; deferred to T-245',
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
      ...(name !== undefined ? { name } : {}),
    };
    return { element, flags };
  }

  if (prstGeom !== undefined) {
    const prst = pickAttr(prstGeom, 'prst');
    const adjustments = readAdjustments(pickRecord(prstGeom, 'a:avLst'));
    const schemaKind = prst === undefined ? undefined : PRESET_TO_SCHEMA[prst];
    if (schemaKind !== undefined) {
      // Compute cornerRadius for `roundRect` from adj1; honored only on the
      // structural-rect mapping. Other structural presets ignore avLst.
      const cornerRadius =
        prst === 'roundRect' && adjustments.adj !== undefined
          ? roundRectCornerRadius(adjustments.adj, transform.width, transform.height)
          : undefined;
      const element: ShapeElement = {
        id,
        transform,
        visible: true,
        locked: false,
        animations: [],
        type: 'shape',
        shape: schemaKind,
        ...(cornerRadius !== undefined ? { cornerRadius } : {}),
        ...(name !== undefined ? { name } : {}),
      };
      const honored = prst === 'roundRect' && cornerRadius !== undefined ? ['adj'] : [];
      flags.push(...adjustmentIgnoredFlags(adjustments, honored, ctx, id, prst));
      return { element, flags };
    }

    // Try the T-242 geometry library before falling back to unsupported-shape.
    if (prst !== undefined) {
      const path = geometryFor(prst, { w: transform.width, h: transform.height }, adjustments);
      if (path !== undefined) {
        const element: ShapeElement = {
          id,
          transform,
          visible: true,
          locked: false,
          animations: [],
          type: 'shape',
          shape: 'custom-path',
          path,
          ...(name !== undefined ? { name } : {}),
        };
        flags.push(
          ...adjustmentIgnoredFlags(adjustments, HONORED_ADJUSTMENTS[prst] ?? [], ctx, id, prst),
        );
        return { element, flags };
      }
    }

    // Recognised PPTX preset but no schema mapping AND no T-242 generator —
    // emit info flag + placeholder. T-245 rasterization will pick it up.
    flags.push(
      emitLossFlag({
        code: 'LF-PPTX-PRESET-GEOMETRY',
        location: { slideId: ctx.slideId, elementId: id, oocxmlPath: ctx.oocxmlPath },
        message: `preset geometry "${prst ?? '<unknown>'}" outside T-242 coverage; deferred to T-245`,
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
      ...(prst !== undefined ? { presetGeom: prst } : {}),
      ...(name !== undefined ? { name } : {}),
    };
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
    ...(name !== undefined ? { name } : {}),
  };
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

/**
 * Read `<a:avLst>`'s `<a:gd name="X" fmla="val N"/>` entries into a
 * name → integer map. Non-`val` formulas are skipped — full formula
 * evaluation is out of scope for T-242 (escalation trigger).
 */
function readAdjustments(avLst: Record<string, unknown> | undefined): AdjustmentMap {
  const out: AdjustmentMap = {};
  if (avLst === undefined) return out;
  for (const gd of asArray(avLst['a:gd'])) {
    if (!isRecord(gd)) continue;
    const name = pickAttr(gd, 'name');
    const fmla = pickAttr(gd, 'fmla');
    if (name === undefined || fmla === undefined) continue;
    const match = fmla.match(/^val\s+(-?\d+)$/);
    if (match === null || match[1] === undefined) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n)) out[name] = n;
  }
  return out;
}

/**
 * OOXML `roundRect` corner radius from `adj1`: spec defines the radius as
 * `(adj × min(w, h)) / (2 × 100000)` — adj is stored in 100000-ths.
 * Default adj = 35000 if absent; we only call this when adj is present.
 */
function roundRectCornerRadius(adj: number, w: number, h: number): number {
  return (adj * Math.min(w, h)) / 200000;
}

/**
 * Build `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` flags for any adjustment names
 * present in `adjustments` that the generator did not honor.
 */
function adjustmentIgnoredFlags(
  adjustments: AdjustmentMap,
  honored: readonly string[],
  ctx: ElementContext,
  elementId: string,
  prst: string | undefined,
): LossFlag[] {
  const out: LossFlag[] = [];
  for (const [name, value] of Object.entries(adjustments)) {
    if (honored.includes(name)) continue;
    out.push(
      emitLossFlag({
        code: 'LF-PPTX-PRESET-ADJUSTMENT-IGNORED',
        location: { slideId: ctx.slideId, elementId, oocxmlPath: ctx.oocxmlPath },
        message: `preset "${prst ?? '<unknown>'}" adjustment ${name}=${value} not honored; using default`,
        originalSnippet: `${prst ?? ''}.${name}=${value}`,
      }),
    );
  }
  return out;
}
