---
title: Tools — Cluster D Compose Bundle
id: skills/stageflip/tools/cluster-d-compose
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-354
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Cluster D Compose Bundle

Cluster D (Titles) composer tools — preset-binding factories for title-sequence / segment-open / end-credits briefs across the 6 ratified Cluster D presets (T-354). Caller-required `presetId`: the cluster spans 6 typographically distinct prestige-TV registers and no semantic dispatch can collapse them.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/cluster-d-compose/`.

Registration: see `@stageflip/engine`'s `registerClusterDComposeBundle` (or equivalent) export.

## Tools

### `compose_title_sequence`

Compose a Cluster D (Titles) main title-sequence routing plan. Returns the caller-supplied `presetId` (one of the 6 ratified Cluster D registers — got-trajan-clockwork / severance-surreal-3d / squid-game-geometric / stranger-things-benguiat / succession-home-video / true-detective-double-exposure) plus opaque pass-through `props` carrying `title`, optional `subtitle`, optional `durationSeconds`, optional `accentColor`. Composer-transparent: omitted optional fields do NOT appear in the output `props` — the primitive's per-preset default flows through. Per cluster SKILL: typography carries emotional weight; the bespoke typeface signals the register, so the caller picks the preset (no auto-route).

- `presetId` (`string`) — enum: `got-trajan-clockwork` / `severance-surreal-3d` / `squid-game-geometric` / `stranger-things-benguiat` / `succession-home-video` / `true-detective-double-exposure`
- `title` (`string`) — Show / film / brand title (1–160 chars).
- `subtitle` (`string`) _(optional)_ — Optional subtitle / tagline (1–200 chars).
- `durationSeconds` (`number`) _(optional)_ — Optional sequence duration in seconds (max 300). When omitted, the preset default flows through.
- `accentColor` (`string`) _(optional)_ — Optional CSS hex color (e.g. #ff0033 or #f03) for the preset accent layer. When omitted, the preset default flows through.

### `compose_segment_open`

Compose a Cluster D (Titles) shorter-form segment-open / chapter-break routing plan. Returns the caller-supplied `presetId` (one of the 6 ratified Cluster D registers) plus opaque pass-through `props` carrying `segmentTitle`, optional `segmentNumber`, optional `durationSeconds`. Same caller-picks-preset posture as `compose_title_sequence` — not all 6 presets are typographically appropriate for short opens (e.g., got-trajan-clockwork's full clockwork scene is overkill for a 5-second chapter break), but the cluster compose contract leaves register selection to the caller. Composer-transparent: omitted optional fields do NOT appear in the output `props`.

- `presetId` (`string`) — enum: `got-trajan-clockwork` / `severance-surreal-3d` / `squid-game-geometric` / `stranger-things-benguiat` / `succession-home-video` / `true-detective-double-exposure`
- `segmentNumber` (`number`) _(optional)_ — Optional 1-based segment number (1..999). When omitted, the preset renders title-only.
- `segmentTitle` (`string`) — Segment / chapter title (1–160 chars).
- `durationSeconds` (`number`) _(optional)_ — Optional segment-open duration in seconds (max 120). When omitted, the preset default flows through.

### `compose_end_credits`

Compose a Cluster D (Titles) end-credits / cast-list routing plan. Returns the caller-supplied `presetId` (one of the 6 ratified Cluster D registers) plus opaque pass-through `props` carrying `credits` (1–64 `{ role, name }` entries) and optional `scrollSpeed` (slow / medium / fast). Composer-transparent: when caller omits `scrollSpeed`, the output `props` does NOT include the key, and the primitive's preset-matched default flows through.

- `presetId` (`string`) — enum: `got-trajan-clockwork` / `severance-surreal-3d` / `squid-game-geometric` / `stranger-things-benguiat` / `succession-home-video` / `true-detective-double-exposure`
- `credits` (`array`) — Credits roll entries: 1–64 `{ role: string (1–120 chars), name: string (1–160 chars) }`.
- `scrollSpeed` (`string`) _(optional)_ — enum: `slow` / `medium` / `fast` — Optional scroll-speed register. When omitted, the preset's matched default flows through.


## Invariants

- Every handler declares `bundle: 'cluster-d-compose'`.
- Tool count 3 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-354
