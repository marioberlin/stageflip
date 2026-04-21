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

**Status**: scaffolded. T-100 ships the comparator + scoring surface
described below. T-101 ships the CLI wrapper. T-102 formalises fixture
format. T-103 wires CI. T-107 replaces this file with the substantive
workflow doc (when-to-score, how-to-debug-a-failure, threshold tuning).

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

## What comes later

- **T-101** — `pnpm parity [<fixture>]` CLI that walks a fixture
  directory and drives `scoreFrames`.
- **T-102** — JSON fixture format formalisation (extends the T-067 seed
  in `packages/testing/src/fixture-manifest.ts` with threshold config
  + golden PNG paths).
- **T-103** — CI integration; gate runs on any PR touching rendering
  code or `packages/parity/**`.
- **T-105** — visual-diff viewer (side-by-side / slider / overlay)
  consuming the `ScoreReport`.
- **T-107** — substantive workflow doc: when to update a golden, how
  to triage a tanked SSIM, codec-specific threshold tables.
