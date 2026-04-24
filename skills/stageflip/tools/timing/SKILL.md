---
title: Tools — Timing Bundle
id: skills/stageflip/tools/timing
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-157
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Timing Bundle

Adjust per-slide duration, sequence, and timeline timing hints.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/timing/`.

Registration: see `@stageflip/engine`'s `registerTimingBundle` (or equivalent) export.

## Tools

### `set_slide_duration`

Set a single slide's static duration in milliseconds. Must be a positive integer. Omit (use `clear_slide_duration`) for "advance on user click".

- `slideId` (`string`)
- `durationMs` (`integer`)

### `clear_slide_duration`

Remove a slide's `durationMs`, reverting it to "advance on user click". `wasSet: false` means the field was absent already; no patch emitted in that case.

- `slideId` (`string`)

### `set_slide_transition`

Set a slide's entrance transition. `kind` is one of `none` / `fade` / `slide-left` / `slide-right` / `zoom` / `push`. `durationMs` defaults to 400 when omitted (schema default).

- `slideId` (`string`)
- `kind` (`string`) — enum: `none` / `fade` / `slide-left` / `slide-right` / `zoom` / `push`
- `durationMs` (`integer`) _(optional)_

### `clear_slide_transition`

Remove a slide's entrance transition entirely. `wasSet: false` means the field was absent already; no patch emitted.

- `slideId` (`string`)


## Invariants

- Every handler declares `bundle: 'timing'`.
- Tool count 4 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-157
