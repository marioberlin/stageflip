# @stageflip/parity-cli

## 0.1.0

### Minor Changes

- 063310a: Parity CLI — `pnpm parity [<fixture>]` (T-101).

  **End-to-end parity harness usage**: given a T-102 fixture JSON
  and rendered candidate PNGs on disk, score PSNR + SSIM and
  exit with a meaningful code. The heavy lifting is
  `scoreFixture(fixturePath, opts?)`; the CLI is argv parsing +
  pretty output + exit-code derivation on top.

  **New package `@stageflip/parity-cli`** with bin `stageflip-parity`.

  **Usage** (root script `pnpm parity`):

  ```sh
  pnpm parity packages/testing/fixtures/css-solid-background.json
  pnpm parity --fixtures-dir packages/testing/fixtures
  pnpm parity my-fixture.json --candidates /tmp/rendered-frames
  pnpm parity --help
  ```

  **Flow**:

  1. Parse fixture via `@stageflip/testing`'s `parseFixtureManifest`.
  2. Resolve thresholds by merging manifest overrides over
     `@stageflip/parity`'s `DEFAULT_THRESHOLDS` (T-102's optional
     thresholds are honoured here).
  3. Resolve golden + candidate paths per reference frame.
     - Goldens via T-102's `resolveGoldenPath` (`<fixture-dir>/<goldens.dir>/...`).
     - Candidates default to `<fixture-dir>/candidates/<fixture-name>/`;
       `--candidates <dir>` overrides.
     - Same filename pattern as goldens (T-102's `goldens.pattern` or
       `DEFAULT_GOLDEN_PATTERN`).
  4. If either side is missing per-frame, classify:
     - `no-goldens` — manifest has no `goldens` block.
     - `no-candidates` — candidates dir entirely missing.
     - `missing-frames` — some (but not all) frames missing.
  5. Otherwise `loadPng` both sides + call `scoreFrames` and
     classify `scored`.

  **Exit codes**:

  - `0` — every scored fixture passed. Skipped fixtures do NOT
    fail the run, so CI greens through until goldens are primed.
  - `1` — at least one fixture was scored and FAILED its
    thresholds.
  - `2` — usage / argument error (no fixtures, bad flag).

  **Public surface**:

  - `scoreFixture(fixturePath, { candidatesDir?, candidatesPattern? })` →
    `FixtureScoreOutcome` — fixtureDir / manifest / thresholds /
    report / status / missingFrames / summary.
  - `FixtureScoreOutcome`, `MissingFrame`, `ScoreFixtureOptions` types.
  - `outcomeIsFailure(outcome)` predicate.
  - `runCli(argv, io?)` → `Promise<number>` — never calls
    `process.exit`, tests drive it directly.
  - `parseArgs(argv)` pure argv parse.
  - `formatOutcome`, `formatSummary` pretty-printers.
  - `CliIo` interface for injectable stdout/stderr.

  **Build**: `tsup` with `noExternal: ['@stageflip/testing']` — the
  testing package exports raw `.ts` (no build step of its own),
  so it must inline into parity-cli's compiled dist. All other
  workspace deps stay external.

  **Tests**: 26 new cases across `score-fixture.test.ts` (8 — all
  four status branches + threshold merging + custom candidates dir

  - invalid JSON) and `cli.test.ts` (18 — argv parsing, runCli
    exit codes for pass / fail / skipped / help / bad flag / both
    fixtures+dir / --fixtures-dir discovery / missing dir, formatter
    helpers). Uses `pngjs` directly (devDep) to synthesise goldens +
    candidates — no real rendering, no Chrome, no FFmpeg.

  **Smoke-test against the 7 shipped fixtures**: `pnpm parity
--fixtures-dir packages/testing/fixtures` reports 5 skipped
  (no-candidates — goldens are committed per T-102 but candidates
  need rendering) + 2 skipped (no-goldens — `shader-swirl-vortex`
  and `shader-glitch` remain input-only until their goldens are
  primed). Exit 0. Confirms the skip-isn't-failure posture.

  **Root script**: `pnpm parity` builds `@stageflip/parity-cli` first
  via turbo, then invokes the bin.

  **Skill**: `skills/stageflip/workflows/parity-testing/SKILL.md`
  gains a full CLI section with usage examples + exit-code table +
  skip-reason legend. Module-surface table extended with the T-101
  exports. The "What comes later" row for T-101 is removed (it's
  here now).

- e019394: T-119b: `stageflip-parity prime` subcommand for golden priming.

  Ships a pure `primeFixture(input, opts)` orchestrator with a
  `PrimeRenderFn` port (unit-tested against a fake render + fake fs),
  plus a `stageflip-parity prime --reference-fixtures --out <dir>`
  subcommand that wires a Puppeteer-backed primer using
  `PuppeteerCdpSession` + `createRuntimeBundleHostHtml` + the 3
  hand-coded `REFERENCE_FIXTURES` from `@stageflip/renderer-cdp`.
  `--dry-run` reports target paths without launching Chrome.

  Public surface additions: `primeFixture`, `PrimeRenderFn`, `PrimeFsOps`,
  `runPrime`, `parsePrimeArgs`, `PRIME_HELP_TEXT`, `defaultReferenceFrames`,
  `createPuppeteerPrimer`, `createReferenceFixturesResolver`.

  Priming the 5 parity fixtures under `packages/testing/fixtures/`
  requires a `FixtureManifest → RIRDocument` converter (T-119d,
  deferred). Until that lands, `--reference-fixtures` is the only
  supported input to the prime subcommand.

  New workspace deps on `@stageflip/renderer-cdp`,
  `@stageflip/cdp-host-bundle`, and `@stageflip/rir` (all
  `workspace:*`; all remain `private: true` at this phase).

- c6fcd16: T-119f: `stageflip-parity prime --parity <fixtures-dir>` flag.

  Extends the `prime` subcommand to render parity fixtures (JSON
  manifests under `packages/testing/fixtures/`) in addition to the
  hand-coded REFERENCE_FIXTURES. Each `*.json` is parsed via
  `parseFixtureManifest` from `@stageflip/testing`, converted to an
  `RIRDocument` via `manifestToDocument` (T-119d), and rendered at
  the manifest's declared `referenceFrames` positions. Filename
  pattern comes from `manifest.goldens.pattern` when present,
  otherwise `DEFAULT_PRIME_PATTERN`.

  **Breaking (internal)**: `PrimeInputResolver.resolveReferenceFixtures()`
  → `PrimeInputResolver.resolve(opts: PrimeCliOptions)`. Single method,
  options-driven. All consumers are in-workspace.

  Exports renamed:

  - `createReferenceFixturesResolver` → `createPrimeInputResolver`
    (now handles both `--reference-fixtures` and `--parity`).

  Usage additions:

  - `--parity <fixtures-dir>` — prime every \*.json under the dir
  - Mutually exclusive with `--reference-fixtures`
  - `--dry-run` works with both modes

  Also: the primer now calls `registerAllLiveRuntimes()` on the Node
  side before mount. Without this the Node-side
  `@stageflip/runtimes-contract` registry was empty and
  `dispatchClips(document)` rejected every parity-fixture clip as
  "unknown-kind". Re-register is caught-and-ignored (the registry
  throws on duplicate id) so repeat primer creations don't crash.

  Verified end-to-end locally: `pnpm parity:prime --parity
packages/testing/fixtures --out …` emits 21 PNGs (7 fixtures × 3
  frames each) across all 6 runtimes.

- c08899f: T-137 — visual-diff viewer. New `stageflip-parity report` subcommand
  that renders a self-contained HTML artifact from any set of scored
  fixtures.

  Three view modes per frame:

  - **Side-by-side** — golden ‖ candidate.
  - **Slider** — candidate layered over golden with a draggable divider.
  - **Overlay · difference** — candidate layered over golden with
    CSS `mix-blend-mode: difference`; black = identical.

  Per-frame PSNR / SSIM readouts, failure reasons, and threshold recap
  render alongside each frame panel. PNG bytes are base64-embedded so
  the HTML is portable (emailable, PR-attachable, file:// viewable).
  Skip statuses (`no-goldens` / `no-candidates` / `missing-frames`)
  render as banner-only sections so the viewer is useful pre-goldens
  too.

  New public surface:

  - `renderViewerHtml(input)` — pure HTML generator (no IO).
  - `buildViewerInput(outcomes, pngReader, options)` — orchestrator
    that reads PNG bytes via an injectable `PngReader` port.
  - `runReport(argv, io)` + `parseReportArgs(argv)` + `REPORT_HELP_TEXT`
    — CLI subcommand entry.

  Types: `ViewerHtmlInput`, `ViewerFixture`, `ViewerFrame`,
  `BuildViewerInputOptions`, `PngReader`, `ReportCliOptions`.

  CLI:

  ```sh
  stageflip-parity report [fixture.json ...] --out report.html
  stageflip-parity report --fixtures-dir packages/testing/fixtures --out report.html
  stageflip-parity report --help
  ```

  Exit `0` on successful HTML emission (scoring PASS/FAIL does not
  change the exit code — the viewer is a diagnostic tool, not a gate).

  Pixel-level PSNR/SSIM heatmaps are out of scope — they need
  block-level SSIM access in `@stageflip/parity` that isn't public yet.
  Mean per-frame scores ship today; heatmaps are tracked as a follow-up
  in `skills/stageflip/workflows/parity-testing/SKILL.md`.

  Plan row promoted `T-137` → `[shipped]`.

### Patch Changes

- Updated dependencies [0bcc2a8]
- Updated dependencies [12a8382]
- Updated dependencies [1e0c779]
- Updated dependencies [1257b50]
- Updated dependencies [c3d84bd]
- Updated dependencies [f57dbd0]
- Updated dependencies [5439ade]
- Updated dependencies [28674f9]
- Updated dependencies [a7b3f85]
- Updated dependencies [2c08812]
- Updated dependencies [018d9f0]
- Updated dependencies [988731e]
- Updated dependencies [3f65147]
- Updated dependencies [0abbeb7]
- Updated dependencies [ec54b0d]
- Updated dependencies [2b86717]
- Updated dependencies [dc34bc8]
- Updated dependencies [6de5649]
- Updated dependencies [eeecee8]
- Updated dependencies [6dd3b44]
- Updated dependencies [93c6393]
- Updated dependencies [fc85c58]
- Updated dependencies [8a1d95e]
- Updated dependencies [5edf5a1]
- Updated dependencies [5f69c4e]
- Updated dependencies [fc9526b]
- Updated dependencies [75e3d7e]
- Updated dependencies [3096a1c]
- Updated dependencies [36d0c5d]
- Updated dependencies [6177c25]
- Updated dependencies [cf1d6c1]
- Updated dependencies [7ae5520]
- Updated dependencies [c053587]
  - @stageflip/cdp-host-bundle@0.1.0
  - @stageflip/renderer-cdp@0.1.0
  - @stageflip/parity@0.1.0
  - @stageflip/rir@0.1.0
  - @stageflip/testing@0.1.0
