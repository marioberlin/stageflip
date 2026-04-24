// packages/export-html5-zip/src/optimize/optimize.test.ts
// T-205 — optimizeHtmlBundle end-to-end.

import { describe, expect, it } from 'vitest';

import type { BannerAsset, HtmlBundle } from '../types.js';
import { stringToZipBytes } from '../zip.js';
import { type ImageOptimizer, optimizeHtmlBundle } from './index.js';

const RAW_HTML = `<!doctype html>
<html><head><style>
  .used { color: red; }
  .dead { color: blue; }
</style></head><body>
<div class="used"></div>
<script>var x = 1 + 2; var unused = 99; console.log(x);</script>
</body></html>`;

describe('optimizeHtmlBundle', () => {
  it('strips unused CSS by default', async () => {
    const bundle: HtmlBundle = { html: RAW_HTML, assets: [] };
    const out = await optimizeHtmlBundle(bundle);
    expect(out.html).toContain('.used');
    expect(out.html).not.toContain('.dead');
  });

  it('minifies inline JS by default', async () => {
    const bundle: HtmlBundle = { html: RAW_HTML, assets: [] };
    const out = await optimizeHtmlBundle(bundle);
    expect(out.html.length).toBeLessThan(RAW_HTML.length);
  });

  it('skips CSS stripping when opts.stripUnusedCss is false', async () => {
    const bundle: HtmlBundle = { html: RAW_HTML, assets: [] };
    const out = await optimizeHtmlBundle(bundle, {
      stripUnusedCss: false,
      minifyJs: false,
    });
    expect(out.html).toContain('.dead');
  });

  it('skips JS minification when opts.minifyJs is false', async () => {
    const bundle: HtmlBundle = {
      html: '<script>var x = 1 + 2;</script>',
      assets: [],
    };
    const out = await optimizeHtmlBundle(bundle, {
      stripUnusedCss: false,
      minifyJs: false,
    });
    expect(out.html).toBe(bundle.html);
  });

  it('runs ImageOptimizer on image assets only', async () => {
    const optimizer: ImageOptimizer = {
      async optimize(asset) {
        // Pretend to shrink — return a smaller byte array.
        return { path: asset.path, bytes: new Uint8Array(1) };
      },
    };
    const bundle: HtmlBundle = {
      html: '<html></html>',
      assets: [
        { path: 'hero.png', bytes: stringToZipBytes('original-png-bytes') },
        { path: 'script.js', bytes: stringToZipBytes('console.log("x")') },
        { path: 'photo.JPG', bytes: stringToZipBytes('original-jpg-bytes') },
      ],
    };
    const out = await optimizeHtmlBundle(bundle, {
      stripUnusedCss: false,
      minifyJs: false,
      imageOptimizer: optimizer,
    });
    const byPath = new Map(out.assets.map((a) => [a.path, a]));
    expect(byPath.get('hero.png')?.bytes.length).toBe(1);
    expect(byPath.get('photo.JPG')?.bytes.length).toBe(1);
    expect(byPath.get('script.js')?.bytes.length).toBeGreaterThan(1);
  });

  it('throws when an ImageOptimizer changes the asset path', async () => {
    const badOptimizer: ImageOptimizer = {
      async optimize(asset) {
        return { path: `${asset.path}.webp`, bytes: asset.bytes };
      },
    };
    const bundle: HtmlBundle = {
      html: '<html></html>',
      assets: [{ path: 'a.png', bytes: new Uint8Array(10) }],
    };
    await expect(
      optimizeHtmlBundle(bundle, {
        stripUnusedCss: false,
        minifyJs: false,
        imageOptimizer: badOptimizer,
      }),
    ).rejects.toThrow(/preserve asset.path/);
  });

  it('passes non-image assets through untouched when an ImageOptimizer is configured', async () => {
    const optimizer: ImageOptimizer = {
      async optimize() {
        throw new Error('should not be called for non-images');
      },
    };
    const bundle: HtmlBundle = {
      html: '<html></html>',
      assets: [{ path: 'font.woff2', bytes: new Uint8Array(50) }],
    };
    const out = await optimizeHtmlBundle(bundle, {
      stripUnusedCss: false,
      minifyJs: false,
      imageOptimizer: optimizer,
    });
    expect(out.assets[0]?.bytes.length).toBe(50);
  });

  it('preserves input order of assets', async () => {
    const assets: BannerAsset[] = [
      { path: 'a.png', bytes: new Uint8Array(1) },
      { path: 'b.js', bytes: new Uint8Array(2) },
      { path: 'c.png', bytes: new Uint8Array(3) },
    ];
    const bundle: HtmlBundle = { html: '<html></html>', assets };
    const out = await optimizeHtmlBundle(bundle, {
      stripUnusedCss: false,
      minifyJs: false,
    });
    expect(out.assets.map((a) => a.path)).toEqual(['a.png', 'b.js', 'c.png']);
  });

  it('is deterministic for identical input', async () => {
    const bundle: HtmlBundle = { html: RAW_HTML, assets: [] };
    const a = await optimizeHtmlBundle(bundle);
    const b = await optimizeHtmlBundle(bundle);
    expect(a.html).toBe(b.html);
  });
});
