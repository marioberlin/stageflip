---
title: Tools — Cluster H Compose Bundle
id: skills/stageflip/tools/cluster-h-compose
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-379
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Cluster H Compose Bundle

Cluster H (AR overlays) composer tools — preset-binding factories for AR overlay / VAR skeletal / swim-lane track briefs across the 4 ratified Cluster H presets (T-379).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/cluster-h-compose/`.

Registration: see `@stageflip/engine`'s `registerClusterHComposeBundle` (or equivalent) export.

## Tools

### `compose_ar_overlay`

Pick a Cluster H (AR overlays) preset by `(sport, brand)` and emit a ratified preset id + clipKind + opaque props payload. Sealed sport enum (soccer / football / basketball / swimming / tennis / cycling) + AR-brand enum (sky-sports / nba / fox-sports / espn / tnt). Dispatch: (soccer | football, sky-sports) → sky-sports-ar-formations; (basketball, nba) → nba-ar-replay; other (sport, brand) tuples return no_preset_for_sport_brand. Hawk-Eye VAR has a dedicated tool (compose_var_skeletal); Olympic swim has a dedicated tool (compose_swim_lane_track) — do not route those through compose_ar_overlay. v1 ships static-fallback only; live-mount via ThreeSceneClip is gated on Track A T-397+. Read-only: caller mounts the clip via a separate write-tier tool.

- `sport` (`string`) — enum: `soccer` / `football` / `basketball` / `swimming` / `tennis` / `cycling`
- `content` (`string`) — enum: `formation` / `shot-arc` / `player-tracking` / `replay`
- `brand` (`string`) — enum: `sky-sports` / `nba` / `fox-sports` / `espn` / `tnt`
- `cameraTrack` (`object`) _(optional)_ — Camera-track atom: `{ feed: live | pre-baked, provider? }`. `provider` is informational (e.g. "Zero Density", "Stype"); the v1 primitive ignores it.
- `displayTier` (`string`) _(optional)_ — enum: `broadcast` / `mobile`
- `label` (`string`) _(optional)_

### `compose_var_skeletal`

Emit the Cluster H Hawk-Eye VAR preset (hawkeye-var-3d-skeletal; arOverlay) for the offside-decision 3D skeletal-wireframe register. Sealed brand enum (hawkeye / premier-league / uefa-cl) — all three route to the same preset (only Cluster H VAR consumer). Optional `freezeFrame` (`timestampMs` + `advisory` text), `playerTracking[]` (per-player skeletal-point counts up to 22 entries), `decision: 'confirmed' | 'overturned' | 'pending'`. Per cluster SKILL line 37, pairs with Cluster B's compose_var_call for the lower-third decision banner; per line 45 the pause-then-flash decision-reveal animation lives at the primitive layer (post-T-397 live-mount). v1 ships static-fallback only.

- `brand` (`string`) — enum: `hawkeye` / `premier-league` / `uefa-cl`
- `freezeFrame` (`object`) _(optional)_ — Freeze-frame atom: `{ timestampMs (>=0), advisory? }`. `advisory` is the on-screen text during the VAR check (e.g. "CHECKING OFFSIDE").
- `playerTracking` (`array`) _(optional)_
- `decision` (`string`) _(optional)_ — enum: `confirmed` / `overturned` / `pending`

### `compose_swim_lane_track`

Emit the Cluster H Olympic swim preset (olympic-swim-lane-track; arOverlay) for the lane-anchored timing + virtual world-record-line register. Sealed brand enum (olympic / omega / fina / world-aquatics) — all four route to the same preset (only Cluster H swim consumer). Required `laneCount` (2 = head-to-head heat; 10 = 10-lane outdoor pool); optional `recordTime` (seconds + holder + eventName), `athletes[]` (per-lane name + ISO 3166-1 alpha-3 countryCode, up to 10 entries). Per cluster SKILL line 43 the WR line reads as authoritative; per the T-377 binding's network permission reservation, live-mount post-T-397 will integrate with the Omega Vionardo timing feed via LiveDataClip. v1 ships static-fallback only.

- `brand` (`string`) — enum: `olympic` / `omega` / `fina` / `world-aquatics`
- `laneCount` (`integer`)
- `recordTime` (`object`) _(optional)_ — Record-time atom: `{ seconds (>=0), holder?, eventName? }`. Used for the Olympic WR-line dramatic differentiator.
- `athletes` (`array`) _(optional)_


## Invariants

- Every handler declares `bundle: 'cluster-h-compose'`.
- Tool count 3 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-379
