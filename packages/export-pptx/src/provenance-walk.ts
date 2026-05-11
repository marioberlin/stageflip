// packages/export-pptx/src/provenance-walk.ts
// T-441 — provenance-walk: classify AI-generated kinds and extract per-element
// disclosures for the PPTX exporter. Pure functions; no I/O.
//
// Mirrors T-439 (`export-html5-zip/src/provenance-walk.ts`) and T-440
// (`export-video/src/provenance-walk.ts`) with one delta: the PPTX walk
// emits an `AiPptxManifest` (extension payload) — no FTC / EU AI Act
// compliance fields (T-439) and no watermark config (T-440), because
// PPTX consumers (PowerPoint / Keynote / LibreOffice Impress) own the
// AI-disclosure UI. T-441 ships data only.
//
// Elements whose provenance is absent OR whose `kind === 'imported'`
// are filtered out. Pending placeholders (`'asset-gen-pending'`) are
// disclosed conservatively (treated as AI).

import type { MediaProvenance, MediaProvenanceKind } from '@stageflip/schema';

/**
 * The seven discriminator values that flag AI-generated content. Imported
 * assets (`kind === 'imported'`) DO NOT — they are hand-authored or
 * imported via PPTX / Google Slides / etc.
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
 */
export function classifyAiKind(kind: MediaProvenanceKind | undefined): boolean {
  if (kind === undefined) return false;
  return AI_KINDS.has(kind);
}

/**
 * One per-element row supplied to the PPTX provenance walker. Hosts map
 * each document MediaElement (image / audio / video) to one of these
 * rows. `slideId` is optional context surfaced in the manifest so
 * downstream consumers can correlate AI disclosures back to a specific
 * slide.
 */
export interface AiPptxElementInput {
  readonly elementId: string;
  readonly slideId?: string;
  readonly provenance?: MediaProvenance;
}

/**
 * One AI-generated element's disclosure row, as it appears in the
 * emitted `<sf:aiContent>` extension's per-element entries. Mirrors
 * T-439's `AiContentDisclosureElement` / T-440's `AiContentManifestElement`
 * with the PPTX-specific `slideId?` addition.
 *
 * (Why duplicate rather than share with T-439 / T-440? See
 * `docs/tasks/T-441.md` "Shared types between T-439 / T-440 / T-441".)
 */
export interface AiPptxManifestElement {
  readonly elementId: string;
  /** `AdapterDescriptor.id` (e.g. `'tts-kokoro'`). `'unknown'` when absent. */
  readonly provider: string;
  /** From `provenance.kind`. */
  readonly modality: MediaProvenanceKind;
  /** Optional slide context surfaced in the manifest. */
  readonly slideId?: string;
  /** SHA-256 from `cacheKeyString(deriveCacheKey(...))` when known. */
  readonly cacheKey?: string;
  /** The prompt the provider received, post-normalization. */
  readonly prompt?: string;
}

/**
 * Top-level shape of the AI-content manifest serialized into the PPTX
 * `<p:extLst>` extension on `ppt/presentation.xml`. Renderer-agnostic
 * data; consumed by downstream tooling (compliance scanners,
 * jurisdiction routers, audit log writers).
 */
export interface AiPptxManifest {
  readonly elements: readonly AiPptxManifestElement[];
}

/**
 * Walk `inputs` and produce an `AiPptxManifest` when ≥1 row is
 * AI-generated. Returns `undefined` when no AI elements are present
 * so the caller suppresses the entire `<p:extLst>` block.
 *
 * Pure function — no I/O, no `Date.now()`, no `Math.random()`.
 */
export function extractAiPptxManifest(
  inputs: readonly AiPptxElementInput[],
): AiPptxManifest | undefined {
  const elements: AiPptxManifestElement[] = [];

  for (const input of inputs) {
    const prov: MediaProvenance | undefined = input.provenance;
    if (prov === undefined) continue;
    if (!classifyAiKind(prov.kind)) continue;
    const provider = prov.provider ?? 'unknown';
    const row: AiPptxManifestElement = {
      elementId: input.elementId,
      provider,
      modality: prov.kind,
      ...(input.slideId !== undefined ? { slideId: input.slideId } : {}),
      ...(prov.cacheKey !== undefined ? { cacheKey: prov.cacheKey } : {}),
      ...(prov.prompt !== undefined ? { prompt: prov.prompt } : {}),
    };
    elements.push(row);
  }

  if (elements.length === 0) return undefined;
  return { elements };
}
