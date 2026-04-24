---
'@stageflip/engine': minor
---

T-163 — Ninth handler bundle shipped: `table-cm1` (6 tools). The only
bundle that manipulates table cells + grid shape.

Tools:

- Cell-level (2): `set_cell` (upsert at `(row, col)`; refuses
  `out_of_bounds` when outside `rows`/`columns`), `clear_cell` (noop
  when absent — sparse cells mean "absent" is valid).
- Grid reshape (4): `insert_row` / `delete_row` / `insert_column` /
  `delete_column`. Each shifts every affected cell's coordinates AND
  adjusts `table.rows` / `table.columns` atomically via a pair of
  wholesale-replace ops. Delete handlers refuse `last_row` /
  `last_column` when the table would end up with 0 rows / columns.

Scope: `element-cm1` deliberately excludes tables — coordinate-aware
edits need this bundle. `create-mutate` still owns table-element
add/delete at the slide level.

21 new engine tests (15 handlers + 6 register); 249 total engine tests.
All 9 gates green. Skill `tools/table-cm1/SKILL.md` flipped from
placeholder to shipped contract.
