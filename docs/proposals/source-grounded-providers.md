---
title: Source-grounded providers — extension to Provider Seam (ADR-006) + Asset Generation (ADR-007)
id: docs/proposals/source-grounded-providers
status: draft (proposal)
authors: orchestrator
created: 2026-04-26
target_adrs:
  - ADR-006 (T-415, not yet written)
  - ADR-007 (T-416, not yet written)
folds_into: Phase 14 α (T-415 / T-416 / T-417 / T-418 / T-419 / T-421)
related: ADR-003 (interactive runtime tier), ADR-005 (frontier clip catalogue)
---

# Source-grounded providers

> **Status — proposal**: this document drafts an extension to ADR-006 (Provider Seam Pattern) and ADR-007 (Asset Generation) **before either ADR is written**. When T-415 and T-416 dispatch (Phase 14 α hard gate), the Implementer should fold these extensions into both ADRs as integral concepts, not as a separate ADR.
>
> **Why a proposal vs. a separate ADR**: the source-grounded concept is foundational enough that bolting it on as ADR-008 after ADR-006/007 land would force ADR-006/007 to be rewritten. Better to land it as a first-class concept on day one.

## 1. The unlock

Phase 14's roster of generation providers (Kokoro, Fish Speech, Tripo, Meshy, Seedance, Runway, ACE-Step, YuE, Stable Audio Open) is **per-modality + prompt-driven**. Each call: one prompt → one asset. Cross-call consistency is the user's burden.

A second class of provider exists. **Source-grounded providers** (NotebookLM is the canonical example; future entrants might include Perplexity Pro, Claude Projects, Anthropic API with file uploads):

- Take a **notebook of sources** (PDFs / URLs / YouTube / Google Drive / pasted text / audio / video / images) up front.
- Produce **multiple internally-consistent artifacts** from the same source set across modalities (audio, video, slide deck, infographic, mind map, quiz, flashcards, report, data table).
- Carry **research-grade citations** — every generated asset can point back to the source paragraphs it draws from.

This is a fundamentally different value prop from "text-to-X creative generation". It does not displace the SOTA per-modality tier; it complements it.

## 2. What the extension adds

### 2.1 New capability descriptor flag (ADR-006)

Every provider's `AdapterDescriptor` (per the planned ADR-006 capability layer) gains:

```ts
export interface AdapterDescriptor {
  // ...existing fields (modality, license, latency, cost, etc.)
  sourceGrounded?: true;
  /** When sourceGrounded is true, names the session-provider this adapter requires. */
  requiresResearchProvider?: string;
}
```

The capability-routing engine (planned T-425) reads `sourceGrounded` to bias provider selection: when `Document.research` is populated, prefer source-grounded adapters; when empty, fall back to creative-tier adapters.

**Why a boolean flag + sibling field, not a discriminated union?** A more open shape (e.g., `grounding?: { kind: 'session'; provider: string } | { kind: 'per-call-context'; … }`) would accommodate future grounding kinds (fact-check-grounded, retrieval-grounded providers that ground per-call without a session). The boolean shape **deliberately defers** that generality: today, every known source-grounded provider in the StageFlip plan is session-scoped (NotebookLM, Perplexity Pro, Claude Projects). When a per-call-grounded provider lands, ADR-006 evolves the descriptor by **adding** a sibling field (e.g., `groundingMode?: 'per-call' | 'session'`) — additive, not breaking. See **D6** in §11 for the explicit ratification.

### 2.2 New meta-provider class: `ResearchSessionProvider` (ADR-007)

Distinct from the per-modality provider interfaces (`TTSProvider`, `VideoGenerationProvider`, etc.), this is a **session-scoped** provider that owns a notebook lifecycle:

```ts
export interface ResearchSessionProvider {
  readonly name: string;                       // 'notebooklm' | 'perplexity-pro' | …
  readonly capabilities: ResearchSourceKind[]; // which source kinds this provider accepts

  /**
   * Create a new research session, uploading the initial source set. Returns
   * a session reference that downstream per-modality adapter calls inherit.
   */
  createSession(sources: ResearchSource[], opts?: CreateSessionOptions): Promise<ResearchSessionRef>;

  /** Add a source to an existing session. */
  addSource(sessionId: string, source: ResearchSource): Promise<ResearchSource>;

  /**
   * Replace an existing source's bytes (provenance preserved).
   *
   * **In-flight call semantics**: generation calls that referenced
   * `providerSourceId` BEFORE `replaceSource` returned observe the
   * **post-replace bytes** (no snapshot). The asset's `MediaProvenance.sourceIds`
   * + `contentHash` records the bytes the provider actually consumed at
   * generation time, so the audit trail remains coherent. If consumers
   * need snapshot semantics, they should `addSource()` a new versioned
   * source and reference that instead. See §3.1 for refresh UX.
   */
  replaceSource(sessionId: string, providerSourceId: string, source: ResearchSource): Promise<ResearchSource>;

  /** Remove a source from the session. */
  removeSource(sessionId: string, providerSourceId: string): Promise<void>;

  /**
   * Verify the session is still alive on the provider side. Sessions can
   * expire / be revoked. Returns 'live' | 'expired' | 'revoked'.
   */
  pingSession(sessionId: string): Promise<'live' | 'expired' | 'revoked'>;

  /**
   * Reconnect to an expired session by re-uploading the persisted source
   * manifest. Returns a NEW sessionId; caller updates Document.research.
   */
  reconnectSession(sources: ResearchSource[]): Promise<ResearchSessionRef>;
}

export interface ResearchSource {
  name: string;
  kind: ResearchSourceKind;
  /** Provider-side id; opaque to consumers. */
  providerSourceId: string;
  /** ISO 8601 of the last upload. Powers "refresh source" UX. */
  lastModified: string;
  /** SHA-256 of the source bytes for change detection. */
  contentHash: string;
}

export type ResearchSourceKind =
  | 'pdf' | 'url' | 'youtube' | 'gdrive' | 'pasted'
  | 'audio' | 'video' | 'image';
```

### 2.3 Schema additions (folded into T-421's `MediaElement.provenance`)

The `MediaElement.provenance` field T-421 plans to add gets one extra slot:

```ts
export interface MediaProvenance {
  // ...existing T-421 fields (kind, provider, prompt, cacheKey, seed, …)

  /** When generated by a source-grounded provider, the session id it used. */
  researchSessionId?: string;
  /** Source ids the asset draws from (cited). */
  sourceIds?: string[];
}
```

Plus a new `Document.research` optional field:

```ts
export interface Document {
  // ...existing
  research?: ResearchSessionRef;
}

export interface ResearchSessionRef {
  /** Provider name registered on the adapter side. */
  provider: string;
  /** Provider-specific session id. */
  sessionId: string;
  /** User-visible source manifest (mirrors what the provider holds). */
  sources: ResearchSource[];
  /** ISO 8601. */
  createdAt: string;
}
```

### 2.4 New per-modality provider interfaces (ADR-007)

Phase 14's planned ADR-007 covers `VideoGenerationProvider`, `MusicGenerationProvider`, `ThreeDAssetProvider`, `TTSProvider`, `SFXProvider`. Source-grounded providers introduce artifacts those interfaces don't cover:

| Interface | Artifact | Notes |
|---|---|---|
| `SlideDeckGenerationProvider` | `Document` (PPTX-shaped) | Output is canonical structure, not asset bytes. New surface area. |
| `MindMapGenerationProvider` | `MindMapClipProps` | Hierarchical JSON consumed by a new `MindMapClip` runtime. |
| `TableGenerationProvider` | `TableElement` content | Populates from natural-language structure prompt. |
| `QuizGenerationProvider` | `QuizClipProps` | Overlaps Phase 15 LiveQuiz; static-fallback mode. |
| `FlashcardGenerationProvider` | `FlashcardClipProps` | Static or interactive (per ADR-003 tier). |
| `ReportGenerationProvider` | `TextElement` content | Briefing doc / study guide / blog post / custom. |
| `InfographicGenerationProvider` | `ImageElement` (PNG asset) | Specialization of image-gen for structured infographics. |

These can be source-grounded OR creative (a future Anthropic-Files API adapter could implement `ReportGenerationProvider` source-grounded; a future DALL-E-style adapter could implement `InfographicGenerationProvider` creative).

## 3. Behavioral semantics

### 3.1 Source refresh — option (a) ratified

**Decision**: `replaceSource(sessionId, providerSourceId, newSource)` updates the source in place on the provider side. Provenance preserved via `ResearchSource.contentHash` change. UX: "refresh source" button shows old hash → new hash.

Rationale: NotebookLM's model is single-source-per-id; versioning would require a wrapper layer that doesn't generalize across providers (Perplexity / Claude Projects may not version sources at all). Hash-based change detection is provider-agnostic.

Out of scope for v1: source versioning history. If a user wants "rollback" UX, they re-upload an earlier file as a new source.

### 3.2 Session lifetime — project lifetime ratified

**Decision**: the `ResearchSessionRef` lives as long as the project does. `Document.research.sessionId` persists in the document store; the plugin's `pingSession()` runs lazily on first generation call after a session-related event (load, restore from cloud, etc.).

When `pingSession()` returns `'expired'` or `'revoked'`:
1. Plugin auto-calls `reconnectSession(persistedSources)` to recreate the session from the manifest.
2. New `sessionId` writes back to `Document.research`.
3. User sees a one-time "reconnected your research session" toast.

Hard failure (provider unreachable, sources gone): emit `LF-RESEARCH-SESSION-LOST` flag (new code in `@stageflip/loss-flags`). Generation tools degrade to creative providers; user prompted to manually re-establish sources.

Rationale: tying session to project lifetime preserves the "set once at creation, benefits every step" UX. Tying it to e.g. browser-tab lifetime would force re-upload on every load — terrible.

### 3.3 Capability routing

When a generation tool fires:

```
1. Read Document.research → present? populated?
2. Look up registered providers for this modality.
3. Filter by capability descriptor:
   • If Document.research present: prefer providers where
     descriptor.sourceGrounded === true && descriptor.requiresResearchProvider === document.research.provider
   • If Document.research absent: pick by license/cost/latency from creative tier.
4. Run pingSession() if source-grounded provider selected; reconnect if needed.
5. Issue the modality call, passing the sessionId.
6. Tag the resulting asset's MediaProvenance with researchSessionId + sourceIds.
```

The capability-routing engine (T-425) implements this; the seam layer doesn't enumerate providers itself.

#### 3.3.1 Per-call grounding override

The above default ("if `Document.research` populated, prefer source-grounded") is overridable per generation tool call. AI copilot tools that take a `groundingOverride` parameter:

```ts
type GroundingOverride =
  | 'auto'             // default: routing engine decides per Document.research
  | 'force-grounded'   // require source-grounded provider; error if none available
  | 'force-creative';  // bypass source-grounded providers; use creative tier even when sources exist
```

Use cases for each:
- `'auto'` (default) — most calls; routing engine picks based on session state.
- `'force-grounded'` — user explicitly invokes "narrate using my sources" / "summarize my notebook"; failure (no source-grounded provider available) surfaces as an error.
- `'force-creative'` — "give me a stock photo for this slide, ignore my sources" / "generate background music unrelated to my research" — common when grounded outputs would be tonally wrong.

Tools advertise their default override behavior in their tool descriptor; the user-facing UI surfaces a toggle for the cases where users want to override the default. Implementation: agent tool router (T-154 family) reads the override and passes it to the routing engine.

A user can opt out of grounding mid-project:
- Project starts ungrounded. User adds sources later via the `ground_existing_project` AI tool. → `Document.research` populated; future generations grounded.
- Project starts grounded. User decides grounding isn't useful. → `Document.research` cleared. Existing assets keep their `provenance.researchSessionId` (audit trail), but new generations route to creative providers.

The schema field is independently optional; consumers must handle both states.

## 4. Plugin / adapter contribution model (Phase 16-aligned)

Plugins contribute to the seam through a manifest. NotebookLM serves as the worked example:

```yaml
# packages/plugins/notebooklm/plugin.yaml
name: notebooklm
version: 0.1.0
license: MIT
runtime: { language: python, install: "pip install notebooklm-py[browser]" }

contributes:
  # The session-scoped provider
  - kind: research-session-provider
    name: notebooklm
    capabilities: [pdf, url, youtube, gdrive, pasted, audio, video, image]

  # Per-modality adapters with sourceGrounded capability
  - kind: tts-provider
    requiresResearchProvider: notebooklm
    descriptor: { sourceGrounded: true, voices: [deep-dive, brief, critique, debate], lengths: [short, medium, long], languages: 50 }
  - kind: video-generation-provider
    requiresResearchProvider: notebooklm
    descriptor: { sourceGrounded: true, styles: [explainer, brief, cinematic, ...9] }
  - kind: image-generation-provider
    requiresResearchProvider: notebooklm
    descriptor: { sourceGrounded: true, orientations: [portrait, landscape, square], detailLevels: [low, mid, high] }
  - kind: slide-deck-generation-provider
    requiresResearchProvider: notebooklm
  - kind: mind-map-generation-provider
    requiresResearchProvider: notebooklm
  - kind: report-generation-provider
    requiresResearchProvider: notebooklm
    descriptor: { formats: [briefing-doc, study-guide, blog-post, custom] }

  # New clip families
  - kind: clip
    name: mind-map
    runtime: frame-runtime-bridge
  - kind: clip
    name: flashcard
    runtime: frame-runtime-bridge

  # AI copilot tools
  - kind: tool
    name: ground_existing_project
    requiresSession: false                  # creates the session
  - kind: tool
    name: generate_narration
    requiresSession: true
  - kind: tool
    name: add_mindmap_summary
    requiresSession: true
  - kind: tool
    name: regenerate_slide_with_sources
    requiresSession: true
  - kind: tool
    name: convert_section_to_video
    requiresSession: true
```

Plugin ratification requires explicit `requiresResearchProvider` on every source-grounded contribution — this is the linkage the routing engine consumes.

## 5. Loss-flag inventory

New `LossFlagCode`s in `@stageflip/loss-flags` (per session — the package owns the canonical type):

| Code | Severity | Category | When |
|---|---|---|---|
| `LF-RESEARCH-SESSION-LOST` | error | other | `pingSession() === 'revoked'` AND reconnect failed |
| `LF-RESEARCH-SOURCE-UPLOAD-FAILED` | warn | media | One source in the manifest failed to upload during reconnect |
| `LF-RESEARCH-PROVIDER-RATE-LIMITED` | warn | other | Provider returned 429; tool retried-and-succeeded or fell through to creative |
| `LF-RESEARCH-CITATIONS-MISSING` | info | other | Generated asset's provenance lacks `sourceIds` despite session being present (provider didn't expose citations) |

These surface in the existing loss-flag reporter UI (T-248, just shipped).

**Not a loss flag**: successful auto-reconnect (`pingSession() === 'expired'` → `reconnectSession()` succeeded → new `sessionId` persisted) is a **UI toast notification**, not a loss event. Surfaced via the editor-shell notification channel, not via the loss-flag reporter. Per **D9** in §11.

## 6. UX surfaces this enables

- **Project-creation dialog**: "Ground this project in source materials? (optional)" — file picker / URL input. Skip → standard empty deck.
- **Editor sidebar**: "Sources (12)" panel, drag-and-drop add, refresh icon per source, "remove source" with confirmation.
- **AI copilot bar**: every source-grounded tool advertises grounding state — `[grounded in your 12 sources]`.
- **Loss-flag reporter**: dedicated `Research` category alongside `Shape` / `Media` / `Theme`.
- **Asset inspector**: per-element panel shows `Provenance: generated by NotebookLM, draws from 3 sources [list]`.

## 7. v1 scope (3-phase rollout)

### Phase A: Foundation (lands inside Phase 14 α)

When T-415 (ADR-006) and T-416 (ADR-007) dispatch, fold this proposal in:
- `sourceGrounded` capability flag on `AdapterDescriptor`.
- `ResearchSessionProvider` meta-interface.
- 7 new per-modality provider interfaces.
- `Document.research` schema field (additive optional).
- `MediaProvenance.researchSessionId` + `.sourceIds` slots.
- Loss-flag inventory.

### Phase B: NotebookLM plugin (Phase 16-aligned, after Phase 14 α)

- `packages/plugins/notebooklm/` MVP — session provider + TTS adapter + video adapter.
- Onboarding dialog in `apps/stageflip-slide`.
- Reporter surface extension.
- AI copilot tools: `ground_existing_project`, `generate_narration`, `regenerate_slide_with_sources`.

### Phase C: NotebookLM plugin (full coverage)

- Add `slide-deck-generation-provider`, `mind-map-generation-provider`, `report-generation-provider` adapters.
- Add `image-generation-provider` (infographic) adapter.
- Add `MindMapClip` + `FlashcardClip` runtimes (independent of NBLM specifically; both clip families are generic).

## 8. Out of scope for the proposal

- **Cost / billing model** for source-grounded provider usage. Phase 12 territory (T-267 stripe billing).
- **Self-hosted research provider** (for users who can't depend on Google services). Future plugin contribution; the seam already supports it.
- **Source-licensing audit** before upload (e.g., DRM check, copyright check). User responsibility for v1; could land as a `pre-upload-validator` plugin contribution later.
- **Multi-provider research sessions** (e.g., NBLM for sources A-F, Perplexity for source G). v1 supports one provider per project; multi-provider is a future generalization.
- **Source-grounded interactive runtime clips** (LiveQuiz / LiveQA grounded in sources). Phase 15 territory; this proposal makes the seam ready but doesn't ship the integration.

## 9. Risks

1. **Vendor lock-in to undocumented APIs.** NotebookLM uses unofficial Google endpoints (per `notebooklm-py` README). Plugin must treat the underlying provider as a fallible upstream and degrade gracefully when endpoints break.
2. **Privacy / data residency.** User sources go to Google. Enterprise deployments may need an on-prem alternative. The seam supports it (any `ResearchSessionProvider` impl works); v1 does not ship one.
3. **Cost / latency.** Session creation + per-call generation may be slow / throttled. Capability descriptor exposes `latencyMs` + `costPerCall` so the routing engine can pick wisely.
4. **Provenance vs. privacy.** Citing source paragraphs in generated content may surface confidential data. Reporter UI should let users opt out of provenance display per export profile.
5. **Schema bloat.** `Document.research` adds a top-level optional field. Defensible because it gates a fundamentally different generation pattern; future research-related fields slot under it cleanly.

## 10. Action items when this proposal lands inside ADR-006/007

When T-415 / T-416 dispatch:
1. Implementer reads this proposal and folds Sections 2.1–2.3 into ADR-006 (capability descriptor + linkage) and Sections 2.2 + 2.4 into ADR-007 (provider interfaces + provenance).
2. Section 5 (loss-flag inventory) lands in `@stageflip/loss-flags` as part of the relevant Phase 14 task.
3. Section 4 (plugin manifest) becomes part of the plugin-contribution skill (`skills/stageflip/concepts/plugins/SKILL.md`, if not already covered).
4. Section 7 Phase A goes into the Phase 14 α task list; Phase B/C land as Phase 16 tasks once Phase 14 α merges.
5. This proposal file moves to `docs/proposals/archive/source-grounded-providers.md` (or deleted) once fully absorbed.

## 11. Decisions ratified by Orchestrator

These design choices are explicitly resolved here so ADR-006/007 don't need to re-litigate:

| # | Choice | Decision | Rationale |
|---|---|---|---|
| D1 | Source refresh model | **Replace in place + content-hash provenance** (option a) | Provider-agnostic; works across NBLM/Perplexity/Claude Projects. Versioning history is out-of-scope; users re-upload as new source if needed. |
| D2 | Session lifetime | **Project lifetime** | Set-once-at-creation UX is the unlock. Tab-lifetime forces re-upload; not acceptable. |
| D3 | Optional grounding | **Schema field is independently optional; routing engine handles both states** | Graceful upgrade path: ungrounded project can be grounded later via `ground_existing_project` tool. |
| D4 | Multi-provider per project | **One provider per project for v1** | Multi-provider routing within a single project is a future generalization; not v1 complexity. |
| D5 | Plugin contribution model | **Per-modality adapter declares `requiresResearchProvider`** | Linkage explicit at manifest time; routing engine doesn't have to infer relationships. |
| D6 | Capability descriptor shape | **Boolean `sourceGrounded` + sibling `requiresResearchProvider` field** (NOT a discriminated `grounding: { kind, provider }` union) | Today's source-grounded providers are all session-scoped (NBLM, Perplexity Pro, Claude Projects). When a per-call-grounded provider lands (e.g., fact-check or retrieval-grounded), ADR-006 evolves the descriptor by **adding** a sibling field (`groundingMode?: 'session' \| 'per-call'`) — additive, not breaking. Defers generality to when a real second case exists. |
| D7 | Per-call grounding override | **`groundingOverride: 'auto' \| 'force-grounded' \| 'force-creative'` parameter on every generation tool** | Default `'auto'` lets routing engine decide; users can force either tier per-call. See §3.3.1. |
| D8 | `replaceSource` in-flight semantics | **Post-replace bytes; provenance records actual bytes consumed** (no snapshot) | Snapshot semantics would require provider-side bytes-versioning that NBLM doesn't expose. Provenance's `contentHash` records what was actually consumed. Consumers needing snapshot use `addSource()` with a versioned name. |
| D9 | `LF-RESEARCH-SESSION-RECONNECTED` taxonomy | **Demoted from loss flag to UI toast notification** | Successful auto-reconnect is a notice, not a loss. Loss-flag inventory in §5 drops to 4 codes; toast surfaced via existing notification channel in editor-shell. |
