// packages/export-html5-zip/src/provenance-walk.ts
// T-439 — provenance-walk: classify AI-generated kinds and extract per-element
// disclosures for the IAB display exporter. Pure functions; no I/O.
//
// Per FTC + EU AI Act (see docs/tasks/T-439.md "Regulatory references"):
// any element whose `provenance.kind` indicates an AI-generated asset
// (`tts`, `video-gen`, `music-gen`, `sfx`, `three-d`, `image-gen`, plus
// T-438's non-terminal `'asset-gen-pending'`) MUST surface in the exported
// manifest's `aiContent` field. Elements whose kind is `'imported'` or
// whose provenance is absent (hand-authored / imported) DO NOT trigger
// disclosure.

import type { MediaProvenance, MediaProvenanceKind } from '@stageflip/schema';

/**
 * The seven discriminator values that flag AI-generated content. Imported
 * assets (`kind === 'imported'`) DO NOT — they are hand-authored or
 * imported via PPTX / Google Slides.
 *
 * `asset-gen-pending` (T-438) is INCLUDED here: a pending placeholder
 * carries the metadata of the in-flight generation and at export time we
 * disclose conservatively (treat pending as AI). The placeholder element
 * itself is filtered upstream by the renderer, but the provenance shows
 * up in the document model and IAB exports should disclose it.
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

/** Per-document input row: an element id and (optional) its provenance. */
export interface AiElementInput {
  readonly elementId: string;
  readonly provenance?: MediaProvenance;
}

/**
 * A single AI-generated element's disclosure row, as it appears in the
 * exported manifest's `aiContent.elements` array.
 */
export interface AiContentDisclosureElement {
  readonly elementId: string;
  /** `AdapterDescriptor.id` (e.g. `'tts-kokoro'`). `'unknown'` when absent. */
  readonly provider: string;
  /** From `provenance.kind`. */
  readonly modality: MediaProvenanceKind;
  /** SHA-256 from `cacheKeyString(deriveCacheKey(...))` when known. */
  readonly cacheKey?: string;
  /** The prompt the provider received, post-normalization. */
  readonly prompt?: string;
}

/** Coarse per-jurisdiction compliance hint surfaced in the manifest. */
export type DisclosureCompliance = 'compliant' | 'requires-tenant-config';

/** Aggregated disclosure record. Populated only when ≥1 AI element present. */
export interface AiContentDisclosure {
  readonly elements: readonly AiContentDisclosureElement[];
  readonly disclosure: {
    readonly ftc: DisclosureCompliance;
    readonly euAiAct: DisclosureCompliance;
  };
}

/** Walker config: whether the visible badge is enabled for this export. */
export interface WalkConfig {
  readonly badgeEnabled: boolean;
}

/**
 * Walk a list of `AiElementInput` rows. Filters down to AI-generated
 * elements (per `classifyAiKind`), then builds the per-element disclosure
 * row plus the aggregated `disclosure` compliance hint.
 *
 * Per docs/tasks/T-439.md "Function":
 * - `ftc = 'compliant'` requires badge enabled AND at least one row
 *   carrying `provider`.
 * - `euAiAct = 'compliant'` requires badge enabled AND at least one row
 *   carrying both `provider` AND `model`.
 *
 * Returns a record even when `elements` is empty; callers decide whether
 * to surface it (the orchestrator suppresses `aiContent` when there are
 * zero AI elements).
 */
export function extractAiDisclosures(
  inputs: readonly AiElementInput[],
  config: WalkConfig,
): AiContentDisclosure {
  const elements: AiContentDisclosureElement[] = [];
  let anyProvider = false;
  let anyProviderAndModel = false;

  for (const input of inputs) {
    const prov = input.provenance;
    if (prov === undefined) continue;
    if (!classifyAiKind(prov.kind)) continue;
    const provider = prov.provider ?? 'unknown';
    if (prov.provider !== undefined) anyProvider = true;
    if (prov.provider !== undefined && prov.model !== undefined) anyProviderAndModel = true;
    const row: AiContentDisclosureElement = {
      elementId: input.elementId,
      provider,
      modality: prov.kind,
      ...(prov.cacheKey !== undefined ? { cacheKey: prov.cacheKey } : {}),
      ...(prov.prompt !== undefined ? { prompt: prov.prompt } : {}),
    };
    elements.push(row);
  }

  const ftc: DisclosureCompliance =
    config.badgeEnabled && anyProvider ? 'compliant' : 'requires-tenant-config';
  const euAiAct: DisclosureCompliance =
    config.badgeEnabled && anyProviderAndModel ? 'compliant' : 'requires-tenant-config';

  return { elements, disclosure: { ftc, euAiAct } };
}
