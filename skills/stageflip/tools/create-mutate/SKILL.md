---
title: Tools — Create Mutate Bundle
id: skills/stageflip/tools/create-mutate
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-156
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Create Mutate Bundle

Add, update, duplicate, reorder, and delete slides + elements.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/create-mutate/`.

Registration: see `@stageflip/engine`'s `registerCreateMutateBundle` (or equivalent) export.

## Tools

### `add_slide`

Append or insert a new slide. Position defaults to the end. Returns the generated slide id and insertion index.

- `position` (`integer`) _(optional)_
- `title` (`string`) _(optional)_
- `durationMs` (`integer`) _(optional)_
- `notes` (`string`) _(optional)_
- `background` (`object`) _(optional)_ — Slide background — schema validated server-side.

### `update_slide`

Update one or more fields on an existing slide. Omit a field to leave it unchanged. Empty string title / notes remove the field.

- `slideId` (`string`)
- `title` (`string`) _(optional)_
- `durationMs` (`integer`) _(optional)_
- `notes` (`string`) _(optional)_
- `background` (`object`) _(optional)_

### `duplicate_slide`

Deep-copy an existing slide, assign fresh ids to the slide + every element, and insert the copy. Position defaults to immediately after the source.

- `slideId` (`string`)
- `position` (`integer`) _(optional)_

### `reorder_slides`

Replace the slide order. The `order` array must contain every existing slide id exactly once.

- `order` (`array`)

### `delete_slide`

Remove a slide by id. Refuses to delete the last remaining slide — every deck must have at least one (schema invariant).

- `slideId` (`string`)

### `add_element`

Append or insert an element on an existing slide. The caller provides the full element (Zod-validated). If the id collides with an existing element, a fresh id is assigned automatically.

- `slideId` (`string`)
- `element` (`object`) — Element payload — Zod-validated server-side against the discriminated elementSchema (text / image / shape / chart / table / clip / …).
- `position` (`integer`) _(optional)_

### `update_element`

Replace one or more fields on an existing element. `id` and `type` cannot be changed — use delete + add for that. Fields are replaced wholesale; to edit a text element's runs use element-cm1 tools (T-161).

- `slideId` (`string`)
- `elementId` (`string`)
- `updates` (`object`) — Field → new value. `id` and `type` are forbidden.

### `delete_element`

Remove a single element from a slide.

- `slideId` (`string`)
- `elementId` (`string`)


## Invariants

- Every handler declares `bundle: 'create-mutate'`.
- Tool count 8 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-156
