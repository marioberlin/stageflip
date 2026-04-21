---
"@stageflip/validation": minor
---

Pre-render linter — 33 rules across 7 categories (T-104).

**Fleshes out `@stageflip/validation`** from its placeholder stub
(pre-existing) into the pre-render linter for `RIRDocument`. Catches
problems that Zod can't express at schema-parse time — timing
windows vs composition duration, clip-registry resolution,
font-requirement coverage, codec-hygiene constraints — plus quality
issues like empty text, off-canvas visible elements, and
`visible + opacity:0` contradictions.

**Public surface**:

- `lintDocument(document, opts?)` → `LintReport` (findings + per-
  severity counts + `passed` flag). Never throws; a misbehaving rule
  produces a synthetic `error` finding and the batch keeps moving.
- `LintRule`, `LintFinding`, `LintReport`, `LintContext`,
  `LintSeverity` types.
- `ALL_RULES` — default catalogue.
- Category-scoped exports: `TIMING_RULES`, `TRANSFORM_RULES`,
  `CONTENT_RULES`, `COMPOSITION_RULES`, `FONT_RULES`,
  `STACKING_RULES`, `CLIP_RULES`.
- `LintOptions.include` / `LintOptions.exclude` — rule-id
  allowlist / denylist applied on top of `ALL_RULES` (or a
  caller-supplied `rules` array).

**Rule catalogue (33 rules)**:

- **Timing & identifiers (5)**: element-timing-within-composition,
  animation-timing-within-element, animation-ids-unique-within-
  element, element-ids-unique, elements-array-non-empty.
- **Transform (4)**: element-overlaps-composition-bounds,
  element-not-tiny-when-visible,
  element-opacity-non-zero-when-visible,
  element-rotation-within-reasonable-range.
- **Content (12)**: text-non-empty, text-font-size-reasonable,
  text-color-is-valid-css, shape-has-fill-or-stroke,
  shape-custom-path-has-path, shape-fill-is-valid-css,
  video-playback-rate-reasonable, video-trim-ordered-when-present,
  embed-src-uses-https, chart-series-length-matches-labels,
  chart-series-non-empty, table-cells-within-bounds.
- **Composition (5)**: composition-dimensions-even-for-video,
  composition-fps-standard, composition-duration-reasonable,
  composition-fits-mode-aspect-hint, meta-digest-present.
- **Fonts (2)**: font-requirement-covers-text-families,
  font-requirement-weights-cover-text-weights.
- **Stacking (3)**: stacking-map-covers-all-elements,
  stacking-value-matches-element, zindex-unique-across-root.
- **Clips (2)**: clip-kind-resolvable (gracefully downgrades to
  `info` when `LintContext.findClip` isn't wired),
  clip-runtime-matches-registered.

Severities map to the lifecycle:
- `error` — fail the CI gate; broken render output.
- `warn` — renders but looks wrong.
- `info` — valid but unusual; operator decides.

**Intentionally NOT covered (already enforced by Zod parse)**:
positive width/height, opacity ∈ [0,1], endFrame > startFrame,
animation timing well-formed, etc. The linter is defense-in-depth
*beyond* the schema; duplicating Zod here would add noise without
catching anything new.

**Skill**: `skills/stageflip/reference/validation-rules/SKILL.md`
promoted from placeholder to **substantive** with a full rule
catalogue grouped by category, quick-start snippet, and
lifecycle/customisation notes. T-107 will replace this hand-curated
document with a build-time auto-generated version sourced from each
rule's `id`, `severity`, and `description` metadata.

**Tests**: 41 cases across `runner.test.ts` (runner behaviour +
every rule has at least one positive-case assertion). Includes a
"ALL_RULES contains at least 30 rules" invariant per the plan row's
"30+ rules" target and an id-uniqueness check to prevent silent
rule collisions.
