---
"@stageflip/testing": minor
---

Parity fixture format: thresholds + goldens (T-102).

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

| Fixture | Runtime | Thresholds |
|---|---|---|
| `css-solid-background` | css | 40 dB / 0.99 SSIM — lossless baseline |
| `gsap-motion-text-gsap` | gsap | 30 dB / 0.97 SSIM on `{ x: 200, y: 200, width: 560, height: 140 }` text region |
| `lottie-lottie-logo` | lottie | 32 dB / 0.97 SSIM |
| `shader-flash-through-white` | shader | 34 dB / 0.97 SSIM |
| `three-three-product-reveal` | three | 30 dB / 0.95 SSIM |

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
