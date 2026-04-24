---
title: Tools — Layout Bundle
id: skills/stageflip/tools/layout
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-158
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Layout Bundle

Apply alignment, distribution, grids, and constraint-based layout.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/layout/`.

Registration: see `@stageflip/engine`'s `registerLayoutBundle` (or equivalent) export.

## Tools

### `align_elements`

Align 2+ elements along an axis. `axis=horizontal` + `mode=start` aligns their top edges (y = min y); `mode=center` aligns vertical centers; `mode=end` aligns bottom edges. `axis=vertical` mirrors this for x.

- `slideId` (`string`)
- `elementIds` (`array`)
- `axis` (`string`) — enum: `horizontal` / `vertical`
- `mode` (`string`) — enum: `start` / `center` / `end`

### `distribute_elements`

Evenly space 3+ elements between the outermost two. `axis=horizontal` distributes along x; `axis=vertical` along y. The outermost elements stay put; middle elements are repositioned so inter-centre gaps are equal.

- `slideId` (`string`)
- `elementIds` (`array`)
- `axis` (`string`) — enum: `horizontal` / `vertical`

### `snap_to_grid`

Snap each element's `x` + `y` to the nearest multiple of `gridSize`. Width / height left untouched. `gridSize` is in the document's transform units (typically px against a 1920×1080 reference).

- `slideId` (`string`)
- `elementIds` (`array`)
- `gridSize` (`number`)

### `set_element_transform`

Patch one or more fields on a single element's `transform`. Fields left out remain unchanged. Prefer this over raw `update_element` for geometry edits — this handler always emits per-field `replace` patches so other transform fields survive.

- `slideId` (`string`)
- `elementId` (`string`)
- `transform` (`object`)

### `match_size`

Copy the source element's `width` / `height` / both onto each target element. Position is unchanged. Use after `align_elements` when a row of cards needs uniform sizing.

- `slideId` (`string`)
- `sourceElementId` (`string`)
- `targetElementIds` (`array`)
- `dimensions` (`string`) _(optional)_ — enum: `width` / `height` / `both`


## Invariants

- Every handler declares `bundle: 'layout'`.
- Tool count 5 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-158
