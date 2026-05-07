---
title: Tools — Cluster F Compose Bundle
id: skills/stageflip/tools/cluster-f-compose
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-368
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Cluster F Compose Bundle

Cluster F (Captions / Lyrics) composer tools — preset-binding factories for creator-caption / subtitle / lyric-video / keyword-highlight briefs (T-368).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/cluster-f-compose/`.

Registration: see `@stageflip/engine`'s `registerClusterFComposeBundle` (or equivalent) export.

## Tools

### `compose_creator_caption`

Pick a Cluster F (Captions) creator-register preset by `style` and emit a ratified preset id + the echoed transcript. Dispatches across 5 presets — `hormozi` → `hormozi-montserrat-black`, `mrbeast` → `mrbeast-komika-axis`, `tiktok` → `tiktok-rounded-box`, `ali-abdaal` → `ali-abdaal-opacity-karaoke`, `netflix` → `netflix-invisible`. Default (no style) routes to `tiktok-rounded-box` (the platform-native short-form register). Output is `clipKind: caption`; caller mounts via a separate write-tier tool.

- `transcript` (`array`)
- `style` (`string`) _(optional)_ — enum: `hormozi` / `mrbeast` / `tiktok` / `ali-abdaal` / `netflix`
- `brand` (`object`) _(optional)_ — Optional brand atom: `{ primary? (#RRGGBB), accent? (#RRGGBB), font? }`. Echoed verbatim through to the output envelope; downstream merges with preset bundle defaults at clip-mount time.

### `compose_subtitle`

Pick a Cluster F (Captions) subtitle preset by `accessibility_mode` and emit a ratified preset id + the echoed transcript. Default `strict` (FCC-grade) routes to `netflix-invisible` — the only preset in the cluster guaranteeing strict-subtitle invariants (≥833 ms minimum-event, 42-char-per-line / 2-lines-max upstream, sentence-case canonical, mute-opacity active-only visibility). `relaxed` routes to `tiktok-rounded-box` (platform-native fallback for short-form non-FCC scenarios). Output is `clipKind: caption`.

- `transcript` (`array`)
- `accessibility_mode` (`string`) _(optional)_ — enum: `strict` / `relaxed`
- `brand` (`object`) _(optional)_ — Optional brand atom: `{ primary? (#RRGGBB), accent? (#RRGGBB), font? }`. Echoed verbatim through to the output envelope; downstream merges with preset bundle defaults at clip-mount time.

### `compose_lyric_video`

Pick a Cluster F (Lyrics) preset for a lyric / karaoke video and emit a ratified preset id + the echoed `lyrics` payload. v1 sealed at `style: 'progressive-wipe'` → `karaoke-progressive-wipe` (the only `clipKind: lyrics` preset in the cluster; left-to-right per-word color-wipe driven by within-word ms-progress). Optional `music: { bpm?, beatGrid? }` is opaque passthrough — beat detection from raw audio is upstream's concern. Output is `clipKind: lyrics`.

- `lyrics` (`array`)
- `music` (`object`) _(optional)_ — Optional music atom for `compose_lyric_video`: `{ bpm? (>0), beatGrid? (number[]) }`. Opaque passthrough; beat detection from raw audio is upstream.
- `style` (`string`) _(optional)_ — enum: `progressive-wipe`
- `brand` (`object`) _(optional)_ — Optional brand atom: `{ primary? (#RRGGBB), accent? (#RRGGBB), font? }`. Echoed verbatim through to the output envelope; downstream merges with preset bundle defaults at clip-mount time.

### `compose_keyword_highlight`

Pick a Cluster F caption preset whose color semantics encode keyword emphasis and emit a ratified preset id + the echoed transcript + keywords. Default `hormozi` → `hormozi-montserrat-black` (yellow / green / red keyword color-pop, broadest palette). `mrbeast` → `mrbeast-komika-axis` (green-on-monetary subvariant). The handler does NOT colorize words inline — the downstream clip-mounting tool applies the preset's keyword-tagging logic. Per-word `emphasis` tagging on `WordTiming` is upstream's concern. Output is `clipKind: caption`.

- `transcript` (`array`)
- `keywords` (`array`)
- `style` (`string`) _(optional)_ — enum: `hormozi` / `mrbeast`
- `brand` (`object`) _(optional)_ — Optional brand atom: `{ primary? (#RRGGBB), accent? (#RRGGBB), font? }`. Echoed verbatim through to the output envelope; downstream merges with preset bundle defaults at clip-mount time.


## Invariants

- Every handler declares `bundle: 'cluster-f-compose'`.
- Tool count 4 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-368
