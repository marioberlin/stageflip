---
title: Tools — Table CM1 Bundle
id: skills/stageflip/tools/table-cm1
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-163
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Table CM1 Bundle

Table-specific content-mutation tools — rows, columns, cell merges.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/table-cm1/`.

Registration: see `@stageflip/engine`'s `registerTableCm1Bundle` (or equivalent) export.

## Tools

### `set_cell`

Upsert a cell at `(row, col)`. If a cell already exists at those coordinates, it's wholesale-replaced; otherwise it's appended to the sparse `cells` array. Refuses `out_of_bounds` if `row >= table.rows` or `col >= table.columns`. The cell payload is Zod-validated against the per-cell shape (content required; color / background / bold / align / colspan / rowspan optional).

- `slideId` (`string`)
- `elementId` (`string`)
- `row` (`integer`)
- `col` (`integer`)
- `cell` (`object`)

### `clear_cell`

Remove a cell entry at `(row, col)` from the sparse `cells` array. Reports `wasSet: false` when no cell was present (noop — no patch emitted). Out-of-bounds coordinates silently noop too, since a missing coordinate and an out-of-bounds coordinate both mean 'no cell to clear'.

- `slideId` (`string`)
- `elementId` (`string`)
- `row` (`integer`)
- `col` (`integer`)

### `insert_row`

Insert a blank row at index `at`. Shifts every cell whose row ≥ at up by one, and increments `table.rows`. `at = table.rows` appends at the bottom; `at > table.rows` refuses with `out_of_bounds`. Atomic: emits one replace op for `cells` and one for `rows`.

- `slideId` (`string`)
- `elementId` (`string`)
- `at` (`integer`)

### `delete_row`

Delete the row at index `at`. Removes every cell whose row equals `at`, shifts cells with row > at down by one, and decrements `table.rows`. Refuses `last_row` when `table.rows == 1` (tables must keep ≥1 row) and `out_of_bounds` when `at >= rows`.

- `slideId` (`string`)
- `elementId` (`string`)
- `at` (`integer`)

### `insert_column`

Insert a blank column at index `at`. Shifts every cell whose col ≥ at right by one, and increments `table.columns`. `at = table.columns` appends on the right.

- `slideId` (`string`)
- `elementId` (`string`)
- `at` (`integer`)

### `delete_column`

Delete the column at index `at`. Removes every cell whose col equals `at`, shifts cells with col > at left by one, and decrements `table.columns`. Refuses `last_column` when `table.columns == 1`.

- `slideId` (`string`)
- `elementId` (`string`)
- `at` (`integer`)


## Invariants

- Every handler declares `bundle: 'table-cm1'`.
- Tool count 6 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-163
