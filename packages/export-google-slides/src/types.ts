// packages/export-google-slides/src/types.ts
// Public types for @stageflip/export-google-slides. T-252 spec §1 / §8 pin
// these — `ExportTier`, `ConvergenceTolerances`, `ExportGoogleSlidesOptions`,
// `ExportGoogleSlidesResult`, `SlideExportOutcome`, `RendererCdpProvider`,
// and the `GSlidesExportLossFlagCode` union.

import type { GoogleAuthProvider } from '@stageflip/import-google-slides';
import type { LossFlag } from '@stageflip/loss-flags';

/**
 * Three tier modes (T-252 spec §2). `hybrid` is the default. The orchestrator
 * uses the tier to decide whether the convergence loop runs and whether
 * residuals are image-rasterized.
 */
export type ExportTier = 'fully-editable' | 'hybrid' | 'pixel-perfect-visual';

/** Per-tolerance overrides for convergence (T-252 spec §3). Defaults pinned. */
export interface ConvergenceTolerances {
  /** Text element bounding-box position tolerance in pixels. Default 2. */
  textBboxPositionPx: number;
  /** Text element bounding-box size tolerance in pixels. Default 3. */
  textBboxSizePx: number;
  /** Image / shape element position+size tolerance in pixels. Default 1. */
  imageShapePx: number;
  /** Whole-slide perceptual diff threshold (0..1). Default 0.02 (2%). */
  perceptualDiffThreshold: number;
}

/** Pinned defaults used when an override is not supplied. */
export const DEFAULT_TOLERANCES: ConvergenceTolerances = {
  textBboxPositionPx: 2,
  textBboxSizePx: 3,
  imageShapePx: 1,
  perceptualDiffThreshold: 0.02,
};

/** Default convergence iteration cap (spec §1 + §6). */
export const DEFAULT_MAX_ITERATIONS = 3;

/** Default tier (spec §2 — `hybrid`). */
export const DEFAULT_TIER: ExportTier = 'hybrid';

/**
 * Renderer-CDP wrapper. Production wires through `@stageflip/renderer-cdp`'s
 * fixture-render pipeline; tests use a stub returning canned PNG bytes per
 * slideId. T-252 spec §1 + §4.
 */
export interface RendererCdpProvider {
  /** Render one slide of the canonical document at the given pixel size. */
  renderSlide(
    doc: import('@stageflip/schema').Document,
    slideId: string,
    sizePx: { width: number; height: number },
  ): Promise<Uint8Array>;
}

/** T-252 spec §1 — public options. */
export interface ExportGoogleSlidesOptions {
  /** Auth provider. Same shape as T-244's `GoogleAuthProvider`. */
  auth: GoogleAuthProvider;
  /** Existing presentationId to overwrite. Undefined → create new. */
  presentationId?: string;
  /** Renderer-CDP wrapper for canonical-side golden PNGs. */
  renderer: RendererCdpProvider;
  /** Tier mode. Default 'hybrid'. */
  tier?: ExportTier;
  /** Max convergence iterations per slide. Default 3. */
  maxIterations?: number;
  /** API base URL override (testing only). */
  apiBaseUrl?: string;
  /** Per-tolerance overrides (testing only). Spec §3. */
  tolerances?: Partial<ConvergenceTolerances>;
  /**
   * Test seam: the API client driving `presentations.batchUpdate`,
   * `presentations.create`, etc. When provided, supplants the default fetch-
   * driven client. Production callers omit this.
   */
  apiClient?: import('./api/client.js').SlidesMutationClient;
}

/** Per-slide convergence outcome surfaced in the result (spec §1). */
export interface SlideExportOutcome {
  slideId: string;
  /** Number of convergence iterations actually run. */
  iterations: number;
  /** Per-element residual count after convergence (0 = perfect). */
  residualCount: number;
  /** Final per-element diff metrics. */
  finalMetrics: { textBboxPx: number; imageShapePx: number; perceptualDiffPct: number };
}

/** T-252 spec §1 — public result. */
export interface ExportGoogleSlidesResult {
  presentationId: string;
  lossFlags: LossFlag[];
  outcomes: SlideExportOutcome[];
  apiCallsMade: number;
}

/**
 * Stable machine-readable identifiers for every Google-Slides-export-specific
 * lossy situation. T-252 spec §8 table.
 */
export type GSlidesExportLossFlagCode =
  | 'LF-GSLIDES-EXPORT-FALLBACK'
  | 'LF-GSLIDES-EXPORT-API-ERROR'
  | 'LF-GSLIDES-EXPORT-CONVERGENCE-STALLED'
  | 'LF-GSLIDES-EXPORT-ANIMATIONS-DROPPED'
  | 'LF-GSLIDES-EXPORT-NOTES-DROPPED'
  | 'LF-GSLIDES-EXPORT-FONT-SUBSTITUTED'
  | 'LF-GSLIDES-EXPORT-TABLE-ROTATION-LOST'
  | 'LF-GSLIDES-EXPORT-CUSTOM-GEOMETRY-DEGRADED';
