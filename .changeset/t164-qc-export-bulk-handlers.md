---
'@stageflip/engine': minor
---

T-164 — Tenth handler bundle shipped: `qc-export-bulk` (9 tools). Spans
three responsibilities: quality-control audits, cross-element bulk
mutations, and export-prep helpers.

Tools:

- QC (4, read-only): `check_alt_text_coverage` (empty-string alt
  treated as decorative, not flagged); `check_notes_coverage`;
  `check_element_outside_canvas` (1920×1080 reference canvas; per-edge
  `left`/`right`/`top`/`bottom` direction tags); `check_orphan_animations`
  (finds B3 `anchored` animations whose anchor id is missing on the
  same slide).
- Bulk (3): `bulk_set_slide_duration`, `bulk_set_element_flags`,
  `bulk_delete_elements` (patches emitted in reverse index order per
  slide for stability). All three validate every assignment before
  emitting any patches.
- Export (2): `list_export_profiles` (static catalog: pdf, pptx, marp,
  html5-zip, video — each flagged with `animationsSupported`);
  `freeze_animations_for_static_export` (clears every element's
  `animations` array across the deck).

Scope boundary: `validate` (T-159) handles schema/structural validation;
this bundle handles content-quality audits + production-prep utilities.

20 new engine tests (14 handlers + 6 register); 269 total engine tests.
All 9 gates green. Skill `tools/qc-export-bulk/SKILL.md` flipped from
placeholder to shipped contract.
