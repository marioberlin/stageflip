---
title: Tools — Arrange Variants Bundle
id: skills/stageflip/tools/arrange-variants
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-386
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Arrange Variants Bundle

Variant generation — turn one canonical Document into a message × locale matrix of variants (T-386).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/arrange-variants/`.

Registration: see `@stageflip/engine`'s `registerArrangeVariantsBundle` (or equivalent) export.

## Tools

### `arrange_variants`

Generate the message × locale variant matrix from the source document and the supplied `matrixSpec`. Persists each variant Document via the executor-supplied storage seam and returns `{ coordinate, documentId, cacheKey }` per variant — never full Document payloads (would blow the agent context). Empty matrix returns an empty `variants` array. Exceeding `matrixSpec.maxVariants` (default 100) returns `{ ok: false, reason: "matrix_cap_exceeded" }` with no partial output. When the executor has no `persistVariant` seam wired (pre-T-408), returns `{ ok: false, reason: "persistence_unavailable" }` rather than emitting unresolvable IDs. Size axis is OUT OF SCOPE in T-386 (T-386a follow-up); passing `size:` is rejected by the schema.

- `matrixSpec` (`object`)


## Invariants

- Every handler declares `bundle: 'arrange-variants'`.
- Tool count 1 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-386
