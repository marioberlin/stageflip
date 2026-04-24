---
'@stageflip/engine': minor
---

T-158 — Fourth handler bundle shipped: `layout` (5 tools). Element
geometry operations: alignment, distribution, grid snap, direct
transform edits, size matching. Slide-mode only.

- `align_elements(slideId, elementIds[≥2], axis, mode)` — align 2+
  elements on start / center / end of the chosen axis.
- `distribute_elements(slideId, elementIds[≥3], axis)` — evenly space
  3+ elements; outermost stay put.
- `snap_to_grid(slideId, elementIds, gridSize)` — round x+y to nearest
  gridSize. Size untouched.
- `set_element_transform(slideId, elementId, transform: Partial<Transform>)`
  — per-field `replace` patches.
- `match_size(slideId, sourceElementId, targetElementIds, dimensions?)`
  — copy width / height / both to targets; default `both`.

Every output is a discriminated union on `ok`; failure `reason`s are
`wrong_mode` / `slide_not_found` / `element_not_found`.

18 new engine tests (12 handlers + 6 register); 119 total. Skill
`tools/layout/SKILL.md` flipped to substantive.
