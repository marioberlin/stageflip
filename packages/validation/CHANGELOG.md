# @stageflip/validation

## 0.1.0

### Minor Changes

- 36d0c5d: T-227: make the Phase-10 publish targets shippable via Changesets.

  - Renames the CLI's workspace name from `@stageflip/app-cli` →
    `@stageflip/cli` (the plan's publishable name).
  - Drops `"private": true` from the 11 packages in the publishable
    closure: the three primary targets (`@stageflip/{cli,plugin,mcp-server}`)
    plus their transitive deps (`@stageflip/{engine,llm-abstraction,schema,
skills-core,skills-sync,validation,rir,runtimes-contract}`).
  - Adds `"publishConfig": { "access": "public" }`, `"license":
"BUSL-1.1"`, `"repository"`, and `"homepage"` metadata to each
    publishable package. Primary targets also get a `"description"`
    visible on npmjs.com.
  - Copies the root `LICENSE` into each publishable package dir so
    tarballs carry the license even outside the monorepo.
  - Flips `.changeset/config.json`'s `access` from `"restricted"` to
    `"public"`.
  - Adds `.github/workflows/release.yml` — Changesets-driven: opens a
    "Version Packages" PR when changesets land on main; `pnpm publish`
    fires on merge of that PR iff `NPM_TOKEN` is configured.

  Actual publishing is opt-in via the NPM_TOKEN secret; this PR does
  NOT run `changeset publish`.

- 3f7e54c: Pre-render linter — 33 rules across 7 categories (T-104).

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
  _beyond_ the schema; duplicating Zod here would add noise without
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

- 9ea2199: T-138 — auto-fix passes. `LintRule` gains an optional
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

### Patch Changes

- Updated dependencies [019f79c]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [36d0c5d]
  - @stageflip/runtimes-contract@0.1.0
  - @stageflip/rir@0.1.0
