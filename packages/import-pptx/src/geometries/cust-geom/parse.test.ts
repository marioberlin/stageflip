// packages/import-pptx/src/geometries/cust-geom/parse.test.ts
// Cover every supported OOXML path command + multi-path payloads + scaling.

import { describe, expect, it } from 'vitest';
import { custGeomToSvgPath } from './parse.js';

/** Small helper: build a fast-xml-parser-shaped node for a single path. */
function singlePath(pathChildren: Record<string, unknown>, attrs?: Record<string, string>) {
  return {
    'a:pathLst': {
      'a:path': {
        ...(attrs ? Object.fromEntries(Object.entries(attrs).map(([k, v]) => [`@_${k}`, v])) : {}),
        ...pathChildren,
      },
    },
  };
}

const PT = (x: number, y: number) => ({ 'a:pt': { '@_x': String(x), '@_y': String(y) } });

describe('custGeomToSvgPath', () => {
  it('translates moveTo + lnTo into M + L', () => {
    const node = singlePath({
      'a:moveTo': PT(0, 0),
      'a:lnTo': [PT(100, 0), PT(100, 100)],
      'a:close': {},
    });
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 0 0 L 100 0 L 100 100 Z');
  });

  it('translates a closed triangle', () => {
    const node = singlePath({
      'a:moveTo': PT(0, 0),
      'a:lnTo': [PT(50, 100), PT(100, 0)],
      'a:close': {},
    });
    expect(custGeomToSvgPath(node)).toBe('M 0 0 L 50 100 L 100 0 Z');
  });

  it('translates cubicBezTo into a 3-point C command', () => {
    const node = singlePath({
      'a:moveTo': PT(0, 50),
      'a:cubicBezTo': {
        'a:pt': [
          { '@_x': '20', '@_y': '0' },
          { '@_x': '80', '@_y': '0' },
          { '@_x': '100', '@_y': '50' },
        ],
      },
    });
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 0 50 C 20 0 80 0 100 50');
  });

  it('scales path-local coords to box pixels when w/h declared', () => {
    const node = singlePath(
      {
        'a:moveTo': PT(0, 0),
        'a:lnTo': PT(1000, 1000),
      },
      { w: '1000', h: '1000' },
    );
    const d = custGeomToSvgPath(node, { w: 100, h: 100 });
    expect(d).toBe('M 0 0 L 100 100');
  });

  it('passes coords through when no path-local frame is declared', () => {
    const node = singlePath({
      'a:moveTo': PT(7, 11),
      'a:lnTo': PT(13, 17),
    });
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 7 11 L 13 17');
  });

  it('joins multiple <a:path> entries into one d string', () => {
    const node = {
      'a:pathLst': {
        'a:path': [
          { 'a:moveTo': PT(0, 0), 'a:lnTo': PT(10, 0), 'a:close': {} },
          { 'a:moveTo': PT(20, 0), 'a:lnTo': PT(30, 0), 'a:close': {} },
        ],
      },
    };
    expect(custGeomToSvgPath(node)).toBe('M 0 0 L 10 0 Z M 20 0 L 30 0 Z');
  });

  it('returns undefined when pathLst is absent', () => {
    expect(custGeomToSvgPath({})).toBeUndefined();
  });

  it('returns undefined when pathLst has no a:path entries', () => {
    expect(custGeomToSvgPath({ 'a:pathLst': {} })).toBeUndefined();
  });

  it('returns undefined for a path with no usable commands', () => {
    const node = singlePath({});
    expect(custGeomToSvgPath(node)).toBeUndefined();
  });

  it('skips malformed lnTo (missing pt)', () => {
    const node = singlePath({
      'a:moveTo': PT(0, 0),
      'a:lnTo': [PT(50, 0), { 'a:pt': {} }, PT(100, 0)],
    });
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 0 0 L 50 0 L 100 0');
  });

  it('skips cubicBezTo with fewer than 3 points', () => {
    const node = singlePath({
      'a:moveTo': PT(0, 0),
      'a:cubicBezTo': { 'a:pt': [PT(10, 10), PT(20, 20)] },
      'a:lnTo': PT(100, 100),
    });
    const d = custGeomToSvgPath(node);
    expect(d).toBe('M 0 0 L 100 100');
  });

  it('formats fractional coords to ≤3 decimals without trailing zeros', () => {
    const node = singlePath(
      {
        'a:moveTo': PT(0, 0),
        'a:lnTo': PT(33, 0),
      },
      { w: '99', h: '99' },
    );
    // 33 / 99 * 100 = 33.333…
    const d = custGeomToSvgPath(node, { w: 100, h: 100 });
    expect(d).toMatch(/L 33\.333 0/);
  });
});
