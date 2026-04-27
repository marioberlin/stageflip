// packages/import-hyperframes-html/src/dom/attrs.test.ts
// Unit tests for the data-* attr helpers.

import { parseFragment } from 'parse5';
import { describe, expect, it } from 'vitest';
import { getAttr, getAttrNumber, hasClass } from './attrs.js';
import { allElements } from './walk.js';

function firstElement(html: string) {
  const frag = parseFragment(html);
  for (const el of allElements(frag)) return el;
  throw new Error('no element parsed');
}

describe('attrs helpers', () => {
  it('getAttr returns the value when present', () => {
    const el = firstElement('<div data-foo="bar"></div>');
    expect(getAttr(el, 'data-foo')).toBe('bar');
  });

  it('getAttr returns undefined when absent', () => {
    const el = firstElement('<div></div>');
    expect(getAttr(el, 'data-foo')).toBeUndefined();
  });

  it('getAttrNumber parses numeric values', () => {
    const el = firstElement('<div data-w="1080" data-d="16.04"></div>');
    expect(getAttrNumber(el, 'data-w')).toBe(1080);
    expect(getAttrNumber(el, 'data-d')).toBe(16.04);
  });

  it('getAttrNumber returns undefined for non-numeric values', () => {
    const el = firstElement('<div data-x="auto"></div>');
    expect(getAttrNumber(el, 'data-x')).toBeUndefined();
  });

  it('hasClass detects exact tokens', () => {
    const el = firstElement('<div class="foo bar baz"></div>');
    expect(hasClass(el, 'bar')).toBe(true);
    expect(hasClass(el, 'qux')).toBe(false);
  });
});
