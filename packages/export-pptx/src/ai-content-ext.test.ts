// packages/export-pptx/src/ai-content-ext.test.ts
// T-441 — ai-content-ext unit tests: emitAiContentExtension XML shape.

import { describe, expect, it } from 'vitest';

import { AI_CONTENT_EXT_URI, emitAiContentExtension } from './ai-content-ext.js';
import type { AiPptxManifest } from './provenance-walk.js';

describe('AI_CONTENT_EXT_URI (T-441)', () => {
  it('is the stageflip-namespaced URI for v1 of the AI content manifest', () => {
    expect(AI_CONTENT_EXT_URI).toBe('https://stageflip.dev/extensions/ai-content/v1');
  });
});

describe('emitAiContentExtension (T-441)', () => {
  it('AC #7: emits <p:extLst>/<p:ext uri>/<sf:aiContent>/<sf:element> for one row', () => {
    const manifest: AiPptxManifest = {
      elements: [
        {
          elementId: 'el-1',
          provider: 'tts-kokoro',
          modality: 'tts',
          cacheKey: 'sha256-abc',
          prompt: 'hello world',
        },
      ],
    };
    const xml = emitAiContentExtension(manifest);
    expect(xml).toContain('<p:extLst>');
    expect(xml).toContain('</p:extLst>');
    expect(xml).toContain(`<p:ext uri="${AI_CONTENT_EXT_URI}">`);
    expect(xml).toContain(`<sf:aiContent xmlns:sf="${AI_CONTENT_EXT_URI}">`);
    expect(xml).toContain('</sf:aiContent>');
    expect(xml).toContain('<sf:element');
    expect(xml).toContain('id="el-1"');
    expect(xml).toContain('provider="tts-kokoro"');
    expect(xml).toContain('modality="tts"');
    expect(xml).toContain('cacheKey="sha256-abc"');
    expect(xml).toContain('prompt="hello world"');
  });

  it('emits one <sf:element> per manifest row, preserving order', () => {
    const manifest: AiPptxManifest = {
      elements: [
        { elementId: 'b', provider: 'tts-kokoro', modality: 'tts' },
        { elementId: 'a', provider: 'image-flux', modality: 'image-gen' },
        { elementId: 'c', provider: 'video-seedance', modality: 'video-gen' },
      ],
    };
    const xml = emitAiContentExtension(manifest);
    const elementMatches = xml.match(/<sf:element\b[^/]*\/>/g);
    expect(elementMatches).toHaveLength(3);
    // Order must match input order.
    const idAttr = (xml: string): string => xml.match(/id="([^"]+)"/)?.[1] ?? '';
    expect(elementMatches?.map(idAttr)).toEqual(['b', 'a', 'c']);
  });

  it('AC #8: escapes XML special characters in prompt', () => {
    const manifest: AiPptxManifest = {
      elements: [
        {
          elementId: 'el-1',
          provider: 'tts-kokoro',
          modality: 'tts',
          prompt: 'foo & <bar> "baz"',
        },
      ],
    };
    const xml = emitAiContentExtension(manifest);
    expect(xml).toContain('prompt="foo &amp; &lt;bar&gt; &quot;baz&quot;"');
    expect(xml).not.toContain('prompt="foo & <bar>');
  });

  it('escapes XML special characters in elementId / provider / cacheKey / slideId', () => {
    const manifest: AiPptxManifest = {
      elements: [
        {
          elementId: 'el-1&<>"',
          slideId: 'slide-1&',
          provider: 'p"r&',
          modality: 'tts',
          cacheKey: 'ck<x>',
        },
      ],
    };
    const xml = emitAiContentExtension(manifest);
    expect(xml).toContain('id="el-1&amp;&lt;&gt;&quot;"');
    expect(xml).toContain('slideId="slide-1&amp;"');
    expect(xml).toContain('provider="p&quot;r&amp;"');
    expect(xml).toContain('cacheKey="ck&lt;x&gt;"');
  });

  it('omits cacheKey / prompt / slideId attributes when absent on the row', () => {
    const manifest: AiPptxManifest = {
      elements: [{ elementId: 'el-1', provider: 'unknown', modality: 'image-gen' }],
    };
    const xml = emitAiContentExtension(manifest);
    expect(xml).not.toContain('cacheKey=');
    expect(xml).not.toContain('prompt=');
    expect(xml).not.toContain('slideId=');
    expect(xml).toContain('id="el-1"');
    expect(xml).toContain('provider="unknown"');
    expect(xml).toContain('modality="image-gen"');
  });

  it('produces deterministic output for the same input (called twice)', () => {
    const manifest: AiPptxManifest = {
      elements: [
        { elementId: 'el-1', provider: 'tts-kokoro', modality: 'tts', cacheKey: 'sha256-abc' },
      ],
    };
    expect(emitAiContentExtension(manifest)).toBe(emitAiContentExtension(manifest));
  });

  it('emits an empty <p:extLst> wrapper if called with an empty manifest (caller suppresses upstream)', () => {
    const manifest: AiPptxManifest = { elements: [] };
    const xml = emitAiContentExtension(manifest);
    expect(xml).toContain('<p:extLst>');
    expect(xml).toContain('</p:extLst>');
    expect(xml).not.toContain('<sf:element');
  });
});
