// packages/import-pptx/src/opc.test.ts
// Cover the preserveOrder XML shape + the helper layer (T-242d sub-PR 1):
// * `parseXml` returns the ordered top-level array with `:@` attribute maps.
// * `firstChild` / `children` / `attrs` / `attr` navigate the new shape.
// * `readRels` continues to round-trip after the parser flip.

import { describe, expect, it } from 'vitest';
import {
  type OrderedXmlNode,
  allChildren,
  attr,
  attrs,
  children,
  firstChild,
  parseXml,
  readRels,
  resolveRelTarget,
  tagOf,
} from './opc.js';
import type { ZipEntries } from './zip.js';

/** Build a minimal ZipEntries record for parser tests. */
function entriesFrom(map: Record<string, string>): ZipEntries {
  const out: ZipEntries = {};
  const enc = new TextEncoder();
  for (const [k, v] of Object.entries(map)) out[k] = enc.encode(v);
  return out;
}

describe('parseXml (preserveOrder: true)', () => {
  it('returns an ordered array of single-key element records', () => {
    const xml = `<?xml version="1.0"?><root><a x="1"/><b/><a x="2"/></root>`;
    const parsed = parseXml(entriesFrom({ 'p.xml': xml }), 'p.xml');
    expect(Array.isArray(parsed)).toBe(true);
    const root = firstChild(parsed, 'root');
    expect(root).toBeDefined();
    // Children are in document order, not grouped by tag.
    const order = allChildren(root).map((c) => tagOf(c));
    expect(order).toEqual(['a', 'b', 'a']);
  });

  it('moves attributes onto the synthetic `:@` key', () => {
    const xml = `<root attr="v"><child a="1" b="2"/></root>`;
    const parsed = parseXml(entriesFrom({ 'p.xml': xml }), 'p.xml');
    const root = firstChild(parsed, 'root');
    const child = firstChild(root, 'child');
    expect(attr(child, 'a')).toBe('1');
    expect(attr(child, 'b')).toBe('2');
    expect(attrs(child)).toEqual({ a: '1', b: '2' });
    expect(attr(root, 'attr')).toBe('v');
  });

  it('throws PptxParseError for missing parts', () => {
    expect(() => parseXml(entriesFrom({}), 'nope.xml')).toThrow(/part not found/);
  });
});

describe('firstChild / children', () => {
  // Hand-built ordered nodes mimicking fast-xml-parser preserveOrder output.
  const node: OrderedXmlNode = {
    'a:pathLst': [
      { 'a:moveTo': [], ':@': { '@_x': '0' } },
      { 'a:lnTo': [], ':@': { '@_x': '1' } },
      { 'a:moveTo': [], ':@': { '@_x': '2' } },
    ],
  };

  it('firstChild finds the first matching tag', () => {
    const moveTo = firstChild(node, 'a:moveTo');
    expect(attr(moveTo, 'x')).toBe('0');
  });

  it('children returns every match in order', () => {
    const moves = children(node, 'a:moveTo');
    expect(moves.map((m) => attr(m, 'x'))).toEqual(['0', '2']);
  });

  it('returns undefined / empty for missing tags', () => {
    expect(firstChild(node, 'a:close')).toBeUndefined();
    expect(children(node, 'a:close')).toEqual([]);
  });

  it('accepts an array (document root) as parent', () => {
    const docRoot: OrderedXmlNode[] = [{ 'a:p': [] }, { 'a:p': [] }];
    expect(children(docRoot, 'a:p').length).toBe(2);
  });

  it('handles undefined parent gracefully', () => {
    expect(firstChild(undefined, 'a:p')).toBeUndefined();
    expect(children(undefined, 'a:p')).toEqual([]);
    expect(attrs(undefined)).toEqual({});
    expect(attr(undefined, 'x')).toBeUndefined();
  });
});

describe('readRels', () => {
  it('round-trips a simple Relationships document', () => {
    const rels = `<?xml version="1.0"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://example/slide" Target="slides/slide1.xml"/>
        <Relationship Id="rId2" Type="http://example/notes" Target="../notes/notes1.xml"/>
      </Relationships>`;
    const map = readRels(
      entriesFrom({ 'ppt/_rels/presentation.xml.rels': rels }),
      'ppt/presentation.xml',
    );
    expect(map.rId1?.resolvedTarget).toBe('ppt/slides/slide1.xml');
    expect(map.rId2?.type).toBe('http://example/notes');
    expect(map.rId2?.resolvedTarget).toBe('notes/notes1.xml');
  });

  it('returns an empty map when the rels file is absent', () => {
    expect(readRels(entriesFrom({}), 'ppt/presentation.xml')).toEqual({});
  });
});

describe('resolveRelTarget', () => {
  it('handles relative + absolute + parent-walk targets', () => {
    expect(resolveRelTarget('ppt/presentation.xml', 'slides/s1.xml')).toBe('ppt/slides/s1.xml');
    expect(resolveRelTarget('ppt/slides/s1.xml', '../media/img.png')).toBe('ppt/media/img.png');
    expect(resolveRelTarget('ppt/x.xml', '/customXml/x1.xml')).toBe('customXml/x1.xml');
  });
});
