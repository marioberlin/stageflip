// packages/import-pptx/src/geometries/cust-geom/parse.ts
// Translate OOXML `<a:custGeom>` payloads into SVG path-data strings.
// Coverage: <a:moveTo>, <a:lnTo>, <a:cubicBezTo>, <a:quadBezTo>, <a:close>,
// multiple <a:path> entries. The walker reads the ordered XML shape from
// `opc.ts` directly (T-242d switched the workspace parser to
// `preserveOrder: true`), so heterogeneous commands interleave in document
// order — this is the precondition `<a:arcTo>` will need in Sub-PR 2.
//
// Derived from the public OOXML spec (ECMA-376 §20.1.9.8 a:custGeom and
// neighbours). Original implementation; no copied prior art.

import { type OrderedXmlNode, allChildren, attr, children, firstChild, tagOf } from '../../opc.js';
import { fmt } from '../format.js';

const COMMAND_KEYS = new Set(['a:moveTo', 'a:lnTo', 'a:cubicBezTo', 'a:quadBezTo', 'a:close']);

/**
 * Translate a parsed `<a:custGeom>` node (ordered XML shape) into an SVG
 * `d` attribute. Returns `undefined` when the node has no usable paths or
 * when an unsupported command appears in every path (caller should emit a
 * loss flag and fall back to `unsupported-shape`).
 *
 * `box` is optional — only used when paths are declared in path-relative
 * coords (`<a:path w="..." h="...">`). Without it, we emit raw coordinates.
 */
export function custGeomToSvgPath(
  custGeom: OrderedXmlNode,
  box?: { w: number; h: number },
): string | undefined {
  const pathLst = firstChild(custGeom, 'a:pathLst');
  if (pathLst === undefined) return undefined;

  // `<a:pathLst>` contains one or more `<a:path>` entries.
  const pathEntries = children(pathLst, 'a:path');
  if (pathEntries.length === 0) return undefined;

  const segments: string[] = [];
  for (const entry of pathEntries) {
    const seg = pathToSvg(entry, box);
    if (seg !== '') segments.push(seg);
  }

  if (segments.length === 0) return undefined;
  // Multiple `<a:path>` are independent subpaths; SVG `d` concatenates them.
  return segments.join(' ');
}

/** Convert a single `<a:path>` to SVG. */
function pathToSvg(path: OrderedXmlNode, box: { w: number; h: number } | undefined): string {
  const pathW = numberAttr(path, 'w');
  const pathH = numberAttr(path, 'h');
  const scale = computeScale(pathW, pathH, box);

  const out: string[] = [];
  for (const child of allChildren(path)) {
    const kind = tagOf(child);
    if (kind === undefined || !COMMAND_KEYS.has(kind)) continue;
    switch (kind) {
      case 'a:moveTo': {
        const pt = readPoint(child);
        if (pt === undefined) continue;
        out.push(`M ${fmt(pt.x * scale.x)} ${fmt(pt.y * scale.y)}`);
        break;
      }
      case 'a:lnTo': {
        const pt = readPoint(child);
        if (pt === undefined) continue;
        out.push(`L ${fmt(pt.x * scale.x)} ${fmt(pt.y * scale.y)}`);
        break;
      }
      case 'a:cubicBezTo': {
        const pts = readPoints(child, 3);
        if (pts === undefined) continue;
        const c1 = pts[0];
        const c2 = pts[1];
        const end = pts[2];
        if (c1 === undefined || c2 === undefined || end === undefined) continue;
        out.push(
          `C ${fmt(c1.x * scale.x)} ${fmt(c1.y * scale.y)} ` +
            `${fmt(c2.x * scale.x)} ${fmt(c2.y * scale.y)} ` +
            `${fmt(end.x * scale.x)} ${fmt(end.y * scale.y)}`,
        );
        break;
      }
      case 'a:quadBezTo': {
        const pts = readPoints(child, 2);
        if (pts === undefined) continue;
        const c = pts[0];
        const end = pts[1];
        if (c === undefined || end === undefined) continue;
        out.push(
          `Q ${fmt(c.x * scale.x)} ${fmt(c.y * scale.y)} ` +
            `${fmt(end.x * scale.x)} ${fmt(end.y * scale.y)}`,
        );
        break;
      }
      case 'a:close': {
        out.push('Z');
        break;
      }
    }
  }
  return out.join(' ');
}

function readPoint(node: OrderedXmlNode): { x: number; y: number } | undefined {
  const pt = firstChild(node, 'a:pt');
  if (pt === undefined) return undefined;
  const x = numberAttr(pt, 'x');
  const y = numberAttr(pt, 'y');
  if (x === undefined || y === undefined) return undefined;
  return { x, y };
}

function readPoints(node: OrderedXmlNode, count: number): { x: number; y: number }[] | undefined {
  const pts = children(node, 'a:pt');
  if (pts.length < count) return undefined;
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const pt = pts[i];
    if (pt === undefined) return undefined;
    const x = numberAttr(pt, 'x');
    const y = numberAttr(pt, 'y');
    if (x === undefined || y === undefined) return undefined;
    result.push({ x, y });
  }
  return result;
}

/** Map path-local coords to box pixels when both are present; else identity. */
function computeScale(
  pathW: number | undefined,
  pathH: number | undefined,
  box: { w: number; h: number } | undefined,
): { x: number; y: number } {
  if (box === undefined || pathW === undefined || pathH === undefined) {
    return { x: 1, y: 1 };
  }
  return {
    x: pathW === 0 ? 1 : box.w / pathW,
    y: pathH === 0 ? 1 : box.h / pathH,
  };
}

function numberAttr(node: OrderedXmlNode, name: string): number | undefined {
  const v = attr(node, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
