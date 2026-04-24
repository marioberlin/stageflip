// packages/export-html5-zip/src/types.ts
// @stageflip/export-html5-zip contracts — the surface every IAB / GDN
// HTML5 banner export target plugs into.
//
// T-203a lands the types + `HtmlBundler` + `FallbackProvider` contracts +
// the deterministic-ZIP utility + the clickTag injector. T-203b will
// wire the orchestrator that consumes them.

import type { BannerFallback, DisplayBudget } from '@stageflip/schema';

/**
 * One canonical banner dimension. Mirrors `BannerSize` from `@stageflip/schema`
 * but leaves the `id` optional so consumers can build inputs from
 * `DISPLAY_CANONICAL_SIZES` without inventing identifiers.
 */
export interface BannerSize {
  readonly width: number;
  readonly height: number;
  /** Human-readable IAB label (e.g. "Medium Rectangle"). */
  readonly name?: string;
  /** Stable identifier used in output ZIP file names. Defaults to `${width}x${height}`. */
  readonly id?: string;
}

/**
 * The per-size bundle an `HtmlBundler` returns. The orchestrator writes
 * `html` as `index.html` at the root of the ZIP; each `asset.path` is a
 * relative path inside the ZIP (e.g. `assets/hero.png`). When
 * `DisplayBudget.assetsInlined` is `true`, the bundler is expected to
 * inline assets directly into the HTML (base64 / data URIs) and return an
 * empty `assets` array; see `concepts/display-budget`.
 */
export interface HtmlBundle {
  /** Rendered HTML for this size. UTF-8; must begin with `<!doctype html>`. */
  readonly html: string;
  /** Non-HTML assets (images, fonts) referenced from the HTML. */
  readonly assets: readonly BannerAsset[];
}

export interface BannerAsset {
  /** Relative path inside the ZIP (forward slashes; no leading `/`). */
  readonly path: string;
  /** Raw bytes. */
  readonly bytes: Uint8Array;
}

/**
 * Pluggable HTML bundler. Concrete implementations (T-205's optimizer,
 * the editor preview bundler, a test stub) turn one canonical size +
 * RIR document into the rendered HTML + asset set that gets zipped. This
 * package owns no rendering logic itself.
 */
export interface HtmlBundler {
  bundle(size: BannerSize): Promise<HtmlBundle>;
}

/**
 * Pluggable fallback-asset provider. T-204 ships a concrete implementation
 * that rasterises the midpoint frame. This package only knows about the
 * contract so it can inline the produced assets into the ZIP alongside
 * `index.html`.
 */
export interface FallbackProvider {
  generate(size: BannerSize): Promise<BannerFallback>;
}

/**
 * Top-level input for a multi-size banner export. Matches
 * `DisplayContent` from the schema field-for-field where it overlaps;
 * this shape is the "export-time" projection (the actual rendering has
 * already happened inside each `HtmlBundler`).
 */
export interface BannerExportInput {
  readonly sizes: readonly BannerSize[];
  /** IAB clickTag exit URL. Ad networks replace this at serve time. */
  readonly clickTag: string;
  /** Optional fallback asset bundle. T-204 generates if absent. */
  readonly fallback?: BannerFallback;
  /** Per-document budget from the schema. */
  readonly budget: DisplayBudget;
}

/** Validation finding produced during export. */
export interface ExportFinding {
  readonly severity: 'error' | 'warn';
  readonly code: string;
  readonly message: string;
  readonly sizeId?: string;
}

/** Per-size export outcome. */
export interface BannerExportResult {
  readonly size: BannerSize;
  /** Final ZIP bytes. */
  readonly zipBytes: Uint8Array;
  /** ZIP byte length in KB (for budget reporting). */
  readonly zipKb: number;
  /** Findings produced during this size's export (budget breaches, etc.). */
  readonly findings: readonly ExportFinding[];
}

/** Multi-size export outcome. */
export interface MultiSizeExportResult {
  readonly results: readonly BannerExportResult[];
  /** True when every size produced a ZIP with zero `error`-severity findings. */
  readonly ok: boolean;
}
