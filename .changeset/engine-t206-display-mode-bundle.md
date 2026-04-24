---
"@stageflip/engine": minor
"@stageflip/app-agent": minor
---

T-206: `display-mode` engine bundle — 16th canonical bundle, two
display-profile-specific agent tools.

- `optimize_for_file_size` — plan which pre-pack optimisation passes
  (unused-CSS strip, JS minify, image optimizer) to enable for a
  display banner given a target ZIP size in KB. Returns a
  recommendation list sorted by expected savings. Defaults `targetKb`
  to `DisplayContent.budget.totalZipKb`, then to the IAB 150 KB
  baseline. Does not mutate the document; the Executor threads the
  recommendations into `optimizeHtmlBundle` (T-205).
- `preview_at_sizes` — resolve per-size preview specs for a display
  banner. Falls back to `DisplayContent.sizes` when `input.sizes` is
  absent; returns `{ sizeId, width, height, durationMs }` per size —
  consumed by the editor multi-size canvas grid (T-201) and the
  display app (T-207).

Both gate on `doc.content.mode === 'display'`; in any other mode the
tools return `{ ok: false, reason: 'wrong_mode' }`.

**Drift-gate bumps** — `CANONICAL_BUNDLES` grows from 15 → 16,
`DISPLAY_MODE_BUNDLE_NAME = 'display-mode'` is added to the engine
barrel, the shared `@stageflip/app-agent` orchestrator wires the new
`registerDisplayModeBundle`, and `scripts/gen-tool-skills.ts`
`OWNER_TASK_MAP` maps `'display-mode' → 'T-206'` so the per-bundle
SKILL is auto-generated. Count assertions bumped in
`packages/engine/src/bundles/registry.test.ts` and
`packages/app-agent/src/orchestrator.test.ts`.

Follow-up: `skills/stageflip/tools/display-mode/SKILL.md` is generated
(15 tool-skill files → 16). `gen-tool-skills:check` PASS.

15 new tests (8 register-drift + 7 handler behaviour); 0 new runtime
deps.
