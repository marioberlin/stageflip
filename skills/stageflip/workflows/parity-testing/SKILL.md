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
| `scoreFixture(fixturePath, opts?)` | `@stageflip/parity-cli` | End-to-end fixture scoring. Returns a `FixtureScoreOutcome` with status 'scored' / 'no-goldens' / 'no-candidates' / 'missing-frames'. |
| `runCli(argv, io?)` + `parseArgs(argv)` | `@stageflip/parity-cli` | CLI entry — argv parse + exit-code-returning runner. Injectable `CliIo` for tests. |
| `formatOutcome` + `formatSummary` | `@stageflip/parity-cli` | Pretty console-output helpers. |
| `outcomeIsFailure(outcome)` | `@stageflip/parity-cli` | Predicate — only scored-and-failed counts as a hard CLI failure. |

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

## CLI (T-101)

`pnpm parity` drives `scoreFrames` end-to-end: fixture parse →
threshold resolve → golden + candidate path resolution → PNG load
→ score → pretty report + exit code.

```sh
# Score an explicit fixture (candidate frames default to
# <fixture-dir>/candidates/<fixture-name>/):
pnpm parity packages/testing/fixtures/css-solid-background.json

# Score every *.json under a directory:
pnpm parity --fixtures-dir packages/testing/fixtures

# Override the candidates directory (useful when the renderer
# dropped PNGs somewhere other than the default):
pnpm parity my-fixture.json --candidates /tmp/rendered-frames

# Show help:
pnpm parity --help
```

**Exit codes**:

- `0` — every scored fixture passed. Skipped fixtures (no
  goldens, no candidates, missing frames) do NOT fail the run,
  so CI greens through until goldens are primed.
- `1` — at least one fixture was scored and FAILED its
  thresholds.
- `2` — usage / argument error.

**Skip reasons**:

- `no-goldens` — manifest has no `goldens` block (fixture is
  input-only).
- `no-candidates` — candidates directory entirely missing.
- `missing-frames` — some frames have no golden or no candidate.

Programmatic consumers (future T-103 CI gate, T-105 visual diff)
import `scoreFixture(fixturePath, opts?)` and `runCli(argv, io?)`
from `@stageflip/parity-cli` directly.

## CI gate (T-103)

`.github/workflows/ci.yml` ships a `parity` job that runs
`pnpm parity --fixtures-dir packages/testing/fixtures` on any PR
that touches rendering-adjacent paths:

- `packages/parity/**`
- `packages/parity-cli/**`
- `packages/renderer-cdp/**`
- `packages/cdp-host-bundle/**`
- `packages/frame-runtime/**`
- `packages/rir/**`
- `packages/schema/**` — upstream of RIR; schema-only changes can
  still shift rendered output via the compiler.
- `packages/fonts/**` — direct dep of renderer-cdp; font-loading
  changes shift glyph rasterisation at capture time.
- `packages/runtimes/**`
- `packages/testing/**`
- `.github/workflows/ci.yml`

`packages/renderer-core/**` is **deliberately excluded** while the
package remains a stub — add it to the filter when it gains real
rendering logic.

Path filtering is done by [dorny/paths-filter](https://github.com/dorny/paths-filter);
PRs that don't touch the filter set skip the job entirely (and
the skip step emits a visible `Skipped — no rendering-adjacent files
changed` line for the UI).

**Current behaviour** — while goldens are still being primed, the
harness reports every fixture as `no-candidates` / `no-goldens`
(depending on the fixture) and exits `0`. The job is therefore a
*structural gate*: it catches fixture-manifest drift, CLI
regressions, and threshold-resolution bugs, but not pixel drift.
The same job becomes a *behavioural gate* automatically as
goldens + candidates land under each fixture's `goldens.dir`
(relative to the fixture JSON).

**Priming goldens** (future) — once a fixture's candidate render
pipeline is stable, commit the first set of goldens and run
`pnpm parity` locally to confirm a clean PASS. Subsequent PRs
that change rendering code must keep those goldens green or bump
their thresholds in the manifest.

## What comes later

- **T-105** — visual-diff viewer (side-by-side / slider / overlay)
  consuming the `ScoreReport`.
- **T-107** — substantive workflow doc: when to update a golden, how
  to triage a tanked SSIM, codec-specific threshold tables.
