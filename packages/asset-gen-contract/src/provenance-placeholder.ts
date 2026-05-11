// packages/asset-gen-contract/src/provenance-placeholder.ts
// Local placeholder for `MediaProvenance` + `ResearchSessionRef` per
// ADR-008 §D2 / §D3. The canonical schemas land in T-421 inside
// `@stageflip/schema`; T-419's source-grounded provider interfaces (D9)
// reference these shapes today so they need a verbatim placeholder until
// the import is available.
//
// TODO(T-421): swap every consumer of these placeholders to import from
// `@stageflip/schema`; delete this file. The shapes here MUST match
// ADR-008 §D2 / §D3 verbatim so the swap is a one-line import flip.

// ----------------------------------------------------------------------------
// MediaProvenance (per ADR-008 §D2)
// ----------------------------------------------------------------------------

/**
 * Discriminator: which generation pipeline produced this asset.
 * Per ADR-008 §D2.
 */
export type MediaProvenanceKind =
  | 'tts'
  | 'video-gen'
  | 'music-gen'
  | 'sfx'
  | 'three-d'
  | 'image-gen'
  | 'imported';

/**
 * Reference into a tenant's voice-consent ledger row.
 * Per ADR-008 §D2 / §D4.
 */
export interface TenantVoiceConsentRef {
  /** Tenant the consent was granted to. */
  readonly tenantId: string;
  /** Stable consent-row id (per §D5 storage). */
  readonly consentId: string;
  /** ISO-8601; lets exporters surface "consented YYYY-MM-DD". */
  readonly grantedAt: string;
}

/**
 * Provenance slot every generated asset element carries. Optional on the
 * element side (hand-authored / imported assets carry no provenance);
 * strict — known fields only, no open extension.
 *
 * Per ADR-008 §D2.
 */
export interface MediaProvenance {
  /** Pipeline that produced this asset. */
  readonly kind: MediaProvenanceKind;

  /** Adapter id from `AdapterDescriptor.id`. */
  readonly provider?: string;

  /** Model identifier the provider used. */
  readonly model?: string;

  /** The prompt the provider received, post-normalization (matches §D1). */
  readonly prompt?: string;

  /**
   * Cache key from §D1. Lets exporters / inspectors deduplicate a single
   * cached asset across multiple elements that reference it.
   */
  readonly cacheKey?: string;

  /** Seed (if any) the provider was called with. */
  readonly seed?: number;

  /**
   * --- TTS-specific (per §D5 voice-consent policy) ---
   * The voice-provider id; distinct from the adapter id when one adapter
   * exposes multiple providers.
   */
  readonly voiceProvider?: string;

  /**
   * Voice id within the provider (library voice slug or tenant-cloned
   * voice slug).
   */
  readonly voiceId?: string;

  /**
   * REQUIRED when `voiceId` references a cloned voice (per §D5). Reference
   * into the tenant's consent ledger row that authorized the clone.
   */
  readonly clonedFromConsent?: TenantVoiceConsentRef;

  /**
   * --- Source-grounded (per §D7) ---
   * Set when the generation pipeline ran inside a research session.
   */
  readonly researchSessionId?: string;
  readonly sourceIds?: readonly string[];
}

// ----------------------------------------------------------------------------
// ResearchSessionRef (per ADR-008 §D3)
// ----------------------------------------------------------------------------

/**
 * Per-source kind taxonomy. Mirrors ADR-007 §D5 `ResearchSourceKind`.
 * Kept as a string union to avoid a hard dep on adapters-core's source-
 * grounded surface; T-421 may collapse this into a single shared type.
 */
export type ResearchSourceKind = 'pdf' | 'doc' | 'slides' | 'audio' | 'video' | 'web' | 'text';

/**
 * Per-source manifest entry. Mirrored on the document side so a reload
 * can re-bind to the live session.
 */
export interface ResearchSource {
  readonly name: string;
  readonly kind: ResearchSourceKind;
  /** Provider-side id; opaque. */
  readonly providerSourceId: string;
  /** ISO 8601 of last upload. */
  readonly lastModified: string;
  /** SHA-256 of the source bytes for change detection. */
  readonly contentHash: string;
}

/**
 * Document-level binding to a research session. When set, asset-gen calls
 * fired against the document inherit the session id (per ADR-008 §D7
 * routing). Per ADR-008 §D3.
 */
export interface ResearchSessionRef {
  /** Provider name registered on the adapter side (e.g. `'notebooklm'`). */
  readonly provider: string;
  /** Provider-specific session id; opaque to consumers. */
  readonly sessionId: string;
  /** User-visible source manifest; mirrors the provider's view. */
  readonly sources: readonly ResearchSource[];
  /** ISO 8601. */
  readonly createdAt: string;
}
