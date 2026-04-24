---
'@stageflip/engine': minor
---

T-162 — Eighth handler bundle shipped: `slide-cm1` + accessibility (6
tools). Focused slide-level affordances + a11y primitives.

Tools:

- Slide content (4): `set_slide_title` (empty-string removes),
  `set_slide_notes` (empty-string removes), `append_slide_notes`
  (concatenation with custom separator; `exceeds_max_length` refusal
  when total > 5000 chars), `set_slide_background` (pass `null` to
  clear).
- A11y (2): `reorder_slide_elements` (drift-gate reorder of the
  `elements` array — the array order is both a11y reading order and
  RIR z-index source), `bulk_set_alt_text` (atomic multi-image alt
  setter; empty-string marks decorative; validates every assignment
  before emitting any patches).

Scope boundary: `create-mutate` still owns slide CRUD and the catch-all
`update_slide`; `timing` owns duration + transition; this bundle is
the first to reorder elements within a slide.

24 new engine tests (18 handlers + 6 register); 228 total engine tests.
All 9 gates green. Skill `tools/slide-cm1/SKILL.md` flipped from
placeholder to the shipped per-tool contract.
