// packages/import-pptx/src/parts/sp-tree.ts
// Walks `<p:spTree>` children and dispatches each to the right element
// converter. Group transforms are not accumulated here; the post-walk pass
// `accumulateGroupTransforms` (T-241a) folds them into descendants.

import { parsePicture } from '../elements/picture.js';
import { parseShape } from '../elements/shape.js';
import type { ElementContext } from '../elements/shared.js';
import { attrNumber } from '../elements/shared.js';
import { emitLossFlag } from '../loss-flags.js';
import { type OrderedXmlNode, allChildren, attr, children, firstChild, tagOf } from '../opc.js';
import type { LossFlag, ParsedElement, ParsedGroupElement } from '../types.js';

/**
 * Walk an `spTree` node (or a recursive `<p:grpSp>`) and produce parser
 * elements + any loss flags raised in that subtree.
 */
export function walkSpTree(
  spTree: OrderedXmlNode | undefined,
  ctx: ElementContext,
): {
  elements: ParsedElement[];
  flags: LossFlag[];
} {
  const elements: ParsedElement[] = [];
  const flags: LossFlag[] = [];

  if (spTree === undefined) return { elements, flags };

  // PPTX shapes
  for (const sp of children(spTree, 'p:sp')) {
    const r = parseShape(sp, ctx);
    if (r.element !== undefined) elements.push(r.element);
    flags.push(...r.flags);
  }

  // Pictures
  for (const pic of children(spTree, 'p:pic')) {
    const r = parsePicture(pic, ctx);
    if (r.element !== undefined) elements.push(r.element);
    flags.push(...r.flags);
  }

  // Recursive groups
  for (const grpSp of children(spTree, 'p:grpSp')) {
    const r = parseGroup(grpSp, ctx);
    if (r.element !== undefined) elements.push(r.element);
    flags.push(...r.flags);
  }

  // Connections, content-parts, OLE, etc. → unsupported flag, no element.
  // Group these by tag (one flag per tag occurrence) to keep parity with the
  // pre-T-242d behavior where fast-xml-parser collapsed repeats into arrays.
  const unsupportedTags = new Set(['p:cxnSp', 'p:graphicFrame', 'p:contentPart']);
  const seenUnsupported = new Set<string>();
  for (const child of allChildren(spTree)) {
    const tag = tagOf(child);
    if (tag === undefined || !unsupportedTags.has(tag)) continue;
    if (seenUnsupported.has(tag)) continue;
    seenUnsupported.add(tag);
    flags.push(
      emitLossFlag({
        code: 'LF-PPTX-UNSUPPORTED-ELEMENT',
        location: { slideId: ctx.slideId, oocxmlPath: ctx.oocxmlPath },
        message: `unsupported element type ${tag}; T-247 / T-248 follow-up`,
        originalSnippet: tag,
      }),
    );
  }

  return { elements, flags };
}

function parseGroup(
  grpSp: OrderedXmlNode | undefined,
  ctx: ElementContext,
): { element?: ParsedGroupElement; flags: LossFlag[] } {
  if (grpSp === undefined) return { flags: [] };

  const inner = walkSpTree(grpSp, ctx);

  const nv = firstChild(grpSp, 'p:nvGrpSpPr');
  const cNvPr = firstChild(nv, 'p:cNvPr');
  const id = makeElementId(attr(cNvPr, 'id'));
  const name = attr(cNvPr, 'name');

  const grpSpPr = firstChild(grpSp, 'p:grpSpPr');
  const xfrm = firstChild(grpSpPr, 'a:xfrm');
  const transform = readTransform(xfrm);

  // <a:chOff> defaults to {0, 0} when absent; <a:chExt> defaults to the
  // group's own extent. Stored in EMU-derived px so accumulation math stays
  // unit-consistent with `transform`.
  const chOff = firstChild(xfrm, 'a:chOff');
  const chExt = firstChild(xfrm, 'a:chExt');
  const groupOrigin = {
    x: emuToPx(attrNumber(chOff, 'x') ?? 0),
    y: emuToPx(attrNumber(chOff, 'y') ?? 0),
  };
  const groupExtent = {
    width:
      chExt !== undefined
        ? emuToPx(attrNumber(chExt, 'cx') ?? 0) || transform.width
        : transform.width,
    height:
      chExt !== undefined
        ? emuToPx(attrNumber(chExt, 'cy') ?? 0) || transform.height
        : transform.height,
  };

  const base: ParsedGroupElement = {
    id,
    transform,
    visible: true,
    locked: false,
    animations: [],
    type: 'group',
    children: inner.elements,
    clip: false,
    groupOrigin,
    groupExtent,
  };

  const element: ParsedGroupElement = name === undefined ? base : { ...base, name };
  return { element, flags: inner.flags };
}

/** Read `<a:xfrm><a:off>/<a:ext>` into a schema transform (in pixels). */
export function readTransform(xfrm: OrderedXmlNode | undefined): {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
} {
  const off = firstChild(xfrm, 'a:off');
  const ext = firstChild(xfrm, 'a:ext');
  const x = emuToPx(attrNumber(off, 'x') ?? 0);
  const y = emuToPx(attrNumber(off, 'y') ?? 0);
  // PPTX width/height of 0 is legal in some malformed exports; fall back to a
  // 1px box so the schema's `.positive()` constraint is satisfied. We also
  // emit nothing here — the caller emits an unsupported-fill flag where
  // appropriate.
  const width = Math.max(1, emuToPx(attrNumber(ext, 'cx') ?? 9525));
  const height = Math.max(1, emuToPx(attrNumber(ext, 'cy') ?? 9525));
  const rotEmu = attrNumber(xfrm, 'rot');
  const rotation = rotEmu === undefined ? 0 : rotEmu / 60000;
  return { x, y, width, height, rotation, opacity: 1 };
}

/** EMU -> pixels at 96 DPI: 914400 EMU = 1 inch = 96 px → 1 EMU = 1/9525 px. */
export function emuToPx(emu: number): number {
  return emu / 9525;
}

/**
 * Build a schema-compatible id from a PPTX `cNvPr@id`. The schema accepts
 * `[A-Za-z0-9_-]+`; PPTX ids are typically integers. Prefix to keep them
 * stable and human-recognisable.
 */
export function makeElementId(rawId: string | undefined): string {
  const safe = (rawId ?? '0').replace(/[^A-Za-z0-9_-]/g, '_');
  return `pptx_${safe}`;
}
