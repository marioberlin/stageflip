// packages/export-video/src/types.ts
// Types for the multi-aspect export orchestrator (T-186). The orchestrator
// is a renderer-agnostic fan-out: it takes N variant targets + a
// `VariantRenderer` and returns one result per variant. Real renderer
// bindings (CDP host bundle, bake tier) plug in behind the contract.

import type { Document } from '@stageflip/schema';

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
