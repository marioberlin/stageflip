// packages/import-hyperframes-html/src/dom/walk.test.ts
// Unit tests for the parse5-tree walker.

import { describe, expect, it } from 'vitest';
import {
  allElements,
  childElements,
  findElementById,
  hasNoElementChildren,
  parseCompositionHtml,
  parseMasterHtml,
  textContent,
} from './walk.js';

describe('walk helpers', () => {
  it('finds an element by id', () => {
    const root = parseMasterHtml(
      '<!doctype html><html><body><div id="master-root">x</div></body></html>',
    );
    const found = findElementById(root, 'master-root');
    expect(found).toBeDefined();
    expect(found?.tagName).toBe('div');
  });

  it('iterates child elements only (no #text / #comment)', () => {
    const fragment = parseCompositionHtml('<div><p>hi</p><!-- c --><span>ok</span></div>');
    // The fragment's body has the outer div as a child, then we drill into it.
    const outer = childElements(fragment)[0];
    if (outer === undefined) throw new Error('expected outer div');
    const kids = childElements(outer);
    expect(kids.map((k) => k.tagName)).toEqual(['p', 'span']);
  });

  it('unwraps <template> wrappers in composition HTML', () => {
    const body = parseCompositionHtml(
      '<template id="t"><div data-composition-id="x"><p>inner</p></div></template>',
    );
    // After unwrap, the template's content fragment is returned; its first
    // element child is the data-composition-id wrapper.
    const top = childElements(body);
    expect(top.length).toBeGreaterThanOrEqual(1);
    expect(top[0]?.tagName).toBe('div');
  });

  it('textContent concatenates descendant text', () => {
    const frag = parseCompositionHtml('<div><span>a</span><span>b</span></div>');
    expect(textContent(frag)).toBe('ab');
  });

  it('hasNoElementChildren is true for text-only divs', () => {
    const frag = parseCompositionHtml('<div>hello</div>');
    const div = childElements(frag)[0];
    if (div === undefined) throw new Error('expected div');
    expect(hasNoElementChildren(div)).toBe(true);
  });

  it('hasNoElementChildren is false when an element child is present', () => {
    const frag = parseCompositionHtml('<div><p>x</p></div>');
    const div = childElements(frag)[0];
    if (div === undefined) throw new Error('expected div');
    expect(hasNoElementChildren(div)).toBe(false);
  });

  it('allElements yields every descendant element', () => {
    const frag = parseCompositionHtml('<div><p><span>x</span></p></div>');
    const tags = Array.from(allElements(frag)).map((e) => e.tagName);
    expect(tags).toEqual(['div', 'p', 'span']);
  });
});
