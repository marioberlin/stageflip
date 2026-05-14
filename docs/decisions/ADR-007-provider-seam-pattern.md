# ADR-007: Provider Seam Pattern (meta)

**Date**: 2026-05-11
**Ratified**: 2026-05-14 (orchestrator approval; post-Phase-16 close)
**Status**: **Accepted**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

Phase 14 (Asset Generation), Phase 15 (Live Audience), and Phase 16 (Bundles & Marketplace) all extend the StageFlip engine through **adapter contracts** rather than first-class hard-coded subsystems. Each new asset modality (TTS, video-gen, music-gen, 3D, SFX), each audience-engagement backend (native, Slido, Mentimeter, Poll Everywhere, Vevox, Wooclap), and each future capability we cannot foresee must plug into the platform without core changes.

This is not a new pattern in the codebase. Three existing seams already implement the same shape:

1. `@stageflip/runtimes/contract` — the `RuntimeContract` / `ClipDefinition` interface every runtime plugin (css, gsap, lottie, shader, three, blender, frame-runtime-bridge) implements; consumed by `findClip(kind)` in `renderer-core` (ADR-003).
2. `TranscriptionProvider` — the captions-package seam at `packages/captions/src/types.ts` that the OpenAI Whisper SDK and test mocks both plug into.
3. `@stageflip/storage` — the 3-method `StorageAdapter` contract at `packages/storage/src/contract.ts` (snapshot / update / patch); concrete adapters (in-memory, Firebase, Postgres) follow the same interface. T-411a's `TenantSettingsStore` is the latest facet of the same shape.

What is new for Phase 14+ is **scale and breadth**. We now need:

- A uniform `AdapterDescriptor` shape so the agent's tool router can pick adapters by capability (modality, latency, cost, license posture, sandbox model).
- A license-aware routing layer so per-tenant license postures (apache-2.0-only / proprietary-byo / no-network) deterministically gate adapter selection.
- A sandbox model so third-party adapter code runs with bounded credential / network / filesystem scope.
- A **session-scoped** provider class — the `ResearchSessionProvider` meta-interface from `docs/proposals/source-grounded-providers.md` — distinct from per-call providers because session-grounded providers (NotebookLM canonical; Perplexity Pro / Claude Projects fit the same shape) own a notebook lifecycle that downstream per-modality calls inherit.
- Seven new per-modality provider classes that source-grounded providers can implement (slide-deck, mind-map, table, quiz, flashcard, report, infographic generation), distinct from the five Phase 14 β modalities (video, music, 3D, TTS, SFX) and reserved as separate downstream consumer ADRs.

This ADR is **meta** — it does not enumerate every adapter contract. It defines the descriptor shape, the routing rules, the sandbox model, and the rules every modality-specific contract ADR (ADR-008 asset generation; ADR-009/010 live audience; ADR-012/013/014 marketplace) must follow.

The proposal `docs/proposals/source-grounded-providers.md` (PR #197, ratified 2026-04-26 with 9 design decisions D1–D9) explicitly stated its decisions must fold into this ADR on day one — not as a separate ADR-N+1 — because the source-grounded concept is foundational enough that bolting it on later would force this ADR to be rewritten. This ADR carries that absorption.

### Renumber note

The implementation plan called this ADR-006 (plan v1.22 row T-415). `docs/decisions/ADR-006-collab-crdt-transport.md` already exists (ratified 2026-04-27 via T-260, prior to T-415 dispatch). Renumbered to ADR-007. T-416 (asset-gen contract) becomes ADR-008. T-450/T-451 (Phase 15 α) become ADR-009/ADR-010. T-490/T-491/T-492 (Phase 16 α) become ADR-012/ADR-013/ADR-014 (preserving the existing ADR-006-collab gap-free numbering downstream). The plan's v1.25 changelog records the renumbering. The existing `ADR-006-collab-crdt-transport.md` is untouched.

---

## Decisions

### D1. The `AdapterDescriptor` shape

Every adapter that participates in the Provider Seam — across asset generation, live audience, marketplace bundles — exposes a static `AdapterDescriptor`. This is the single object the routing layer reads to decide whether to instantiate the adapter for a given call.

```ts
// Conceptual shape — exact field types land in @stageflip/adapters-core (T-418).
export interface AdapterDescriptor {
  /** Adapter id. Globally unique across the registry. Kebab-case. */
  readonly id: string;

  /** What this adapter does. Discriminated union; expanded per consumer ADR. */
  readonly modality: AdapterModality;

  /**
   * Capability descriptor — modality-specific shape with a uniform envelope.
   * Asset-gen: { sampleRate?, outputFormat[], maxDurationS?, voices?, styles?, ... }
   * Audience: { backend, maxConcurrentVoters, persistenceTier, ... }
   * Bundle: { contentKinds[], packFormat, ... }
   */
  readonly capability: CapabilityDescriptor;

  /**
   * License posture this adapter ships under. Routing layer filters per
   * tenant policy (e.g., 'apache-2.0-only' tenants reject 'proprietary').
   */
  readonly license: AdapterLicensePosture;

  /**
   * Sandbox model — declares the runtime isolation level the adapter needs.
   * Routing layer refuses to instantiate an adapter whose declared model is
   * stronger than the host environment can grant. See D5.
   */
  readonly sandbox: SandboxModel;

  /**
   * Cost + latency hints for the routing engine. Adapter authors document
   * a representative call; routing engine uses these to rank candidates
   * when multiple adapters satisfy the capability filter.
   */
  readonly costPerCall?: CostHint;
  readonly latencyMs?: LatencyHint;

  /**
   * **From source-grounded-providers proposal §2.1 (D6)**.
   * Declares whether this adapter accepts a research-session-scoped source
   * corpus. When `true` AND `requiresResearchProvider` is set, the adapter
   * MUST receive a paired `ResearchSessionRef` at call time; otherwise the
   * routing layer falls through to creative-tier adapters.
   */
  readonly sourceGrounded?: boolean;

  /**
   * **From source-grounded-providers proposal §2.1 (D5)**.
   * When set, names the `ResearchSessionProvider` this adapter is paired
   * with at manifest time. The capability-routing engine (T-425) uses this
   * to link a per-modality call to its session. Linkage is explicit at
   * manifest time — the routing engine does not infer relationships.
   */
  readonly requiresResearchProvider?: string;
}

export type AdapterModality =
  // Phase 14 β modalities (asset generation):
  | { kind: 'tts' }
  | { kind: 'video-gen' }
  | { kind: 'music-gen' }
  | { kind: 'sfx' }
  | { kind: 'three-d' }
  // Phase 14 source-grounded modalities (per §2.4 of proposal):
  | { kind: 'slide-deck-gen' }
  | { kind: 'mind-map-gen' }
  | { kind: 'table-gen' }
  | { kind: 'quiz-gen' }
  | { kind: 'flashcard-gen' }
  | { kind: 'report-gen' }
  | { kind: 'infographic-gen' }
  // Source-grounded session provider:
  | { kind: 'research-session' }
  // Phase 15 modalities (live audience):
  | { kind: 'audience-backend' }
  // Phase 16 modalities (marketplace):
  | { kind: 'bundle' };

export type AdapterLicensePosture =
  | { kind: 'apache-2.0' }
  | { kind: 'mit' }
  | { kind: 'proprietary-byo' } // Bring-your-own credential; tenant-paid.
  | { kind: 'proprietary-vendored' } // Vendored by us; license fee in pricing.
  | { kind: 'cc-by' }
  | { kind: 'gpl-incompatible' }; // Refused by default in the routing layer.
```

**Why a uniform descriptor**: the routing engine must be modality-agnostic. Three different shapes (one per phase) would force three different routers. One descriptor with discriminated `modality` union lets a single router handle every phase.

**Why `capability` is opaque**: capability is modality-specific (TTS has voices, video-gen has resolution, audience-backend has voter caps). A single typed shape would force every consumer ADR to widen / churn this ADR. The opaque envelope is safe because the routing layer only filters on `modality + license + sandbox + sourceGrounded`; capability is consumed downstream by the modality-specific tool layer.

### D2. Modality-specific contracts are downstream ADRs

This ADR does **not** define the per-modality call shapes. Each modality gets its own contract ADR + interface package:

| Phase | ADR | Interface package | Modalities covered |
|---|---|---|---|
| 14 | ADR-008 (T-416) | `@stageflip/asset-gen-contract` (T-419) | `TTSProvider`, `VideoGenerationProvider`, `MusicGenerationProvider`, `SFXProvider`, `ThreeDAssetProvider` |
| 14 | ADR-008 (T-416) — same ADR | `@stageflip/asset-gen-contract` (T-419) — same package | `SlideDeckGenerationProvider`, `MindMapGenerationProvider`, `TableGenerationProvider`, `QuizGenerationProvider`, `FlashcardGenerationProvider`, `ReportGenerationProvider`, `InfographicGenerationProvider`, `ResearchSessionProvider` (per §D7 below) |
| 15 | ADR-009 (T-450) | `@stageflip/audience-contract` (T-452) | `AudienceBackendProvider` |
| 15 | ADR-010 (T-451) | (clip family — not provider-pattern; cross-link only) | — |
| 16 | ADR-012 (T-490) | `@stageflip/bundle-contract` (TBD task) | `BundleProvider`, `LicenseProvider` |
| 16 | ADR-013 (T-491) | (catalogue — not provider-pattern; cross-link only) | — |
| 16 | ADR-014 (T-492) | (registry — infra; cross-link only) | — |

**Rule**: every consumer-ADR-introduced provider interface MUST extend `AdapterDescriptor` for its `descriptor` static / `id` discovery; the per-call shape is the consumer ADR's freedom.

### D3. License-aware routing

The routing layer (T-425) filters adapters by tenant license posture **before** capability ranking:

```
1. Read tenant policy: features.licensePosture: 'apache-2.0-only' | 'permissive-only' |
   'permit-byo' | 'permit-vendored' | 'permit-all'.
2. Filter registry: keep adapters whose descriptor.license is admissible under policy.
3. Filter by modality + capability (modality-specific filter logic per consumer ADR).
4. Filter by descriptor.sourceGrounded if Document.research is populated (per D7).
5. Rank by costPerCall × latencyMs heuristic; return top-N with explanation.
```

**Refusal modes**:
- `gpl-incompatible` is **never** admissible regardless of policy. Keeps StageFlip's whitelist invariant intact (CLAUDE.md §3 / `pnpm check-licenses`).
- `proprietary-byo` requires tenant credential present; routing layer surfaces a `LF-ADAPTER-CREDENTIAL-MISSING` loss flag and falls through.

**Where the policy lives**: `TenantSettings.features.licensePosture` (extends T-411a's `TenantSettingsStore` via the same 3-method contract; no new storage facet needed).

### D4. Sandbox model

Adapters declare their isolation needs:

```ts
export type SandboxModel =
  | { kind: 'in-process' }                           // Trusted: ships in our packages.
  | { kind: 'sidecar'; runtime: 'node' | 'python' }  // Subprocess; same host.
  | { kind: 'remote-service'; baseUrlEnvVar: string } // HTTP service; tenant-configured.
  | { kind: 'wasm-sandbox' };                         // Untrusted code; capability-restricted runtime.
```

The host environment declares which sandbox kinds it supports. Browser-only hosts (the editor preview) admit only `in-process`. Server hosts (the renderer-cdp pipeline; the asset-gen worker) admit all four. The routing layer refuses adapters whose declared sandbox exceeds host capability and surfaces `LF-ADAPTER-SANDBOX-UNAVAILABLE`.

**Why declarative**: third-party adapters (Phase 16 marketplace) cannot be trusted to run in-process. The sandbox declaration is the contract a marketplace adapter signs at manifest time; deviation at runtime is a manifest violation and the adapter is unloaded.

**Out of scope here**: the WASM sandbox runtime itself. T-444 implements; this ADR specifies the shape only.

### D5. The `ResearchSessionProvider` meta-interface

Source-grounded providers (NotebookLM canonical; Perplexity Pro and Claude Projects fit) are session-scoped, multi-modal, and own a notebook lifecycle that downstream per-modality calls inherit. This is structurally different from per-call providers — it is its own meta-interface, distinct from the per-modality providers in §D2.

Per the proposal §2.2:

```ts
export interface ResearchSessionProvider {
  readonly name: string;                       // 'notebooklm' | 'perplexity-pro' | …
  readonly capabilities: ResearchSourceKind[];

  /** Create a new research session. Returns a session reference downstream
   *  per-modality calls inherit. */
  createSession(sources: ResearchSource[], opts?: CreateSessionOptions): Promise<ResearchSessionRef>;

  addSource(sessionId: string, source: ResearchSource): Promise<ResearchSource>;

  /** Replace bytes in place; provenance preserved via contentHash. See §D8. */
  replaceSource(sessionId: string, providerSourceId: string, source: ResearchSource): Promise<ResearchSource>;

  removeSource(sessionId: string, providerSourceId: string): Promise<void>;

  /** Verify session liveness; provider sessions can expire / be revoked. */
  pingSession(sessionId: string): Promise<'live' | 'expired' | 'revoked'>;

  /** Reconnect to an expired session by re-uploading the persisted manifest.
   *  Returns a NEW sessionId; caller updates Document.research. */
  reconnectSession(sources: ResearchSource[]): Promise<ResearchSessionRef>;

  /** Close + free server-side resources. */
  closeSession(sessionId: string): Promise<void>;
}

export type ResearchSourceKind =
  | 'pdf' | 'url' | 'youtube' | 'gdrive' | 'pasted'
  | 'audio' | 'video' | 'image';

export interface ResearchSource {
  readonly name: string;
  readonly kind: ResearchSourceKind;
  /** Provider-side id; opaque to consumers. */
  readonly providerSourceId: string;
  /** ISO 8601 of last upload. Powers "refresh source" UX. */
  readonly lastModified: string;
  /** SHA-256 of the source bytes for change detection. */
  readonly contentHash: string;
}
```

The `Document` schema gains an optional `research?: ResearchSessionRef` field, persisted with the document so a reload re-binds to the live session via `pingSession()` / `reconnectSession()`. Per-modality adapter calls that fire while `Document.research` is populated and the call's adapter declares `requiresResearchProvider === document.research.provider` receive the `ResearchSessionRef` at call time. `MediaProvenance` (per ADR-008 / T-421) gains optional `researchSessionId` + `sourceIds[]` slots so generated assets carry a citation trail back to the source paragraphs they draw from.

**Schema additions land in ADR-008 (T-416)**, not here. This ADR specifies the meta-interface shape and the descriptor flags (`sourceGrounded` + `requiresResearchProvider`); ADR-008 wires it into the asset-gen pipeline + `MediaElement.provenance`.

### D6. The seven per-modality source-grounded provider classes

The proposal §2.4 enumerates seven per-modality provider classes that source-grounded providers can implement. They are **preserved scope** — each lands as a separate downstream interface in `@stageflip/asset-gen-contract` (T-419), and each gets its own consumer ADR section / row in ADR-008:

| Interface | Artifact | Notes |
|---|---|---|
| `SlideDeckGenerationProvider` | `Document` (PPTX-shaped) | Output is canonical structure, not asset bytes. New surface area in ADR-008. |
| `MindMapGenerationProvider` | `MindMapClipProps` | Hierarchical JSON consumed by a new `MindMapClip` (Phase 16 / 14 γ scope). |
| `TableGenerationProvider` | `TableElement` content | Populates from natural-language structure prompt. |
| `QuizGenerationProvider` | `QuizClipProps` | Overlaps Phase 15 LiveQuiz; the static-fallback variant. |
| `FlashcardGenerationProvider` | `FlashcardClipProps` | Static or interactive (per ADR-003 tier). |
| `ReportGenerationProvider` | `TextElement` content | Briefing doc / study guide / blog post / custom. |
| `InfographicGenerationProvider` | `ImageElement` (PNG asset) | Specialization of image-gen for structured infographics. |

These can be source-grounded OR creative — the routing layer reads `descriptor.sourceGrounded` to decide. A future Anthropic-Files API adapter could implement `ReportGenerationProvider` source-grounded; a future DALL-E-style adapter could implement `InfographicGenerationProvider` creative.

### D7. Source-grounded routing rules

When a generation tool fires, the routing layer applies the following — this is the per-call decision tree the proposal §3.3 ratified:

```
1. Read Document.research → present? populated?
2. Look up registered adapters for this modality from §D2 registry.
3. Filter by capability descriptor:
   • If Document.research present: prefer adapters where
     descriptor.sourceGrounded === true && descriptor.requiresResearchProvider === document.research.provider
   • If Document.research absent: pick by license/cost/latency from creative tier.
4. If a source-grounded adapter is selected: run pingSession() + reconnect if needed (per D5).
5. Issue the modality call, passing the sessionId.
6. Tag the resulting asset's MediaProvenance with researchSessionId + sourceIds (ADR-008 wiring).
```

A per-call `groundingOverride: 'auto' | 'force-grounded' | 'force-creative'` parameter (proposal §3.3.1 / D7) overrides the default. The default `'auto'` is the rule above. `'force-grounded'` fails with an error if no source-grounded adapter is available for the modality. `'force-creative'` bypasses source-grounded providers even when sources exist.

### D8. Decisions ratified from the source-grounded proposal

The following decisions are imported verbatim from `docs/proposals/source-grounded-providers.md` §11. They are **load-bearing** for ADR-007 / ADR-008 implementation; the proposal documents fuller rationale.

| # | Choice | Decision (this ADR) |
|---|---|---|
| D1 (proposal) | Source refresh model | **Replace in place + content-hash provenance.** `replaceSource()` updates bytes on the provider side; `ResearchSource.contentHash` change records the swap. Versioning history is out of scope. |
| D2 (proposal) | Session lifetime | **Project lifetime.** `Document.research.sessionId` persists; provider auto-pings + reconnects on load. Tab-lifetime would force re-upload on every reload. |
| D3 (proposal) | Optional grounding | **Schema field independently optional; routing engine handles both states.** Project can be ungrounded at creation, grounded later via the `ground_existing_project` tool. |
| D4 (proposal) | Multi-provider per project | **One research provider per project for v1.** Multi-provider routing within a single project is a future generalization. |
| D5 (proposal) | Plugin contribution model | **Per-modality adapter declares `requiresResearchProvider` at manifest time.** Routing engine does not infer relationships. (Maps to `AdapterDescriptor.requiresResearchProvider` in §D1 above.) |
| D6 (proposal) | Capability descriptor shape | **Boolean `sourceGrounded` + sibling `requiresResearchProvider`.** NOT a discriminated `grounding: { kind, provider }` union. When per-call grounding lands (e.g., fact-check or retrieval-grounded providers), this ADR evolves additively by adding a sibling `groundingMode?: 'session' \| 'per-call'` field. |
| D7 (proposal) | Per-call grounding override | **`groundingOverride: 'auto' \| 'force-grounded' \| 'force-creative'`** parameter on every generation tool. Default `'auto'`. |
| D8 (proposal) | `replaceSource` in-flight semantics | **Post-replace bytes; provenance records actual bytes consumed (no snapshot semantics).** Snapshot would require provider-side bytes-versioning that NotebookLM does not expose. Consumers needing snapshot use `addSource()` with a versioned name. |
| D9 (proposal) | `LF-RESEARCH-SESSION-RECONNECTED` taxonomy | **Demoted from loss flag to UI toast notification.** Successful auto-reconnect is a notice, not a loss. Loss-flag inventory in ADR-008 §LossFlags drops to 4 codes; toast surfaces via the editor-shell notification channel. |

### D9. Pattern instances already in the wild (canonical examples)

Per plan v1.22 § "Provider Seam Pattern (ADR-007) is the meta-ADR codifying the adapter pattern across all of P14, P15, P16, retroactively cross-referencing the existing ... seams as canonical examples", this ADR retroactively names the three existing instances:

| Instance | Location | Discriminator |
|---|---|---|
| `RuntimeContract` / `ClipDefinition` | `packages/runtimes/contract/src/index.ts` | `RuntimeTier = 'live' \| 'bake'` |
| `TranscriptionProvider` | `packages/captions/src/types.ts` | `provider.id` |
| `StorageAdapter` (`StorageAdapter`, `TenantSettingsStore`) | `packages/storage/src/contract.ts`, `packages/storage/src/tenant-settings-store.ts` | `kind: 'in-memory' \| 'firebase' \| 'postgres'` |

These instances do not (yet) expose an `AdapterDescriptor` — they predate this ADR. Conformance retrofit is **not required**; they continue working as-is. New adapters across P14/P15/P16 use the descriptor; if existing instances later need routing-layer participation, they wrap into a descriptor in a follow-up task. ADR-007 is not a refactor mandate.

### D10. Determinism posture

Adapter code is **not** in the determinism perimeter (CLAUDE.md §3 covers `packages/frame-runtime/**`, `packages/runtimes/**/src/clips/**`, `packages/renderer-core/src/clips/**`). Adapters live in their own packages (`@stageflip/tts-kokoro`, `@stageflip/audience-slido`, etc.) and freely use `Date.now()`, `fetch()`, `setTimeout`, RNGs, network, filesystem, etc.

The cache-key derivation (per ADR-008 / T-420) **is** deterministic — `sha256(prompt + model + voice + params + seed)`. This is a property of the cache layer, not the adapter; the adapter contract does not require deterministic outputs at all (a TTS call with the same prompt + seed produces the same audio because the model is deterministic, not because the contract enforces it).

Source-grounded providers similarly do not promise determinism; the same source corpus + prompt may produce different summaries across calls. Provenance (`researchSessionId` + `sourceIds`) is the audit trail, not a reproducibility contract.

### D11. Loss-flag conventions

Adapter-related loss flags follow the existing `@stageflip/loss-flags` package (T-247-loss-flags). New `LF-ADAPTER-*` codes for cross-cutting failures land here; modality-specific codes (`LF-RESEARCH-*`, `LF-PPTX-EXPORT-*`, etc.) live in their consumer ADR. The four `LF-RESEARCH-*` codes from proposal §5 (after D9 demoted the fifth) land in ADR-008.

| Code | Severity | Where defined |
|---|---|---|
| `LF-ADAPTER-CREDENTIAL-MISSING` | warn | This ADR / T-418 (`@stageflip/adapters-core`) |
| `LF-ADAPTER-SANDBOX-UNAVAILABLE` | warn | This ADR / T-418 |
| `LF-ADAPTER-RATE-LIMITED` | warn | This ADR / T-418 |
| `LF-ADAPTER-LICENSE-REJECTED` | error | This ADR / T-418 |
| `LF-RESEARCH-SESSION-LOST` | error | ADR-008 / T-419 |
| `LF-RESEARCH-SOURCE-UPLOAD-FAILED` | warn | ADR-008 / T-419 |
| `LF-RESEARCH-PROVIDER-RATE-LIMITED` | warn | ADR-008 / T-419 |
| `LF-RESEARCH-CITATIONS-MISSING` | info | ADR-008 / T-419 |

The reporter UI (T-248) consumes these as opaque `code` strings; no consumer changes are required to surface new codes.

### D12. Plugin contribution model (Phase 16 alignment)

Phase 16 packs declare seam contributions in their `plugin.yaml` manifest. The shape is documented in proposal §4 with NotebookLM as the worked example; this ADR ratifies the manifest structure as part of the seam contract:

```yaml
contributes:
  - kind: research-session-provider | tts-provider | video-generation-provider | ...
    name: <unique adapter id>
    requiresResearchProvider: <name>?   # only for source-grounded contributions
    descriptor:
      sourceGrounded: true|false
      capability: { ...modality-specific shape }
      license: apache-2.0 | mit | proprietary-byo | proprietary-vendored | cc-by
      sandbox: in-process | { sidecar: node|python } | { remote-service: ENV_VAR } | wasm-sandbox
      costPerCall: ...
      latencyMs: ...
```

Plugin ratification (Phase 16 marketplace gate) requires explicit `requiresResearchProvider` on every source-grounded contribution — the routing engine consumes this linkage; without it, the contribution is rejected at install time.

---

## Out-of-scope decisions (deferred)

| Question | Punted to |
|---|---|
| Per-modality call shapes for asset generation | ADR-008 (T-416) |
| `MediaElement.provenance` schema | ADR-008 (T-416) / T-421 |
| `@stageflip/adapters-core` package layout | T-418 |
| `@stageflip/asset-gen-contract` package layout | ADR-008 / T-419 |
| Capability-routing engine algorithm + ranking heuristic | T-425 |
| WASM sandbox runtime implementation | T-444 |
| Per-modality license whitelist | T-422 (`check-asset-licenses`) |
| Audience-backend contract shape | ADR-009 (T-450) |
| Live audience clip family + `AudienceProvenance` schema | ADR-010 (T-451) |
| Bundle / license-runtime contract | ADR-012 (T-490) |
| First-party pack pricing tiers | ADR-013 (T-491) |
| Marketplace registry decision | ADR-014 (T-492) |
| Multi-provider research sessions per project | Future generalization (proposal §8 out-of-scope) |
| Self-hosted research provider | Future plugin contribution; the seam already supports it (proposal §8) |
| Per-call grounded providers (fact-check / retrieval-grounded) | Future ADR amendment via additive `groundingMode` field per D8 (proposal D6) |

---

## Consequences

### Immediate (Phase 14 α dispatch unblock)

- **T-417** (concept SKILL `skills/stageflip/concepts/provider-seam/SKILL.md`) consumes this ADR as its primary citation.
- **T-418** (`@stageflip/adapters-core`) implements `AdapterDescriptor`, the registry, the capability-descriptor parser, license-gate hooks, and the fallback-chain executor against this ADR's shape.
- **T-419** (`@stageflip/asset-gen-contract`) gates on **ADR-008** (T-416) for the per-modality interfaces (`TTSProvider`, `VideoGenerationProvider`, etc.) AND for the seven source-grounded interfaces (`SlideDeckGenerationProvider`, ...) AND for the `ResearchSessionProvider` meta-interface — all per §D5 / §D6 above. ADR-008 absorbs these; this ADR provides the descriptor + routing rules they fold into.
- **T-425** (capability-routing engine) implements §D3 + §D7 against this descriptor.
- **T-444** (sandbox model) implements §D4.

### Downstream (Phases 15, 16)

- ADR-009/010 (Phase 15 α) cite this ADR for the `AudienceBackendProvider` descriptor envelope.
- ADR-012/013/014 (Phase 16 α) cite this ADR for plugin-contribution manifests + license-runtime gating.
- All third-party adapter contributions (Phase 16 marketplace) declare against this descriptor shape. Sandbox model (D4) is the contract that gates third-party code admission.

### Ongoing

- New adapter modality → expand `AdapterModality` discriminated union in this ADR + add a consumer ADR for the per-call shape.
- New license posture → expand `AdapterLicensePosture` here + update tenant-policy enum (T-411a / future task).
- New sandbox kind → expand `SandboxModel` + ADR amendment with host-capability table.

### Risks

- **Descriptor surface bloat.** Each consumer ADR will want to extend `capability` for its modality. This ADR keeps `capability` opaque to the routing layer to absorb that growth without churn.
- **Routing-layer correctness.** §D7 source-grounded routing is the most complex piece. T-425 must ship with property tests across a representative adapter mix; routing bugs surface as "wrong adapter selected" which is hard to diagnose post-hoc.
- **Sandbox enforcement.** Declarative sandbox declarations are only as strong as the host's enforcement. T-444 must implement actual isolation; declared `wasm-sandbox` running in `in-process` is a security regression.
- **Source-grounded vendor lock-in.** NotebookLM uses unofficial Google endpoints. Plugin (Phase 16 / T-419 consumer) treats the upstream as fallible; falls through to creative providers per `LF-RESEARCH-SESSION-LOST`.

---

## Alternatives Considered

### A. Per-phase descriptor (one descriptor type per phase)

**Rejected.** Three descriptors would force three routing engines, three license-gate implementations, and three sandbox-model definitions. The point of the meta-ADR is uniformity across phases; descriptor reuse is its core value.

### B. Discriminated `grounding: { kind, provider }` union instead of boolean `sourceGrounded` + sibling `requiresResearchProvider`

**Rejected per proposal D6.** Today every source-grounded provider in the StageFlip plan is session-scoped. The boolean shape defers generality; per-call grounding (when it lands) extends the descriptor additively via a sibling `groundingMode?: 'session' \| 'per-call'` field. Discriminated union now would over-fit; additive evolution is non-breaking.

### C. Source-grounded providers as a separate ADR (ADR-008 in original numbering)

**Rejected per proposal preamble.** Bolting source-grounded onto ADR-007 / ADR-008 after both land would force their rewrite. The proposal explicitly states: "the source-grounded concept is foundational enough that bolting it on as a later ADR would force ADR-007/008 to be rewritten. Better to land it as a first-class concept on day one." This ADR carries that absorption.

### D. Conformance retrofit of the three existing seam instances

**Rejected per D9.** `RuntimeContract`, `TranscriptionProvider`, `StorageAdapter` predate this ADR and continue to work as-is. Forcing retrofit would expand T-415's scope from a docs ADR to a multi-package code change; deferred to per-instance follow-ups when (and if) routing-layer participation becomes valuable for them. ADR-007 is a forward-looking contract for new adapters; not a refactor mandate.

### E. License posture as a flat string field instead of discriminated union

**Rejected.** Flat strings make license-policy evaluation a parse step at every routing call. Discriminated union lets the routing engine pattern-match exhaustively at TS-strict typecheck time — license-policy bugs surface as TS errors, not as runtime "we accepted a GPL adapter" incidents.

---

## References

- `docs/proposals/source-grounded-providers.md` — folded source per §11 D1–D9; this ADR is the absorbing target.
- `docs/implementation-plan.md` — Phase 14 α (T-415 → T-419), Phase 14 β (T-426 → T-435), Phase 14 γ (T-436 → T-444), Phase 15 α (T-450 → T-460), Phase 16 α (T-490 → T-492). Plan v1.25 records the ADR renumbering.
- `docs/decisions/ADR-003-interactive-runtime-tier.md` — `RuntimeContract` shape (existing seam instance per §D9).
- `docs/decisions/ADR-005-frontier-clip-catalogue.md` — frontier clip taxonomy; `AiGenerativeClip` is playback-time, distinct from this ADR's authoring-time generation per Phase 14 plan-row note.
- `docs/decisions/ADR-006-collab-crdt-transport.md` — preserved; not modified by this ADR (collision-resolved via renumber to 007).
- `packages/runtimes/contract/src/index.ts` — `RuntimeContract` / `ClipDefinition` (existing seam instance).
- `packages/captions/src/types.ts` — `TranscriptionProvider` (existing seam instance).
- `packages/storage/src/contract.ts` — `StorageAdapter` (existing seam instance).
- `packages/storage/src/tenant-settings-store.ts` — `TenantSettingsStore` (latest seam facet, T-411a).
- CLAUDE.md §3 (license whitelist enforcement; `gpl-incompatible` refusal).
- CLAUDE.md §10 (where things go — adapter packages slot under `packages/<modality>-<vendor>/`).

---

## Ratification Signoff

- [ ] Product owner — meta-pattern + descriptor shape ratified
- [ ] Product owner — source-grounded proposal absorption confirmed (D8 D1–D9 verbatim)
- [ ] Engineering — T-417 concept SKILL + T-418 `@stageflip/adapters-core` shipped against this ADR
- [ ] Engineering — T-425 capability-routing engine ships with property-test coverage of §D3 + §D7
- [ ] Security — T-444 sandbox model implementation complete (gates Phase 16 marketplace third-party admission)
