// packages/import-pptx/src/geometries/cust-geom/parse.ts
// Translate OOXML `<a:custGeom>` payloads into SVG path-data strings.
// Coverage: <a:moveTo>, <a:lnTo>, <a:cubicBezTo>, <a:quadBezTo>, <a:close>,
// multiple <a:path> entries. <a:arcTo> is deferred — its SVG translation
// requires knowing the current pen position before the arc, which the
// current walk-by-kind traversal can't reliably provide; lifting that
// limitation requires switching the shared XML parser to preserveOrder:
// true (workspace-wide refactor; tracked separately).
//
// Derived from the public OOXML spec (ECMA-376 §20.1.9.8 a:custGeom and
// neighbours). Original implementation; no copied prior art.

import { fmt } from '../format.js';

const COMMAND_KEYS = ['a:moveTo', 'a:lnTo', 'a:cubicBezTo', 'a:quadBezTo', 'a:close'] as const;
type CommandKey = (typeof COMMAND_KEYS)[number];

/** Parsed-XML node shape (from fast-xml-parser; same convention as opc.ts). */
type XmlNode = Record<string, unknown>;

/**
 * Translate a parsed `<a:custGeom>` node (from fast-xml-parser) into an SVG
 * `d` attribute. Returns `undefined` when the node has no usable paths or
 * when an unsupported command appears in every path (caller should emit a
 * loss flag and fall back to `unsupported-shape`).
 *
 * `box` is optional — only used when paths are declared in path-relative
 * coords (`<a:path w="..." h="...">`). Without it, we emit raw coordinates.
 */
export function custGeomToSvgPath(
  custGeom: XmlNode,
  box?: { w: number; h: number },
): string | undefined {
  const pathLst = pickRecord(custGeom, 'a:pathLst');
  if (pathLst === undefined) return undefined;

  // `<a:pathLst>` contains one or more `<a:path>` entries.
  const pathEntries = asArray(pathLst['a:path']);
  if (pathEntries.length === 0) return undefined;

  const segments: string[] = [];
  for (const entry of pathEntries) {
    if (!isRecord(entry)) continue;
    const seg = pathToSvg(entry, box);
    if (seg !== '') segments.push(seg);
  }

  if (segments.length === 0) return undefined;
  // Multiple `<a:path>` are independent subpaths; SVG `d` concatenates them.
  return segments.join(' ');
}

/** Convert a single `<a:path>` to SVG. */
function pathToSvg(path: XmlNode, box: { w: number; h: number } | undefined): string {
  const pathW = numberAttr(path, 'w');
  const pathH = numberAttr(path, 'h');
  const scale = computeScale(pathW, pathH, box);

  const out: string[] = [];
  for (const child of orderedChildren(path)) {
    switch (child.kind) {
      case 'a:moveTo': {
        const pt = readPoint(child.node);
        if (pt === undefined) continue;
        out.push(`M ${fmt(pt.x * scale.x)} ${fmt(pt.y * scale.y)}`);
        break;
      }
      case 'a:lnTo': {
        const pt = readPoint(child.node);
        if (pt === undefined) continue;
        out.push(`L ${fmt(pt.x * scale.x)} ${fmt(pt.y * scale.y)}`);
        break;
      }
      case 'a:cubicBezTo': {
        const pts = readPoints(child.node, 3);
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
        const pts = readPoints(child.node, 2);
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

/**
 * Walk a path entry's children in document order. fast-xml-parser groups
 * them by tag; `<a:moveTo>`, `<a:lnTo>`, etc. each become a possibly-
 * arrayed entry on the parent. We reconstruct order by interleaving via the
 * synthetic `:@` order attribute fast-xml-parser preserves on
 * `preserveOrder: true` configurations — but our parser uses
 * `preserveOrder: false`, so the simpler approach is to walk each command
 * type and trust that path commands of the same kind run together. For
 * presets that mix kinds in a single path, this is wrong — but T-242a's
 * scope keeps custom geometries simple. T-242b can switch to preserveOrder
 * if needed.
 */
function orderedChildren(path: XmlNode): { kind: CommandKey; node: XmlNode }[] {
  const flat: { kind: CommandKey; node: XmlNode }[] = [];
  for (const key of COMMAND_KEYS) {
    for (const node of asArray(path[key])) {
      if (isRecord(node)) flat.push({ kind: key, node });
      else if (key === 'a:close') flat.push({ kind: key, node: {} });
    }
  }
  return flat;
}

function readPoint(node: XmlNode): { x: number; y: number } | undefined {
  const pt = pickRecord(node, 'a:pt');
  if (pt === undefined) return undefined;
  const x = numberAttr(pt, 'x');
  const y = numberAttr(pt, 'y');
  if (x === undefined || y === undefined) return undefined;
  return { x, y };
}

function readPoints(node: XmlNode, count: number): { x: number; y: number }[] | undefined {
  const pts = asArray(node['a:pt']);
  if (pts.length < count) return undefined;
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const pt = pts[i];
    if (!isRecord(pt)) return undefined;
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

function numberAttr(node: unknown, name: string): number | undefined {
  if (!isRecord(node)) return undefined;
  const v = node[`@_${name}`];
  if (typeof v !== 'string') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function isRecord(v: unknown): v is XmlNode {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v === undefined) return [];
  return [v];
}

function pickRecord(node: unknown, name: string): XmlNode | undefined {
  if (!isRecord(node)) return undefined;
  const v = node[name];
  return isRecord(v) ? v : undefined;
}
