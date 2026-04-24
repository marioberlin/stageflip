// packages/export-html5-zip/src/optimize/minify-js.test.ts
// T-205 — inline-JS minifier tests.

import { describe, expect, it } from 'vitest';

import { minifyInlineJsInHtml } from './minify-js.js';

describe('minifyInlineJsInHtml', () => {
  it('minifies a simple inline <script>', async () => {
    const html = '<html><head><script>var x = 1 + 2; console.log(x);</script></head></html>';
    const out = await minifyInlineJsInHtml(html);
    expect(out.length).toBeLessThan(html.length);
    expect(out).toContain('<script>');
    expect(out).toContain('</script>');
  });

  it('leaves HTML without scripts unchanged', async () => {
    const html = '<html><body><div></div></body></html>';
    const out = await minifyInlineJsInHtml(html);
    expect(out).toBe(html);
  });

  it('preserves script attributes', async () => {
    const html = '<html><head><script type="text/javascript">var a = 1;</script></head></html>';
    const out = await minifyInlineJsInHtml(html);
    expect(out).toContain('type="text/javascript"');
  });

  it('skips external-src scripts', async () => {
    const html = '<script src="https://cdn.example.com/a.js"></script>';
    const out = await minifyInlineJsInHtml(html);
    expect(out).toBe(html);
  });

  it('skips JSON-LD and other non-JS types', async () => {
    const html = '<script type="application/ld+json">{"a":"original with  spaces"}</script>';
    const out = await minifyInlineJsInHtml(html);
    expect(out).toBe(html);
  });

  it('minifies type="module" scripts', async () => {
    const html = '<script type="module">const x = 1 + 2; export default x;</script>';
    const out = await minifyInlineJsInHtml(html);
    expect(out.length).toBeLessThan(html.length);
    expect(out).toContain('type="module"');
  });

  it('leaves empty script tags untouched', async () => {
    const html = '<script></script>';
    const out = await minifyInlineJsInHtml(html);
    expect(out).toBe(html);
  });

  it('keeps the original when terser errors', async () => {
    // Intentionally malformed JS — terser will throw.
    const html = '<script>function (  {</script>';
    const out = await minifyInlineJsInHtml(html);
    expect(out).toBe(html);
  });

  it('minifies multiple scripts back-to-front safely (offsets stay valid)', async () => {
    const html = '<script>var a = 1 + 2;</script><div></div><script>var b = 3 + 4;</script>';
    const out = await minifyInlineJsInHtml(html);
    expect(out).toMatch(/<script>.*<\/script>.*<div>.*<\/div>.*<script>.*<\/script>/);
    expect(out.length).toBeLessThan(html.length);
  });

  it('is deterministic for identical input', async () => {
    const html = '<script>var x = 1; x;</script>';
    const a = await minifyInlineJsInHtml(html);
    const b = await minifyInlineJsInHtml(html);
    expect(a).toBe(b);
  });
});
