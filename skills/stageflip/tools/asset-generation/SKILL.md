---
title: Tools — Asset Generation Bundle
id: skills/stageflip/tools/asset-generation
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-423
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Asset Generation Bundle

Asset-generation tools — wraps the Phase 14 α Provider Seam (AdapterRegistry / LicenseGate / FallbackChainExecutor + AssetCache + MediaProvenance) so agents can generate audio / image / video assets with provenance + content-addressed cache keys (T-423).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/asset-generation/`.

Registration: see `@stageflip/engine`'s `registerAssetGenerationBundle` (or equivalent) export.

## Tools

### `generate_asset`

Generate a new media asset (audio / image / video) by dispatching through the Provider Seam (ADR-007 + ADR-008). Sealed `modality` enum (12 asset-producing modalities: tts / video-gen / music-gen / sfx / three-d / infographic-gen / slide-deck-gen / mind-map-gen / table-gen / quiz-gen / flashcard-gen / report-gen). Required `prompt` (1..16000 chars; normalized via NFC + trim + collapse + lowercase before hashing). Optional `model` / `voice` (TTS-only) / `params` / `seed` / `researchSessionId` (source-grounded). Required `target: { slideId, elementType: audio|image|video, transform, src: 'asset:<id>' }`. The bundle derives a content-addressed cache key per ADR-008 §D1, populates a strict `MediaProvenance` shape, and emits a JSON-Patch `add` op that mounts the element on the named slide with `provenance` populated. Returns `{ ok: true, slideId, elementId, cacheKey, provenance }` on success; typed `{ ok: false, reason }` on every failure path. Read soft-seam: when the executor has not wired the asset-generation context (`adapterRegistry` + `licenseGate` + `tenantContext` + `executeAdapterCall`), returns `{ ok: false, reason: 'asset_generation_unavailable' }` rather than throwing. v1 does not cache-hit short-circuit (T-435/T-436/T-437 land that); the optional cache store is written on success only.

- `modality` (`string`) — enum: `tts` / `video-gen` / `music-gen` / `sfx` / `three-d` / `slide-deck-gen` / `mind-map-gen` / `table-gen` / `quiz-gen` / `flashcard-gen` / `report-gen` / `infographic-gen`
- `prompt` (`string`)
- `model` (`string`) _(optional)_
- `voice` (`string`) _(optional)_
- `params` (`object`) _(optional)_
- `seed` (`number | string`) _(optional)_
- `researchSessionId` (`string`) _(optional)_
- `target` (`object`) — Mount target — `{ slideId, elementType: audio|image|video, transform, src: "asset:<id>" }`. The caller supplies `src` (the bundle does not own asset upload); the seam may overwrite it via cache-store side effects in a future task.

### `list_adapters`

Enumerate registered AdapterDescriptors via `@stageflip/adapters-core`'s AdapterRegistry. Optional `modality` (sealed enum from adapters-core) filter. Returns `{ ok: true, adapters: AdapterDescriptor[] }`; the empty list is returned (not an error) when no adapters match. Read soft-seam: when the executor has not wired `adapterRegistry`, returns `{ ok: false, reason: 'asset_generation_unavailable' }`. The descriptor shape carries id, modality, capability (opaque per-modality), license, sandbox, and optional cost / latency hints; per-modality call shapes live in `@stageflip/asset-gen-contract`.

- `modality` (`string`) _(optional)_ — enum: `tts` / `video-gen` / `music-gen` / `sfx` / `three-d` / `slide-deck-gen` / `mind-map-gen` / `table-gen` / `quiz-gen` / `flashcard-gen` / `report-gen` / `infographic-gen` / `research-session` / `audience-backend` / `bundle`

### `get_adapter_capabilities`

Look up a single AdapterDescriptor by `(modality, adapterId)` via the AdapterRegistry. Sealed `modality` enum (15 modalities from adapters-core). Required `adapterId` (kebab-case, 1..200 chars). Returns `{ ok: true, descriptor: AdapterDescriptor }` on hit; `{ ok: false, reason: 'not_found' }` on miss. Read soft-seam: when the executor has not wired `adapterRegistry`, returns `{ ok: false, reason: 'asset_generation_unavailable' }`. Use this to inspect a known adapter's capability shape (per-modality, opaque in the descriptor envelope) before calling generate_asset.

- `modality` (`string`) — enum: `tts` / `video-gen` / `music-gen` / `sfx` / `three-d` / `slide-deck-gen` / `mind-map-gen` / `table-gen` / `quiz-gen` / `flashcard-gen` / `report-gen` / `infographic-gen` / `research-session` / `audience-backend` / `bundle`
- `adapterId` (`string`)


## Invariants

- Every handler declares `bundle: 'asset-generation'`.
- Tool count 3 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-423
