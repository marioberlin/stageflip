// packages/import-pptx/src/parts/sp-tree.ts
// Walks `<p:spTree>` children and dispatches each to the right element
// converter. Group transforms are not accumulated here; the post-walk pass
// `accumulateGroupTransforms` (T-241a) folds them into descendants.

import { parsePicture } from '../elements/picture.js';
import { parseShape } from '../elements/shape.js';
import type { ElementContext } from '../elements/shared.js';
import { attrNumber } from '../elements/shared.js';
import { parseVideo } from '../elements/video.js';
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

  // PPTX shapes — disambiguate <p:videoFile>-bearing shapes (T-243b) from
  // ordinary shapes. A shape carrying a <p:nvPr><p:videoFile> child whose
  // relationship resolves to in-ZIP bytes is dispatched to parseVideo and
  // its body (text / geometry) is dropped with an info flag. External-URL
  // r:link videos fall through to parseShape with an UNSUPPORTED flag —
  // a future task adds LF-PPTX-LINKED-VIDEO.
  for (const sp of children(spTree, 'p:sp')) {
    const dispatch = classifyShape(sp, ctx);
    if (dispatch.kind === 'video') {
      const r = parseVideo(sp, ctx);
      if (r.element !== undefined) elements.push(r.element);
      flags.push(...r.flags);
      if (dispatch.bodyDropped) {
        const elementId = r.element?.id;
        flags.push(
          emitLossFlag({
            code: 'LF-PPTX-UNSUPPORTED-ELEMENT',
            location: {
              slideId: ctx.slideId,
              oocxmlPath: ctx.oocxmlPath,
              ...(elementId !== undefined ? { elementId } : {}),
            },
            message: 'shape body dropped on video extension; only the video survives',
            originalSnippet: 'shape body dropped on video extension',
          }),
        );
      }
      continue;
    }
    const r = parseShape(sp, ctx);
    if (r.element !== undefined) elements.push(r.element);
    flags.push(...r.flags);
    if (dispatch.kind === 'shape-with-external-video') {
      const elementId = r.element?.id;
      flags.push(
        emitLossFlag({
          code: 'LF-PPTX-UNSUPPORTED-ELEMENT',
          location: {
            slideId: ctx.slideId,
            oocxmlPath: ctx.oocxmlPath,
            ...(elementId !== undefined ? { elementId } : {}),
          },
          message: 'external video URL referenced by <p:videoFile r:link> not yet supported',
          originalSnippet: 'external video URL',
        }),
      );
    }
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

/**
 * Decide whether a `<p:sp>` should be dispatched to `parseVideo` or
 * `parseShape`. T-243b §"Architecture / Parser-side" pins the rules:
 *
 * - No `<p:videoFile>` child → 'shape' (existing path; no behavior change).
 * - `<p:videoFile>` + Internal rel (or `r:embed`, or `TargetMode` absent)
 *   → 'video' (in-ZIP bytes; parseVideo emits the element).
 * - `<p:videoFile>` + External rel → 'shape-with-external-video'
 *   (parseShape runs unchanged; LF-PPTX-UNSUPPORTED-ELEMENT emits with
 *   originalSnippet="external video URL" until LF-PPTX-LINKED-VIDEO ships).
 *
 * `bodyDropped` is set when the `<p:sp>` ALSO carries a `<p:txBody>` or
 * a `<p:spPr><a:custGeom>` / `<p:spPr><a:prstGeom>` — i.e., real shape
 * content that the video dispatch is overriding.
 */
function classifyShape(
  sp: OrderedXmlNode,
  ctx: ElementContext,
):
  | { kind: 'shape' }
  | { kind: 'video'; bodyDropped: boolean }
  | { kind: 'shape-with-external-video' } {
  const nvSpPr = firstChild(sp, 'p:nvSpPr');
  const nvPr = firstChild(nvSpPr, 'p:nvPr');
  const videoFile = firstChild(nvPr, 'p:videoFile');
  if (videoFile === undefined) return { kind: 'shape' };

  const relId = attr(videoFile, 'r:embed') ?? attr(videoFile, 'r:link');
  if (relId === undefined) {
    // No relId at all — defensively treat as a shape; the video extension
    // is malformed and parseShape's normal path will run.
    return { kind: 'shape' };
  }
  const rel = ctx.rels[relId];
  // Per OOXML, TargetMode defaults to Internal when absent. Only an
  // explicit "External" diverts to the fall-through branch.
  if (rel?.targetMode === 'External') return { kind: 'shape-with-external-video' };

  const spPr = firstChild(sp, 'p:spPr');
  const txBody = firstChild(sp, 'p:txBody');
  const custGeom = firstChild(spPr, 'a:custGeom');
  const prstGeom = firstChild(spPr, 'a:prstGeom');
  const bodyDropped = txBody !== undefined || custGeom !== undefined || prstGeom !== undefined;
  return { kind: 'video', bodyDropped };
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
