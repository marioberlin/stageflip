# Parity fixtures (T-067 seed, T-102 extended)

One JSON manifest per demo clip shipped by the Phase 3 runtimes. Each
manifest is the smallest description a future Puppeteer-backed renderer
(T-100 / T-102 in Phase 5) needs to produce a reference frame:

- **What** to render — `runtime` + `kind` + `clip.props`.
- **At what dimensions / fps** — `composition.{width, height, fps, durationInFrames}`.
- **For what frames** — `referenceFrames: [t0, mid, end, ...]`.

The schema + loader live at
`packages/testing/src/fixture-manifest.ts`; the validator at
`packages/testing/src/fixture-manifest.test.ts` checks every file in this
directory at `pnpm test` time.

## Scope of T-067

- Ship manifests, schema, and validation.
- **No binary reference frames.** Producing those requires the CDP renderer
  (Phase 4) and the parity harness (T-100); T-067 seeds the inputs.

## Contents

| File | Runtime | Clip kind | T-102 thresholds + goldens |
|---|---|---|---|
| `css-solid-background.json` | `css` | `solid-background` | ✓ (40 dB / 0.99) |
| `gsap-motion-text-gsap.json` | `gsap` | `motion-text-gsap` | ✓ (30 dB / 0.97, text region) |
| `lottie-lottie-logo.json` | `lottie` | `lottie-logo` | ✓ (32 dB / 0.97) |
| `shader-flash-through-white.json` | `shader` | `flash-through-white` | ✓ (34 dB / 0.97) |
| `shader-swirl-vortex.json` | `shader` | `swirl-vortex` | — |
| `shader-glitch.json` | `shader` | `glitch` | — |
| `three-three-product-reveal.json` | `three` | `three-product-reveal` | ✓ (30 dB / 0.95) |

### T-188 StageFlip.Video fixtures

One manifest per `VIDEO_CLIP_KINDS` entry (T-180b), plus an aspect-bounce
spread and a caption-pack sanity check. Together these exercise the Phase 8
render targets called out in `docs/implementation-plan.md` (audio-sync,
captions, video overlays, aspect-bounce).

| File | Composition | Parity category |
|---|---|---|
| `frame-runtime-hook-moment.json` | 1920×1080 30fps | video overlay |
| `frame-runtime-product-reveal.json` | 1920×1080 30fps | video overlay |
| `frame-runtime-lower-third.json` | 1920×1080 30fps | video overlay |
| `frame-runtime-endslate-logo.json` | 1080×1920 30fps (**9:16**) | aspect-bounce |
| `frame-runtime-testimonial-card.json` | 1080×1080 30fps (**1:1**) | aspect-bounce |
| `frame-runtime-beat-synced-text.json` | 1920×1080 30fps | audio-sync (beat-driven) |

The **captions** category is already covered by the existing
`frame-runtime-subtitle-overlay.json` fixture (karaoke-style word reveal);
T-184's caption pack consumes the same render surface, so no duplicate
fixture is needed.

## Adding a new fixture

1. Drop a JSON file in this directory; file name must be
   `<runtime>-<kind>.json` and match the `name` field.
2. Update the `KNOWN_KINDS` allowlist in
   `packages/testing/src/fixture-manifest.test.ts`.
3. `pnpm test` — the validator enforces schema + allowlist + uniqueness +
   "at least three reference frames" convention.

## What T-100 will do with these

The Phase 5 parity harness will:

1. Load each manifest via `parseFixtureManifest`.
2. Spin up a headless browser (via vendored Hyperframes / Puppeteer from
   Phase 4) and render the clip at each `referenceFrame`.
3. Snapshot the rendered canvas bytes.
4. Compute PSNR + SSIM against goldens (stored alongside each manifest
   as PNG files — not present during T-067).
5. Fail the gate if any frame scores below the configured thresholds.

T-102 extended the schema with two optional blocks: `thresholds`
(`minPsnr`, `minSsim`, `maxFailingFrames`, optional focus `region`) and
`goldens` (`dir` + optional filename `pattern`). 5 fixtures (one per
runtime) ship pre-populated; the remaining 2 shader variants stay as
input-only manifests until their first goldens are committed.
`resolveGoldenPath(manifest, fixtureDir, frame)` in
`@stageflip/testing` returns the absolute path for a specific frame's
golden; `null` when the manifest has no `goldens` block.

Per-fixture thresholds — when set — override `@stageflip/parity`'s
`DEFAULT_THRESHOLDS` (30 dB / 0.97 / 0). T-101's CLI merges the two
and prints the resolved values in its report.
