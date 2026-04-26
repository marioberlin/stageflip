// packages/export-pptx/src/xml/emit.test.ts
import { describe, expect, it } from 'vitest';
import { emitElement, emitSelfClosing, escapeAttr, escapeText } from './emit.js';

describe('xml/emit', () => {
  it('emitSelfClosing emits an empty element', () => {
    expect(emitSelfClosing('a:tag')).toBe('<a:tag/>');
  });

  it('emitSelfClosing emits attributes in insertion order', () => {
    expect(emitSelfClosing('foo', { z: '1', a: '2', m: '3' })).toBe('<foo z="1" a="2" m="3"/>');
  });

  it('emitSelfClosing skips undefined attribute values', () => {
    expect(emitSelfClosing('foo', { a: '1', b: undefined, c: '3' })).toBe('<foo a="1" c="3"/>');
  });

  it('emitElement emits children verbatim in order', () => {
    expect(emitElement('parent', {}, ['<a/>', '<b/>'])).toBe('<parent><a/><b/></parent>');
  });

  it('emitElement collapses to self-closing when no children', () => {
    expect(emitElement('p', { x: '1' }, [])).toBe('<p x="1"/>');
  });

  it('escapeAttr handles all five basic escapes', () => {
    expect(escapeAttr('A & B < C > D " E')).toBe('A &amp; B &lt; C &gt; D &quot; E');
  });

  it('escapeText escapes &, <, > but leaves quotes alone', () => {
    expect(escapeText('"hello" & <world>')).toBe('"hello" &amp; &lt;world&gt;');
  });

  it('emitElement coerces numeric attribute values to strings', () => {
    expect(emitSelfClosing('p', { id: 256 })).toBe('<p id="256"/>');
  });
});
