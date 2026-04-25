// packages/import-pptx/src/parts/sp-tree.ts
// Walks `<p:spTree>` children and dispatches each to the right element
// converter. Group nodes recurse via this same walker — note that group
// transforms are deliberately NOT accumulated into descendants (T-241a).

import { parsePicture } from '../elements/picture.js';
import { parseShape } from '../elements/shape.js';
import type { ElementContext } from '../elements/shared.js';
import { isRecord } from '../elements/shared.js';
import { emitLossFlag } from '../loss-flags.js';
import type { LossFlag, ParsedElement, ParsedGroupElement } from '../types.js';

/**
 * Walk an `spTree` node (or a recursive `<p:grpSp>`) and produce parser
 * elements + any loss flags raised in that subtree.
 */
export function walkSpTree(
  spTree: unknown,
  ctx: ElementContext,
): {
  elements: ParsedElement[];
  flags: LossFlag[];
} {
  const elements: ParsedElement[] = [];
  const flags: LossFlag[] = [];

  if (!isRecord(spTree)) return { elements, flags };

  // PPTX shapes
  for (const sp of asArray(spTree['p:sp'])) {
    const r = parseShape(sp, ctx);
    if (r.element !== undefined) elements.push(r.element);
    flags.push(...r.flags);
  }

  // Pictures
  for (const pic of asArray(spTree['p:pic'])) {
    const r = parsePicture(pic, ctx);
    if (r.element !== undefined) elements.push(r.element);
    flags.push(...r.flags);
  }

  // Recursive groups
  for (const grpSp of asArray(spTree['p:grpSp'])) {
    const r = parseGroup(grpSp, ctx);
    if (r.element !== undefined) elements.push(r.element);
    flags.push(...r.flags);
  }

  // Connections, content-parts, OLE, etc. → unsupported flag, no element
  for (const key of ['p:cxnSp', 'p:graphicFrame', 'p:contentPart']) {
    const nodes = asArray(spTree[key]);
    if (nodes.length === 0) continue;
    flags.push(
      emitLossFlag({
        code: 'LF-PPTX-UNSUPPORTED-ELEMENT',
        location: { slideId: ctx.slideId, oocxmlPath: ctx.oocxmlPath },
        message: `unsupported element type ${key}; T-247 / T-248 follow-up`,
        originalSnippet: key,
      }),
    );
  }

  return { elements, flags };
}

function parseGroup(
  grpSp: unknown,
  ctx: ElementContext,
): { element?: ParsedGroupElement; flags: LossFlag[] } {
  if (!isRecord(grpSp)) return { flags: [] };

  // Group's own transform is read but NOT pushed down into children — that's
  // T-241a per acceptance criterion #5. Children carry their raw <a:xfrm>
  // values verbatim.
  const flags: LossFlag[] = [];

  // T-241a placeholder flag — every group node hints at the transform-accum
  // work the next task owns.
  flags.push(
    emitLossFlag({
      code: 'LF-PPTX-NESTED-GROUP-TRANSFORM',
      location: { slideId: ctx.slideId, oocxmlPath: ctx.oocxmlPath },
      message: 'group transform not accumulated into descendants (T-241a follow-up)',
    }),
  );

  const nestedCtx: ElementContext = { ...ctx };
  const inner = walkSpTree(grpSp, nestedCtx);
  flags.push(...inner.flags);

  const nv = pickRecord(grpSp, 'p:nvGrpSpPr');
  const cNvPr = pickRecord(nv, 'p:cNvPr');
  const id = makeElementId(pickAttr(cNvPr, 'id'));
  const name = pickAttr(cNvPr, 'name');

  const grpSpPr = pickRecord(grpSp, 'p:grpSpPr');
  const xfrm = pickRecord(grpSpPr, 'a:xfrm');
  const transform = readTransform(xfrm);

  const base = {
    id,
    transform,
    visible: true,
    locked: false,
    animations: [],
    type: 'group' as const,
    children: inner.elements,
    clip: false,
  };

  const element: ParsedGroupElement = name === undefined ? base : { ...base, name };
  return { element, flags };
}

/** Read `<a:xfrm><a:off>/<a:ext>` into a schema transform (in pixels). */
export function readTransform(xfrm: Record<string, unknown> | undefined): {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
} {
  const off = pickRecord(xfrm, 'a:off');
  const ext = pickRecord(xfrm, 'a:ext');
  const x = emuToPx(pickAttrNumber(off, 'x') ?? 0);
  const y = emuToPx(pickAttrNumber(off, 'y') ?? 0);
  // PPTX width/height of 0 is legal in some malformed exports; fall back to a
  // 1px box so the schema's `.positive()` constraint is satisfied. We also
  // emit nothing here — the caller emits an unsupported-fill flag where
  // appropriate.
  const width = Math.max(1, emuToPx(pickAttrNumber(ext, 'cx') ?? 9525));
  const height = Math.max(1, emuToPx(pickAttrNumber(ext, 'cy') ?? 9525));
  const rotEmu = pickAttrNumber(xfrm, 'rot');
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

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v === undefined) return [];
  return [v];
}

function pickRecord(node: unknown, name: string): Record<string, unknown> | undefined {
  if (!isRecord(node)) return undefined;
  const v = node[name];
  return isRecord(v) ? v : undefined;
}

function pickAttr(node: unknown, name: string): string | undefined {
  if (!isRecord(node)) return undefined;
  const v = node[`@_${name}`];
  return typeof v === 'string' ? v : undefined;
}

function pickAttrNumber(node: unknown, name: string): number | undefined {
  const v = pickAttr(node, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
