---
'@stageflip/asset-gen-contract': minor
---

T-419 — `@stageflip/asset-gen-contract` ships per-modality provider
interfaces + Zod capability schemas + capability validators per ADR-008
§D4–§D6 + §D9. Pure interface package; concrete adapters are T-426..T-434.

Surface (12 provider interfaces + 1 storage facet):

5 β modality contracts (§D5 + §D6) — each extends
`Omit<AdapterDescriptor, 'modality' | 'capability'>` from T-418 with a
narrowed `modality.kind` literal and a per-modality capability:

- `TTSProvider` — `voices`, `outputFormats`, `sampleRates`,
  `maxDurationS`, `emitsWordTimestamps`, `supportsVoiceClone`
  (activates §D4 voice-consent enforcement on cloned-voice calls).
- `VideoGenerationProvider` — `aspectRatios`, `frameRates`,
  `outputFormats`, `emitsAudio`, `safetyFilters`.
- `MusicGenerationProvider` — `genres`, `outputLicense` (`permissive` /
  `attribution-required` / `non-commercial`); drives T-422 enforcement.
- `SFXProvider` — `outputFormats`, `sampleRates`, `supportsLoop`.
- `ThreeDAssetProvider` — GLB-only output, `topology` (`quad-clean` /
  `triangle-soup` / `mixed`), `supportsAutoRigging`.

7 source-grounded provider class interfaces (§D9):

- `SlideDeckGenerationProvider` — generates a `Document`.
- `MindMapGenerationProvider` — generates `MindMapTree`.
- `TableGenerationProvider` — populates `TableElement.content`.
- `QuizGenerationProvider` — populates `QuizClipProps` (Phase 15
  staticFallback variant per ADR-005 §D2).
- `FlashcardGenerationProvider` — populates `FlashcardClipProps`.
- `ReportGenerationProvider` — populates `TextElement.content`.
- `InfographicGenerationProvider` — populates `ImageElement.src`.

`TenantVoiceConsentStore` facet (§D4):

- `get` / `listForTenant` / `assertActive` / `create` / `revoke`.
- `assertActive` throws on missing-or-revoked rows; per-call
  enforcement (no session caching per §D4 ratification D).
- Mirrors T-411a's `TenantSettingsStore` carve-out pattern; concrete
  adapter implementations downstream (triggered by T-427
  `@stageflip/tts-fish-speech`).

Each modality exports a `validateXxxCapability` function conforming to
T-418's `CapabilityValidator` type — wire at host boot via
`new CapabilityDescriptorParser(buildValidatorMap({ tts:
validateTtsCapability, ... }))`.

`MediaProvenance` + `ResearchSessionRef` are forward-declared in
`provenance-placeholder.ts` with `TODO(T-421)` cross-reference; the
shapes match ADR-008 §D2 / §D3 verbatim. T-421's PR will swap to
`@stageflip/schema` imports (one-line flip per file) and delete the
placeholder.

NOT a structural extension per CLAUDE.md §13 — adds a new contracts
package. Schema additions (Document.research, MediaProvenance) are
deferred to T-421 which bears the §13 obligation. Render verification
N/A.
