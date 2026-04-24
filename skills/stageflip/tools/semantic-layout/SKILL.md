---
title: Tools — Semantic Layout Bundle
id: skills/stageflip/tools/semantic-layout
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-168
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/tools/layout/SKILL.md
  - skills/stageflip/tools/domain-finance-sales-okr/SKILL.md
---

# Tools — Semantic Layout Bundle

Four write-tier tools that reshape existing slide elements into
conventional layouts. Slide-mode only. Handlers type against
`MutationContext`; each tool emits per-element
`replace /content/slides/<i>/elements/<j>/transform` ops.

Scope boundary vs other layout bundles:

- `layout` (T-158) is the low-level primitive layer — alignment,
  distribution, grid snap, per-element transform edits.
- `domain-finance-sales-okr` (T-166) CREATES new slides with
  pre-composed elements.
- **This bundle** assumes the caller has already placed elements; it
  only reshapes `transform` to match a semantic role layout. Never
  adds, removes, or re-types elements.

## Tools

### `apply_title_body_layout` — `{ slideId, titleElementId, bodyElementId, titleHeight? }`

Title at top (full width, default 160 px), body fills remaining
vertical space.

### `apply_two_column_layout` — `{ slideId, leftElementIds, rightElementIds, topY?, gap? }`

Equal-width columns starting at `topY` (default 240, leaving room for
a title). Elements within each column share remaining vertical space
equally with `gap` (default 24 px) between them.

### `apply_kpi_strip_layout` — `{ slideId, elementIds, y?, height? }`

1–6 elements in a horizontal equal-width strip. Default `y: 280`,
`height: 240`. Useful for retrofitting mis-aligned metric cards.

### `apply_centered_hero_layout` — `{ slideId, elementId, widthRatio?, heightRatio? }`

Centers a single element as a hero box. Ratios default to 0.75 × 0.5
(1440×540 at 240, 270 on the 1920×1080 canvas).

## Invariants

- Every handler declares `bundle: 'semantic-layout'`.
- All 4 handlers type against `MutationContext`.
- Tool count 4 → well within I-9's 30 cap.
- Handlers emit only `transform` replace ops. They never touch
  element `type`, content, animations, or siblings not listed in the
  input.
- Reference canvas: 1920×1080, margin 80 px, column gap 48 px.

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Low-level sibling: `tools/layout/SKILL.md`
- Composite sibling: `tools/domain-finance-sales-okr/SKILL.md`
- Task: T-168
