---
title: Tools — Display Mode Bundle
id: skills/stageflip/tools/display-mode
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-206
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Display Mode Bundle

StageFlip.Display profile tools — file-size optimization planning, multi-size preview resolution (T-206 and onward).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/display-mode/`.

Registration: see `@stageflip/engine`'s `registerDisplayModeBundle` (or equivalent) export.

## Tools



## Invariants

- Every handler declares `bundle: 'display-mode'`.
- Tool count 0 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-206
