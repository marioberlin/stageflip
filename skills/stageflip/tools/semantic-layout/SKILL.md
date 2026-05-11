---
title: Tools — Semantic Layout Bundle
id: skills/stageflip/tools/semantic-layout
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-168
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Semantic Layout Bundle

Semantic-role layout helpers — title blocks, KPI strips, two-column flows.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/semantic-layout/`.

Registration: see `@stageflip/engine`'s `registerSemanticLayoutBundle` (or equivalent) export.

## Tools

### `apply_title_body_layout`

Reshape two existing elements into a title-over-body layout. Title gets `titleHeight` (default 160 px) at the top with standard margins; body fills the remaining vertical space. Emits one transform replace per element — doesn't touch `type`, content, or any field other than `transform`.

- `slideId` (`string`)
- `titleElementId` (`string`)
- `bodyElementId` (`string`)
- `titleHeight` (`integer`) _(optional)_

### `apply_two_column_layout`

Reshape existing elements into a two-column layout. `leftElementIds` become equal-height cards stacked in the left column; `rightElementIds` fill the right. `topY` defaults to 240 (leaving room for a title); `gap` is inter-row spacing (default 24 px).

- `slideId` (`string`)
- `leftElementIds` (`array`)
- `rightElementIds` (`array`)
- `topY` (`integer`) _(optional)_
- `gap` (`integer`) _(optional)_

### `apply_kpi_strip_layout`

Reshape 1–6 existing elements into a horizontal equal-width KPI strip. `y` defaults to 280, `height` to 240. Perfect for quick retrofits of mis-aligned metric cards.

- `slideId` (`string`)
- `elementIds` (`array`)
- `y` (`integer`) _(optional)_
- `height` (`integer`) _(optional)_

### `apply_centered_hero_layout`

Reshape one element to a centered hero box. `widthRatio` / `heightRatio` are fractions of the canvas (default 0.75 / 0.5), so the default box is 1440×540 centered on the slide.

- `slideId` (`string`)
- `elementId` (`string`)
- `widthRatio` (`number`) _(optional)_
- `heightRatio` (`number`) _(optional)_

### `arrange_reveal`

Append a staggered enter-animation sequence to caller-supplied element ids on a slide. Canonical use case: headline → body → media reveal at deck open. Caller passes `revealOrder` (an ordered list of element ids — the 0th reveals first); the tool emits one animation-add JSON-Patch per element. Frame-native input (the canonical schema has no ms surface on slide content): defaults at 30fps are 9-frame stagger (≈300 ms) + 14-frame enter (≈450 ms) + `fade` + `ease-out`. Override `enterAnimationKind` to `slide-up` / `slide-down` / `slide-left` / `slide-right` / `scale`. Refuses with `duplicate_element_id` if `revealOrder` carries duplicates (checked first); then `wrong_mode` / `slide_not_found` / `element_not_found` per the bundle's standard locator. Animation ids are auto-generated as `reveal-N` (collision-safe against pre-existing `reveal-*` animations). Does NOT touch `transform`, content, or any field other than `animations`.

- `slideId` (`string`)
- `revealOrder` (`array`)
- `initialDelayFrames` (`integer`) _(optional)_
- `staggerFrames` (`integer`) _(optional)_
- `enterDurationFrames` (`integer`) _(optional)_
- `enterAnimationKind` (`string`) _(optional)_ — enum: `fade` / `slide-up` / `slide-down` / `slide-left` / `slide-right` / `scale`
- `enterEasing` (`string`) _(optional)_ — enum: `linear` / `ease` / `ease-in` / `ease-out` / `ease-in-out`
- `autoplay` (`boolean`) _(optional)_


## Invariants

- Every handler declares `bundle: 'semantic-layout'`.
- Tool count 5 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-168
