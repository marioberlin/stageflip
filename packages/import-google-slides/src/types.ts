// packages/import-google-slides/src/types.ts
// Parser-side types for @stageflip/import-google-slides. Re-exports the
// canonical CanonicalSlideTree / ParsedElement / ParsedAssetRef et al. from
// @stageflip/import-pptx so consumers see one parser-side tree shape (per
// T-244 spec §1: "Output shape: same CanonicalSlideTree as
// @stageflip/import-pptx"). Adds Google-Slides-specific extensions for
// pendingResolution residuals and the GSlidesLossFlagCode union.

import type {
  ParsedElement,
  CanonicalSlideTree as PptxCanonicalSlideTree,
} from '@stageflip/import-pptx';

export type {
  CanonicalSlideTree as PptxCanonicalSlideTree,
  ParsedAssetRef,
  ParsedElement,
  ParsedGroupElement,
  ParsedImageElement,
  ParsedSlide,
  LossFlag,
  LossFlagCategory,
  LossFlagSeverity,
  LossFlagSource,
} from '@stageflip/import-pptx';

/**
 * Stable machine-readable identifiers for every Google-Slides-specific lossy
 * situation. Listed in T-244 spec §8 (Loss flags taxonomy). Each code maps to
 * a default severity + category in `loss-flags.ts`'s `CODE_DEFAULTS` table.
 */
export type GSlidesLossFlagCode =
  | 'LF-GSLIDES-PADDING-INFERRED'
  | 'LF-GSLIDES-FONT-SUBSTITUTED'
  | 'LF-GSLIDES-IMAGE-FALLBACK'
  | 'LF-GSLIDES-LOW-MATCH-CONFIDENCE'
  | 'LF-GSLIDES-PLACEHOLDER-INLINED'
  | 'LF-GSLIDES-TABLE-MERGE-LOST';

/**
 * Per-element residual record handed to T-246 (the AI-QC convergence loop).
 * Surfaced when a deterministic match falls below
 * `matchConfidenceThreshold`. Pinned by T-244 spec AC #39.
 */
export interface PendingMatchResolution {
  slideId: string;
  elementId: string;
  /** API element shape at emit time, with API-only values (no candidate values applied). */
  apiElement: ParsedElement;
  /** Bbox slice of the rendered slide PNG covering the element's API bbox + 16-px padding. */
  pageImageCropPx: { x: number; y: number; width: number; height: number };
  /** Top-K candidate matches the deterministic matcher considered, ranked by overallConfidence desc. */
  rankedCandidates: Array<{
    candidateKind: 'textLine' | 'contour' | 'mask';
    candidateIndex: number;
    contentConfidence: number;
    positionConfidence: number;
    zPenalty: number;
    overallConfidence: number;
  }>;
}

/**
 * CanonicalSlideTree extension for the Google-Slides importer. Inherits the
 * same shape as the PPTX parser's output (slides / layouts / masters /
 * lossFlags) and adds a per-slide pendingResolution map keyed by slideId →
 * elementId → residual record. T-246 reads this map to drive Gemini calls.
 */
export interface CanonicalSlideTree extends PptxCanonicalSlideTree {
  /**
   * Per-slide residual map. Outer key: slideId. Inner key: elementId. Empty
   * `{}` (not undefined) when no element fell below the matching threshold.
   */
  pendingResolution: Record<string, Record<string, PendingMatchResolution>>;
}

/**
 * Typed Google-Slides API client error. Carries a stable `code` so callers
 * can branch without string-matching. AC #3 / #4 pin the codes.
 */
export type GoogleApiErrorCode = 'AUTH_FAILED' | 'API_UNAVAILABLE' | 'TIMEOUT' | 'BAD_RESPONSE';

export class GoogleApiError extends Error {
  override readonly name = 'GoogleApiError';
  readonly code: GoogleApiErrorCode;
  readonly httpStatus?: number;

  constructor(init: { code: GoogleApiErrorCode; message?: string; httpStatus?: number }) {
    super(init.message ?? init.code);
    this.code = init.code;
    if (init.httpStatus !== undefined) this.httpStatus = init.httpStatus;
  }
}

/**
 * Typed CV-provider error. Thrown by `HttpCvProvider` on malformed responses
 * or persistent backend failures. AC #11 / #12 pin the codes.
 */
export type CvProviderErrorCode = 'BAD_RESPONSE' | 'WORKER_UNAVAILABLE' | 'TIMEOUT';

export class CvProviderError extends Error {
  override readonly name = 'CvProviderError';
  readonly code: CvProviderErrorCode;

  constructor(init: { code: CvProviderErrorCode; message?: string }) {
    super(init.message ?? init.code);
    this.code = init.code;
  }
}
