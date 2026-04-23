---
'@stageflip/validation': minor
'@stageflip/skills-sync': minor
---

T-138 — auto-fix passes. `LintRule` gains an optional
`fix(document, findings): RIRDocument | null` method; new
`autoFixDocument(doc, opts)` orchestrator runs up to 10 iterative
passes until the fix set stabilises or the pass limit is hit.

Each pass is lint → apply every rule that emitted findings AND has
a `fix` method → re-lint. Rules without a `fix` never participate;
their findings simply persist into the final report. The result
surfaces `initialReport`, `finalReport`, `passes[*]` (per-pass
`rulesApplied` + finding counts), `converged`, and `hitMaxPasses`
so callers can diff before/after.

10 rules gained fixes this release:

- `element-rotation-within-reasonable-range` — normalise to
  (-360, 360].
- `composition-dimensions-even-for-video` — round odd width/height
  up to the next even integer.
- `stacking-map-covers-all-elements` — populate missing entries
  from `element.stacking`.
- `stacking-value-matches-element` — sync `stackingMap[id]` to
  `element.stacking` when they disagree.
- `text-font-size-reasonable` — clamp `fontSize` to [1, 2000].
- `video-playback-rate-reasonable` — clamp `playbackRate` to
  [0.25, 4].
- `video-trim-ordered-when-present` — swap `trimStartMs` /
  `trimEndMs` when strictly inverted.
- `embed-src-uses-https` — rewrite `http://` → `https://` on
  `embed.src`.
- `font-requirement-covers-text-families` — add missing family to
  `document.fontRequirements` with the first-seen weight.
- `font-requirement-weights-cover-text-weights` — add the missing
  weight to an already-declared family's requirements.

Rules where no deterministic safe repair exists (e.g.
`text-color-is-valid-css` — there's no sensible default for a
garbage colour string; `shape-custom-path-has-path` — needs an
actual path from the author) deliberately omit `fix`. Their
findings flow through to `finalReport.findings` untouched.

`skills-sync`'s validation-rules generator gains an Auto-fix column
(✓ / —) and an `## Auto-fix (T-138)` prose section. The
`skills-sync:check` CI gate catches drift between the live rule
metadata and the committed SKILL.md.

New public surface: `autoFixDocument`, `AutoFixOptions`,
`AutoFixPassOutcome`, `AutoFixResult`. The `LintRule` type gains an
optional `fix` method.

Plan row `T-138` promoted `[shipped]`.
