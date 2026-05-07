---
title: Tools — Cluster E Compose Bundle
id: skills/stageflip/tools/cluster-e-compose
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-361
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Cluster E Compose Bundle

Cluster E (Data) composer tools — preset-binding factories for live-data / market-ticker / election-board / big-number / stat-callout briefs across the 6 ratified Cluster E presets (T-361).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/cluster-e-compose/`.

Registration: see `@stageflip/engine`'s `registerClusterEComposeBundle` (or equivalent) export.

## Tools

### `compose_live_data`

Compose a live-data routing plan for Cluster E (Data). Returns a `presetId` of `magic-wall-drilldown` (when `layout: 'wall'`) or `big-number-stat-impact` (when `layout: 'big-number'`), plus opaque pass-through `props` for the runtime to materialize the preset. Does NOT fetch live data — the runtime evaluates frontier capability and chooses the live or fallback path. Refuses `unsupported_domain` for Olympic + wall (use `compose_stat_callout` for Olympic data).

- `domain` (`string`) — enum: `politics` / `finance` / `sports` / `olympic`
- `layout` (`string`) — enum: `wall` / `big-number`
- `state` (`object`) _(optional)_ — Opaque host-supplied state pass-through (record of unknown).
- `brand` (`string`) _(optional)_
- `locale` (`string`) _(optional)_

### `compose_market_ticker`

Compose a Bloomberg-register scrolling ticker routing plan. Returns `presetId: 'bloomberg-ticker'` plus opaque pass-through `props`. `symbols.length` ∈ [1, 64]; `deltas` (when supplied) must match `symbols.length`. `brand: 'generic'` parameterizes the preset for non-Bloomberg palette per the preset stub.

- `symbols` (`array`) — Ticker symbol strings (1–8 chars each); 1–64 entries.
- `deltas` (`array`) _(optional)_ — Optional numeric deltas; length must match `symbols`.
- `brand` (`string`) _(optional)_ — enum: `bloomberg` / `generic`
- `locale` (`string`) _(optional)_

### `compose_election_board`

Compose a Magic Wall election-board routing plan. Returns `presetId: 'magic-wall-drilldown'` plus opaque pass-through `props`. `states.length` ∈ [1, 60]; `statePalette` (when supplied) must use `^#[0-9a-fA-F]{6}$` hex. Cluster owner of `magic-wall-drilldown` materializes the rendered map via the parity-cli resolver.

- `states` (`array`) — US state codes / region names (2–40 chars each); 1–60 entries.
- `leaders` (`object`) _(optional)_ — Optional `{ stateCode: candidateId }` map.
- `statePalette` (`object`) _(optional)_ — Optional `{ stateCode: #RRGGBB }` color overrides.
- `brand` (`string`) _(optional)_

### `compose_big_number`

Compose a big-number stat routing plan. Returns `presetId: 'f1-sector-purple-green'` (when `sport: 'f1'`) or `big-number-stat-impact` (else) plus opaque pass-through `props`. `figure` is string-typed (e.g. `'$3.2M'`, `'87%'`, `'12.4M'`); the cluster skill mandates pre-formatted units — the composer does NOT format.

- `figure` (`string`) — Pre-formatted figure (e.g. '$3.2M', '87%', '12.4M').
- `label` (`string`) _(optional)_
- `magnitude` (`string`) _(optional)_ — enum: `raw` / `k` / `m` / `b`
- `sport` (`string`) _(optional)_ — enum: `f1`
- `theme` (`string`) _(optional)_

### `compose_stat_callout`

Compose an inline-stat-callout routing plan. Returns one of `cricket-ball-by-ball-dots` (when `sport: 'cricket'`), `f1-sector-purple-green` (when `sport: 'f1'`), `olympic-medal-tracker` (when `sport: 'olympic'`), or `big-number-stat-impact` (default). Plus opaque pass-through `props`. `stat` is string-typed (e.g. `'87 runs off 42 balls'`, `'P3 → P1, gap +0.124'`).

- `stat` (`string`) — Pre-formatted stat (e.g. '87 runs off 42 balls', 'P3 → P1, gap +0.124').
- `sport` (`string`) _(optional)_ — enum: `cricket` / `f1` / `olympic`
- `context` (`string`) _(optional)_
- `brand` (`string`) _(optional)_


## Invariants

- Every handler declares `bundle: 'cluster-e-compose'`.
- Tool count 5 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-361
