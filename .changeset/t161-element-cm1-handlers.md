---
'@stageflip/engine': minor
---

T-161 — Seventh handler bundle shipped: `element-cm1` (12 tools).
Per-element content-mutation tier 1 — text runs + styles, and one
`update_<type>` tool per non-table element. Table edits are out of scope
(T-163 `table-cm1` owns them).

Tools:

- Text (4): `set_text_content` (text + runs + Zod refine forcing at
  least one), `append_text_run`, `remove_text_run` (`run_not_found`
  on out-of-range), `update_text_run_style` (partial-merge on a run's
  `color` / `weight` / `italic` / `underline` / `text`).
- Block text (1): `update_text_style` —
  `fontFamily` / `fontSize` / `color` / `align` / `lineHeight`.
- Per-type (6): `update_shape` / `update_image` / `update_video` /
  `update_audio` / `update_code` / `update_embed`. Each refuses
  `wrong_element_type` when the element discriminant doesn't match.
- Common (1): `set_element_flags` — `visible` / `locked` / `name` on any
  element type.

Special behaviors:

- `update_audio` is the only per-type tool with sub-object merge:
  `mix` is merged field-by-field onto the existing `mix` object
  (gain / pan / fadeInMs / fadeOutMs) rather than replaced wholesale.
- `update_image` (`alt`), `update_code` (`theme`), and
  `set_element_flags` (`name`) follow the T-156 empty-string-removes
  convention for optional fields.

30 new engine tests (24 handlers + 6 register); 165 total engine tests.
All 9 gates green.

Skill `tools/element-cm1/SKILL.md` flipped from placeholder to the
shipped per-tool contract.
