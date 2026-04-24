# @stageflip/testing

## 0.1.0

### Minor Changes

- 6177c25: Parity fixture manifests (T-067). Seeds the Phase 5 parity harness
  with one JSON manifest per demo clip shipped by the Phase 3 runtimes.

  Exports:

  - `fixtureManifestSchema` — Zod schema for a fixture manifest.
  - `parseFixtureManifest(raw)` — parse + validate a raw object.
  - `FixtureManifest` — inferred type.

  Ships seven manifests under `packages/testing/fixtures/`, one per
  demo clip (css, gsap, lottie, shader×3, three). Each manifest
  carries:

  - `runtime` + `kind` — clip dispatch identity.
  - `composition` — width / height / fps / durationInFrames.
  - `clip` — `from`, `durationInFrames`, `props`.
  - `referenceFrames` — at minimum `[t=0, mid, end]`.

  No binary reference frames yet — producing those requires the CDP
  renderer (Phase 4) and parity harness (T-100). T-067 is the input
  seed; T-100 scores PSNR+SSIM against goldens; T-102 may extend or
  supersede this schema.

- cf1d6c1: Parity fixture format: thresholds + goldens (T-102).

  **Extends the T-067 fixture manifest** with two optional blocks:

  - **`thresholds`** — per-fixture `minPsnr` (dB), `minSsim` (0..1),
    `maxFailingFrames`, and an optional focus `region`. Any field
    left unset falls through to `@stageflip/parity`'s
    `DEFAULT_THRESHOLDS` at CLI time (T-101). Region is used for
    the "text-heavy SSIM ≥ 0.97" clause per the T-100 plan row.
  - **`goldens`** — `{ dir, pattern? }`. `dir` is the directory
    holding reference PNGs (resolved relative to the fixture JSON
    file); `pattern` defaults to `frame-${frame}.png`.

  Both blocks are opt-in. Fixtures without `goldens` are
  inputs-only (the T-067 seed shape); T-101's CLI reports "no
  goldens — skipping score" rather than failing when a fixture
  hasn't been primed yet.

  **New public exports from `@stageflip/testing`**:

  - `parityThresholdsSchema`, `parityGoldensSchema` — standalone Zod
    schemas for the new fields (callers can compose or reuse).
  - `ParityThresholds`, `ParityGoldens` — inferred types.
  - `resolveGoldenPath(manifest, fixtureDir, frame)` — resolves the
    absolute filesystem path for a given frame's golden PNG.
    Returns `null` when the manifest has no `goldens` block.
  - `DEFAULT_GOLDEN_PATTERN` — `frame-${frame}.png`.

  **5 fixtures pre-populated with thresholds + goldens** (one per
  runtime):

  | Fixture                      | Runtime | Thresholds                                                                     |
  | ---------------------------- | ------- | ------------------------------------------------------------------------------ |
  | `css-solid-background`       | css     | 40 dB / 0.99 SSIM — lossless baseline                                          |
  | `gsap-motion-text-gsap`      | gsap    | 30 dB / 0.97 SSIM on `{ x: 200, y: 200, width: 560, height: 140 }` text region |
  | `lottie-lottie-logo`         | lottie  | 32 dB / 0.97 SSIM                                                              |
  | `shader-flash-through-white` | shader  | 34 dB / 0.97 SSIM                                                              |
  | `three-three-product-reveal` | three   | 30 dB / 0.95 SSIM                                                              |

  The remaining 2 shader variants (`shader-swirl-vortex`,
  `shader-glitch`) stay as T-067 input-only manifests until their
  first goldens are committed.

  **Tests**: 10 → 25 in `@stageflip/testing` (+15 — threshold /
  goldens parsing positive + negative cases + all 6 exports from
  `resolveGoldenPath`). All existing T-067 tests still pass
  (backwards-compat was the explicit design goal).

  **Skill**: `skills/stageflip/workflows/parity-testing/SKILL.md`
  promoted from T-100 stub-surface to include a "Fixture format
  (T-102)" section documenting both new blocks + the starter-5
  table + the graduation-to-parity pattern for input-only fixtures.
  Module-surface table extended with the 3 new `@stageflip/testing`
  exports.

- 7ae5520: T-119d: `manifestToDocument(manifest)` converter.

  Pure function that takes a `FixtureManifest` (composition + clip +
  {runtime, kind, props}) and returns a full `RIRDocument` suitable
  for `PuppeteerCdpSession.mount`. Hand-assembles a single-clip
  document with full-bleed transform, timing derived from the clip
  window, deterministic id + digest (both derived from `manifest.name`),
  and empty animations/fontRequirements. The output is Zod-validated
  via `rirDocumentSchema` before return so shape drift surfaces as a
  parse error at conversion time rather than a mysterious mount failure.

  This unblocks priming the 5 parity fixtures under
  `packages/testing/fixtures/` via `stageflip-parity prime` (T-119b);
  a follow-on patch extends its CLI with a `--parity` flag.

  New dep: `@stageflip/rir` (workspace:\*) — needed for the RIRDocument
  type + rirDocumentSchema.

### Patch Changes

- c053587: T-188: six parity fixtures for the StageFlip.Video profile clips.

  Adds manifest-only fixtures under `packages/testing/fixtures/` covering
  every entry in `VIDEO_CLIP_KINDS` (T-180b), plus an aspect-bounce
  spread so the parity harness exercises more than one aspect ratio:

  | Fixture                               | Composition                | Category                 |
  | ------------------------------------- | -------------------------- | ------------------------ |
  | `frame-runtime-hook-moment.json`      | 1920×1080 30fps            | video overlay            |
  | `frame-runtime-product-reveal.json`   | 1920×1080 30fps            | video overlay            |
  | `frame-runtime-lower-third.json`      | 1920×1080 30fps            | video overlay            |
  | `frame-runtime-endslate-logo.json`    | 1080×1920 30fps (**9:16**) | aspect-bounce            |
  | `frame-runtime-testimonial-card.json` | 1080×1080 30fps (**1:1**)  | aspect-bounce            |
  | `frame-runtime-beat-synced-text.json` | 1920×1080 30fps            | audio-sync (beat-driven) |

  Each manifest pins reference frames at interesting points (entrance
  peaks, holds, exits, beat markers) and lands the standard
  `thresholds: { minPsnr: 32, minSsim: 0.95, maxFailingFrames: 0 }`
  expected by the frame-runtime-bridge tier.

  The **captions** parity category called out in the plan is already
  covered by the existing `frame-runtime-subtitle-overlay.json` fixture
  (karaoke word reveal) — T-184's caption pack hydrates the same render
  surface, so no duplicate manifest is needed.

  Goldens (PNG references) are not shipped in this PR; they're produced
  by the CDP renderer at harness time and committed separately as each
  fixture's render pipeline solidifies.

  Wiring:

  - `KNOWN_KINDS` in `packages/testing/src/fixture-manifest.test.ts`
    gains entries for the six video kinds.
  - `packages/testing/fixtures/README.md` adds a T-188 table row.

  Testing fixtures: 41 → 47. Manifest schema + uniqueness validator
  green (39 tests pass across the testing package).

- Updated dependencies [36d0c5d]
  - @stageflip/rir@0.1.0
