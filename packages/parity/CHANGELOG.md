# @stageflip/parity

## 0.1.0

### Minor Changes

- 5439ade: Parity harness — PSNR + SSIM comparators + scoring aggregator (T-100).

  **Phase 5 kicks off with the comparator infrastructure.** Per the
  plan row "PSNR + SSIM (via `ssim.js` MIT); per-fixture thresholds:
  PSNR ≥ configured, SSIM ≥ 0.97 on text-heavy regions; max
  frame-failure budget" this lands the quantitative engine that the
  parity CLI (T-101), fixture format (T-102), and CI gate (T-103)
  all consume.

  **New package**: `@stageflip/parity` (`private: true`).

  Modules (packages/parity/src/):
  - `image-data.ts` — `ParityImageData` type (RGBA, shape-compatible
    with `ssim.js` + browser `ImageData`), `loadPng(source)` via
    `pngjs`, `crop(img, region)`, `assertSameDimensions(a, b)`.
  - `psnr.ts` — pure per-pixel PSNR in dB. RGB-only by default;
    `includeAlpha` option for the rare case where alpha drift
    matters. `Infinity` for bit-identical inputs.
  - `ssim.ts` — thin wrapper over `ssim.js`, surfaces `mssim`.
    Optional `region` crops before scoring (for the plan's
    "text-heavy regions" clause). Forwards `ssim.js` `Options`
    (variant: fast / original / bezkrovny / weber) untouched.
  - `thresholds.ts` — `ParityThresholds { minPsnr, minSsim,
maxFailingFrames }` + `DEFAULT_THRESHOLDS` (30 dB / 0.97 / 0) +
    `resolveThresholds(override?)` with range validation.
  - `score.ts` — `scoreFrames(inputs, opts?)` — batch scorer. One
    `FrameScore` per input; aggregate `ScoreReport` applies the
    failing-frames budget. Per-frame `region` takes precedence over
    `ssimOptions.region`; PSNR respects the same region so cross-
    frame drift outside the focused area doesn't dominate.
  - `index.ts` — 19 re-exports, type-first.

  **Intentionally NOT in scope** (per plan): CLI wrapper (T-101),
  JSON fixture format formalisation (T-102), CI integration
  (T-103), visual-diff viewer (T-105), linter (T-104), auto-fix
  (T-106). T-107 replaces the skill scaffold with the full
  workflow doc.

  **Dependency decisions**:
  - `ssim.js@3.5.0` (MIT) — pre-pinned in `docs/dependencies.md` §3
    at T-001a for exactly this task. Zero runtime transitive deps.
  - `pngjs@7.0.0` (MIT) — net-new to §3 in this PR. T-100 first
    targeted `sharp` (also pre-pinned) but `pnpm check-licenses`
    flagged `@img/sharp-libvips-*` as `LGPL-3.0-or-later`. Per
    `THIRD_PARTY.md` §1.1 + CLAUDE.md §3 that requires an ADR.
    pngjs achieves the same goal (PNG → RGBA buffer) in pure JS
    with zero transitive deps, avoiding the policy exposure at no
    practical cost at fixture sizes. Sharp's §3 entry is retained
    as pre-pinned-but-uninstalled with a clarifying note. Recorded
    in `docs/dependencies.md` Audit 8.

  Test surface: 38 cases across 5 files — `image-data.test.ts` (9),
  `psnr.test.ts` (7), `ssim.test.ts` (5), `thresholds.test.ts` (8),
  `score.test.ts` (9).

  Skill: `skills/stageflip/workflows/parity-testing/SKILL.md`
  promoted from placeholder to `substantive` with module-surface
  table + sketch; T-107 fills the remaining workflow (when to
  update goldens, triage tanked SSIM, per-codec threshold tables).
