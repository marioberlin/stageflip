---
title: Tools — Slide CM1 Bundle
id: skills/stageflip/tools/slide-cm1
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-162
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Slide CM1 Bundle

Slide-level content-mutation + accessibility (alt text, reading order).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/slide-cm1/`.

Registration: see `@stageflip/engine`'s `registerSlideCm1Bundle` (or equivalent) export.

## Tools

### `set_slide_title`

Set or clear a slide's title. Empty-string `title` removes the field entirely (follows the T-156 empty-string-removes convention). Reports `action: 'set' | 'cleared'`.

- `slideId` (`string`)
- `title` (`string`)

### `set_slide_notes`

Set or clear a slide's speaker notes. Empty-string `notes` removes the field. Use `append_slide_notes` when you want to preserve existing notes.

- `slideId` (`string`)
- `notes` (`string`)

### `append_slide_notes`

Append text to a slide's speaker notes. `separator` defaults to two newlines (paragraph break); use `' '` for inline joins. Adds the field when absent. Refuses `exceeds_max_length` when the appended total would exceed 5000 chars (schema limit).

- `slideId` (`string`)
- `text` (`string`)
- `separator` (`string`) _(optional)_

### `set_slide_background`

Set or clear a slide's background. Pass a `{ kind: 'color', value }` or `{ kind: 'asset', value }` to set; pass `null` to clear. Noop when asked to clear a slide that has no background.

- `slideId` (`string`)
- `background` (`object`) — Background — `{ kind: 'color', value }` or `{ kind: 'asset', value }`, or `null` to clear.

### `reorder_slide_elements`

Reorder a slide's `elements` array. `order` must contain every existing element id exactly once — drift-gate checks match `reorder_slides` (T-156). Element array order is the a11y reading order (screen readers announce in document order) AND drives RIR z-index (array-index × 10). Changing this order therefore affects both a11y and stacking.

- `slideId` (`string`)
- `order` (`array`)

### `bulk_set_alt_text`

A11y: set alt text on multiple image elements in one call. Each assignment targets an image element by id; empty-string `alt` marks the image as decorative (removes the field). Fails atomically — validates every assignment before emitting any patches. Refuses `element_not_found` / `wrong_element_type` with `detail` on first offender.

- `slideId` (`string`)
- `assignments` (`array`)


## Invariants

- Every handler declares `bundle: 'slide-cm1'`.
- Tool count 6 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-162
