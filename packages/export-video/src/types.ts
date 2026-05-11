// packages/export-video/src/types.ts
// Types for the multi-aspect export orchestrator (T-186) + T-440's
// provenance-aware export surface. The orchestrator is a renderer-agnostic
// fan-out: it takes N variant targets + a `VariantRenderer` and returns
// one result per variant. Real renderer bindings (CDP host bundle, bake
// tier) plug in behind the contract.

import type { Document, MediaProvenance, MediaProvenanceKind } from '@stageflip/schema';

/**
 * A single aspect-ratio render target produced by the Planner's
 * `bounce_to_aspect_ratios` tool (T-185). `label` is an agent-facing
 * identifier (e.g. `'16:9'`, `'custom:9x16'`).
 */
export interface VariantTarget {
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly aspectRatio:
    | string
    | { readonly kind: 'custom'; readonly w: number; readonly h: number };
}

/**
 * Args passed to a `VariantRenderer`. The renderer clones / mutates the
 * document internally as needed; the orchestrator never mutates the
 * input document.
 */
export interface VariantRenderRequest {
  readonly document: Document;
  readonly variant: VariantTarget;
  readonly signal?: AbortSignal;
}

/** Output bytes (typical) or an external URL pointer the renderer produced. */
export interface VariantRenderOutput {
  readonly variant: VariantTarget;
  readonly mimeType: string;
  readonly bytes?: Uint8Array;
  readonly url?: string;
  /** Wall-clock render duration reported by the renderer. */
  readonly durationMs: number;
}

/** The renderer contract every backend must implement. */
export interface VariantRenderer {
  readonly id: string;
  render(request: VariantRenderRequest): Promise<VariantRenderOutput>;
}

/** Per-variant outcome after `exportMultiAspectInParallel` runs. */
export type VariantOutcome =
  | { readonly ok: true; readonly output: VariantRenderOutput }
  | { readonly ok: false; readonly variant: VariantTarget; readonly error: Error };

export interface MultiAspectExportOptions {
  readonly document: Document;
  readonly variants: readonly VariantTarget[];
  readonly renderer: VariantRenderer;
  /** Max concurrent renders. Default 3; pass `Infinity` for unlimited. */
  readonly concurrency?: number;
  /** When set, propagates to every renderer call. */
  readonly signal?: AbortSignal;
}

export interface MultiAspectExportResult {
  readonly rendererId: string;
  readonly outcomes: readonly VariantOutcome[];
  readonly okCount: number;
  readonly errorCount: number;
}

// ---------------------------------------------------------------------------
// T-440 — Provenance-aware export surface.
//
// The watermark posture is OPT-IN by default (vs T-439's IAB exporter
// which auto-marks for FTC + EU AI Act ad-tech compliance). Video output
// spans many contexts (artistic, internal, broadcast); forcing a
// watermark over-discloses for legitimate creative uses.
// ---------------------------------------------------------------------------

/**
 * Tenant-configurable AI-content watermark. Mirrors T-439's
 * `AiDisclosureBadgeConfig` shape with a few video-specific deltas
 * (opacity instead of background; `enabled` opt-in master switch).
 *
 * `enabled: false` is the default — see `DEFAULT_AI_WATERMARK` in
 * `ai-watermark.ts`. Setting `enabled: true` plus passing ≥1 AI element
 * causes the orchestrator to emit both an `AiContentManifest` (sidecar
 * payload) and an `AiWatermarkPlan` (renderer instructions).
 */
export interface AiWatermarkConfig {
  /** Master switch — opt-in. Default `false`. */
  enabled: boolean;
  /** Watermark text. Default `'Made with AI'`. */
  text: string;
  /** Corner position. Default `'bottom-right'`. */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Opacity 0..1. Default `0.10`. */
  opacity: number;
  /** Font color CSS string. Default `'#fff'`. */
  color: string;
  /** Font size in px. Default `12`. */
  fontSize: number;
}

/** Half-open frame range `[startFrame, endFrame)`. */
export interface FrameRange {
  readonly startFrame: number;
  readonly endFrame: number;
}

/**
 * One per-element row supplied to the orchestrator's provenance walker.
 * Hosts that build the input map each document MediaElement (audio /
 * image / video / future GLB-bearing wrappers) to one of these rows.
 *
 * `frameRange` is optional. When absent, the walker treats the element
 * as present for the entire timeline (the watermark plan collapses to
 * `[{0..MAX_SAFE_INTEGER}]`).
 */
export interface AiVideoElementInputRow {
  readonly elementId: string;
  readonly provenance?: MediaProvenance;
  readonly frameRange?: FrameRange;
}

/**
 * One AI-generated element's disclosure row, as it appears in the
 * exported `ai-content.json` sidecar's `elements` array. Mirrors
 * T-439's `AiContentDisclosureElement` with the video-specific
 * `frameRange?` addition.
 *
 * (Why duplicate rather than share with T-439? See `docs/tasks/T-440.md`
 * "Shared types between T-439 and T-440". Future refactor task can
 * extract once T-441 adds the third near-identical surface.)
 */
export interface AiContentManifestElement {
  readonly elementId: string;
  /** `AdapterDescriptor.id` (e.g. `'tts-kokoro'`). `'unknown'` when absent. */
  readonly provider: string;
  /** From `provenance.kind`. */
  readonly modality: MediaProvenanceKind;
  /** SHA-256 from `cacheKeyString(deriveCacheKey(...))` when known. */
  readonly cacheKey?: string;
  /** The prompt the provider received, post-normalization. */
  readonly prompt?: string;
  /** Half-open frame range over which the element is visible. */
  readonly frameRange?: FrameRange;
}

/**
 * Top-level shape of the `ai-content.json` sidecar emitted alongside
 * each exported MP4. Renderer-agnostic data; consumed by downstream
 * tooling (CMS uploaders, compliance scanners, jurisdiction routers).
 */
export interface AiContentManifest {
  readonly elements: readonly AiContentManifestElement[];
  readonly watermark: {
    readonly enabled: boolean;
    readonly text: string;
    readonly position: AiWatermarkConfig['position'];
    readonly opacity: number;
  };
}

/**
 * Renderer instructions for compositing the AI watermark. The
 * orchestrator builds the plan; concrete `VariantRenderer`
 * implementations consume it (FFmpeg drawtext for the bake tier;
 * canvas / CSS overlay for the live preview).
 *
 * `frameRanges` is sorted ascending and non-overlapping (merged via
 * `mergeFrameRanges`). When the plan is `undefined` (opt-out or zero
 * AI elements), renderers skip the watermark pass entirely.
 */
export interface AiWatermarkPlan {
  readonly config: AiWatermarkConfig;
  readonly frameRanges: readonly FrameRange[];
}

/** Input to the provenance-aware orchestrator entry point. */
export interface ProvenanceAwareExportInput {
  readonly document: Document;
  readonly variants: readonly VariantTarget[];
  readonly renderer: VariantRenderer;
  /**
   * Opt-in list of MediaElements whose provenance should be scanned for
   * AI-generated content. When absent or empty, the export path is
   * byte-identical to non-AI exports.
   */
  readonly aiElements?: readonly AiVideoElementInputRow[];
  /**
   * Partial watermark config; merged with `DEFAULT_AI_WATERMARK`.
   * `aiWatermark.enabled === true` is required to opt in.
   */
  readonly aiWatermark?: Partial<AiWatermarkConfig>;
  /** Max concurrent renders. Default 3; pass `Infinity` for unlimited. */
  readonly concurrency?: number;
  /** Propagates to every renderer call. */
  readonly signal?: AbortSignal;
}

/** Result from the provenance-aware orchestrator entry point. */
export interface ProvenanceAwareExportResult {
  readonly multiAspect: MultiAspectExportResult;
  /**
   * `ai-content.json` payload. Populated only when the tenant opted
   * in (`aiWatermark.enabled === true`) AND ≥1 AI-generated element
   * was supplied; `undefined` otherwise.
   */
  readonly aiContent?: AiContentManifest;
  /**
   * Watermark plan. Same population rule as `aiContent`. Renderers
   * consume this; the orchestrator does not pixel-composite frames
   * itself.
   */
  readonly watermarkPlan?: AiWatermarkPlan;
}
