// packages/import-pptx/src/geometries/cust-geom/parse.test.ts
// Cover every supported OOXML path command + multi-path payloads + scaling.
//
// Fixtures build the ordered XML shape (`preserveOrder: true`, T-242d) the
// production walker now consumes. Each element record is a single-key object
// `{ "<tag>": [...children], ":@": { "@_attr": "..." } }`.

import { describe, expect, it } from 'vitest';
import type { OrderedXmlNode } from '../../opc.js';
import { custGeomToSvgPath } from './parse.js';

/** Build an ordered XML element record. */
function el(
  tag: string,
  opts: { children?: OrderedXmlNode[]; attrs?: Record<string, string> } = {},
): OrderedXmlNode {
  const out: OrderedXmlNode = { [tag]: opts.children ?? [] };
  if (opts.attrs && Object.keys(opts.attrs).length > 0) {
    const attrMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(opts.attrs)) attrMap[`@_${k}`] = v;
    out[':@'] = attrMap;
  }
  return out;
}

/** `<a:pt x=".." y=".."/>` with no children. */
const pt = (x: number, y: number): OrderedXmlNode =>
  el('a:pt', { attrs: { x: String(x), y: String(y) } });

/** `<a:moveTo><a:pt .../></a:moveTo>` */
const moveTo = (x: number, y: number): OrderedXmlNode => el('a:moveTo', { children: [pt(x, y)] });

/** `<a:lnTo><a:pt .../></a:lnTo>` */
const lnTo = (x: number, y: number): OrderedXmlNode => el('a:lnTo', { children: [pt(x, y)] });

/** `<a:cubicBezTo>` with three `<a:pt>` children. */
const cubicBezTo = (
  c1: [number, number],
  c2: [number, number],
  end: [number, number],
): OrderedXmlNode => el('a:cubicBezTo', { children: [pt(...c1), pt(...c2), pt(...end)] });

/** `<a:quadBezTo>` with two `<a:pt>` children. */
const quadBezTo = (c: [number, number], end: [number, number]): OrderedXmlNode =>
  el('a:quadBezTo', { children: [pt(...c), pt(...end)] });

/** `<a:close/>` */
const close = (): OrderedXmlNode => el('a:close');

/** Build a `<a:custGeom>` wrapping a single `<a:path>` with the given commands. */
function singlePath(
  commands: OrderedXmlNode[],
  pathAttrs?: Record<string, string>,
): OrderedXmlNode {
  const path = el('a:path', { children: commands, ...(pathAttrs ? { attrs: pathAttrs } : {}) });
  const pathLst = el('a:pathLst', { children: [path] });
  return el('a:custGeom', { children: [pathLst] });
}

describe('custGeomToSvgPath', () => {
  it('translates moveTo + lnTo into M + L', () => {
    const node = singlePath([moveTo(0, 0), lnTo(100, 0), lnTo(100, 100), close()]);
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 0 0 L 100 0 L 100 100 Z');
  });

  it('translates a closed triangle', () => {
    const node = singlePath([moveTo(0, 0), lnTo(50, 100), lnTo(100, 0), close()]);
    expect(custGeomToSvgPath(node)).toBe('M 0 0 L 50 100 L 100 0 Z');
  });

  it('translates quadBezTo into a 2-point Q command', () => {
    const node = singlePath([moveTo(0, 50), quadBezTo([50, 0], [100, 50])]);
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 0 50 Q 50 0 100 50');
  });

  it('skips quadBezTo with fewer than 2 points', () => {
    const malformedQuad = el('a:quadBezTo', { children: [pt(50, 0)] });
    const node = singlePath([moveTo(0, 0), malformedQuad, lnTo(100, 100)]);
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 0 0 L 100 100');
  });

  it('scales quadBezTo control + endpoint by box ratio', () => {
    const node = singlePath([moveTo(0, 1000), quadBezTo([500, 0], [1000, 1000])], {
      w: '1000',
      h: '1000',
    });
    const d = custGeomToSvgPath(node, { w: 100, h: 100 });
    expect(d).toBe('M 0 100 Q 50 0 100 100');
  });

  it('translates cubicBezTo into a 3-point C command', () => {
    const node = singlePath([moveTo(0, 50), cubicBezTo([20, 0], [80, 0], [100, 50])]);
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 0 50 C 20 0 80 0 100 50');
  });

  it('scales path-local coords to box pixels when w/h declared', () => {
    const node = singlePath([moveTo(0, 0), lnTo(1000, 1000)], { w: '1000', h: '1000' });
    const d = custGeomToSvgPath(node, { w: 100, h: 100 });
    expect(d).toBe('M 0 0 L 100 100');
  });

  it('passes coords through when no path-local frame is declared', () => {
    const node = singlePath([moveTo(7, 11), lnTo(13, 17)]);
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 7 11 L 13 17');
  });

  it('joins multiple <a:path> entries into one d string', () => {
    const path1 = el('a:path', { children: [moveTo(0, 0), lnTo(10, 0), close()] });
    const path2 = el('a:path', { children: [moveTo(20, 0), lnTo(30, 0), close()] });
    const pathLst = el('a:pathLst', { children: [path1, path2] });
    const node = el('a:custGeom', { children: [pathLst] });
    expect(custGeomToSvgPath(node)).toBe('M 0 0 L 10 0 Z M 20 0 L 30 0 Z');
  });

  it('returns undefined when pathLst is absent', () => {
    expect(custGeomToSvgPath(el('a:custGeom'))).toBeUndefined();
  });

  it('returns undefined when pathLst has no a:path entries', () => {
    const node = el('a:custGeom', { children: [el('a:pathLst')] });
    expect(custGeomToSvgPath(node)).toBeUndefined();
  });

  it('returns undefined for a path with no usable commands', () => {
    const node = singlePath([]);
    expect(custGeomToSvgPath(node)).toBeUndefined();
  });

  it('skips malformed lnTo (missing pt)', () => {
    const malformedLn = el('a:lnTo', { children: [el('a:pt')] }); // a:pt without x/y attrs
    const node = singlePath([moveTo(0, 0), lnTo(50, 0), malformedLn, lnTo(100, 0)]);
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 0 0 L 50 0 L 100 0');
  });

  it('skips cubicBezTo with fewer than 3 points', () => {
    const malformedCubic = el('a:cubicBezTo', { children: [pt(10, 10), pt(20, 20)] });
    const node = singlePath([moveTo(0, 0), malformedCubic, lnTo(100, 100)]);
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 0 0 L 100 100');
  });

  it('formats fractional coords to ≤3 decimals without trailing zeros', () => {
    const node = singlePath([moveTo(0, 0), lnTo(33, 0)], { w: '99', h: '99' });
    // 33 / 99 * 100 = 33.333…
    const d = custGeomToSvgPath(node, { w: 100, h: 100 });
    expect(d).toMatch(/L 33\.333 0/);
  });

  it('preserves heterogeneous-tag document order (preserveOrder pin)', () => {
    // Interleave moveTo / lnTo / moveTo to assert the walker honors the
    // ordered shape rather than grouping by tag — the precondition <a:arcTo>
    // (Sub-PR 2) needs.
    const node = singlePath([moveTo(0, 0), lnTo(10, 0), moveTo(20, 20), lnTo(30, 30)]);
    expect(custGeomToSvgPath(node)).toBe('M 0 0 L 10 0 M 20 20 L 30 30');
  });
});
