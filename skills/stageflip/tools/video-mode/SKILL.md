---
title: Tools — Video Mode Bundle
id: skills/stageflip/tools/video-mode
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-185
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Video Mode Bundle

StageFlip.Video profile tools — multi-aspect export planning, per-aspect layout helpers (T-185 and onward).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/video-mode/`.

Registration: see `@stageflip/engine`'s `registerVideoModeBundle` (or equivalent) export.

## Tools



## Invariants

- Every handler declares `bundle: 'video-mode'`.
- Tool count 0 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-185
