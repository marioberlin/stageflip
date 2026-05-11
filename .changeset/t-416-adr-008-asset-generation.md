---
---

T-416 — ADR-008 Asset Generation contract — Phase 14 α hard-gate #2.
docs ADR.

Defines the content-addressed cache key (SHA-256 over canonicalized
{modality, model, voice, prompt, params, seed}), the `MediaElement.provenance`
schema (with `researchSessionId` + `sourceIds` + `clonedFromConsent` slots),
the `Document.research?: ResearchSessionRef` slot, the voice-consent policy
(per-call check, tenant-admin-declared, dedicated `TenantVoiceConsentStore`
storage facet), the five β modality contracts (TTS, video-gen, music-gen,
SFX, 3D) extending `AdapterDescriptor`, the `ResearchSessionProvider`
asset-gen wiring, the seven source-grounded provider class bodies
(`SlideDeckGenerationProvider`, `MindMapGenerationProvider`,
`TableGenerationProvider`, `QuizGenerationProvider`,
`FlashcardGenerationProvider`, `ReportGenerationProvider`,
`InfographicGenerationProvider`), the four `LF-RESEARCH-*` codes + two
`LF-VOICE-CONSENT-*` codes, plugin manifest per-modality extensions, and
per-modality license-posture preview for T-422.

Folds in `docs/proposals/source-grounded-providers.md` Sections 2.2 / 2.3 /
2.4 / §5 — completing the absorption begun by ADR-007 (T-415, merged
2026-05-11). Proposal moves to `docs/proposals/archive/` in the same PR per
its own §10 disposition.

Together with ADR-007, clears the Phase 14 α hard gate. Downstream tasks
T-417 (concept SKILL), T-418 (`@stageflip/adapters-core`), T-419
(`@stageflip/asset-gen-contract`), T-420 (`@stageflip/asset-cache`), T-421
(`MediaElement.provenance` schema), T-422 (`check-asset-licenses`), T-423
(asset-generation tool bundle), T-424 (adapter catalog), T-425 (capability-
routing engine) can dispatch.

No code, package, fixture, parity-golden, or skill changes — pure docs.
No publishable package version bumps.
