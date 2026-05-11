// packages/export-video/src/provenance-walk.ts
// T-440 — provenance-walk: classify AI-generated kinds and extract per-element
// disclosures for the video exporter. Pure functions; no I/O.
//
// Mirrors T-439's display-side `provenance-walk.ts` (FTC + EU AI Act
// disclosure shape) with one delta: the video walk emits an
// `AiContentManifest` (sidecar payload) instead of T-439's
// `AiContentDisclosure` (per-banner manifest field), and the manifest
// carries the tenant watermark config so consumers can decide whether
// to skip the composite step.
//
// Elements whose provenance is absent OR whose `kind === 'imported'`
// are filtered out. Pending placeholders (`'asset-gen-pending'`) are
// disclosed conservatively (treated as AI).

import type { MediaProvenance, MediaProvenanceKind } from '@stageflip/schema';

import type {
  AiContentManifest,
  AiContentManifestElement,
  AiVideoElementInputRow,
  AiWatermarkConfig,
} from './types.js';

/**
 * The seven discriminator values that flag AI-generated content. Imported
 * assets (`kind === 'imported'`) DO NOT — they are hand-authored or
 * imported via PPTX / Google Slides.
 *
 * `asset-gen-pending` (T-438) is INCLUDED: a pending placeholder carries
 * the metadata of the in-flight generation and at export time we
 * disclose conservatively (treat pending as AI).
 */
const AI_KINDS: ReadonlySet<MediaProvenanceKind> = new Set([
  'tts',
  'video-gen',
  'music-gen',
  'sfx',
  'three-d',
  'image-gen',
  'asset-gen-pending',
]);

/**
 * Return `true` when `kind` indicates AI-generated content. Defensive:
 * unknown discriminator values return `false` (the strict schema rejects
 * them at parse time; this is a runtime backstop).
 *
 * Re-exported through the walker module rather than the watermark
 * module so the dependency direction stays: walker → types (no cycle).
 */
export function classifyAiKind(kind: MediaProvenanceKind | undefined): boolean {
  if (kind === undefined) return false;
  return AI_KINDS.has(kind);
}

/** Re-export of `AiVideoElementInputRow` so callers importing the walker
 *  don't also need to import `./types.js`. */
export type { AiVideoElementInputRow };

/**
 * Walk `inputs` and produce an `AiContentManifest` when ≥1 row is
 * AI-generated. Returns `undefined` when no AI elements are present
 * (caller suppresses the sidecar entirely).
 *
 * The `watermark` sub-record on the manifest carries the tenant config
 * verbatim (filtered to the four fields consumers care about); a
 * consumer that sees `watermark.enabled === false` reads the manifest
 * for record-keeping but skips the renderer composite step.
 *
 * Pure function — no I/O, no `Date.now()`, no `Math.random()`.
 */
export function extractAiContentManifest(
  inputs: readonly AiVideoElementInputRow[],
  watermarkConfig: AiWatermarkConfig,
): AiContentManifest | undefined {
  const elements: AiContentManifestElement[] = [];

  for (const input of inputs) {
    const prov: MediaProvenance | undefined = input.provenance;
    if (prov === undefined) continue;
    if (!classifyAiKind(prov.kind)) continue;
    const provider = prov.provider ?? 'unknown';
    const row: AiContentManifestElement = {
      elementId: input.elementId,
      provider,
      modality: prov.kind,
      ...(prov.cacheKey !== undefined ? { cacheKey: prov.cacheKey } : {}),
      ...(prov.prompt !== undefined ? { prompt: prov.prompt } : {}),
      ...(input.frameRange !== undefined ? { frameRange: input.frameRange } : {}),
    };
    elements.push(row);
  }

  if (elements.length === 0) return undefined;

  return {
    elements,
    watermark: {
      enabled: watermarkConfig.enabled,
      text: watermarkConfig.text,
      position: watermarkConfig.position,
      opacity: watermarkConfig.opacity,
    },
  };
}
