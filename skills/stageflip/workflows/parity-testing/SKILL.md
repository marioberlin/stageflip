---
title: Workflow — Parity Testing
id: skills/stageflip/workflows/parity-testing
tier: workflow
status: substantive
last_updated: 2026-04-23
owner_task: T-107
related:
  - skills/stageflip/concepts/determinism
  - skills/stageflip/reference/export-formats
  - skills/stageflip/reference/validation-rules
---

# Workflow — Parity Testing

The parity harness is the quantitative enforcement layer for "every
backend renders the same document the same way". T-100 shipped the
comparators + scoring aggregator; T-101 shipped the CLI; T-102
formalised the fixture format with optional thresholds + goldens;
T-103 wired the path-filtered CI gate; T-107 (this pass) hardens the
workflow guidance below and points the validation-rules reference at
the auto-generated catalogue generator.

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

## Visual-diff viewer (T-137)

`stageflip-parity report` renders a self-contained HTML artifact from
the same fixture set `stageflip-parity` (score mode) consumes. Every
scored frame shows three synchronised view modes:

1. **Side-by-side** — golden ‖ candidate next to each other.
2. **Slider** — candidate layered over golden with a draggable
   `<input type="range">` clipping the candidate so the golden is
   revealed underneath.
3. **Overlay · difference** — candidate layered over golden with CSS
   `mix-blend-mode: difference` + a black background; pure black
   pixels mean identical channels.

Per-frame PSNR / SSIM readouts and failure reasons are rendered
alongside each frame panel. All PNG bytes are base64-embedded into
the output HTML — the file is portable (emailable, PR-attachable,
file:// viewable without a server).

```sh
# Build a report for the whole fixture set:
stageflip-parity report --fixtures-dir packages/testing/fixtures \
  --out /tmp/parity-report.html

# Build a report for a single fixture:
stageflip-parity report packages/testing/fixtures/css-solid-background.json \
  --out /tmp/report.html

# Override the title shown in the header:
stageflip-parity report --fixtures-dir packages/testing/fixtures \
  --title "Release candidate RC-42" --out report.html
```

**Exit codes**: `0` on successful HTML emission (even when a scored
fixture FAILs its thresholds — the viewer is a tool for diagnosing
failures, not a gate). `2` on usage errors.

**Skip fixtures** (`no-goldens` / `no-candidates` / `missing-frames`)
render as banner-only sections; the viewer is useful pre-goldens to
confirm a fixture is wired, not just post-goldens to triage drift.

### Module surface (T-137)

| Export | From | What it does |
|---|---|---|
| `renderViewerHtml(input)` | `@stageflip/parity-cli` | Pure HTML string generator. All PNGs must already be base64-embedded in `input.fixtures[i].frames[j].goldenUri` / `.candidateUri`. |
| `buildViewerInput(outcomes, pngReader, options)` | `@stageflip/parity-cli` | Orchestrator — reads PNG bytes via an injectable `PngReader` port and produces a `ViewerHtmlInput`. Missing assets yield `null` URIs + `missingReason` passthrough. |
| `runReport(argv, io)` | `@stageflip/parity-cli` | CLI subcommand entry. Scores fixtures, reads PNGs, writes HTML. |
| `parseReportArgs(argv)` | `@stageflip/parity-cli` | Pure argv parser — `--out` / `--fixtures-dir` / `--candidates` / `--title` / `--help`. |

### What's NOT in the viewer

- **Pixel-level SSIM / PSNR heatmaps.** Mean per-frame scores ship;
  block-level SSIM maps need `@stageflip/parity` to expose its
  internal windowed SSIM matrix (not currently public). Tracked as a
  follow-up.
- **Watch mode / live reload.** The artifact is one-shot; re-run
  `stageflip-parity report` after re-rendering candidates.
- **Region-scoped rendering.** The viewer always displays the full
  frame even when `thresholds.region` is set. Adding a region-overlay
  box is a cheap follow-up if it becomes necessary.

## Workflow guidance (T-107)

### When to update a golden

- **Never casually.** A golden is the ground truth for a fixture;
  replacing it silently accepts whatever pixel shift produced the
  mismatch. Only bump goldens when the rendered output is
  **intentionally** different: a runtime bug fix, a schema change
  with downstream rendering semantics, a new asset resolution.
- **Always include a rationale** in the PR description. The changeset
  should name the commit that caused the intended shift and — when
  relevant — the upstream issue / ADR.
- **Re-run locally first** before committing. Run
  `pnpm parity --fixtures-dir packages/testing/fixtures` to confirm
  only the fixtures you expect to shift are showing PSNR/SSIM
  changes. An unintended drift in a fixture you didn't mean to touch
  is almost always a regression in a shared runtime / host.
- **Bump thresholds instead** when the drift is codec noise (video
  fixtures) and the visible output is indistinguishable. Bumping is
  safer than replacing goldens because the same goldens keep
  catching regressions elsewhere. If you find yourself repeatedly
  bumping one fixture's thresholds, that's a signal to isolate the
  non-determinism source (probably a font-hinting, GPU-driver, or
  BeginFrame-vs-screenshot mode issue).

### Triage playbook for a tanked SSIM score

When CI flags a fixture's SSIM below threshold:

1. **Open the fixture's region bounds** in the manifest. If
   `thresholds.region` is set, the mismatch is inside that
   rectangle (text-heavy area). If unset, it's anywhere in the frame.
2. **Open side-by-side** goldens vs candidates for the failing
   frames via `stageflip-parity report --out report.html` (T-137).
   Open the HTML file in any browser and use the slider / overlay-
   difference views to localise pixel drift.
3. **Check which frames failed** via `ScoreReport.frames[*]`. If
   only one frame failed while the rest passed, the drift is
   temporally localised — likely an animation easing, frame
   interpolation, or seek-state bug. If all frames failed, the
   drift is global — likely a font-loading, GPU-context, or
   composition-level issue.
4. **Run the specific fixture locally** via `pnpm parity
   <fixture.json>` to confirm CI reproduction. If it passes locally,
   the issue is environmental (Linux-vs-macOS Chrome, CI font
   availability, BeginFrame-vs-screenshot-mode disparity).
5. **Never silence by raising `maxFailingFrames`** beyond what the
   fixture genuinely tolerates. If a fixture consistently has one
   flaky frame, isolate the flakiness source — don't normalise it
   away.

### Threshold tuning guidance

Per-fixture thresholds are per-runtime:

| Runtime class | Typical PSNR floor | Typical SSIM floor | Why |
|---|---|---|---|
| CSS (lossless) | 40 dB | 0.99 | Pure CSS fills/text are codec-free; near-identical expected. |
| Lottie | 32 dB | 0.97 | Vector rasterisation + anti-aliasing; small drift per GPU. |
| Shader | 34 dB | 0.97 | Fragment-shader output is stable but GPU-quantisation adds noise. |
| GSAP text | 30 dB | 0.97 (on text region) | Text layout drift between CI platforms; use region-scoped SSIM. |
| Three (3D) | 30 dB | 0.95 | Lighting + anti-aliasing + depth; tolerate more. |
| Video (h264) _(TBD)_ | 28 dB | 0.95 | Codec noise dominates; SSIM is the load-bearing metric. **No codec fixture exists yet — calibrate after the first codec parity fixture lands.** |
| Video (prores) _(TBD)_ | 40 dB | 0.99 | Near-lossless codec; tighten accordingly. **No codec fixture exists yet — calibrate after the first codec parity fixture lands.** |

Tune these per-fixture via the `thresholds` block. Global defaults
(`DEFAULT_THRESHOLDS` in `@stageflip/parity`) are 30 dB / 0.97 / 0
— appropriate for most mid-quality runtimes but too generous for
lossless and too strict for some codec paths.

**When in doubt, start strict.** A too-strict threshold fails fast
and prompts analysis; a too-loose threshold hides regressions
forever. The parity harness is defence-in-depth on top of
per-runtime unit tests, not a replacement.

### Priming goldens (first-time)

1. Render the fixture via the renderer-cdp pipeline (headless Chrome
   + ffmpeg doctor-check green). Generate PNGs at each reference
   frame.
2. Visually verify the output looks correct. This is the ONLY
   non-automated step; goldens are the ground truth.
3. Copy the PNGs into `<fixture-dir>/<goldens.dir>/frame-<n>.png`.
4. Run `pnpm parity <fixture.json>` locally. It should report PASS.
5. Commit goldens + any threshold adjustments as a single PR. Use
   the fixture's parity fields (`thresholds`, `goldens.dir`) to
   document the baseline.

### Priming in CI (T-119b / T-119c / T-119e / T-119f)

The `render-e2e` CI job primes BOTH goldens sets on every
rendering-adjacent PR and uploads each as a separate artifact:

1. **Dry-run audit** — invokes `pnpm parity:prime --reference-fixtures
   --dry-run` to exercise CLI plumbing without launching Chrome.
2. **Reference-set real render** — `pnpm parity:prime
   --reference-fixtures --out …`. Emits 9 PNGs (3 hand-coded
   RIRDocuments × `[0, mid, last]`) to
   `$RUNNER_TEMP/parity-goldens-reference/`. Uploaded as
   `parity-goldens-reference-<sha>` (7-day retention).
3. **Parity-fixture real render** — `pnpm parity:prime --parity
   packages/testing/fixtures --out …`. Each `*.json` is parsed as a
   FixtureManifest, converted to an RIRDocument via
   `manifestToDocument` (T-119d), and rendered at the manifest's
   declared `referenceFrames`. Emits one subdir per fixture
   (`<manifest.name>/`) with PNGs named per `goldens.pattern` (or
   `frame-${frame}.png` by default). Uploaded as
   `parity-goldens-fixtures-<sha>` (7-day retention).

### Operator workflow for committing goldens

1. Open a PR that touches any rendering-adjacent path (or push
   directly if operating on a dedicated priming branch).
2. Wait for the `render-e2e` CI job to finish. The PR's checks page
   shows both `parity-goldens-reference-<sha>` and
   `parity-goldens-fixtures-<sha>` artifacts.
3. Download the relevant artifact and visually inspect each PNG.
4. Commit the PNGs to the canonical location for each fixture:
   - **Reference set** — destination depends on how consumers want
     to wire them (the 3 reference fixtures in
     `@stageflip/renderer-cdp` are hand-coded RIRDocuments with no
     `goldens.dir` today; a follow-up can define one).
   - **Parity fixtures** — copy each fixture's PNGs into the
     directory the manifest's `goldens.dir` already points to. The
     parity harness (`pnpm parity`) flips from structural-skip to
     behavioural-gate as soon as goldens land.

The **priming PR should be separate from any behaviour change**. If
a PR both changes what gets rendered AND commits new goldens, there's
no way for future reviewers to tell whether the golden change was
intentional or a drive-by.
