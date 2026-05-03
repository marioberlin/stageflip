# @stageflip/skills-sync

## 0.1.0

### Minor Changes

- 624038f: Auto-gen validation-rules reference + workflow guidance (T-107).

  **Closes out the Phase 5 skill surface.** The parity-testing skill
  gains substantive "when to update a golden / triage a tanked SSIM /
  threshold tuning" guidance; the validation-rules reference switches
  from hand-curated to auto-generated so rule-surface drift can't
  silently go undocumented.

  **New generator — `generateValidationRulesSkill(pkg)`**:

  Exported from `@stageflip/skills-sync`. Reads every
  `LintRule`'s `id`, `severity`, and `description` from the live
  `@stageflip/validation` module surface + the category-grouped
  arrays (`TIMING_RULES`, `TRANSFORM_RULES`, etc.) and emits a
  deterministic markdown catalogue with:
  - Frontmatter (`status: auto-generated`, `owner_task: T-107`)
  - Intro with rule-count summary
  - Severity legend
  - Quick-start snippet
  - Per-category rule tables (id / severity / what)
  - Customising + lifecycle prose

  Pipe-in-description and newline-in-description get escaped so they
  survive the markdown table. Empty categories render with a
  "_No rules registered in this category._" placeholder so the
  skeleton is stable across future rule additions.

  **Wiring**:
  - `scripts/sync-skills.ts` gains a second job (`reference/validation-rules`)
    alongside the existing schema job.
  - `pnpm skills-sync` writes both SKILL.md files.
  - `pnpm skills-sync:check` now fails if either drifts from its
    generator output — same mechanism as the schema skill.
  - `@stageflip/skills-sync` adds `@stageflip/validation` as a
    workspace dep. Validation is type-only-imported from outside
    (runtime imports are self-contained), so tsx resolves the source
    without requiring rir/runtimes-contract to be built first.

  **Workflow guidance (parity-testing SKILL.md)**:

  The "What comes later" T-107 row is replaced with three new
  substantive sections:
  - **When to update a golden** — never casually; bump thresholds
    instead of replacing goldens when drift is codec noise; always
    document rationale; always re-run locally first.
  - **Triage playbook for a tanked SSIM** — 5-step process: region
    bounds → side-by-side → per-frame breakdown → local reproduction
    → isolate non-determinism source. Explicitly discourages
    silencing via `maxFailingFrames` bumps.
  - **Threshold tuning** — per-runtime class reference table (CSS
    lossless, Lottie, Shader, GSAP text, Three 3D, h264, prores)
    with typical PSNR + SSIM floors. "Start strict" framing.
  - **Priming goldens** — 5-step first-time setup.

  Skill also adds a `related:` link to `reference/validation-rules`
  for proximity to the linter reference.

  **Tests**: 8 generator cases (group layout, frontmatter shape,
  rule-count totalling, pipe-escape, empty-category placeholder,
  determinism, prose inclusion, rule-order preservation). Uses a
  synthetic `ValidationRulesPkg` fixture rather than importing the
  real validation surface so test output stays hermetic under rule
  churn.

  **Plan note**: the validation-rules SKILL.md was previously
  hand-curated (T-104 ship). T-107 overwrites it with the generator
  output; the catalogue tables stay identical because T-104's
  hand-written tables matched the rule metadata exactly. Any future
  rule addition now only requires a `pnpm skills-sync`; no more
  hand-editing the skill.

- 3096a1c: T-220: `@stageflip/skills-sync` — four new generators to auto-emit
  skill files from the canonical source of truth:
  - `generateClipsCatalogSkill` (ClipsCatalogPkg) →
    `skills/stageflip/clips/catalog/SKILL.md`.
  - `generateToolsIndexSkill` (ToolsIndexPkg) →
    `skills/stageflip/tools/SKILL.md`.
  - `generateRuntimesIndexSkill` (RuntimesIndexPkg) →
    `skills/stageflip/runtimes/SKILL.md`.
  - `generateCliReferenceSkill` (CliReferencePkg) — ready for T-226
    to wire against `apps/cli`'s command registry; not yet invoked.

  `scripts/sync-skills.ts` produces all three new skill files.
  `packages/cdp-host-bundle/src/runtimes.test.ts` gains a drift test
  that cross-checks the hand-maintained `LIVE_RUNTIME_MANIFEST`
  against `listRuntimes()` after `registerAllLiveRuntimes()` fires
  in happy-dom — keeps the manifest honest without running
  browser-only runtime deps in the node sync script.

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

- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [164b50f]
- Updated dependencies [36d0c5d]
- Updated dependencies [3f7e54c]
- Updated dependencies [9ea2199]
- Updated dependencies [38e4017]
  - @stageflip/schema@0.1.0
  - @stageflip/skills-core@0.1.0
  - @stageflip/validation@0.1.0
