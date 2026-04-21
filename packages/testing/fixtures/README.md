# Parity fixtures (T-067)

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

| File | Runtime | Clip kind |
|---|---|---|
| `css-solid-background.json` | `css` | `solid-background` |
| `gsap-motion-text-gsap.json` | `gsap` | `motion-text-gsap` |
| `lottie-lottie-logo.json` | `lottie` | `lottie-logo` |
| `shader-flash-through-white.json` | `shader` | `flash-through-white` |
| `shader-swirl-vortex.json` | `shader` | `swirl-vortex` |
| `shader-glitch.json` | `shader` | `glitch` |
| `three-three-product-reveal.json` | `three` | `three-product-reveal` |

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

The T-102 "fixture format" task may extend this schema (e.g. adding per-
frame PSNR thresholds, clip-local theming slots); T-067's schema is the
minimal seed that T-102 either generalises or supersedes.
