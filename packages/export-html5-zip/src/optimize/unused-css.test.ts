// packages/export-html5-zip/src/optimize/unused-css.test.ts
// T-205 — unused-CSS stripper behaviour + selector-match heuristics.

import { describe, expect, it } from 'vitest';

import {
  extractHtmlReferences,
  parseCssRules,
  selectorMatchesHtml,
  stripUnusedCss,
  stripUnusedCssFromHtml,
} from './unused-css.js';

describe('extractHtmlReferences', () => {
  it('collects tag names (lowercase)', () => {
    const refs = extractHtmlReferences('<DIV><span></span></DIV>');
    expect(refs.tags.has('div')).toBe(true);
    expect(refs.tags.has('span')).toBe(true);
  });

  it('collects classes from space-separated class attributes', () => {
    const refs = extractHtmlReferences('<div class="foo bar baz"></div>');
    expect(refs.classes.has('foo')).toBe(true);
    expect(refs.classes.has('bar')).toBe(true);
    expect(refs.classes.has('baz')).toBe(true);
  });

  it('collects classes from single-quoted attributes', () => {
    const refs = extractHtmlReferences("<div class='foo'></div>");
    expect(refs.classes.has('foo')).toBe(true);
  });

  it('collects ids from quoted attributes', () => {
    const refs = extractHtmlReferences('<div id="hero"><span id="sub"></span></div>');
    expect(refs.ids.has('hero')).toBe(true);
    expect(refs.ids.has('sub')).toBe(true);
  });

  it('ignores empty class / id attributes', () => {
    const refs = extractHtmlReferences('<div class=""></div>');
    expect(refs.classes.size).toBe(0);
  });
});

describe('parseCssRules', () => {
  it('parses simple selector-body rules', () => {
    const rules = parseCssRules('.a { color: red; } #b { color: blue; }');
    expect(rules).toHaveLength(2);
    expect(rules[0]?.selectors).toEqual(['.a']);
    expect(rules[1]?.selectors).toEqual(['#b']);
  });

  it('splits comma-separated selectors', () => {
    const rules = parseCssRules('.a, .b { color: red; }');
    expect(rules[0]?.selectors).toEqual(['.a', '.b']);
  });

  it('handles @media as an opaque at-rule', () => {
    const rules = parseCssRules('@media (max-width: 500px) { .a { color: red; } }');
    expect(rules).toHaveLength(1);
    expect(rules[0]?.isAtRule).toBe(true);
  });
});

describe('selectorMatchesHtml', () => {
  const refs = extractHtmlReferences('<div class="a b"><span id="x"></span></div>');

  it('matches tag selectors present in the HTML', () => {
    expect(selectorMatchesHtml('div', refs)).toBe(true);
    expect(selectorMatchesHtml('span', refs)).toBe(true);
  });

  it('rejects tag selectors absent from the HTML', () => {
    expect(selectorMatchesHtml('h1', refs)).toBe(false);
  });

  it('matches class selectors', () => {
    expect(selectorMatchesHtml('.a', refs)).toBe(true);
    expect(selectorMatchesHtml('.b', refs)).toBe(true);
  });

  it('rejects absent classes', () => {
    expect(selectorMatchesHtml('.missing', refs)).toBe(false);
  });

  it('matches id selectors', () => {
    expect(selectorMatchesHtml('#x', refs)).toBe(true);
  });

  it('rejects absent ids', () => {
    expect(selectorMatchesHtml('#missing', refs)).toBe(false);
  });

  it('keeps descendant combinators when at least one compound is live', () => {
    // `div .a` requires both tokens to resolve — both are live here.
    expect(selectorMatchesHtml('div .a', refs)).toBe(true);
  });

  it('strips pseudo-classes + pseudo-elements during match', () => {
    expect(selectorMatchesHtml('.a:hover', refs)).toBe(true);
    expect(selectorMatchesHtml('span::before', refs)).toBe(true);
  });

  it('keeps selectors with unfamiliar syntax (attribute selectors)', () => {
    expect(selectorMatchesHtml('[data-x]', refs)).toBe(true);
  });

  it('keeps the universal selector', () => {
    expect(selectorMatchesHtml('*', refs)).toBe(true);
  });
});

describe('stripUnusedCss', () => {
  const refs = extractHtmlReferences('<div class="used"><span></span></div>');

  it('keeps rules whose selector is referenced', () => {
    const css = '.used { color: red; }';
    expect(stripUnusedCss(css, refs)).toContain('.used');
  });

  it('drops rules whose selector is not referenced', () => {
    const css = '.unused { color: red; }';
    expect(stripUnusedCss(css, refs)).toBe('');
  });

  it('prunes dead selectors in a comma-separated rule', () => {
    const css = '.used, .dead { color: red; }';
    const out = stripUnusedCss(css, refs);
    expect(out).toContain('.used');
    expect(out).not.toContain('.dead');
  });

  it('keeps @media at-rules untouched', () => {
    const css = '@media (max-width: 500px) { .anything { color: red; } }';
    expect(stripUnusedCss(css, refs)).toContain('@media');
  });
});

describe('stripUnusedCssFromHtml', () => {
  it('rewrites <style> blocks in place', () => {
    const html =
      '<!doctype html><html><head><style>.used { color: red; } .dead { color: blue; }</style></head><body><div class="used"></div></body></html>';
    const out = stripUnusedCssFromHtml(html);
    expect(out).toContain('.used');
    expect(out).not.toContain('.dead');
  });

  it('leaves HTML without <style> blocks unchanged', () => {
    const html = '<!doctype html><html><body><div></div></body></html>';
    expect(stripUnusedCssFromHtml(html)).toBe(html);
  });

  it('handles multiple <style> blocks independently', () => {
    const html =
      '<html><head><style>.used {}</style><style>.dead {}</style></head><body><div class="used"></div></body></html>';
    const out = stripUnusedCssFromHtml(html);
    expect(out).toContain('.used');
    expect(out).not.toContain('.dead');
  });
});
