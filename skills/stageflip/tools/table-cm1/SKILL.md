---
title: Tools — Table CM1 Bundle
id: skills/stageflip/tools/table-cm1
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-163
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/tools/element-cm1/SKILL.md
  - skills/stageflip/tools/create-mutate/SKILL.md
---

# Tools — Table CM1 Bundle

Six write-tier tools for table-element content mutation. Slide-mode
only. Handlers type against `MutationContext`; mutations flow as
JSON-Patch ops.

Table elements store cells sparsely — one entry per non-default cell,
addressed by `{row, col}`. Tools that reshape the grid (`insert_row` /
`delete_row` / `insert_column` / `delete_column`) automatically shift
every affected cell's coordinates AND update the table's declared
`rows` / `columns` counts atomically via wholesale-replace ops.

Scope boundary: `create-mutate` owns table-element add / delete;
`element-cm1` does NOT touch tables (by design — tables need
coordinate-aware edits). This bundle is the only one that manipulates
the `cells` array, `rows`, and `columns`.

Registration: `registerTableCm1Bundle(registry, router)` from
`@stageflip/engine`.

## Tools

### Cell-level

#### `set_cell` — `{ slideId, elementId, row, col, cell }`

Upsert a cell at `(row, col)`. Adds a new cell entry if absent, or
wholesale-replaces the existing one. Refuses `out_of_bounds` when
`row >= rows` or `col >= columns`. `cell.content` is required; styling
fields (`color` / `background` / `bold` / `align` / `colspan` /
`rowspan`) are optional. Reports `action: 'added' | 'replaced'`.

#### `clear_cell` — `{ slideId, elementId, row, col }`

Remove the cell entry at `(row, col)`. Noop when no cell is present
(`wasSet: false`) — sparse cells mean "absent" is a valid state, so
this is not an error. Out-of-bounds coordinates also noop.

### Grid reshape

#### `insert_row` — `{ slideId, elementId, at }`

Insert a blank row at index `at`. Shifts every cell with `row >= at`
up by one AND increments `table.rows` in one atomic pair of replace
ops. `at = rows` appends at the bottom; `at > rows` refuses
`out_of_bounds`.

#### `delete_row` — `{ slideId, elementId, at }`

Delete the row at `at`. Removes every cell with `row == at`, shifts
cells with `row > at` down by one, and decrements `table.rows`. Reports
`cellsRemoved`. Refuses `last_row` when `rows == 1` (table must keep
≥1 row) and `out_of_bounds` when `at >= rows`.

#### `insert_column` — `{ slideId, elementId, at }`

Mirror of `insert_row` for columns.

#### `delete_column` — `{ slideId, elementId, at }`

Mirror of `delete_row`. Refuses `last_column` when `columns == 1`.

## Invariants

- Every handler declares `bundle: 'table-cm1'`.
- All 6 handlers type against `MutationContext` and refuse
  `wrong_element_type` when the element isn't `type: 'table'`.
- Tool count 6 → within I-9's 30 cap.
- `rows >= 1` and `columns >= 1` — enforced by `last_row` /
  `last_column` refusals.
- Grid-reshape tools emit exactly 2 patches (`cells` + `rows` |
  `cells` + `columns`) — Executor applies them together so
  post-mutation reads never see a mismatched count.
- Sparse cell convention: an absent `(row, col)` entry means "default
  cell" (empty content + default style). Tools never force creation
  of empty cell stubs.

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Siblings: `tools/element-cm1/SKILL.md` (all non-table elements),
  `tools/create-mutate/SKILL.md` (element CRUD)
- Task: T-163
