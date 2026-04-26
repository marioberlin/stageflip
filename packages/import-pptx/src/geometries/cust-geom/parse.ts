// packages/import-pptx/src/geometries/cust-geom/parse.ts
// Translate OOXML `<a:custGeom>` payloads into SVG path-data strings.
// Coverage: <a:moveTo>, <a:lnTo>, <a:cubicBezTo>, <a:quadBezTo>, <a:arcTo>,
// <a:close>, multiple <a:path> entries. The walker reads the ordered XML
// shape from `opc.ts` directly (T-242d switched the workspace parser to
// `preserveOrder: true`), so heterogeneous commands interleave in document
// order — the precondition `<a:arcTo>` needs since arcs are anchored at
// the previous command's end-point ("pen position").
//
// Derived from the public OOXML spec (ECMA-376 §20.1.9.3 a:arcTo and
// §20.1.9.8 a:custGeom). Original implementation; no copied prior art.

import { type OrderedXmlNode, allChildren, attr, children, firstChild, tagOf } from '../../opc.js';
import { fmt } from '../format.js';

const COMMAND_KEYS = new Set([
  'a:moveTo',
  'a:lnTo',
  'a:cubicBezTo',
  'a:quadBezTo',
  'a:arcTo',
  'a:close',
]);

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
  // Pen position in *output* (post-scale) coordinates. Used by `<a:arcTo>`
  // to compute the arc's implicit ellipse center. `undefined` until a
  // pen-position-establishing command runs.
  let penX: number | undefined;
  let penY: number | undefined;
  for (const child of allChildren(path)) {
    const kind = tagOf(child);
    if (kind === undefined || !COMMAND_KEYS.has(kind)) continue;
    switch (kind) {
      case 'a:moveTo': {
        const pt = readPoint(child);
        if (pt === undefined) continue;
        const x = pt.x * scale.x;
        const y = pt.y * scale.y;
        out.push(`M ${fmt(x)} ${fmt(y)}`);
        penX = x;
        penY = y;
        break;
      }
      case 'a:lnTo': {
        const pt = readPoint(child);
        if (pt === undefined) continue;
        const x = pt.x * scale.x;
        const y = pt.y * scale.y;
        out.push(`L ${fmt(x)} ${fmt(y)}`);
        penX = x;
        penY = y;
        break;
      }
      case 'a:cubicBezTo': {
        const pts = readPoints(child, 3);
        if (pts === undefined) continue;
        const c1 = pts[0];
        const c2 = pts[1];
        const end = pts[2];
        if (c1 === undefined || c2 === undefined || end === undefined) continue;
        const ex = end.x * scale.x;
        const ey = end.y * scale.y;
        out.push(
          `C ${fmt(c1.x * scale.x)} ${fmt(c1.y * scale.y)} ` +
            `${fmt(c2.x * scale.x)} ${fmt(c2.y * scale.y)} ` +
            `${fmt(ex)} ${fmt(ey)}`,
        );
        penX = ex;
        penY = ey;
        break;
      }
      case 'a:quadBezTo': {
        const pts = readPoints(child, 2);
        if (pts === undefined) continue;
        const c = pts[0];
        const end = pts[1];
        if (c === undefined || end === undefined) continue;
        const ex = end.x * scale.x;
        const ey = end.y * scale.y;
        out.push(`Q ${fmt(c.x * scale.x)} ${fmt(c.y * scale.y)} ` + `${fmt(ex)} ${fmt(ey)}`);
        penX = ex;
        penY = ey;
        break;
      }
      case 'a:arcTo': {
        // ECMA-376 §20.1.9.3: arc centered on an implicit ellipse anchored
        // at the previous command's end-point (the pen). Required attrs:
        // wR / hR (radii in path-local coords) + stAng / swAng (60000ths
        // of a degree). Skip silently when the pen isn't established or
        // when any attr is missing — preserves pen position in either case.
        if (penX === undefined || penY === undefined) continue;
        const arc = arcToSvg(child, penX, penY, scale);
        if (arc === undefined) continue;
        out.push(arc.svg);
        penX = arc.endX;
        penY = arc.endY;
        break;
      }
      case 'a:close': {
        out.push('Z');
        // `<a:close>` returns the pen to the most recent moveTo; not
        // tracked here because no current command depends on the
        // post-close position (a fresh moveTo would re-establish it).
        break;
      }
    }
  }
  return out.join(' ');
}

/**
 * Translate `<a:arcTo>` to SVG `A`. Returns the SVG segment + the arc's
 * end-point (post-scale) so the walker can advance the pen. `undefined`
 * when required attrs are missing or non-finite.
 *
 * Math (ECMA-376 §20.1.9.3 → SVG §9.3.8):
 *   stRad = stAng · π / (180 · 60000)
 *   swRad = swAng · π / (180 · 60000)
 *   center = (penX − wR·cos(stRad), penY − hR·sin(stRad))
 *   end    = center + (wR·cos(stRad+swRad), hR·sin(stRad+swRad))
 *   large-arc-flag = |swAng| > 180·60000 ? 1 : 0
 *   sweep-flag     = swAng ≥ 0 ? 1 : 0   (OOXML CW = SVG sweep=1, y-down)
 *
 * Radii scale by `scale.x` / `scale.y`. The OOXML spec doesn't define
 * non-square radii under non-uniform scale; we apply per-axis scale to
 * each radius, matching the implicit assumption that wR maps to the x
 * axis and hR to the y axis (which is what callers using <a:path w h>
 * expect when the box aspect differs from the path frame).
 */
function arcToSvg(
  node: OrderedXmlNode,
  penX: number,
  penY: number,
  scale: { x: number; y: number },
): { svg: string; endX: number; endY: number } | undefined {
  const wR = numberAttr(node, 'wR');
  const hR = numberAttr(node, 'hR');
  const stAng = numberAttr(node, 'stAng');
  const swAng = numberAttr(node, 'swAng');
  if (wR === undefined || hR === undefined || stAng === undefined || swAng === undefined) {
    return undefined;
  }
  const rx = wR * scale.x;
  const ry = hR * scale.y;
  const stRad = (stAng * Math.PI) / (180 * 60000);
  const swRad = (swAng * Math.PI) / (180 * 60000);
  // Implicit ellipse center: pen position minus the radius vector at
  // angle stRad (the arc's start).
  const cx = penX - rx * Math.cos(stRad);
  const cy = penY - ry * Math.sin(stRad);
  const endX = cx + rx * Math.cos(stRad + swRad);
  const endY = cy + ry * Math.sin(stRad + swRad);
  const largeArc = Math.abs(swAng) > 180 * 60000 ? 1 : 0;
  const sweep = swAng >= 0 ? 1 : 0;
  const svg = `A ${fmt(rx)} ${fmt(ry)} 0 ${largeArc} ${sweep} ${fmt(endX)} ${fmt(endY)}`;
  return { svg, endX, endY };
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
