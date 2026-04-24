---
title: Tools — Validate Bundle
id: skills/stageflip/tools/validate
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-159
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Validate Bundle

Run the pre-render linter, schema validation, and fixable-rule checks.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/validate/`.

Registration: see `@stageflip/engine`'s `registerValidateBundle` (or equivalent) export.

## Tools

### `validate_schema`

Run `documentSchema.parse` on the current document and report every Zod issue (path + code + message). `ok: true` when the document parses cleanly.

### `check_duplicate_ids`

Scan the document for duplicate slide ids and duplicate element ids (element ids must be unique across the entire deck). Returns arrays of offenders; `ok: true` when no duplicates.

### `check_timing_coverage`

Report which slides have a static `durationMs` and sum them. Useful before an export: slides without `durationMs` advance on user click and are unsuitable for non-interactive outputs.

### `validate_all`

Run every validate-bundle check and aggregate findings. Convenient for a 'please lint the doc' call site; prefer the individual tools when the agent already knows which axis to inspect.


## Invariants

- Every handler declares `bundle: 'validate'`.
- Tool count 4 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-159
