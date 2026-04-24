---
title: Tools — Slide CM1 + Accessibility Bundle
id: skills/stageflip/tools/slide-cm1
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-162
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/tools/create-mutate/SKILL.md
  - skills/stageflip/tools/timing/SKILL.md
  - skills/stageflip/tools/element-cm1/SKILL.md
---

# Tools — Slide CM1 + Accessibility Bundle

Six write-tier tools for slide-level content mutation + accessibility
affordances. Slide-mode only. Handlers type against `MutationContext`;
mutations flow as JSON-Patch ops via `ctx.patchSink.push(op)`.

Scope boundary:

- `create-mutate` (T-156) owns slide CRUD (add / duplicate / delete /
  reorder) and the catch-all `update_slide` for arbitrary field writes.
- `timing` (T-157) owns slide duration + transitions.
- `element-cm1` (T-161) owns per-element content mutation.
- **This bundle** adds focused slide affordances the LLM can reach
  for without packing everything into one generic call, plus
  accessibility primitives: reading-order reorder and bulk alt-text.

Registration: `registerSlideCm1Bundle(registry, router)` from
`@stageflip/engine`.

## Tools

### Slide content

#### `set_slide_title` — `{ slideId, title }`

Empty-string `title` removes the field; otherwise `add` or `replace`
based on prior state. Reports `action: 'set' | 'cleared'`.

#### `set_slide_notes` — `{ slideId, notes }`

Same empty-string-removes semantics for speaker notes. Use
`append_slide_notes` when preserving prior content matters.

#### `append_slide_notes` — `{ slideId, text, separator? }`

Concatenate `text` onto existing notes. `separator` defaults to two
newlines (paragraph break). Refuses `exceeds_max_length` if the combined
string would exceed 5000 chars (the schema limit).

#### `set_slide_background` — `{ slideId, background: SlideBackground | null }`

Set a `{ kind: 'color', value }` or `{ kind: 'asset', value }`
background; pass `null` to clear. Noop when asked to clear an absent
background.

### Accessibility

#### `reorder_slide_elements` — `{ slideId, order: string[] }`

Replace the slide's `elements` array order. `order` must contain every
existing element id exactly once (drift-gate reasons
`mismatched_ids` / `mismatched_count`). Element array order is BOTH the
a11y reading order (screen readers announce in document order) AND the
z-index source for the RIR compiler (array-index × 10) — reordering
affects both. No other bundle reorders elements.

#### `bulk_set_alt_text` — `{ slideId, assignments: Array<{ elementId, alt }> }`

Set alt text on multiple image elements in one call. Empty-string `alt`
marks an image as decorative (removes the field per ARIA convention).
**Atomic** — validates every assignment (element exists, is `image`)
before emitting any patches; rejects with `element_not_found` or
`wrong_element_type` on first offender.

## Invariants

- Every handler declares `bundle: 'slide-cm1'`.
- All 6 handlers type against `MutationContext`.
- Tool count 6 → well within I-9's 30 cap.
- `bulk_set_alt_text` is the only bundle tool with all-or-nothing
  validation semantics (fail without partial patches).
- Reading order (reorder_slide_elements) is intentionally co-located
  with a11y tools — the element array IS the reading order.

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Siblings: `tools/create-mutate/SKILL.md`, `tools/timing/SKILL.md`,
  `tools/element-cm1/SKILL.md`
- Task: T-162
