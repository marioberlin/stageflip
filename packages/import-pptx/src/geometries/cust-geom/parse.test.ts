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

/** `<a:arcTo wR=".." hR=".." stAng=".." swAng=".."/>` */
const arcTo = (wR: number, hR: number, stAng: number, swAng: number): OrderedXmlNode =>
  el('a:arcTo', {
    attrs: { wR: String(wR), hR: String(hR), stAng: String(stAng), swAng: String(swAng) },
  });

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

  // --- T-242d: <a:arcTo> translation ---------------------------------------
  // Math: see ECMA-376 §20.1.9.3 + the spec table in docs/tasks/T-242d.md.
  // OOXML angles in 60000ths of a degree; positive swAng = clockwise (= SVG
  // sweep-flag 1 in y-down coordinates).

  describe('arcTo', () => {
    // AC #2 — the sign-convention lock. Pinned in two places (here for the
    // raw cust-geom output; AC #4 for the registry presets).
    it('AC #2 sign-convention lock: 90° CW from origin on a 100x100 ellipse', () => {
      // moveTo(0,0) + arcTo(wR=hR=100, stAng=0, swAng=5400000 [90°])
      //   stRad = 0 → cx = 0 - 100·cos(0) = -100, cy = 0 - 100·sin(0) = 0.
      //   endX = -100 + 100·cos(π/2) = -100; endY = 0 + 100·sin(π/2) = 100.
      //   |swAng|=5400000 < 10800000 → large-arc=0; swAng≥0 → sweep=1.
      const node = singlePath([moveTo(0, 0), arcTo(100, 100, 0, 5400000)]);
      expect(custGeomToSvgPath(node)).toBe('M 0 0 A 100 100 0 0 1 -100 100');
    });

    it('AC #1 (b) — 270° sweep produces large-arc=1, sweep=1', () => {
      // moveTo(0,0) + arcTo(wR=hR=100, stAng=0, swAng=16200000 [270°])
      //   |swAng|=16200000 > 10800000 → large-arc=1; sweep=1.
      //   endX = -100 + 100·cos(3π/2) = -100; endY = 0 + 100·sin(3π/2) = -100.
      const node = singlePath([moveTo(0, 0), arcTo(100, 100, 0, 16200000)]);
      expect(custGeomToSvgPath(node)).toBe('M 0 0 A 100 100 0 1 1 -100 -100');
    });

    it('AC #1 (c) — negative sweep (-90°) flips sweep flag to 0', () => {
      // moveTo(0,0) + arcTo(wR=hR=100, stAng=0, swAng=-5400000 [-90°])
      //   swAng<0 → sweep=0; |swAng|=5400000 < 10800000 → large-arc=0.
      //   endX = -100 + 100·cos(-π/2) = -100; endY = 0 + 100·sin(-π/2) = -100.
      const node = singlePath([moveTo(0, 0), arcTo(100, 100, 0, -5400000)]);
      expect(custGeomToSvgPath(node)).toBe('M 0 0 A 100 100 0 0 0 -100 -100');
    });

    it('AC #1 (d) — sweep > 360° (420°) → large-arc=1, sweep=1, wraps past full', () => {
      // arcTo(wR=hR=100, stAng=0, swAng=25200000 [420°])
      //   |swAng|=25200000 > 10800000 → large-arc=1; sweep=1.
      //   endX = -100 + 100·cos(7π/3) = -100 + 100·(0.5) = -50.
      //   endY = 0 + 100·sin(7π/3) = 100·(√3/2) ≈ 86.603.
      const node = singlePath([moveTo(0, 0), arcTo(100, 100, 0, 25200000)]);
      expect(custGeomToSvgPath(node)).toBe('M 0 0 A 100 100 0 1 1 -50 86.603');
    });

    it('AC #1 (e) — arcTo after lnTo (non-trivial pen position)', () => {
      // moveTo(0,0) + lnTo(50,0) + arcTo(wR=hR=50, stAng=0, swAng=5400000)
      //   pen at (50,0); cx = 50-50 = 0, cy = 0; endX = 0+50·cos(π/2) = 0;
      //   endY = 0+50·sin(π/2) = 50.
      const node = singlePath([moveTo(0, 0), lnTo(50, 0), arcTo(50, 50, 0, 5400000)]);
      expect(custGeomToSvgPath(node)).toBe('M 0 0 L 50 0 A 50 50 0 0 1 0 50');
    });

    it('AC #1 (f) — arcTo immediately after moveTo (pen position from M)', () => {
      // moveTo(10,10) + arcTo(wR=hR=10, stAng=0, swAng=5400000)
      //   pen at (10,10); cx = 10-10 = 0, cy = 10; endX = 0+10·cos(π/2) = 0;
      //   endY = 10+10·sin(π/2) = 20.
      const node = singlePath([moveTo(10, 10), arcTo(10, 10, 0, 5400000)]);
      expect(custGeomToSvgPath(node)).toBe('M 10 10 A 10 10 0 0 1 0 20');
    });

    it('AC #3 — pen position updates after arcTo (next command starts at arc end)', () => {
      // arcTo lands at (-100, 100); subsequent lnTo takes a relative move
      // implicitly via the path's chained pen position. Verify by following
      // arcTo with a lnTo that closes the path back to the origin — if the
      // pen position weren't updated, the SVG would still come out correct
      // (the L command is absolute), but this fixture pins document-order.
      const node = singlePath([moveTo(0, 0), arcTo(100, 100, 0, 5400000), lnTo(0, 0), close()]);
      expect(custGeomToSvgPath(node)).toBe('M 0 0 A 100 100 0 0 1 -100 100 L 0 0 Z');
    });

    it('scales arc radii and endpoint by box ratio when path-local frame is declared', () => {
      // arcTo on a 1000-EMU-square local frame, rendered into a 100px box.
      const node = singlePath([moveTo(0, 0), arcTo(1000, 1000, 0, 5400000)], {
        w: '1000',
        h: '1000',
      });
      expect(custGeomToSvgPath(node, { w: 100, h: 100 })).toBe('M 0 0 A 100 100 0 0 1 -100 100');
    });

    it('skips malformed arcTo (missing required attrs)', () => {
      const malformed = el('a:arcTo', { attrs: { wR: '100' } }); // missing hR/stAng/swAng
      const node = singlePath([moveTo(0, 0), malformed, lnTo(50, 50)]);
      // Walker continues past the bad arc; pen position is preserved at the
      // last good command's end-point so subsequent commands are unaffected.
      expect(custGeomToSvgPath(node)).toBe('M 0 0 L 50 50');
    });

    it('skips arcTo issued before any pen-position-establishing command', () => {
      // arcTo with no prior moveTo → no pen position to extrapolate from.
      const node = singlePath([arcTo(100, 100, 0, 5400000)]);
      expect(custGeomToSvgPath(node)).toBeUndefined();
    });
  });
});
