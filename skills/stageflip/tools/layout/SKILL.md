---
title: Tools — Layout Bundle
id: skills/stageflip/tools/layout
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-158
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
  - skills/stageflip/tools/create-mutate/SKILL.md
---

# Tools — Layout Bundle

Five write-tier tools for element geometry: alignment, distribution,
grid snapping, direct transform edits, size matching. Slide-mode only.
Every tool emits `replace` patches against `slide.elements[*].transform`
and returns a discriminated union on `ok` with failure `reason`s:
`wrong_mode` / `slide_not_found` / `element_not_found`.

Registration: `registerLayoutBundle(registry, router)`.

## Tools

### `align_elements` — `{ slideId, elementIds: string[] (min 2), axis, mode }`

Align 2+ elements. `axis=horizontal` operates on the y dimension (top /
center / bottom edges); `axis=vertical` mirrors for x. `mode` ∈ `start`
/ `center` / `end`.

### `distribute_elements` — `{ slideId, elementIds: string[] (min 3), axis }`

Evenly space 3+ elements between the outermost two. Outermost stay put;
middle centres are equalised. `axis=vertical` distributes along x;
`axis=horizontal` along y (same "axis is the line" convention as
`align_elements`).

### `snap_to_grid` — `{ slideId, elementIds, gridSize }`

Round each element's `x` + `y` to nearest `gridSize`. Width / height
untouched.

### `set_element_transform` — `{ slideId, elementId, transform: Partial<Transform> }`

Patch one or more `transform` fields on a single element. Emits per-
field `replace` ops so untouched fields survive. Prefer this over raw
`update_element` (create-mutate bundle) for geometry edits.

### `match_size` — `{ slideId, sourceElementId, targetElementIds, dimensions? }`

Copy `width` / `height` / both from source to every target. Position
unchanged. Default `dimensions: 'both'`.

## Invariants

- Every handler declares `bundle: 'layout'`.
- Every output is a discriminated union on `ok`; handlers never throw
  for caller-controllable errors.
- Tool count 5 → well within the 30-tool I-9 budget.

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Router: `concepts/tool-router/SKILL.md`
- Sibling (CRUD): `tools/create-mutate/SKILL.md`
- Task: T-158
