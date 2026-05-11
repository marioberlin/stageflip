---
title: Provider Seam Pattern
id: skills/stageflip/concepts/provider-seam
tier: concept
status: substantive
last_updated: 2026-05-11
owner_task: T-417
related:
  - skills/stageflip/concepts/storage-contract/SKILL.md
  - skills/stageflip/concepts/tenant-settings/SKILL.md
  - skills/stageflip/concepts/captions/SKILL.md
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/runtimes/contract/SKILL.md
---

# Provider Seam Pattern

The provider seam is the shape every adapter contract in StageFlip
follows: a small interface package defines the contract, concrete
backends implement it, higher layers bind to the contract (never the
backend). Phase 14 (Asset Generation), Phase 15 (Live Audience), and
Phase 16 (Bundles & Marketplace) all extend the engine through this
pattern rather than first-class hard-coded subsystems. ADR-007
("Provider Seam Pattern", meta) is the codifying ADR; ADR-008 ("Asset
Generation Contract") is the first downstream consumer.

This SKILL is the human-and-agent-readable summary. The ADRs are the
source of truth.

## Where it applies

Four canonical instances on `main` today. The first three predate
ADR-007 — they are retroactively named as canonical examples per
ADR-007 §D9 and continue working as-is. The fourth (`adapters-core`) is
the first instance built against the descriptor envelope and lands via
T-418.

| Instance | Package | Contract | Discriminator | Status |
|---|---|---|---|---|
| `RuntimeContract` / `ClipDefinition` | `packages/runtimes/contract` | `runtimes/contract/SKILL.md` | `RuntimeTier = 'live' \| 'bake'` | Shipped (Phase 4) |
| `TranscriptionProvider` | `packages/captions` | `concepts/captions/SKILL.md` | `provider.id` | Shipped (T-184) |
| `StorageAdapter` | `packages/storage` | `concepts/storage-contract/SKILL.md` | `kind: 'in-memory' \| 'firebase' \| 'postgres'` | Shipped (T-025 / T-270) |
| `TenantSettingsStore` | `packages/storage` (facet) | `concepts/tenant-settings/SKILL.md` | `kind` (sibling facet of `StorageAdapter`) | Shipped (T-411a) |
| `@stageflip/adapters-core` | `packages/adapters-core` | this SKILL + ADR-007 | `AdapterModality` | **Upcoming — T-418, not yet on `main`** |

The pattern itself is not new for StageFlip. What is new for Phase 14+
is the **uniform descriptor envelope** (`AdapterDescriptor`) so the
agent's tool router can pick adapters by capability across modalities,
and the **license-aware routing layer** that filters per tenant policy
before capability ranking.

## The `AdapterDescriptor` envelope (ADR-007 §D1)

Every new adapter participating in the Phase 14+ provider seam exposes
a static `AdapterDescriptor`. This is the single object the routing
layer reads to decide whether to instantiate the adapter for a given
call. Conceptual shape (exact field types land in `@stageflip/adapters-core` via T-418):

| Field | Purpose |
|---|---|
| `id: string` | Globally unique kebab-case adapter id. |
| `modality: AdapterModality` | Discriminated union — `'tts' \| 'video-gen' \| 'music-gen' \| 'sfx' \| 'three-d' \| 'slide-deck-gen' \| 'mind-map-gen' \| 'table-gen' \| 'quiz-gen' \| 'flashcard-gen' \| 'report-gen' \| 'infographic-gen' \| 'research-session' \| 'audience-backend' \| 'bundle'`. |
| `capability: CapabilityDescriptor` | Opaque envelope; modality-specific shape consumed downstream (e.g. TTS has `voices[]`, video-gen has `aspectRatios[]`). |
| `license: AdapterLicensePosture` | Discriminated union — `'apache-2.0' \| 'mit' \| 'cc-by' \| 'proprietary-byo' \| 'proprietary-vendored' \| 'gpl-incompatible'`. `gpl-incompatible` is refused unconditionally (CLAUDE.md §3 whitelist invariant). |
| `sandbox: SandboxModel` | Discriminated union — `'in-process' \| { sidecar: 'node' \| 'python' } \| { remote-service: ENV_VAR } \| 'wasm-sandbox'`. Routing layer refuses adapters whose declared sandbox exceeds host capability. |
| `costPerCall?: CostHint` | Routing hint for ranking when multiple adapters satisfy the capability filter. |
| `latencyMs?: LatencyHint` | Sibling routing hint. |
| `sourceGrounded?: boolean` | When `true` AND a `ResearchSessionProvider` is paired, this adapter receives a session reference at call time. |
| `requiresResearchProvider?: string` | Names the `ResearchSessionProvider` this adapter is paired with at manifest time. Routing layer does not infer relationships. |

The envelope is uniform; per-modality call shapes live in downstream
contract packages (`@stageflip/asset-gen-contract`,
`@stageflip/audience-contract`, `@stageflip/bundle-contract`). See
ADR-007 §D1 for the full shape and rationale; §D2 for the modality →
downstream-ADR mapping.

## Asset-gen extensions (ADR-008)

ADR-008 is the first downstream consumer ADR. It folds the
session-grounded providers proposal in full and adds three pieces on
top of ADR-007's envelope:

### Content-addressed cache key (§D1)

Every generated asset is stored under a deterministic SHA-256 key:

```
sha256(canonical({ modality, model, voice, prompt, params, seed }))
```

Inputs are canonicalised first (sorted JSON for `params`, trim + collapse
whitespace + NFC for `prompt`, `model:voice` concatenation, base-10
seed). Two callers issuing identical normalised input hit the same key —
the cache short-circuits before any provider call. `provider` is
deliberately NOT in the key (the model name is the determinism boundary,
not the provider id); `seed` IS in the key (when omitted, renders as
`"none"` so the cache still has a stable key). T-420 implements.

### `MediaProvenance` schema slot (§D2)

`ImageElement`, `VideoElement`, `AudioElement`, and the GLB-bearing
wrappers gain an optional `provenance` slot recording how the asset was
produced:

```ts
interface MediaProvenance {
  readonly kind: 'tts' | 'video-gen' | 'music-gen' | 'sfx'
              | 'three-d' | 'image-gen' | 'imported';
  readonly provider?: string;          // AdapterDescriptor.id
  readonly model?: string;
  readonly prompt?: string;            // post-normalization (matches §D1)
  readonly cacheKey?: string;
  readonly seed?: number;
  readonly voiceProvider?: string;     // TTS-specific
  readonly voiceId?: string;           // TTS-specific
  readonly clonedFromConsent?: TenantVoiceConsentRef; // REQUIRED for cloned voices
  readonly researchSessionId?: string; // when produced under Document.research
  readonly sourceIds?: readonly string[]; // provider citation list
}
```

Optional (hand-authored / imported assets carry no provenance), strict
(known fields only — `exactOptionalPropertyTypes`). T-421 implements
the Zod shape against `imageElementSchema`, `videoElementSchema`,
`audioElementSchema`, and the `ThreeSceneClip` / `BlenderClip` GLB
wrappers.

### Voice consent (§D4)

Voice-clone TTS adapters that synthesize from a model trained on a real
human's voice MUST refuse to generate without a per-tenant
`TenantVoiceConsentRow`. The consent rows live in a **dedicated**
`TenantVoiceConsentStore` storage facet (NOT a `TenantSettings`
extension — same carve-out reasoning as T-411a's `TenantSettingsStore`:
append-mostly, audit-load-bearing, per-row revocation timestamps).

Check is **per-call**, not per-session: a revocation must take effect
immediately. Library voices (provider-distributed pre-trained voices)
bypass the check via a static `TtsCapabilityDescriptor` flag.

### `Document.research?` + `ResearchSessionProvider` wiring (§D3 + §D7)

The document schema gains an optional `research?: ResearchSessionRef`
field that binds the document to a session-scoped source corpus
(NotebookLM is the canonical implementor; Perplexity Pro / Claude
Projects fit the same shape).

`ResearchSessionProvider` is a **session-scoped** meta-interface
(distinct from per-call providers) that owns the notebook lifecycle:
`createSession` / `addSource` / `replaceSource` / `removeSource` /
`pingSession` / `reconnectSession` / `closeSession`. When a generation
tool fires against a grounded document, the routing engine picks an
adapter where `descriptor.sourceGrounded === true` AND
`descriptor.requiresResearchProvider === document.research.provider`,
pings the session, reconnects if expired, threads the `sessionId` into
the per-modality call, and stamps the resulting asset's
`MediaProvenance.{researchSessionId, sourceIds}`.

## Routing posture (ADR-007 §D3 + §D7)

The capability-routing engine (T-425) applies filters in order:

1. **License filter.** Read `TenantSettings.features.licensePosture`;
   reject adapters whose `descriptor.license` is not admissible under
   tenant policy. `gpl-incompatible` is refused unconditionally;
   `proprietary-byo` requires tenant credential present.
2. **Modality filter.** Keep adapters matching the requested modality.
3. **Sandbox filter.** Reject adapters whose declared sandbox exceeds
   host capability (browser-only hosts admit only `in-process`).
4. **Source-grounded preference.** If `Document.research` is populated,
   prefer adapters whose `descriptor.sourceGrounded === true` AND
   `descriptor.requiresResearchProvider === document.research.provider`;
   else fall through to the creative tier.
5. **Cost / latency rank.** Surface top-N candidates with explanation.

A per-call `groundingOverride: 'auto' | 'force-grounded' | 'force-creative'`
parameter (ADR-007 §D7 / proposal D7) overrides step 4. Default
`'auto'` follows the rule above.

## How to add a new seam

A "new seam" is a new adapter contract whose backends are
interchangeable. The pattern:

1. **Define the contract.** A new package or facet exposing the
   interface. Keep zero concrete backend code in the contract package
   — types + the registry only. (See `packages/runtimes/contract` and
   `packages/storage/src/contract.ts` for shape.)
2. **Implement a reference adapter.** One concrete backend, usually
   `in-memory` or a dev-grade variant. Ship its tests against the
   contract's round-trip / null-on-absent / payload-validation
   surface.
3. **Wire the contract into consumers.** Higher layers bind to the
   contract, never the backend. Construction-time injection at the
   host shell; consumers receive the interface.
4. **Register with the meta-registry** (when the new seam plugs into
   the ADR-007 descriptor envelope). Add an `AdapterDescriptor` static
   on the implementation; register the adapter into
   `@stageflip/adapters-core` (T-418) so the routing engine can pick
   it. **NOT required** for the four existing instances — they predate
   the descriptor and continue working as-is per ADR-007 §D9.
5. **Add a concept SKILL pointer here.** Update this SKILL's "Where it
   applies" table and the consumer's own concept SKILL (e.g.,
   `concepts/storage-contract/SKILL.md` for storage facets).
6. **Add a consumer ADR if it crosses package boundaries.** A new
   modality (e.g., an `EmbeddingProvider` for vector search) gets its
   own ADR-NNN documenting the per-modality call shape; ADR-007's
   descriptor envelope is the parent.

The four existing instances followed exactly this shape pre-ADR-007.
The descriptor envelope is the unification, not a refactor mandate.

## Determinism posture

Adapter code is **outside** the determinism perimeter. CLAUDE.md §3
covers `packages/frame-runtime/**`, `packages/runtimes/**/src/clips/**`,
and `packages/renderer-core/src/clips/**`. Adapter packages live at
`packages/<modality>-<vendor>/` (e.g. `packages/tts-kokoro`,
`packages/audience-slido`) and freely use `Date.now()`, `fetch()`,
`setTimeout`, RNGs, network, filesystem.

The cache-key derivation (ADR-008 §D1) IS deterministic — identical
inputs → identical hash — but this is a property of the cache layer,
not the adapter contract. Adapters MAY produce non-deterministic
output for identical input; the cache layer treats the first response
under a given key as canonical and serves it on subsequent identical
calls, which is the user-visible determinism contract.

Source-grounded providers carry the same posture: same source corpus
+ prompt may yield different summaries call-to-call; provenance
(`researchSessionId` + `sourceIds`) is the audit trail, not a
reproducibility contract.

## Conformance retrofit (ADR-007 §D9)

The four existing seam instances on `main` (`RuntimeContract`,
`TranscriptionProvider`, `StorageAdapter`, `TenantSettingsStore`) do
**not** expose `AdapterDescriptor` — they predate the descriptor
envelope. **Retrofit is not required.** They continue working as-is;
new adapters across Phase 14 / Phase 15 / Phase 16 use the descriptor.
If an existing instance later needs routing-layer participation
(license filtering, capability ranking, sandbox declaration), it
wraps into a descriptor in a follow-up task — ADR-007 is forward-
looking, not a refactor mandate.

This is deliberate. Expanding T-415's scope from a docs ADR to a
multi-package code change would have delayed every Phase 14 α task;
the four instances are stable, their consumers are stable, and the
cost of retrofit exceeds the value until a concrete routing-layer
participant case appears.

## Loss flags

Adapter-related loss flags follow the existing `@stageflip/loss-flags`
package. Cross-cutting codes (`LF-ADAPTER-CREDENTIAL-MISSING`,
`LF-ADAPTER-SANDBOX-UNAVAILABLE`, `LF-ADAPTER-RATE-LIMITED`,
`LF-ADAPTER-LICENSE-REJECTED`) land via T-418. Modality-specific codes
live in their consumer ADR (e.g. `LF-RESEARCH-SESSION-LOST`,
`LF-RESEARCH-SOURCE-UPLOAD-FAILED`, `LF-RESEARCH-PROVIDER-RATE-LIMITED`,
`LF-RESEARCH-CITATIONS-MISSING`, `LF-VOICE-CONSENT-MISSING`,
`LF-VOICE-CONSENT-PROVENANCE-MISSING` — all from ADR-008 §D11; T-419
implements).

Successful auto-reconnect after a session expiry is **not** a loss
flag (per ADR-007 §D8 D9 ratification). The editor-shell notification
channel surfaces it as a UI toast.

## Plugin contribution model (Phase 16 alignment)

Phase 16 marketplace packs declare seam contributions in their
`plugin.yaml` manifest. The shape is ratified by ADR-007 §D12:

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

Plugin ratification (the marketplace install-time gate) requires
explicit `requiresResearchProvider` on every source-grounded
contribution; ADR-008 adds the rule that voice-clone-supporting TTS
contributions MUST be paired with a documented consent UX path.

## Related

- ADRs: `docs/decisions/ADR-007-provider-seam-pattern.md` (meta-pattern);
  `docs/decisions/ADR-008-asset-generation.md` (first consumer ADR —
  asset-gen specifics: cache key, provenance, voice consent,
  source-grounded wiring).
- Existing seam instances on `main`:
  - `packages/runtimes/contract/src/index.ts` — `RuntimeContract` /
    `ClipDefinition` (canonical example per ADR-007 §D9).
  - `packages/captions/src/providers/` — `TranscriptionProvider`.
  - `packages/storage/src/contract.ts` — `StorageAdapter` (3-tier
    snapshot / update / patch contract).
  - `packages/storage/src/tenant-settings-store.ts` —
    `TenantSettingsStore` (T-411a; latest seam facet).
- Concept SKILLs: `concepts/runtimes/SKILL.md`,
  `concepts/captions/SKILL.md`, `concepts/storage-contract/SKILL.md`,
  `concepts/tenant-settings/SKILL.md`,
  `runtimes/contract/SKILL.md`.
- Downstream Phase 14 α tasks (consumers of this meta-pattern):
  T-418 (`@stageflip/adapters-core` — `AdapterDescriptor` registry,
  capability-descriptor parser, license-gate hooks, fallback-chain
  executor); T-419 (`@stageflip/asset-gen-contract` — the per-modality
  interface bodies); T-420 (`@stageflip/asset-cache` —
  `computeAssetCacheKey`); T-421 (`MediaElement.provenance` schema);
  T-422 (`check-asset-licenses` CI gate); T-423
  (`tools/asset-generation` semantic-tools bundle); T-424
  (`reference/asset-providers` adapter catalog); T-425 (capability-
  routing engine).
- Downstream Phase 15 α / Phase 16 α: ADR-009 / ADR-010 (Phase 15 α —
  `AudienceBackendProvider`); ADR-012 / ADR-013 / ADR-014 (Phase 16 α
  — bundle / marketplace / pack catalogue).
- CLAUDE.md §3 (determinism perimeter the seam respects — adapters are
  outside it; clip code is inside); §10 (where things go — adapter
  packages slot under `packages/<modality>-<vendor>/`); §13
  (structural-extension rule — this SKILL is NOT a structural
  extension).
