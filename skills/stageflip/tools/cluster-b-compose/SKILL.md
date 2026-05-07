---
title: Tools — Cluster B Compose Bundle
id: skills/stageflip/tools/cluster-b-compose
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-340
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Cluster B Compose Bundle

Cluster B (Sports) composer tools — preset-binding factories for live-sports score / standings / VAR / player-intro briefs (T-340).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/cluster-b-compose/`.

Registration: see `@stageflip/engine`'s `registerClusterBComposeBundle` (or equivalent) export.

## Tools

### `compose_sports_score`

Pick a Cluster B (Sports) score-bug or news-ticker preset by `sport` + `brand` and emit a ratified preset id + opaque props payload. Dispatches across the 7 Cluster B presets that bind `scoreBug` or bottom-line `newsTicker`. Golf maps to `compose_standings_table`; UEFA fullScreen / VAR routes to `compose_var_call`. Caller mounts the clip via a separate write-tier tool.

- `sport` (`string`) — enum: `football` / `racing` / `cricket` / `tennis` / `soccer` / `golf`
- `brand` (`string`) — enum: `premier-league` / `fox-nfl` / `nbc-snf` / `espn` / `f1` / `icc` / `wimbledon` / `masters` / `uefa-cl`
- `home` (`object`) — Team-score atom: `{ code, color (#RRGGBB), score }`. `code` is 1–8 chars (e.g. 'ARS' / 'KC'). Validated server-side against `teamScoreSchema`.
- `away` (`object`) — Team-score atom: `{ code, color (#RRGGBB), score }`. `code` is 1–8 chars (e.g. 'ARS' / 'KC'). Validated server-side against `teamScoreSchema`.
- `clock` (`string`)
- `period` (`string`)
- `possession` (`string`) _(optional)_ — enum: `home` / `away`
- `down` (`string`) _(optional)_
- `direction` (`string`) _(optional)_ — enum: `left-to-right` / `right-to-left`
- `centerCircle` (`boolean`) _(optional)_
- `backdropGradient` (`object`) _(optional)_ — `{ centerOpacity (0–1), edgeOpacity (0–1) }` — Fox NFL no-chrome backdrop.

### `compose_standings_table`

Pick a Cluster B (Sports) standings / leaderboard preset by `sport` + `brand` and emit a ratified preset id + opaque props payload. v1 routes only `(golf, masters)` → `masters-red-under-par`; non-golf standings (Olympic medal tables, league tables) route through Cluster E.

- `sport` (`string`) — enum: `football` / `racing` / `cricket` / `tennis` / `soccer` / `golf`
- `brand` (`string`) — enum: `premier-league` / `fox-nfl` / `nbc-snf` / `espn` / `f1` / `icc` / `wimbledon` / `masters` / `uefa-cl`
- `rows` (`array`)
- `title` (`string`) _(optional)_
- `subtitle` (`string`) _(optional)_

### `compose_var_call`

Reserved surface for VAR call-out compositions (PL / UCL register only). The bound clip `VARBanner` is gap-task T-320; this tool always returns `not_yet_implemented` in v1. Schema is full-fidelity so the consumer-facing contract is forward-compatible — when T-320 lands, only the dispatch body fills in.

- `sport` (`string`) — enum: `football` / `soccer`
- `brand` (`string`) — enum: `premier-league` / `uefa-cl`
- `decision` (`string`) — enum: `goal` / `no-goal` / `penalty` / `no-penalty` / `red-card` / `no-red-card` / `offside` / `no-offside`
- `reason` (`string`) _(optional)_

### `compose_player_intro`

Reserved surface for Cluster B player-intro compositions. No Cluster B preset binds the `playerIntro` clipKind in v1; this tool always returns `not_yet_implemented`. When the eventual Cluster B player-intro preset lands, only the dispatch body fills in — schema + registration + tool name stay intact.

- `sport` (`string`) — enum: `football` / `racing` / `cricket` / `tennis` / `soccer` / `golf`
- `brand` (`string`) — enum: `premier-league` / `fox-nfl` / `nbc-snf` / `espn` / `f1` / `icc` / `wimbledon` / `masters` / `uefa-cl`
- `player` (`object`) — Player atom: `{ name, code?, countryCode (ISO-3)?, teamCode?, teamColor (#RRGGBB)?, seed?, headshotAssetId? }`.
- `stats` (`array`) _(optional)_


## Invariants

- Every handler declares `bundle: 'cluster-b-compose'`.
- Tool count 4 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-340
