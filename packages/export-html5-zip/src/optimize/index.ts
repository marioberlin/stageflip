// packages/export-html5-zip/src/optimize/index.ts
// T-205 — file-size optimizer. Applies HTML-level optimisations to an
// `HtmlBundle` before it enters the ZIP packer: unused-CSS stripping,
// inline-JS minification, and an optional pluggable `ImageOptimizer` for
// non-HTML assets.
//
// Image optimisation is delegated to a pluggable contract. Callers who
// want sharp-based PNG/AVIF/WebP re-encoding can ADR it separately (see
// CLAUDE.md §3 / THIRD_PARTY.md — sharp is LGPL-3.0) and register an
// adapter here. The default optimizer is a no-op so the package stays
// MIT/BSD-only.

import type { MinifyOptions } from 'terser';

import type { BannerAsset, HtmlBundle } from '../types.js';
import { minifyInlineJsInHtml } from './minify-js.js';
import { stripUnusedCssFromHtml } from './unused-css.js';

/**
 * Pluggable image optimizer. Implementations are free to call sharp /
 * jimp / oxipng / etc. — the export package is agnostic to the backend.
 * A return of the same-shape asset (no size reduction) is fine; callers
 * read `BannerExportResult.zipKb` to decide whether the optimisation
 * pass produced a measurable shrink.
 */
export interface ImageOptimizer {
  /**
   * Return an optimised version of the asset. MUST return an asset with
   * the same `path` — replacing the extension changes HTML references
   * silently, which is out of scope.
   */
  optimize(asset: BannerAsset): Promise<BannerAsset>;
}

/** The passes `optimizeHtmlBundle` can run. Default: all true. */
export interface OptimizeOptions {
  readonly stripUnusedCss?: boolean;
  readonly minifyJs?: boolean;
  readonly minifyJsOptions?: MinifyOptions;
  readonly imageOptimizer?: ImageOptimizer;
}

const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
]);

function isImagePath(path: string): boolean {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return false;
  return IMAGE_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

/**
 * Run every configured optimisation pass over an `HtmlBundle`. The
 * returned bundle's `html` byte-count is monotonically non-increasing
 * for the CSS + JS passes (terser errors keep the original script; the
 * CSS stripper is conservative). `imageOptimizer` runs on every
 * image-extension asset in the bundle; non-images pass through
 * unchanged.
 */
export async function optimizeHtmlBundle(
  bundle: HtmlBundle,
  opts: OptimizeOptions = {},
): Promise<HtmlBundle> {
  const { stripUnusedCss = true, minifyJs = true, minifyJsOptions, imageOptimizer } = opts;

  let html = bundle.html;
  if (stripUnusedCss) {
    html = stripUnusedCssFromHtml(html);
  }
  if (minifyJs) {
    html = await minifyInlineJsInHtml(html, minifyJsOptions ?? undefined);
  }

  let assets: readonly BannerAsset[] = bundle.assets;
  if (imageOptimizer !== undefined && assets.length > 0) {
    const optimised: BannerAsset[] = [];
    for (const asset of assets) {
      if (isImagePath(asset.path)) {
        const out = await imageOptimizer.optimize(asset);
        if (out.path !== asset.path) {
          throw new Error(
            `ImageOptimizer must preserve asset.path ('${asset.path}' → '${out.path}')`,
          );
        }
        optimised.push(out);
      } else {
        optimised.push(asset);
      }
    }
    assets = optimised;
  }

  return { html, assets };
}

export { stripUnusedCss, stripUnusedCssFromHtml, extractHtmlReferences } from './unused-css.js';
export { minifyInlineJsInHtml, DEFAULT_MINIFY_OPTIONS } from './minify-js.js';
