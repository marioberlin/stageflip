// packages/schema/src/elements/media-provenance.ts
// MediaProvenance schema — per ADR-008 §D2.
//
// Optional, strict slot every generated asset element (`audio`, `image`,
// `video`; future GLB-bearing wrappers via T-437) carries to record HOW
// the asset was produced. Imported / hand-authored assets carry no
// provenance — the slot stays absent.
//
// Cross-references:
//   - `packages/asset-cache/src/cache-key.ts` (T-420) — `cacheKey` here
//     matches the sha256-hex output of `cacheKeyString(deriveCacheKey(...))`.
//   - `packages/asset-gen-contract/src/provenance-placeholder.ts` (T-419) —
//     the local placeholder that mirrors this shape verbatim until the
//     placeholder swap (separate downstream task) flips its consumers to
//     import from `@stageflip/schema`.
//
// Strict-shape note (ADR-008 §D2 "Why strict"): Zod's `.strict()` rejects
// unknown fields at parse time, which the IAB-export auto-marker (T-439)
// and the asset inspector rely on to consume the slot without a permissive
// `unknown` fallback. The inferred TS type carries no `readonly` modifier
// (Zod doesn't enforce immutability at runtime); callers who need it can
// annotate `Readonly<MediaProvenance>` at the use site.

import { z } from 'zod';

/**
 * Discriminator: which generation pipeline produced this asset.
 * Per ADR-008 §D2.
 */
export const MEDIA_PROVENANCE_KINDS = [
  'tts',
  'video-gen',
  'music-gen',
  'sfx',
  'three-d',
  'image-gen', // covers infographic-gen output
  'imported', // imported via PPTX / Google Slides / etc; provider info absent
] as const;

/** Discriminator literal type for `MediaProvenance.kind`. */
export type MediaProvenanceKind = (typeof MEDIA_PROVENANCE_KINDS)[number];

/**
 * Reference into the tenant's voice-consent ledger row that authorized
 * a voice clone. Required by the TTS adapter pre-call check whenever
 * `voiceId` resolves to a cloned voice (per ADR-008 §D4).
 *
 * On asset load, if `voiceId` resolves to a cloned voice but
 * `clonedFromConsent` is absent, the loader emits
 * `LF-VOICE-CONSENT-PROVENANCE-MISSING` (per ADR-008 §D11). That
 * loss-flag wiring is a separate downstream task; T-421 only ships the
 * schema slot.
 */
export const tenantVoiceConsentRefSchema = z
  .object({
    /** Tenant the consent was granted to. */
    tenantId: z.string().min(1),
    /** Stable consent-row id (per ADR-008 §D4 storage). */
    consentId: z.string().min(1),
    /** ISO-8601 datetime; lets exporters surface "consented YYYY-MM-DD". */
    grantedAt: z.string().datetime(),
  })
  .strict();
export type TenantVoiceConsentRef = z.infer<typeof tenantVoiceConsentRefSchema>;

/**
 * Provenance slot every generated asset element carries. Optional on
 * the element side (hand-authored / imported assets carry no
 * provenance); strict — known fields only, no open extension.
 *
 * Per ADR-008 §D2. Field-by-field:
 *
 *   - `kind` — pipeline discriminator. Required.
 *   - `provider` — `AdapterDescriptor.id` (e.g. `'tts-kokoro'`,
 *     `'video-seedance'`).
 *   - `model` — model identifier the provider used (e.g.
 *     `'kokoro-82m'`).
 *   - `prompt` — the prompt the provider received, post-normalization
 *     per `@stageflip/asset-cache#normalizePrompt`.
 *   - `cacheKey` — sha256-hex from `cacheKeyString(deriveCacheKey(...))`.
 *     Lets exporters / inspectors deduplicate a single cached asset
 *     across multiple elements that reference it.
 *   - `seed` — seed (if any) the provider was called with. Numeric or
 *     string per provider preference; the cache-key derivation
 *     normalizes to base-10 int or `"none"` (per ADR-008 §D1) for
 *     hashing, so either type is admissible here for audit.
 *   - `voiceProvider` / `voiceId` — TTS-only; distinct from
 *     `provider` when one adapter exposes multiple providers.
 *   - `clonedFromConsent` — required when `voiceId` references a
 *     cloned voice; absence on a cloned-voice asset is a corruption
 *     signal.
 *   - `researchSessionId` / `sourceIds` — source-grounded providers
 *     (per ADR-008 §D7 / §D9). A provider may emit
 *     `researchSessionId` without per-source citations
 *     (`LF-RESEARCH-CITATIONS-MISSING`).
 */
export const mediaProvenanceSchema = z
  .object({
    /** Pipeline that produced this asset. */
    kind: z.enum(MEDIA_PROVENANCE_KINDS),

    /** Adapter id from `AdapterDescriptor.id` (e.g. `'tts-kokoro'`). */
    provider: z.string().min(1).optional(),

    /** Model identifier the provider used (e.g. `'kokoro-82m'`). */
    model: z.string().min(1).optional(),

    /** The prompt the provider received, post-normalization (per ADR-008 §D1). */
    prompt: z.string().optional(),

    /**
     * Cache key (sha256-hex) from
     * `cacheKeyString(deriveCacheKey(...))` (T-420). Lets exporters /
     * inspectors deduplicate a single cached asset across multiple
     * elements that reference it.
     */
    cacheKey: z.string().min(1).optional(),

    /**
     * Seed (if any) the provider was called with. ADR-008 §D2
     * declares `seed?: number` conceptually; ADR-008 §D1's cache-key
     * recipe accepts `seed?: number | string` (string used for
     * non-numeric provider seeds). Accept both here for audit
     * faithfulness; cache-key normalization happens upstream.
     */
    seed: z.union([z.number(), z.string().min(1)]).optional(),

    /**
     * --- TTS-specific (per ADR-008 §D5 voice-consent policy) ---
     * Voice-provider id (e.g. `'kokoro'`, `'fish-speech'`); distinct
     * from `provider` when one adapter exposes multiple providers.
     */
    voiceProvider: z.string().min(1).optional(),

    /**
     * Voice id within the provider (library voice slug or
     * tenant-cloned voice slug).
     */
    voiceId: z.string().min(1).optional(),

    /**
     * **REQUIRED** when `voiceId` references a cloned voice (per
     * ADR-008 §D4 / §D5). Reference into the tenant's consent ledger
     * row. Absence on a loaded asset that names a cloned voiceId is a
     * corruption signal — `LF-VOICE-CONSENT-PROVENANCE-MISSING`
     * emission is downstream (separate loss-flags task per ADR-008
     * §D11). T-421 ships only the slot.
     */
    clonedFromConsent: tenantVoiceConsentRefSchema.optional(),

    /**
     * --- Source-grounded (per ADR-008 §D7) ---
     * Set when the generation pipeline ran inside a research session.
     * Values come from `Document.research.sessionId` + the provider's
     * citation list.
     */
    researchSessionId: z.string().min(1).optional(),

    /**
     * Per-source citation ids the provider exposed. Independently
     * optional from `researchSessionId`: a provider may surface a
     * session id without per-source citations
     * (`LF-RESEARCH-CITATIONS-MISSING` info loss flag — emission is
     * downstream).
     */
    sourceIds: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type MediaProvenance = z.infer<typeof mediaProvenanceSchema>;
