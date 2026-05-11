// packages/export-html5-zip/src/ai-badge.test.ts
// T-439 — ai-badge unit tests: aiBadgeHtml / injectAiBadge / annotateAiElementsInHtml.

import { describe, expect, it } from 'vitest';

import {
  type AiDisclosureBadgeConfig,
  DEFAULT_AI_BADGE,
  aiBadgeHtml,
  annotateAiElementsInHtml,
  injectAiBadge,
} from './ai-badge.js';

function cfg(overrides: Partial<AiDisclosureBadgeConfig> = {}): AiDisclosureBadgeConfig {
  return { ...DEFAULT_AI_BADGE, ...overrides };
}

const BASE_HTML = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';

describe('aiBadgeHtml', () => {
  it('emits an <aside data-ai-disclosure> snippet wrapped in marker comments', () => {
    const html = aiBadgeHtml(cfg());
    expect(html).toContain('<!-- stageflip-ai-disclosure -->');
    expect(html).toContain('<aside data-ai-disclosure');
    expect(html).toContain('AI');
  });

  it('honors position="bottom-left"', () => {
    const html = aiBadgeHtml(cfg({ position: 'bottom-left' }));
    expect(html).toContain('bottom: 8px');
    expect(html).toContain('left: 8px');
    expect(html).not.toContain('top: 8px');
    expect(html).not.toContain('right: 8px');
  });

  it('honors position="top-right" (default)', () => {
    const html = aiBadgeHtml(cfg());
    expect(html).toContain('top: 8px');
    expect(html).toContain('right: 8px');
  });

  it('honors position="bottom-right"', () => {
    const html = aiBadgeHtml(cfg({ position: 'bottom-right' }));
    expect(html).toContain('bottom: 8px');
    expect(html).toContain('right: 8px');
  });

  it('honors position="top-left"', () => {
    const html = aiBadgeHtml(cfg({ position: 'top-left' }));
    expect(html).toContain('top: 8px');
    expect(html).toContain('left: 8px');
  });

  it('escapes HTML-unsafe characters in text', () => {
    const html = aiBadgeHtml(cfg({ text: 'AI <Made & "tested">' }));
    expect(html).toContain('AI &lt;Made &amp; &quot;tested&quot;&gt;');
    expect(html).not.toContain('AI <Made & "tested">');
  });

  it('throws when text is empty (disabled-badge callers must skip injection)', () => {
    expect(() => aiBadgeHtml(cfg({ text: '' }))).toThrow(/empty/);
  });

  it('emits a stable string across two calls (deterministic)', () => {
    expect(aiBadgeHtml(cfg())).toBe(aiBadgeHtml(cfg()));
  });
});

describe('injectAiBadge', () => {
  it('inserts the badge snippet immediately before </body>', () => {
    const out = injectAiBadge(BASE_HTML, cfg());
    expect(out).toContain('<!-- stageflip-ai-disclosure -->');
    const bodyIdx = out.indexOf('</body>');
    const badgeIdx = out.indexOf('<!-- stageflip-ai-disclosure -->');
    expect(badgeIdx).toBeLessThan(bodyIdx);
    expect(badgeIdx).toBeGreaterThan(0);
  });

  it('is idempotent — re-injecting replaces the existing block in place', () => {
    const once = injectAiBadge(BASE_HTML, cfg());
    const twice = injectAiBadge(once, cfg());
    expect(twice).toBe(once);
  });

  it('replaces an existing badge with new config', () => {
    const once = injectAiBadge(BASE_HTML, cfg({ text: 'AI' }));
    const twice = injectAiBadge(once, cfg({ text: 'Made with AI' }));
    expect(twice).toContain('Made with AI');
    expect(twice).not.toMatch(/>AI</);
    // exactly one marker present
    expect((twice.match(/stageflip-ai-disclosure/g) ?? []).length).toBe(2); // open + close markers
  });

  it('throws when HTML has no </body>', () => {
    expect(() => injectAiBadge('<!doctype html><html><head></head></html>', cfg())).toThrow(
      /no <\/body>/,
    );
  });
});

describe('annotateAiElementsInHtml', () => {
  it('rewrites a matching data-element-id node to carry data-ai-generated="true"', () => {
    const html = '<div data-element-id="el-1">A</div><div data-element-id="el-2">B</div>';
    const out = annotateAiElementsInHtml(html, ['el-1']);
    expect(out).toContain('<div data-element-id="el-1" data-ai-generated="true">A</div>');
    expect(out).toContain('<div data-element-id="el-2">B</div>');
    expect(out).not.toContain('<div data-element-id="el-2" data-ai-generated="true">');
  });

  it('annotates multiple matching nodes', () => {
    const html = '<div data-element-id="a">A</div><div data-element-id="b">B</div>';
    const out = annotateAiElementsInHtml(html, ['a', 'b']);
    expect(out).toContain('data-element-id="a" data-ai-generated="true"');
    expect(out).toContain('data-element-id="b" data-ai-generated="true"');
  });

  it('is a no-op when no element-id matches', () => {
    const html = '<div>plain</div>';
    expect(annotateAiElementsInHtml(html, ['el-1'])).toBe(html);
  });

  it('does not double-annotate when data-ai-generated already present', () => {
    const html = '<div data-element-id="el-1" data-ai-generated="true">A</div>';
    const out = annotateAiElementsInHtml(html, ['el-1']);
    expect(out).toBe(html);
  });

  it('returns the input unchanged when the elementIds list is empty', () => {
    const html = '<div data-element-id="a">A</div>';
    expect(annotateAiElementsInHtml(html, [])).toBe(html);
  });

  it('only annotates elements whose id is in the list (selective)', () => {
    const html = '<span data-element-id="x"/><span data-element-id="y"/>';
    const out = annotateAiElementsInHtml(html, ['y']);
    expect(out).toContain('data-element-id="y" data-ai-generated="true"');
    expect(out).toMatch(/data-element-id="x"\/>/);
  });
});
