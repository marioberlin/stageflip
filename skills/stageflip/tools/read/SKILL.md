---
title: Tools — Read Bundle
id: skills/stageflip/tools/read
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-155
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Read Bundle

Read-only inspection of the current document — get_document, get_slide, list_elements, describe_selection, get_theme.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/read/`.

Registration: see `@stageflip/engine`'s `registerReadBundle` (or equivalent) export.

## Tools

### `get_document`

Return top-level document metadata: id, mode, title, locale, and a mode-specific count (slides / tracks / sizes). Never returns the full document payload.

### `get_slide`

Fetch metadata for a single slide by id: element count, duration, flags for background/transition/notes. Slide-mode only.

- `slideId` (`string`) — Target slide id.

### `list_elements`

List every element on a slide with id, type, optional name, and visibility. Slide-mode only.

- `slideId` (`string`) — Target slide id.

### `describe_selection`

Describe the elements the user currently has selected in the editor. Returns empty arrays when nothing is selected.

### `get_theme`

Return the theme — named palette entries (primary / secondary / etc.) plus dotted-path design tokens. Small payload; safe to call whenever the model needs to reason about brand colours or token values.


## Invariants

- Every handler declares `bundle: 'read'`.
- Tool count 5 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-155
