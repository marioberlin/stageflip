---
title: Tools — QC Export Bulk Bundle
id: skills/stageflip/tools/qc-export-bulk
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-164
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — QC Export Bulk Bundle

Batch quality checks, bulk operations, and export-trigger tools.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/qc-export-bulk/`.

Registration: see `@stageflip/engine`'s `registerQcExportBulkBundle` (or equivalent) export.

## Tools

### `check_alt_text_coverage`

A11y audit: find every image element with no `alt` field (or an empty-string alt that WASN'T explicitly marked decorative). Reports `totalImages` + a list of `{ slideId, elementId }` pairs needing attention. Empty-string alt is treated as decorative (per ARIA convention) and does NOT show up as missing.

### `check_notes_coverage`

Find slides without speaker notes (or with empty-string notes). Returns `totalSlides` + the list of slide ids needing attention.

### `check_element_outside_canvas`

Find elements whose transform bounding box extends outside the 1920×1080 reference canvas. Reports direction tags (`left` / `right` / `top` / `bottom`) so the caller can understand which edge is violated. Elements entirely off-canvas report all four directions the box exits.

### `check_orphan_animations`

Find B3 `anchored` animations whose `anchor` id references a non-existent element on the same slide. Reports `{ slideId, elementId, animationId, missingAnchor }` per orphan. Only checks same-slide scope (cross-slide anchoring isn't allowed by the RIR compiler).

### `bulk_set_slide_duration`

Set `durationMs` on multiple slides at once. Validates every assignment (slide exists) before emitting any patches; rejects atomically with `slide_not_found` on first offender.

- `assignments` (`array`)

### `bulk_set_element_flags`

Bulk version of `set_element_flags` (element-cm1): flip `visible` / `locked` across many elements spanning multiple slides. Fails atomically on first `slide_not_found` / `element_not_found`. Reports `applied` assignments + total `patchCount` emitted (one patch per flip per element).

- `assignments` (`array`)

### `bulk_delete_elements`

Delete multiple elements across slides in one call. Atomic: validates every assignment first. Patches are emitted per-slide in reverse element-index order so successive removes within a slide stay index-stable.

- `assignments` (`array`)

### `list_export_profiles`

Return the static catalog of known export profiles. Each entry has `name`, `description`, and `animationsSupported` — callers that target profiles with `animationsSupported: false` (PDF / Marp) should prep with `freeze_animations_for_static_export` first.

### `freeze_animations_for_static_export`

Clear every element's `animations` array across the deck (replaces with `[]`) so static exports (PDF / Marp / image sequence) render deterministically from the first frame. Reports `animationsCleared` total. Idempotent — rerunning on a frozen deck emits patches (still replacing with `[]`) but leaves visible state unchanged.


## Invariants

- Every handler declares `bundle: 'qc-export-bulk'`.
- Tool count 9 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-164
