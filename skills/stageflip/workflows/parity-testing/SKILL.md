---
title: Workflow — Parity Testing
id: skills/stageflip/workflows/parity-testing
tier: workflow
status: substantive
last_updated: 2026-04-21
owner_task: T-107
related:
  - skills/stageflip/concepts/determinism
  - skills/stageflip/reference/export-formats
---

# Workflow — Parity Testing

**Status**: module surface is substantive (T-100); workflow guidance
is still thin. T-100 ships the comparator + scoring surface described
below. T-101 ships the CLI wrapper. T-102 formalises fixture format.
T-103 wires CI. T-107 replaces the "What comes later" section with
substantive workflow material (when-to-score, how-to-debug-a-failure,
threshold tuning).

## What parity-testing proves

StageFlip renders go through multiple backends (live CDP via
`@stageflip/renderer-cdp`, bake runtimes in Phase 12, eventually
export-video + export-html5-zip paths). Every backend should produce
the same rendered frame for the same input document — "parity".
Parity is enforced quantitatively by comparing candidate PNG frames
against golden PNGs using two metrics:

- **PSNR** (peak signal-to-noise ratio, dB) — raw pixel fidelity.
- **SSIM** (mean structural similarity, 0..1) — perceptual similarity
  weighted by local luminance, contrast, and structure. More forgiving
  of codec noise, less forgiving of structural drift (misaligned
  glyphs, missing shadows).

A fixture passes when **every scored frame** meets its PSNR + SSIM
thresholds, OR the number of failing frames stays within the fixture's
`maxFailingFrames` budget.

## Module surface (T-100)

| Export | From | What it does |
|---|---|---|
| `ParityImageData` | `@stageflip/parity` | RGBA image container — shape-compatible with `ssim.js` + browser `ImageData`. |
| `loadPng(source)` | `@stageflip/parity` | Decode a PNG (path or bytes) via `pngjs` into `ParityImageData`. |
| `Region` + `crop(img, region)` | `@stageflip/parity` | Integer-aligned sub-rectangle extraction. |
| `psnr(a, b, opts?)` | `@stageflip/parity` | PSNR in dB. RGB-only by default; `includeAlpha` flips to all 4 channels. |
| `ssim(a, b, opts?)` | `@stageflip/parity` | Mean SSIM via `ssim.js`. Optional `region` crops before scoring. |
| `ParityThresholds` + `DEFAULT_THRESHOLDS` | `@stageflip/parity` | `{minPsnr, minSsim, maxFailingFrames}`. Defaults: 30 dB / 0.97 / 0. |
| `resolveThresholds(override?)` | `@stageflip/parity` | Merges partial overrides onto the defaults; validates ranges. |
| `scoreFrames(inputs, opts?)` | `@stageflip/parity` | Batch scorer — one `FrameScore` per input; aggregate verdict applies the failing-frames budget. |
| `fixtureManifestSchema` + `parseFixtureManifest(raw)` | `@stageflip/testing` | Parses a fixture JSON and validates thresholds + goldens (T-102). |
| `parityThresholdsSchema` + `parityGoldensSchema` | `@stageflip/testing` | Standalone Zod schemas for the new T-102 fields. |
| `resolveGoldenPath(manifest, fixtureDir, frame)` | `@stageflip/testing` | Resolves the absolute golden PNG path for a frame. Returns `null` when the manifest has no `goldens` block. |

## Minimum sketch

```ts
import { loadPng, scoreFrames } from '@stageflip/parity';

const frames = await Promise.all(
  referenceFrameNumbers.map(async (frame) => ({
    frame,
    candidate: await loadPng(`./out/frame-${frame}.png`),
    golden: await loadPng(`./goldens/frame-${frame}.png`),
  })),
);

const report = scoreFrames(frames, {
  thresholds: { minPsnr: 32, minSsim: 0.97 },
});

if (!report.passed) {
  console.error(report.reasons);
  for (const f of report.frames.filter((f) => !f.passed)) {
    console.error(`  frame ${f.frame}: ${f.reasons.join(', ')}`);
  }
  process.exit(1);
}
```

## Fixture format (T-102)

Parity fixtures live in `packages/testing/fixtures/*.json` and parse
under `@stageflip/testing`'s `fixtureManifestSchema`. Core fields are
still the T-067 seed (`name`, `runtime`, `kind`, `description`,
`composition`, `clip`, `referenceFrames`). T-102 adds two optional
blocks:

- `thresholds` — per-fixture `minPsnr`, `minSsim`, `maxFailingFrames`,
  and an optional focus `region`. Any field left unset falls through
  to `@stageflip/parity`'s `DEFAULT_THRESHOLDS` at CLI time (T-101).
  Region is used for the text-heavy SSIM ≥ 0.97 clause per the T-100
  plan row.
- `goldens` — `{ dir, pattern? }`. `dir` is the directory holding
  reference PNGs (resolved relative to the fixture JSON file);
  `pattern` defaults to `frame-${frame}.png`. `resolveGoldenPath(
  manifest, fixtureDir, frame)` returns the absolute filesystem path
  for a given frame — used by T-101's CLI when loading goldens.

Fixtures without a `goldens` block are inputs-only (the T-067 seed
shape). T-101's CLI should report "no goldens — skipping score"
rather than failing when a fixture hasn't been primed yet.

5 starter fixtures ship pre-populated with thresholds + goldens
paths (one per runtime):

| Fixture | Runtime | Notes |
|---|---|---|
| `css-solid-background` | css | 40 dB / 0.99 SSIM — lossless baseline |
| `gsap-motion-text-gsap` | gsap | 30 dB / 0.97 SSIM on text region |
| `lottie-lottie-logo` | lottie | 32 dB / 0.97 SSIM |
| `shader-flash-through-white` | shader | 34 dB / 0.97 SSIM |
| `three-three-product-reveal` | three | 30 dB / 0.95 SSIM |

The remaining 2 shader variants (`shader-swirl-vortex`, `shader-glitch`)
remain as T-067 input-only manifests; they can graduate to full parity
coverage as operators commit their first goldens.

## What comes later

- **T-101** — `pnpm parity [<fixture>]` CLI that walks a fixture
  directory and drives `scoreFrames`.
- **T-103** — CI integration; gate runs on any PR touching rendering
  code or `packages/parity/**`.
- **T-105** — visual-diff viewer (side-by-side / slider / overlay)
  consuming the `ScoreReport`.
- **T-107** — substantive workflow doc: when to update a golden, how
  to triage a tanked SSIM, codec-specific threshold tables.
