---
title: Tools — QC/Export/Bulk Bundle
id: skills/stageflip/tools/qc-export-bulk
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-164
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/tools/validate/SKILL.md
  - skills/stageflip/tools/slide-cm1/SKILL.md
  - skills/stageflip/tools/element-cm1/SKILL.md
---

# Tools — QC/Export/Bulk Bundle

Nine tools spanning three responsibilities: quality-control audits,
cross-element bulk ops, and export-prep helpers. Slide-mode only. All
handlers type against `MutationContext`; QC tools emit no patches but
share the write-tier context signature.

Scope boundary vs `validate` (T-159): `validate` handles schema +
structural validation (duplicate ids, schema parse, timing coverage).
This bundle handles content-quality audits (a11y, layout, orphans) and
production-prep utilities (bulk edits, export helpers).

Registration: `registerQcExportBulkBundle(registry, router)` from
`@stageflip/engine`.

## Tools

### QC (read-only, all take `{}`)

- `check_alt_text_coverage` — find images without `alt`. Empty-string
  alt is treated as decorative (per ARIA) and NOT flagged.
- `check_notes_coverage` — find slides without speaker notes.
- `check_element_outside_canvas` — find elements whose transform
  extends beyond the 1920×1080 reference canvas; reports per-direction
  tags (`left`/`right`/`top`/`bottom`).
- `check_orphan_animations` — find B3 `anchored` animations whose
  `anchor` id references a non-existent element on the same slide.

### Bulk

- `bulk_set_slide_duration` — apply `durationMs` to many slides
  atomically.
- `bulk_set_element_flags` — flip `visible` / `locked` across elements
  spanning multiple slides.
- `bulk_delete_elements` — delete multiple elements across slides;
  emits patches in reverse element-index order per slide so successive
  removes within a slide stay index-stable.

### Export

- `list_export_profiles` — static catalog of export formats
  (`pdf` / `pptx` / `marp` / `html5-zip` / `video`) with an
  `animationsSupported: boolean` flag per profile.
- `freeze_animations_for_static_export` — clear every element's
  `animations` array across the deck. Run before exporting to profiles
  with `animationsSupported: false` (PDF / Marp).

## Invariants

- Every handler declares `bundle: 'qc-export-bulk'`.
- All 9 handlers type against `MutationContext`. QC handlers emit no
  patches despite the wider context.
- Tool count 9 → within I-9's 30 cap.
- Bulk handlers validate every assignment before emitting any patches
  (atomic all-or-nothing).

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Sibling (schema validation): `tools/validate/SKILL.md`
- Task: T-164
