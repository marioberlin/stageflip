# ADR-008: Asset Generation Contract

**Date**: 2026-05-11
**Ratified**: pending (T-416 ratification PR; orchestrator approval)
**Status**: **Proposed**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

Phase 14 (Asset Generation) ships authoring-time generation of video / music / 3D / TTS / SFX assets — frozen files consumed by the existing `MediaElement` schema slots. ADR-007 (Provider Seam Pattern, meta) established the uniform `AdapterDescriptor` envelope every adapter shares; this ADR is its first downstream consumer ADR. It defines:

1. The **content-addressed cache key** scheme generated assets are stored under.
2. The **`MediaElement.provenance` schema** every generated asset carries.
3. The **voice-consent policy** TTS adapters that clone a real voice must enforce.
4. The **per-modality contracts** — five β modalities (TTS, video-gen, music-gen, 3D, SFX) plus the **seven source-grounded provider classes** preserved as ADR-008 scope per ADR-007 §D6.
5. The **`ResearchSessionProvider` interface body** + the **`Document.research?`** schema slot + the **`MediaProvenance.{researchSessionId, sourceIds}`** slots that wire ADR-007's source-grounded routing into the asset-gen pipeline.
6. The **four `LF-RESEARCH-*` LossFlagCodes** modality-specific providers emit when session lifecycle events fail.

Together with ADR-007, this ADR clears the Phase 14 α hard gate. After both merge, T-417 (concept SKILL), T-418 (`@stageflip/adapters-core`), T-419 (`@stageflip/asset-gen-contract`), T-420 (`@stageflip/asset-cache`), T-421 (`MediaElement.provenance` schema), and T-422 (`check-asset-licenses`) can dispatch.

### Folds-in source

This ADR absorbs the remaining sections of `docs/proposals/source-grounded-providers.md` not already in ADR-007:

| Proposal section | Where it lands in this ADR |
|---|---|
| §2.2 `ResearchSessionProvider` interface body (full method bodies, not just shape) | §D7 (ResearchSessionProvider asset-gen wiring) |
| §2.3 `Document.research?: ResearchSessionRef` schema addition | §D3 (`Document.research` slot) |
| §2.3 `MediaProvenance.{researchSessionId, sourceIds}` schema additions | §D2 (`MediaElement.provenance` schema) |
| §2.4 per-modality provider class **bodies** (vs. ADR-007 enumeration only) | §D9 (seven source-grounded provider class contracts) |
| §5 four `LF-RESEARCH-*` LossFlagCodes (after D9 demoted reconnect to UI toast) | §D11 (loss-flag inventory) |

ADR-007 §D5 / §D6 / §D8 already absorbed the proposal's §2.1 capability-descriptor flags, the meta-interface shape, the per-modality class enumeration, and the nine design decisions D1–D9. This ADR closes the loop. After T-416 merges, the proposal moves to `docs/proposals/archive/source-grounded-providers.md` per its own §10 disposition.

---

## Decisions

### D1. Content-addressed cache key

Every generated asset is stored under a deterministic SHA-256 cache key. The cache key is the single source of truth for "have I generated this asset before"; it is the primary key in `@stageflip/asset-cache` (T-420).

```ts
// Conceptual shape — exact derivation lands in @stageflip/asset-cache (T-420).
export interface AssetCacheKey {
  readonly modality: AdapterModality['kind'];
  readonly hash: string; // hex sha256, length 64
}

/**
 * Compute the content-addressed cache key.
 *
 * Inputs are canonicalized before hashing:
 *   1. `params` is sorted by key recursively (stable JSON).
 *   2. `prompt` is normalized: trim, collapse internal whitespace runs
 *      to a single space, lowercase Unicode NFC.
 *   3. `model` and `voice` are concatenated as `model:voice` (or `model:`
 *      when voice is absent).
 *   4. `seed` is rendered as a base-10 integer or the literal string
 *      `"none"` when absent.
 *
 * Hash input is the byte-encoding of the JSON canonical form:
 *   { modality, model, voice, prompt, params, seed }
 *
 * The 64-hex string is the asset's cache key. Storage layer prepends the
 * modality-bucket prefix at write time so the on-disk layout is
 *   {bucket-root}/{modality}/{hash[:2]}/{hash[2:4]}/{hash}.{ext}
 * Modality buckets prevent cross-modality collisions when models reuse
 * names across providers (e.g. a future `gpt-tts` and a future `gpt-image`).
 */
export function computeAssetCacheKey(input: {
  readonly modality: AdapterModality['kind'];
  readonly model: string;
  readonly voice?: string;
  readonly prompt: string;
  readonly params: Record<string, unknown>;
  readonly seed?: number;
}): AssetCacheKey;
```

**Why content-addressed.** Two callers issuing identical `(prompt, model, voice, params, seed)` get a single byte-identical cached asset — the second call short-circuits at the cache layer with no provider call. Since the cache is content-addressed (not key-by-call-id), we never need to invalidate on prompt edits; a new prompt simply produces a new hash.

**Why include `seed` in the key.** Most modern asset-gen models accept a seed and produce deterministic output for fixed `(prompt, model, params, seed)`. Excluding seed would force every regeneration into a single bucket regardless of intent. Callers requesting non-determinism omit `seed` (rendered `"none"`) and the cache stores the first response under the seed-less key; subsequent identical calls return the cached output, which is the desired "deterministic from cache" behaviour even when the underlying model is non-deterministic.

**Why NOT include `provider`.** Two providers serving the same model (e.g. fal hosting Seedance vs. self-hosted Seedance) MUST produce identical output for identical input or the deterministic cache contract breaks; we treat the model name as the determinism boundary, not the provider id. Provider information lives in `MediaElement.provenance.provider` (per §D2) for audit, not in the cache key.

**Out of scope here.** Storage layer migration, eviction policy, cross-tenant cache sharing, and the off-machine cache transport. T-420 (`@stageflip/asset-cache`) implements the in-process store + the per-tenant CDN-backed mirror. Per-modality license-aware cache rules live in T-422 (`check-asset-licenses`).

### D2. `MediaElement.provenance` schema

Every generated asset element (`ImageElement`, `VideoElement`, `AudioElement`, three-d / `BlenderClip` GLB consumers per T-437) carries a `provenance` slot that records how the asset was produced. The slot is **optional** — hand-authored or imported assets do not have one — and **strict** — known fields only, no open extension.

```ts
// Conceptual shape — lands in packages/schema/src/elements/provenance.ts (T-421).

/** Discriminator: which generation pipeline produced this asset. */
export type MediaProvenanceKind =
  | 'tts'
  | 'video-gen'
  | 'music-gen'
  | 'sfx'
  | 'three-d'
  | 'image-gen' // covers infographic-gen output
  | 'imported'; // imported via PPTX / Google Slides / etc; provider info absent

export interface MediaProvenance {
  /** Pipeline that produced this asset. */
  readonly kind: MediaProvenanceKind;

  /** Adapter id from AdapterDescriptor.id (e.g. 'tts-kokoro', 'video-seedance'). */
  readonly provider?: string;

  /** Model identifier the provider used (e.g. 'kokoro-82m', 'seedance-2.0'). */
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
   * The voice-provider id (e.g. 'kokoro' or 'fish-speech'); distinct from
   * the adapter id when one adapter exposes multiple providers.
   */
  readonly voiceProvider?: string;

  /**
   * Voice id within the provider (e.g. 'voice-1', a library voice slug,
   * or a tenant-cloned voice slug).
   */
  readonly voiceId?: string;

  /**
   * **REQUIRED** when the voiceId references a cloned voice (per §D5).
   * Reference into the tenant's consent ledger row that authorized the
   * clone. Absence at generation time blocks the call; absence on a
   * loaded asset that names a cloned voiceId is a corruption signal.
   */
  readonly clonedFromConsent?: TenantVoiceConsentRef;

  /**
   * --- Source-grounded (per §D7) ---
   * Set when the generation pipeline ran inside a research session.
   * Values come from `Document.research.sessionId` + the provider's
   * citation list. Both fields are independently optional: a provider
   * may surface session-id without per-source citations
   * (LF-RESEARCH-CITATIONS-MISSING in §D11).
   */
  readonly researchSessionId?: string;
  readonly sourceIds?: readonly string[];
}

export interface TenantVoiceConsentRef {
  /** Tenant the consent was granted to. */
  readonly tenantId: string;
  /** Stable consent-row id (per §D5 storage). */
  readonly consentId: string;
  /** ISO-8601; lets exporters surface "consented YYYY-MM-DD". */
  readonly grantedAt: string;
}
```

**Why optional.** Imported assets (PPTX, Google Slides) and hand-authored assets carry no provenance; making the slot required would force every importer + every legacy document to emit a sentinel value. The `kind: 'imported'` value is reserved as the future-explicit form when an importer wants to record provenance for round-trip but is not the implied default.

**Why strict.** Per CLAUDE.md §3 (TS strict, `exactOptionalPropertyTypes`) the schema should not silently accept unknown fields; stricter shapes catch typos at parse time and let the IAB-export auto-marker (T-439) consume the slot without a permissive `unknown` fallback.

**Wiring**: T-421 ships `provenance.ts` + extends `imageElementSchema`, `videoElementSchema`, `audioElementSchema`, and the GLB-bearing element wrappers consumed by `ThreeSceneClip` / `BlenderClip` (per T-437). The schema addition is non-breaking (the field is optional); migrations are not required.

### D3. `Document.research?` schema slot

The document schema gains one optional top-level field — `research?: ResearchSessionRef` — persisted with the document so a reload re-binds to the live session:

```ts
// Conceptual shape — lands in packages/schema/src/document.ts (T-419 wiring task).

export interface Document {
  // ...existing meta / theme / variables / components / masters / layouts
  // / content / variantSlots fields (per packages/schema/src/document.ts).

  /**
   * When set, the document is bound to a research-session-scoped source
   * corpus. Asset-gen calls fired against this document inherit the
   * session id (per §D7 routing). Absent for ungrounded documents.
   *
   * Schema field is **independently optional** (proposal D3): an
   * ungrounded document can be grounded later by populating this field
   * via the `ground_existing_project` AI tool; a grounded document can
   * be ungrounded by clearing it. Existing assets keep their
   * `provenance.researchSessionId` audit trail in either direction.
   */
  readonly research?: ResearchSessionRef;
}

export interface ResearchSessionRef {
  /** Provider name registered on the adapter side (e.g. 'notebooklm'). */
  readonly provider: string;
  /** Provider-specific session id; opaque to consumers. */
  readonly sessionId: string;
  /** User-visible source manifest; mirrors the provider's view. */
  readonly sources: readonly ResearchSource[];
  /** ISO 8601. */
  readonly createdAt: string;
}

export interface ResearchSource {
  readonly name: string;
  readonly kind: ResearchSourceKind; // per ADR-007 §D5
  /** Provider-side id; opaque. */
  readonly providerSourceId: string;
  /** ISO 8601 of last upload. */
  readonly lastModified: string;
  /** SHA-256 of the source bytes for change detection. */
  readonly contentHash: string;
}
```

**Wiring**: T-419 (`@stageflip/asset-gen-contract`) extends `documentSchema` in `packages/schema/src/document.ts` with the optional `research` slot. The addition is non-breaking — every existing persisted document parses unchanged. Migrations not required.

### D4. Voice-consent policy

Voice-clone TTS adapters that synthesize from a model trained on a real human's voice MUST refuse to generate without a per-tenant consent record. This is the single moral / legal hazard the asset-gen contract carries; the rest of the modalities have license posture (handled by §D3 / D11 / T-422) but voice-clone has consent posture beyond license.

The contract clauses are:

1. **WHO declares consent.** A tenant-admin role (existing, per T-411a `TenantSettings`) — not an end-user — declares the consent. The admin asserts (a) the voice is the admin's own, (b) the voice belongs to a person who has signed a consent form the admin can produce on demand, or (c) the voice is a public-figure usage that the tenant accepts legal liability for. The contract does NOT enable voice-clone-synthesis-without-an-admin-consent-row at the engine layer; UI surfaces (per T-411e admin UI) gate the consent declaration.

2. **HOW consent is stored.** A new `tenantVoiceConsent` storage facet on the existing `StorageAdapter` 3-method contract (per ADR-007 §D9 / `packages/storage/src/contract.ts`). The shape is:

   ```ts
   // Conceptual shape — lands in packages/storage/src/tenant-voice-consent-store.ts
   // when a TTS-clone adapter dispatches (T-427 fish-speech is the v1 trigger).

   export interface TenantVoiceConsentRow {
     readonly id: string;                      // ULID
     readonly tenantId: string;
     readonly voiceProvider: string;           // e.g. 'fish-speech'
     readonly voiceId: string;                 // provider's slug for the cloned voice
     readonly grantedBy: string;               // admin user id who declared consent
     readonly grantedAt: string;               // ISO 8601
     readonly grantBasis: 'self' | 'third-party-signed' | 'public-figure';
     /** Free-text note the admin attaches at declaration time (e.g. consent-form file ref). */
     readonly evidenceUri?: string;
     /** Set when the admin (or a downstream automation) revokes the consent. */
     readonly revokedAt?: string;
   }

   export interface TenantVoiceConsentStore {
     get(id: string): Promise<TenantVoiceConsentRow | undefined>;
     listForTenant(tenantId: string): Promise<readonly TenantVoiceConsentRow[]>;
     /** Throws if the row is revoked or absent — used inline by the
      *  TTS adapter pre-call check. */
     assertActive(input: {
       tenantId: string;
       voiceProvider: string;
       voiceId: string;
     }): Promise<TenantVoiceConsentRow>;
     create(row: Omit<TenantVoiceConsentRow, 'id' | 'grantedAt'>): Promise<TenantVoiceConsentRow>;
     revoke(id: string, revokedAt: string): Promise<void>;
   }
   ```

   Storage facet implementation lands when the first voice-clone adapter dispatches (T-427 `@stageflip/tts-fish-speech`); ADR-008 specifies the contract shape only.

   **Why a separate storage facet, not a `TenantSettings` extension.** Consent rows are append-mostly + audit-load-bearing. Bundling them into the JSON-shaped `TenantSettings` blob would (a) bloat every settings-read with consent rows, (b) make per-row revocation timestamps awkward, (c) make per-row audit-log emission (D7 future work) require diffing JSON instead of inserting rows. A dedicated facet matches how `TenantSettingsStore` itself was carved out from generic `StorageAdapter` per T-411a.

3. **WHEN consent is checked.** Per-call. The TTS adapter's pre-call hook calls `tenantVoiceConsentStore.assertActive({tenantId, voiceProvider, voiceId})`; if it throws (revoked / absent), the adapter refuses with a `LF-VOICE-CONSENT-MISSING` loss flag (added to `@stageflip/loss-flags` by T-419 alongside the LF-RESEARCH-* codes per §D11). Per-session caching is rejected: a consent revocation must take effect immediately, not at session boundary.

   **Library voices** (voices the provider distributes pre-trained, not cloned per-tenant) bypass the consent check; the library-voice list is a static property of the adapter's `TtsCapabilityDescriptor` (per §D5) so the adapter can short-circuit before touching storage.

4. **Provenance witness.** Every generated asset whose `voiceId` is a cloned voice (not a library voice) carries `MediaProvenance.clonedFromConsent: TenantVoiceConsentRef` (per §D2). On asset load, if `voiceId` resolves to a cloned voice but `clonedFromConsent` is absent, the loader emits `LF-VOICE-CONSENT-PROVENANCE-MISSING` (corruption signal). Exporters that publish AI-generated audio (T-439 / T-440) MAY surface the consent timestamp; v1 does not require it but the slot is provisioned for it.

### D5. Per-modality contracts — TTS

`TTSProvider` extends `AdapterDescriptor` with TTS-specific call shape and capability:

```ts
// Lands in @stageflip/asset-gen-contract (T-419). Per-modality contracts.

export interface TTSProvider extends ProviderBase<TtsCapabilityDescriptor> {
  readonly modality: { kind: 'tts' };

  /**
   * Synthesize speech. Returns the cache key + asset metadata (URL,
   * duration, word timestamps) once the cache layer has the bytes.
   * Implementations MUST call `tenantVoiceConsentStore.assertActive`
   * before issuing the upstream call when `voiceId` is a cloned voice
   * (per §D4).
   */
  synthesize(call: TtsCall): Promise<TtsResult>;
}

export interface TtsCapabilityDescriptor {
  /** Voices this adapter exposes. */
  readonly voices: readonly TtsVoice[];
  /** Output audio formats (must include at least one of these). */
  readonly outputFormats: readonly ('wav' | 'mp3' | 'opus' | 'flac')[];
  /** Sample rates the adapter can emit (Hz). */
  readonly sampleRates: readonly number[];
  /** Maximum synthesizable duration per call (seconds). */
  readonly maxDurationS: number;
  /** Whether the adapter emits per-word timestamps the captions
   *  bypass-Whisper integration (T-436) consumes. */
  readonly emitsWordTimestamps: boolean;
  /** Whether the adapter supports voice cloning. */
  readonly supportsVoiceClone: boolean;
}

export interface TtsVoice {
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /** Distinguishes consent-gated from free-to-use voices (per §D4). */
  readonly origin: 'library' | 'cloned-per-tenant';
  /** ISO-639-1 codes the voice supports. */
  readonly languages: readonly string[];
}

export interface TtsCall {
  readonly tenantId: string;
  readonly voiceId: string;
  readonly text: string;
  readonly outputFormat: 'wav' | 'mp3' | 'opus' | 'flac';
  readonly sampleRate: number;
  readonly seed?: number;
}

export interface TtsResult {
  readonly cacheKey: string; // per §D1
  readonly url: string;
  readonly durationS: number;
  /** Set when descriptor.emitsWordTimestamps is true. */
  readonly wordTimestamps?: readonly { word: string; startS: number; endS: number }[];
}
```

### D6. Per-modality contracts — video-gen / music-gen / SFX / 3D

Each follows the same `ProviderBase<CapabilityDescriptor>` shape as TTS. Only the modality-specific fields differ:

```ts
export interface VideoGenerationProvider extends ProviderBase<VideoGenCapabilityDescriptor> {
  readonly modality: { kind: 'video-gen' };
  generate(call: VideoGenCall): Promise<VideoGenResult>;
}

export interface VideoGenCapabilityDescriptor {
  /** Aspect ratios this adapter can emit (e.g. '16:9', '9:16', '1:1'). */
  readonly aspectRatios: readonly string[];
  /** Frame rates (fps). */
  readonly frameRates: readonly number[];
  /** Maximum duration per call (seconds). */
  readonly maxDurationS: number;
  /** Output container formats. */
  readonly outputFormats: readonly ('mp4' | 'webm')[];
  /** Whether the adapter emits audio (Seedance 2.0: yes; most others: no). */
  readonly emitsAudio: boolean;
  /** Adapter-declared safety filters (descriptive; routing layer does
   *  not interpret — agent UI surfaces them so the user can choose). */
  readonly safetyFilters: readonly string[];
}

export interface MusicGenerationProvider extends ProviderBase<MusicGenCapabilityDescriptor> {
  readonly modality: { kind: 'music-gen' };
  generate(call: MusicGenCall): Promise<MusicGenResult>;
}

export interface MusicGenCapabilityDescriptor {
  /** Genres / moods the model can target (descriptive; not a closed
   *  enum because vocabularies vary across vendors). */
  readonly genres: readonly string[];
  /** Maximum duration per call (seconds). */
  readonly maxDurationS: number;
  /** Output formats. */
  readonly outputFormats: readonly ('wav' | 'mp3' | 'flac')[];
  /** License disposition of the generated track. Critical for the
   *  monetization story: ACE-Step (MIT) emits commercially-usable
   *  output; YuE (Apache + attribution) does too with attribution
   *  recorded in MediaProvenance. T-422 enforces. */
  readonly outputLicense: 'permissive' | 'attribution-required' | 'non-commercial';
}

export interface SFXProvider extends ProviderBase<SfxCapabilityDescriptor> {
  readonly modality: { kind: 'sfx' };
  generate(call: SfxCall): Promise<SfxResult>;
}

export interface SfxCapabilityDescriptor {
  readonly outputFormats: readonly ('wav' | 'mp3' | 'flac')[];
  readonly sampleRates: readonly number[];
  /** Maximum duration per call (seconds). SFX typically 1-15 s. */
  readonly maxDurationS: number;
  /** Whether the adapter can emit a seamlessly-loopable clip. */
  readonly supportsLoop: boolean;
}

export interface ThreeDAssetProvider extends ProviderBase<ThreeDCapabilityDescriptor> {
  readonly modality: { kind: 'three-d' };
  generate(call: ThreeDCall): Promise<ThreeDResult>;
}

export interface ThreeDCapabilityDescriptor {
  /** GLB output is mandatory (the only format ThreeSceneClip / T-437 consumes). */
  readonly outputFormats: readonly ['glb'];
  /** Topology the adapter emits — quad-clean (Tripo characters) vs.
   *  triangle-soup (most prop generators). T-437 honours: rigging
   *  pipeline only valid on quad-clean output. */
  readonly topology: 'quad-clean' | 'triangle-soup' | 'mixed';
  /** Whether the adapter can rig characters (skeleton + skinning weights). */
  readonly supportsAutoRigging: boolean;
  /** Approximate maximum mesh complexity in vertices (declarative; the
   *  agent uses this to refuse callers asking for >budget assets). */
  readonly maxVertices: number;
}
```

**Why call/result types are sketched, not normative here.** ADR-008 fixes the descriptor envelope + the provenance contract; T-419 ships the precise call/result types in the `@stageflip/asset-gen-contract` package. The shapes above document the shared envelope and the modality-distinguishing fields the routing engine reads (per ADR-007 §D3); per-call detail (e.g. video `cameraMotion`, music `tempo`, sfx `category`) is the package's freedom to refine in implementation.

### D7. `ResearchSessionProvider` asset-gen wiring

ADR-007 §D5 specified the `ResearchSessionProvider` meta-interface shape. The asset-gen wiring — how a per-modality call against a grounded document picks up the session id — lives here:

```
1. Tool dispatcher resolves the document's research field.
   • document.research is undefined → call routes via the creative tier;
     no session-id flows through; provenance.researchSessionId omitted.
   • document.research is defined → step 2.

2. Capability-routing engine (ADR-007 §D7) selects an adapter whose
   descriptor.sourceGrounded is true AND descriptor.requiresResearchProvider
   matches document.research.provider.
   • No matching adapter → fall through to creative tier; emit
     LF-RESEARCH-PROVIDER-RATE-LIMITED only if the source-grounded path
     was actively tried-and-throttled, otherwise no flag.

3. Engine pings the session via ResearchSessionProvider.pingSession(sessionId):
   • 'live' → step 4.
   • 'expired' → call reconnectSession(persistedSources) → write the
     new sessionId back to document.research → emit a UI toast
     (NOT a loss flag, per ADR-007 §D8 D9 ratification) → step 4.
   • 'revoked' → emit LF-RESEARCH-SESSION-LOST → fall through to
     creative tier.

4. Engine issues the per-modality call with the resolved sessionId
   threaded through the call's options bag.

5. Provider responds with asset bytes + an optional citation list
   (sourceIds it drew from). The asset-cache layer stores the asset
   under the §D1 cache key.

6. The per-modality call result wraps MediaProvenance with:
       researchSessionId: document.research.sessionId
       sourceIds: provider.citationList ?? undefined
   • If provider does not surface citationList despite being
     source-grounded, emit LF-RESEARCH-CITATIONS-MISSING (info).
```

**Per-call grounding override** (ADR-007 §D7 / proposal D7) is the dispatch-time `groundingOverride: 'auto' | 'force-grounded' | 'force-creative'` parameter; the routing engine consumes it before step 2.

**Out-of-scope for this ADR.** Storage of per-source manifest bytes (the provider holds these; we keep the `ResearchSource[]` mirror + content-hash for change detection only). The reconnect-on-expiry retry budget (T-425 implements with reasonable defaults). UI toast surfacing is the editor-shell notification channel's responsibility (T-417's concept SKILL covers the convention).

### D8. Five β modality contracts — summary table

| Contract | Modality kind | Capability discriminators | Provenance kind |
|---|---|---|---|
| `TTSProvider` | `tts` | `voices[]`, `outputFormats[]`, `sampleRates[]`, `maxDurationS`, `emitsWordTimestamps`, `supportsVoiceClone` | `tts` |
| `VideoGenerationProvider` | `video-gen` | `aspectRatios[]`, `frameRates[]`, `maxDurationS`, `outputFormats[]`, `emitsAudio`, `safetyFilters[]` | `video-gen` |
| `MusicGenerationProvider` | `music-gen` | `genres[]`, `maxDurationS`, `outputFormats[]`, `outputLicense` | `music-gen` |
| `SFXProvider` | `sfx` | `outputFormats[]`, `sampleRates[]`, `maxDurationS`, `supportsLoop` | `sfx` |
| `ThreeDAssetProvider` | `three-d` | `outputFormats[]` (always `['glb']`), `topology`, `supportsAutoRigging`, `maxVertices` | `three-d` |

All five extend `AdapterDescriptor` (ADR-007 §D1) for `id`, `license`, `sandbox`, `costPerCall`, `latencyMs`, `sourceGrounded`, `requiresResearchProvider`. Per-call shapes (`TtsCall`, `VideoGenCall`, etc.) and per-call result shapes (`TtsResult`, `VideoGenResult`, etc.) ship with T-419.

### D9. Seven source-grounded provider class contracts

ADR-007 §D6 enumerated the seven source-grounded provider classes and reserved them as ADR-008 scope. Their interface bodies:

```ts
// Lands in @stageflip/asset-gen-contract (T-419).

export interface SlideDeckGenerationProvider extends ProviderBase<SlideDeckCapabilityDescriptor> {
  readonly modality: { kind: 'slide-deck-gen' };
  /** Generates a Document (a full canonical structure, not asset bytes). */
  generate(call: SlideDeckCall): Promise<{ document: Document; provenance: MediaProvenance }>;
}
export interface SlideDeckCapabilityDescriptor {
  readonly maxSlides: number;
  /** Themes / templates the provider can apply at generation time. */
  readonly templates: readonly string[];
}

export interface MindMapGenerationProvider extends ProviderBase<MindMapCapabilityDescriptor> {
  readonly modality: { kind: 'mind-map-gen' };
  /** Output shape consumed by the (deferred) MindMapClip runtime. */
  generate(call: MindMapCall): Promise<{ mindMap: MindMapTree; provenance: MediaProvenance }>;
}
export interface MindMapCapabilityDescriptor {
  readonly maxDepth: number;
  readonly maxNodes: number;
}

export interface TableGenerationProvider extends ProviderBase<TableCapabilityDescriptor> {
  readonly modality: { kind: 'table-gen' };
  /** Output shape populates an existing TableElement's content. */
  generate(call: TableCall): Promise<{ table: TableElement['content']; provenance: MediaProvenance }>;
}
export interface TableCapabilityDescriptor {
  readonly maxRows: number;
  readonly maxCols: number;
}

export interface QuizGenerationProvider extends ProviderBase<QuizCapabilityDescriptor> {
  readonly modality: { kind: 'quiz-gen' };
  /** Static (frozen) output that the static-fallback variant of LiveQuiz can render
   *  per ADR-005 §D2 / Phase 15 staticFallback contract. */
  generate(call: QuizCall): Promise<{ quiz: QuizClipProps; provenance: MediaProvenance }>;
}
export interface QuizCapabilityDescriptor {
  readonly maxQuestions: number;
  readonly questionTypes: readonly ('multiple-choice' | 'true-false' | 'short-answer')[];
}

export interface FlashcardGenerationProvider extends ProviderBase<FlashcardCapabilityDescriptor> {
  readonly modality: { kind: 'flashcard-gen' };
  generate(call: FlashcardCall): Promise<{ flashcards: FlashcardClipProps; provenance: MediaProvenance }>;
}
export interface FlashcardCapabilityDescriptor {
  readonly maxCards: number;
  readonly supportsImages: boolean;
}

export interface ReportGenerationProvider extends ProviderBase<ReportCapabilityDescriptor> {
  readonly modality: { kind: 'report-gen' };
  /** Output populates a TextElement (or several). */
  generate(call: ReportCall): Promise<{ text: TextElement['content']; provenance: MediaProvenance }>;
}
export interface ReportCapabilityDescriptor {
  readonly formats: readonly ('briefing-doc' | 'study-guide' | 'blog-post' | 'custom')[];
  readonly maxTokens: number;
}

export interface InfographicGenerationProvider extends ProviderBase<InfographicCapabilityDescriptor> {
  readonly modality: { kind: 'infographic-gen' };
  /** Output is image bytes — populates an ImageElement. Provenance.kind is 'image-gen'. */
  generate(call: InfographicCall): Promise<{ image: ImageElement['src']; provenance: MediaProvenance }>;
}
export interface InfographicCapabilityDescriptor {
  readonly aspectRatios: readonly string[];
  readonly outputFormats: readonly ('png' | 'svg')[];
  readonly maxResolutionPx: number;
}
```

**Notes on dependent surface area.** `MindMapTree` / `MindMapClipProps` / `QuizClipProps` / `FlashcardClipProps` are clip-prop shapes that do not yet exist on `main`; they ship alongside their respective clips (Phase 16 / Phase 14 γ scope per ADR-007 §D6). `Document`, `TableElement`, `TextElement`, `ImageElement` already exist (per `packages/schema/src/elements/`); the seven providers above plug into existing or shortly-arriving canonical shapes — no schema surface bloat from this ADR beyond the §D2 / §D3 additions.

**Source-grounded vs. creative.** Each of the seven can be implemented source-grounded (descriptor.sourceGrounded === true; receives `ResearchSessionRef` per §D7) OR creative (descriptor.sourceGrounded false; ignores any session). The same interface body works for both. The routing engine reads the descriptor flag (per ADR-007 §D7); the contract here imposes no constraint either way.

### D10. Determinism posture

Adapter packages and the asset-gen pipeline are **outside** the determinism perimeter (CLAUDE.md §3 covers `packages/frame-runtime/**`, `packages/runtimes/**/src/clips/**`, `packages/renderer-core/src/clips/**`). Adapters freely use `Date.now()`, `fetch()`, `setTimeout`, RNGs, network, and filesystem.

The cache-key derivation (§D1) **is** deterministic: identical inputs → identical hash. This is a property of the cache layer, not the adapter contract. Adapters MAY produce non-deterministic output for identical input (model-side seed instability); the cache layer treats the first response under a given key as canonical and serves it on subsequent identical calls — which is the user-visible determinism contract.

Source-grounded providers (§D7 wiring) carry the same posture: same source corpus + prompt may yield different summaries call-to-call; provenance (`researchSessionId` + `sourceIds`) is the audit trail, not a reproducibility contract.

### D11. Loss-flag inventory

This ADR adds the four `LF-RESEARCH-*` codes the source-grounded proposal §5 specified (after D9 demoted reconnect from a fifth code to a UI toast) and one `LF-VOICE-CONSENT-*` code per §D4. All land in `@stageflip/loss-flags` via T-419 (the `@stageflip/asset-gen-contract` task is the natural carrier; T-421 schema work depends on the codes existing).

| Code | Severity | Category | When emitted |
|---|---|---|---|
| `LF-RESEARCH-SESSION-LOST` | error | other | `pingSession() === 'revoked'` AND `reconnectSession()` failed |
| `LF-RESEARCH-SOURCE-UPLOAD-FAILED` | warn | media | One source in the manifest failed to upload during reconnect |
| `LF-RESEARCH-PROVIDER-RATE-LIMITED` | warn | other | Provider returned 429; tool retried-and-succeeded or fell through to creative tier |
| `LF-RESEARCH-CITATIONS-MISSING` | info | other | Generated asset's provenance lacks `sourceIds` despite session being present (provider didn't expose citations) |
| `LF-VOICE-CONSENT-MISSING` | error | media | TTS adapter pre-call check found no active `TenantVoiceConsentRow` for the requested cloned voice; call refused |
| `LF-VOICE-CONSENT-PROVENANCE-MISSING` | warn | media | Asset loaded references a cloned `voiceId` but `MediaProvenance.clonedFromConsent` is absent (corruption signal) |

Successful auto-reconnect (`pingSession() === 'expired'` → `reconnectSession()` succeeded → new sessionId persisted) is **not** a loss flag (per ADR-007 §D8 D9). The editor-shell notification channel surfaces it as a UI toast.

The reporter UI (T-248) consumes these as opaque `code` strings; no consumer changes are required to surface new codes (per the loss-flags package contract — `code: string`, not a closed union).

### D12. Plugin / adapter contribution surface (Phase 16 alignment)

ADR-007 §D12 ratified the manifest shape every plugin uses to declare seam contributions. ADR-008 adds the per-modality declaration shape generation adapters use:

```yaml
# Asset-gen specific extensions to the §D12 manifest from ADR-007.
contributes:
  - kind: tts-provider
    name: tts-fish-speech
    descriptor:
      sourceGrounded: false
      capability:
        voices: [...] # per §D5 TtsVoice list
        outputFormats: [wav, mp3]
        sampleRates: [16000, 24000, 44100]
        maxDurationS: 60
        emitsWordTimestamps: true
        supportsVoiceClone: true   # triggers §D4 consent enforcement
      license: apache-2.0
      sandbox: { sidecar: python }
      costPerCall: { unit: 'character', amount: 0.0001 }
      latencyMs: { p50: 800, p99: 2400 }

  - kind: video-generation-provider
    name: video-seedance
    descriptor:
      sourceGrounded: false
      capability:
        aspectRatios: ['16:9', '9:16', '1:1']
        frameRates: [24, 30]
        maxDurationS: 15
        outputFormats: [mp4]
        emitsAudio: true
        safetyFilters: ['no-faces', 'no-text']
      license: proprietary-byo
      sandbox: { remote-service: SEEDANCE_API_URL }
      costPerCall: { unit: 'second', amount: 0.10 }
      latencyMs: { p50: 30000, p99: 90000 }

  # Source-grounded variant from ADR-007 §D9 example (NotebookLM):
  - kind: report-generation-provider
    name: notebooklm-report
    requiresResearchProvider: notebooklm
    descriptor:
      sourceGrounded: true
      capability:
        formats: [briefing-doc, study-guide, blog-post, custom]
        maxTokens: 8192
      license: proprietary-byo
      sandbox: { remote-service: NOTEBOOKLM_BASE_URL }
```

Plugin ratification at install time validates: every `tts-provider` declaring `supportsVoiceClone: true` MUST be paired with a documented consent UX path (admin app surface that calls `tenantVoiceConsentStore.create`); the marketplace gate refuses adapters that declare voice-clone capability without naming a consent surface.

### D13. License posture per modality (preview of T-422)

`check-asset-licenses` (T-422) extends `pnpm check-licenses` with adapter-modality-aware rules. ADR-008 specifies the rules; T-422 enforces. Summary:

| Modality | Default-permissible | Default-refused | Tenant override |
|---|---|---|---|
| `tts` | `apache-2.0`, `mit`, `proprietary-byo` (with consent), `proprietary-vendored` | `gpl-incompatible` (always) | License posture per tenant (`features.licensePosture` per ADR-007 §D3); voice consent additionally per §D4 |
| `video-gen` | `apache-2.0`, `mit`, `proprietary-byo`, `proprietary-vendored` | `gpl-incompatible`, `cc-by-nc` (commercial generation) | Same as above |
| `music-gen` | `apache-2.0`, `mit`, `cc-by` (with attribution recorded in provenance), `proprietary-byo`, `proprietary-vendored` | `gpl-incompatible`, `cc-by-nc` | Tenants in entertainment vertical may admit `cc-by-nc`; routing engine refuses without explicit opt-in |
| `sfx` | `apache-2.0`, `mit`, `cc-by`, `proprietary-byo`, `proprietary-vendored` | `gpl-incompatible` | Same as music |
| `three-d` | `apache-2.0`, `mit`, `proprietary-byo`, `proprietary-vendored` | `gpl-incompatible` | None |
| `slide-deck-gen` / `mind-map-gen` / `table-gen` / `quiz-gen` / `flashcard-gen` / `report-gen` / `infographic-gen` | `apache-2.0`, `mit`, `proprietary-byo`, `proprietary-vendored` | `gpl-incompatible` | None |

**Why music + sfx allow `cc-by-nc` opt-in.** Some music-gen / sfx vendors emit non-commercially-licensed output by default; tenants doing internal-use-only content (educational, internal training) can validly use them. The opt-in is explicit per-tenant; the routing engine refuses without it.

---

## Out-of-scope decisions (deferred)

| Question | Punted to |
|---|---|
| `@stageflip/asset-gen-contract` package layout | T-419 |
| `@stageflip/asset-cache` package layout + eviction policy + cross-tenant cache sharing | T-420 |
| `MediaElement.provenance` schema implementation (Zod schema + element-base merge) | T-421 |
| `check-asset-licenses` per-vendor whitelist | T-422 |
| `tools/asset-generation/SKILL.md` semantic tools bundle | T-423 |
| Adapter catalog (`reference/asset-providers/SKILL.md`) | T-424 |
| Capability-routing engine algorithm | T-425 (already in ADR-007 out-of-scope; cited here for completeness) |
| TTS↔captions bypass-Whisper integration | T-436 |
| 3D↔ThreeSceneClip GLB consumer | T-437 |
| Per-modality usage telemetry | T-445 |
| Per-provider data-flow security audit | T-446 |
| `MindMapClip` + `FlashcardClip` runtime implementations (the schema shapes consumed by §D9 are reserved scope; the clip families themselves ship in Phase 14 γ / Phase 16 per ADR-007 §D6) | Phase 14 γ / Phase 16 |
| `tenantVoiceConsentStore` storage facet implementation (in-memory, Firestore, Postgres) | Triggered by T-427 (`@stageflip/tts-fish-speech`); in-memory ships first, Firebase/Postgres land via the existing storage-adapter pattern |
| Admin UI for declaring / revoking voice consent | Sibling task to T-411e (TenantSettings admin UI); not specced here. Surfaces the `TenantVoiceConsentStore` contract. |
| `SchemaVersion` bump for `Document.research?` + `MediaElement.provenance` | NOT REQUIRED — both fields are optional additions; existing documents parse unchanged. T-421's schema PR confirms with a roundtrip test. |
| Multi-provider research sessions per project | Future generalization (proposal §8 out-of-scope) |
| Session-bytes versioning for `replaceSource` snapshot semantics | Out-of-scope per ADR-007 §D8 D8 ratification (no NotebookLM-side bytes-versioning available) |

---

## Consequences

### Immediate (Phase 14 α dispatch unblock)

- **T-417** (`skills/stageflip/concepts/provider-seam/SKILL.md`) cites this ADR as primary citation for the asset-gen specifics (voice consent + provenance + cache key); ADR-007 covers the meta-pattern.
- **T-418** (`@stageflip/adapters-core`) implements the `ProviderBase<CapabilityDescriptor>` shape this ADR's per-modality contracts extend.
- **T-419** (`@stageflip/asset-gen-contract`) implements the seven source-grounded provider class bodies from §D9 + the five β modality contracts from §D5 / §D6 + the four `LF-RESEARCH-*` codes + the two `LF-VOICE-CONSENT-*` codes per §D11. Adds `Document.research?` slot + `ResearchSessionRef` per §D3.
- **T-420** (`@stageflip/asset-cache`) implements `computeAssetCacheKey` per §D1 + the storage layer.
- **T-421** (`MediaElement.provenance`) implements the Zod shape from §D2 against `imageElementSchema`, `videoElementSchema`, `audioElementSchema`, and the GLB-bearing wrappers; adds `provenance.test.ts` proving the schema additions are non-breaking.
- **T-422** (`check-asset-licenses`) enforces the §D13 per-modality license rules at CI time.

### Downstream (Phase 14 β + γ)

- All nine v1 reference adapters (T-426 → T-434) implement one of the per-modality contracts in §D5 / §D6.
- The two voice-clone-supporting adapters (T-427 `@stageflip/tts-fish-speech`; future Coqui XTTS adapter) trigger the consent-store storage facet (§D4); first impl in-memory, Firebase/Postgres follow via the storage-adapter pattern.
- T-436 (TTS→captions bypass-Whisper) consumes `TtsResult.wordTimestamps` (per §D5 `emitsWordTimestamps`).
- T-437 (3D→ThreeSceneClip GLB consumer) consumes `ThreeDResult` (GLB-only per §D6 `ThreeDCapabilityDescriptor`).
- T-438 (optimistic placeholder UX) consumes `MediaProvenance.cacheKey` to mint a placeholder element pointing at the eventual cached asset URL.
- T-439 / T-440 / T-441 (provenance-aware export) consume `MediaProvenance.kind` to mark AI-generated content per FTC + EU AI Act requirements; voice-clone exports MAY surface `clonedFromConsent.grantedAt`.

### Downstream (Phases 15, 16)

- Phase 15 LiveQuiz / LiveQA frozen-fallback variants consume `QuizGenerationProvider` (§D9) for offline-generated quiz content.
- Phase 16 NotebookLM plugin (proposal §7 Phase B / C) is the v1 implementor of every source-grounded interface in §D9; the seam supports it directly with no further ADR work.
- Phase 16 marketplace plugin ratification gate consumes the §D12 manifest validation rules (voice-clone adapters require declared consent UX surface).

### Ongoing

- New asset modality → expand the discriminated union in §D2 / §D5 / §D6 + add a per-modality `ProviderBase<…>` extension here.
- New voice-consent grant basis (e.g., `'community-pool'`) → expand `TenantVoiceConsentRow.grantBasis` in §D4 with an ADR amendment.
- New license posture for an asset modality (e.g., introducing `cc-by-sa` for a music generator that requires share-alike) → expand §D13 + bump T-422's whitelist.

### Risks

- **Provenance bloat.** `MediaProvenance` carries 11 optional fields. As more modalities land, the slot may need a discriminated-union refactor (e.g. `provenance: TtsProvenance | VideoProvenance | …`). For v1, the flat shape with `kind` discriminator is more ergonomic for cross-cutting consumers (export auto-marker, asset inspector); refactor if/when consumers actively branch on `kind`.
- **Voice consent UX gap.** The contract requires a per-call check; if the admin UI for declaring consent ships late (sibling task to T-411e), voice-clone adapters will be inert at runtime even though their bytes ship. Acceptable: feature-flag voice-clone capability per tenant via `TenantSettings` until the consent UX lands.
- **Cache-key model-name brittleness.** §D1 treats `model` as the determinism boundary. If a vendor silently rolls a model under the same name (a real risk with hosted services), the cache will return stale bytes. T-420 stamps `model` + a per-vendor `modelRevision` (when the vendor exposes one) into the asset metadata so a stale-cache audit can detect drift; the cache key itself does not include `modelRevision` because we want stable hashes across reasonable model upgrades.
- **`Document.research?` adoption surface.** Top-level optional field on `Document`. Hand-authored / imported decks default to absent; the editor must surface a clear "ground this project" affordance for the research path to be discoverable. T-419 ships the schema; UI surface is downstream.
- **Seven source-grounded provider classes are ambitious.** §D9 enumerates seven shapes; not all have concrete v1 implementors. The interfaces are still specified up-front per the proposal's foundational-on-day-one rationale; absent implementors, the routing engine simply has no candidate adapters for those modalities and returns the "no adapter available" path.

---

## Alternatives Considered

### A. Single `provenance` blob (string-typed JSON) instead of a strict discriminated shape

**Rejected.** A string-typed blob would defer schema discipline and force every consumer (export auto-marker, asset inspector, IAB compliance gate) to parse-and-hope. The discriminated-shape with optional fields is verifiable at TS-strict typecheck time and surfaces missing fields (e.g., voice-clone without consent reference) as type errors, not runtime corruption.

### B. Voice consent as an extension of `TenantSettings` instead of a dedicated storage facet

**Rejected per §D4.** Three concrete reasons: bloat per settings-read, awkward per-row revocation timestamps, audit-log emission by JSON-diff vs. row-insert. The dedicated `TenantVoiceConsentStore` facet matches the `TenantSettingsStore` carve-out pattern (T-411a) and keeps the consent data model clean.

### C. Per-modality `provenance` discriminated union (e.g., `provenance: TtsProvenance | VideoProvenance | …`) up-front

**Considered, deferred.** A flat shape with `kind` discriminator is more ergonomic for the v1 cross-cutting consumers (export auto-marker, asset inspector). When and if consumers actively branch on per-modality fields enough to make the flat shape painful, a discriminated-union refactor is mechanical. Listed as a §Risks item.

### D. Per-call voice-consent check is too strict; cache the consent at session start instead

**Rejected per §D4.** A revocation must take effect immediately. Caching consent at session start would create a window where revocation is honoured by the admin UI but not the runtime — which is the moral / legal failure the consent contract exists to prevent. The per-call check costs one in-memory `assertActive` lookup; the storage layer is responsible for keeping it fast (an indexed `(tenantId, voiceProvider, voiceId)` lookup).

### E. Source-grounded providers as a separate downstream ADR (post-Phase-14-α)

**Rejected per ADR-007 §D8 D8 + ADR-007 §"Alternatives Considered" C** (and the proposal preamble). Bolting source-grounded onto ADR-008 after it lands would force an ADR-008 rewrite. The proposal explicitly stated "the source-grounded concept is foundational enough that bolting it on as a later ADR would force ADR-007/008 to be rewritten." This ADR carries the absorption.

### F. Cache key derived from raw bytes of `(prompt + model + voice + params + seed)` without normalization

**Rejected per §D1.** Two callers issuing semantically-identical prompts that differ only in trailing whitespace would miss the cache and double-pay the provider. Normalization (trim + collapse whitespace + Unicode NFC) collapses the surface-form variation that does not affect output. Stable JSON for `params` does the same for object key-order.

### G. Single per-modality license whitelist (asset-license rules in T-422 are uniform across modalities)

**Rejected per §D13.** Music / sfx have a `cc-by-nc` opt-in story (entertainment / internal-only content) that other modalities don't share. Modality-aware rules are the smaller surface; uniform rules would refuse legitimate music-gen / sfx use cases.

---

## References

- `docs/decisions/ADR-007-provider-seam-pattern.md` — meta-pattern this ADR's per-modality contracts extend; §D5 (`ResearchSessionProvider` shape), §D6 (seven per-modality enumeration), §D8 (proposal D1–D9 ratifications), §D11 (loss-flag conventions), §D12 (plugin manifest), §D13 (asset-license rules cross-reference).
- `docs/proposals/source-grounded-providers.md` — folded source per §D2 / §D3 / §D7 / §D9 / §D11; archived after T-416 ships per its own §10 disposition.
- `docs/decisions/ADR-005-frontier-clip-catalogue.md` — `AiGenerativeClip` is playback-time generation; this ADR is authoring-time generation. The two are explicit complements per Phase 14 plan-row note.
- `docs/decisions/ADR-006-collab-crdt-transport.md` — preserved; not modified by this ADR (collision-resolved upstream by ADR-007 renumber).
- `packages/schema/src/document.ts` — receives the optional `research?: ResearchSessionRef` slot per §D3 (T-419 wiring).
- `packages/schema/src/elements/{image.ts,video.ts,audio.ts}` — receive the optional `provenance` slot per §D2 (T-421 wiring).
- `packages/storage/src/contract.ts` — `StorageAdapter` 3-method contract the new `tenantVoiceConsentStore` facet extends per §D4.
- `packages/loss-flags/src/types.ts` — receives the four `LF-RESEARCH-*` codes + two `LF-VOICE-CONSENT-*` codes per §D11 (string-typed `code`; no closed-union edit).
- `packages/captions/src/types.ts` — `TranscriptionProvider` (existing seam instance per ADR-007 §D9); T-436 wires `TtsResult.wordTimestamps` into this surface.
- `docs/implementation-plan.md` — Phase 14 α (T-415 → T-419), Phase 14 β (T-426 → T-435), Phase 14 γ (T-436 → T-444); v1.27 (this ADR's ship) records the merge.
- CLAUDE.md §3 (license whitelist invariant §D13 honors), §6 (escalation triggers — voice-consent grant-basis questions if the in-house counsel UX raises them), §10 (where things go — adapter packages slot under `packages/<modality>-<vendor>/`), §13 (structural-extension rule — N/A here, this is a docs-only ADR; the schema additions §D2 / §D3 land in T-419 / T-421 which DO bear the §13 obligation).

---

## Ratification Signoff

- [ ] Product owner — provenance schema + voice-consent policy ratified
- [ ] Product owner — source-grounded proposal absorption confirmed (full §2.2 / §2.3 / §2.4 / §5 fold)
- [ ] Engineering — T-419 (`@stageflip/asset-gen-contract`) shipped against this ADR; the seven source-grounded interface bodies + the five β modality contracts + the six new loss-flag codes
- [ ] Engineering — T-420 (`@stageflip/asset-cache`) ships `computeAssetCacheKey` per §D1 with property tests
- [ ] Engineering — T-421 (`MediaElement.provenance` schema) lands without breaking change (roundtrip test green)
- [ ] Engineering — T-422 (`check-asset-licenses`) enforces §D13 per-modality license rules
- [ ] Security — Voice consent enforcement verified end-to-end with the first voice-clone adapter (T-427 `@stageflip/tts-fish-speech`); revocation propagates immediately
