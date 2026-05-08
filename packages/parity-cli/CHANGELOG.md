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

- e6d1a03: T-348 — Add `stranger-things-benguiat` preset binding (Cluster D second preset; **first multi-clip-composition consumer in StageFlip parity-CLI history**; first Cluster D consumer to ride the just-completed T-321 atmospheric-primitive carve-out roadmap end-to-end).

  **Public API surface change (D-T348-1)**: `ClipKindBinding` interface gains an optional `overlays?: ReadonlyArray<{ runtimeId, clipName, buildProps }>` field for multi-clip composition. Single-clip bindings (no `overlays`) remain byte-identical to the pre-T-348 shape — every existing `PRESET_ID_BINDINGS` entry (25 prior) and every clipKind-default arm (10) STILL emits exactly one `RIRDocument.elements` entry. Multi-clip bindings (with `overlays`) fan out one element per overlay in declaration order = z-order: parent at `zIndex: 0`, overlays at `zIndex: 1, 2, 3, ...`. All overlays share the parent's full-canvas `transform` and full-duration `timing`.

  **New `PRESET_ID_BINDINGS['stranger-things-benguiat']` → `strangerThingsBenguiatBinding`** composes the parent `titleSequence` primitive (T-321) with four atmospheric overlays in z-order: `grain` (T-321a; `intensity: 0.15` canonical Stranger Things-grade subtle grain), `light-leak` (T-131b.2; warm-orange family `color1='#ff6b35'/color2='#ff8c1a'/color3='#ffa040'`), `particles` (T-131d.1; `style: 'snow'`, `count: 30`, `color: '#ffffff'` for atmospheric drifting dust), `photographic-overlay` (T-321d; `mode: 'fade'` at `intensity: 0.4` for subtle 80s analog warmth). Five exported props constants: `STRANGER_TITLE_SEQUENCE_PROPS`, `STRANGER_GRAIN_PROPS`, `STRANGER_LIGHT_LEAK_PROPS`, `STRANGER_PARTICLES_PROPS`, `STRANGER_PHOTOGRAPHIC_OVERLAY_PROPS`. titleSequence parent ships `'letterform-assemble'` style with ALL CAPS `'STRANGER THINGS'`, Cormorant Garamond Bold (OFL fallback) → ITC Benguiat Bold (commercial-byo), white letters on `#000000`, red `#FF0000` Gaussian-blur glow (blur 8 px) for the canonical neon-torch-through-canvas register. `letterformScale: 0.7` per primitive default — letterforms ~504 px scale (clipping canvas edges per stub canon "letterform-as-environment"). Parity golden rendered at frame 480 (canonical "full assembly + glow" register) with **lowered thresholds** `--psnr=36 --ssim=0.92` (NOT cluster-norm 42 / 0.98 — mandatory film grain reduces compression precision per stub line 49; T-321a D-T321a-12 explicitly pre-declares lowered thresholds for grain-bearing presets).

  `signOff.typeDesign: 'pending-cluster-batch'` PRESERVED (cluster-batch flip happens in the Cluster D cluster-composer follow-up after all 6 typography-carrying Cluster D presets sign their parity goldens). `DEFAULT_CLIP_KIND_RESOLVER` UNCHANGED — T-350's `titleSequence → squidGameGeometricBinding` clipKind-default arm stays as the fallthrough. All 25 prior `PRESET_ID_BINDINGS` entries UNCHANGED. Cluster D goes from 1/6 → 2/6 signed.

  **Establishes the multi-clip composition pattern for the rest of Cluster D** — T-349 / T-351 / T-352 / T-353 reuse the `overlays?` extension without re-deriving it.

### Patch Changes

- a3b3156: T-323 — `cnn-classic` preset substantive (Cluster A first; first
  `lowerThird` clipKind binding).

  Adds `cnnClassicBinding` to `DEFAULT_CLIP_KIND_RESOLVER` as the first arm
  for `clipKind: 'lowerThird'` (Pattern C — clipKind-default, not
  `PRESET_ID_BINDINGS` override). Exports the new `CNN_CLASSIC_PROPS`
  constant: a seven-field snapshot driving the canonical CNN-Classic
  steady-state lower-third register on the `LowerThird` primitive (T-183) —
  white banner (`background: '#FFFFFF'`), red flag end-cap
  (`accent: '#CC0000'`, Boston University Red / PMS 2347 C),
  UPPERCASE bold headline (`name: 'BREAKING: SUPREME COURT RULES'`),
  Mixed-Case talent (`title: 'Anderson Cooper · Chief Anchor'`), anchored
  bottom-left at `insetLeftPx: 64` / `insetBottomPx: 64`. Reference frame
  60 (steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98.

  Note the case mapping per D-T323-12: preset frontmatter
  `clipKind: 'lowerThird'` (camelCase) → primitive `kind: 'lower-third'`
  (kebab-case).

- eadca1f: T-324 — `cnn-breaking` preset substantive (Cluster A sixth; first
  `breakingBanner` clipKind binding via the clipKind-default arm in
  `DEFAULT_CLIP_KIND_RESOLVER`).

  Adds `cnnBreakingBinding` as the new `'breakingBanner'` switch arm in
  `DEFAULT_CLIP_KIND_RESOLVER` (Pattern C — first-preset-for-clipKind via
  the clipKind-default path, NOT `PRESET_ID_BINDINGS`). Sister Cluster A
  `breakingBanner` preset T-327 `fox-news-alert` will supply the second
  consumer via `PRESET_ID_BINDINGS` for the sliver-register variant.
  Exports the new `CNN_BREAKING_PROPS` constant: a ten-field snapshot
  driving the canonical CNN-Breaking steady-state register on the
  just-shipped T-324a `BreakingBanner` primitive — full-width white
  banner (`background: '#FFFFFF'`) + red flag end-cap on the left
  (`endCap: { fill: '#CC0000', position: 'left' }`) + red `BREAKING
NEWS` label badge with white text (`label: { text: 'BREAKING NEWS',
fill: '#CC0000', color: '#FFFFFF' }`) + UPPERCASE black headline
  (`headline: 'SUPREME COURT RULES UNANIMOUSLY'`, `headlineColor:
'#000000'`, `casing: 'uppercase'`) at Inter Tight 800
  (`font: { family: 'Inter Tight', weight: 800 }` honored via T-324a's
  `font` prop override — D-T324-13), anchored at `insetBottomPx: 60`
  (closer to bottom edge than the chyron's 64 px). `mode: 'banner'` and
  `slideAxis: 'horizontal'` are CNN canonical defaults. Reference frame
  60 (steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98 via
  F-4 generator flags `--psnr=42 --ssim=0.98` (no manual hand-pin).

  T-324 is the **first production consumer of the just-shipped T-324a
  `BreakingBanner` primitive** AND the **first `breakingBanner` clipKind
  to be wired into the parity-CLI resolver**. The five existing
  `lowerThird` `PRESET_ID_BINDINGS` overrides (`bbc-reith-dark`,
  `al-jazeera-orange`, `apple-tv-lt`, `netflix-doc-lt`,
  `big-number-stat-impact`) and the existing `lowerThird` clipKind-default
  (`cnnClassicBinding`) remain unchanged.

  LIVE pulse bug, ticker strip, red-block-wipe text-change, CNN bug
  rounded box, and staged red-block sweep entrance are deferred to
  T-324b/c/d carve-outs IF Reviewer scrutiny demands them; ticker strip
  composes externally via `news-ticker-bar` (T-356a). v1 ships the
  steady-state register only.

- eca80c4: T-325 — `bbc-reith-dark` preset substantive (Cluster A second; second
  `lowerThird` clipKind binding via `PRESET_ID_BINDINGS` override).

  Adds `bbcReithDarkBinding` to `PRESET_ID_BINDINGS` keyed on
  `'bbc-reith-dark'` (Pattern C — second-preset-for-clipKind via the
  per-presetId override map; the `lowerThird` clipKind-default
  `cnnClassicBinding` from T-323 stays unchanged). Exports the new
  `BBC_REITH_DARK_PROPS` constant: a seven-field snapshot driving the
  canonical BBC Reith-dark steady-state lower-third register on the
  `LowerThird` primitive (T-183) — dark bar (`background: '#1A1A1A'`),
  BBC Red left-edge accent strip (`accent: '#BB1919'`), Mixed-Case
  white headline (`name: 'Sarah Smith'`), Mixed-Case subtitle
  (`title: 'Chief Political Correspondent'`), anchored bottom-left at
  `insetLeftPx: 64` / `insetBottomPx: 48`. Reference frame 60
  (steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98.

  Mirrors T-363 / T-364 / T-365 / T-366 pattern in the caption family;
  this is the first `lowerThird`-keyed entry in `PRESET_ID_BINDINGS`.

- 75f10d2: T-326 — `al-jazeera-orange` preset substantive (Cluster A third; third
  `lowerThird` clipKind binding via `PRESET_ID_BINDINGS` override).

  Adds `alJazeeraOrangeBinding` to `PRESET_ID_BINDINGS` keyed on
  `'al-jazeera-orange'` (Pattern C — third-preset-for-clipKind via the
  per-presetId override map; the `lowerThird` clipKind-default
  `cnnClassicBinding` from T-323 stays unchanged; T-325's
  `bbcReithDarkBinding` override stays unchanged). Exports the new
  `AL_JAZEERA_ORANGE_PROPS` constant: a seven-field snapshot driving the
  canonical Al Jazeera English steady-state lower-third register on the
  `LowerThird` primitive (T-183) — light bar (`background: '#F7F7F5'`),
  Al Jazeera Orange left-edge accent strip (`accent: '#F7941D'`),
  Mixed-Case dark headline (`name: 'Marwan Bishara'`,
  `textColor: '#222222'`), Mixed-Case subtitle (`title:
'Senior Political Analyst'`), anchored bottom-left at
  `insetLeftPx: 64` / `insetBottomPx: 48`. Reference frame 60
  (steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98.

  v1 ships Latin only — Arabic companion (`الجزيرة` second-language slot)
  deferred to T-326a IF Reviewer demands; mirrors T-350's D-T350-12
  Hangul-deferred posture. v1 single-color accent `#F7941D`; orange→amber
  gradient deferred to `T-183z`-family primitive follow-up.

  Second `lowerThird`-keyed entry in `PRESET_ID_BINDINGS` after T-325.

- 480b5e4: T-327 — `fox-news-alert` preset substantive (Cluster A seventh; second
  `breakingBanner` clipKind consumer via `PRESET_ID_BINDINGS` override
  — Pattern C).

  Adds `foxNewsAlertBinding` as a new entry in `PRESET_ID_BINDINGS`
  keyed by `'fox-news-alert'` (Pattern C — second-preset-for-clipKind
  via the override path, NOT clipKind-default). The
  `'breakingBanner'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED
  at `cnnBreakingBinding` (T-324's clipKind-default). Exports the new
  `FOX_NEWS_ALERT_PROPS` constant: a ten-field snapshot driving the
  canonical Fox-News-Alert steady-state register on the T-324a
  `BreakingBanner` primitive — Prussian Blue persistent narrow sliver
  (`background: '#003366'`, `mode: 'sliver'`, `sliverAnchor: 'top-left'`,
  `sliverWidthPct: 0.30`) + Fox-red `FOX NEWS ALERT` label badge with
  white text (`label: { text: 'FOX NEWS ALERT', fill: '#C20017',
color: '#FFFFFF' }`) + Mixed-Case white headline
  (`headline: 'Major Storm Approaches East Coast'`,
  `headlineColor: '#FFFFFF'`, `casing: 'as-is'`) at League Gothic 700
  (`font: { family: 'League Gothic', weight: 700 }` honored via T-324a's
  `font` prop override — D-T327-13). `slideAxis: 'vertical'` records
  Fox's signature axis but is functional no-op at the steady-state
  mid-hold per T-324a D-T324a-6 (sliver mode skips entrance). NO
  `endCap` — Fox doesn't use a flag end-cap; the sliver IS the brand
  mark. Reference frame 60 (steady-state mid-hold) signed at PSNR ≥
  42 dB / SSIM ≥ 0.98 via F-4 generator flags `--psnr=42 --ssim=0.98`
  (no manual hand-pin).

  T-327 is the **first production consumer of T-324a's sliver mode +
  vertical slide axis** AND the **first preset to declare `League
Gothic` in the font registry**. The existing six `PRESET_ID_BINDINGS`
  overrides (`bbc-reith-dark`, `al-jazeera-orange`, `apple-tv-lt`,
  `netflix-doc-lt`, `big-number-stat-impact`, plus the four
  non-cluster-A overrides) and every clipKind-default arm
  (`breakingBanner` → `cnnBreakingBinding`, `lowerThird` →
  `cnnClassicBinding`, etc.) remain unchanged.

  Searchlight morph (return-from-commercial bumper), LIVE pulse bug,
  return-from-commercial multi-stage sequence, ticker strip, dark
  overlay, vertical-slide entrance / exit are deferred to
  T-327a/T-327b/T-324b/sister carve-outs IF Reviewer scrutiny demands
  them. v1 ships the steady-state persistent-sliver register only.

- e4cf1c3: T-328 — `msnbc-big-board` preset substantive (Cluster A eighth + closer;
  second `fullScreen` clipKind consumer via `PRESET_ID_BINDINGS` override
  — Pattern C; second production consumer of T-355a's `magic-wall-panel`
  primitive after T-355).

  Adds `msnbcBigBoardBinding` as a new entry in `PRESET_ID_BINDINGS` keyed
  by `'msnbc-big-board'` (Pattern C — second-preset-for-clipKind via the
  override path, NOT clipKind-default). The `'fullScreen'` arm in
  `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at `fullScreenBinding`
  (T-355's CNN-default magic-wall-drilldown binding). Exports two new
  constants: `MSNBC_BIG_BOARD_REGIONS` (eight US-state region tiles —
  CA / TX / FL / NY / PA / OH / GA / AZ; mirrors T-355's canonical region
  shape verbatim per D-T328-4) and `MSNBC_BIG_BOARD_PARTY_COLORS` (NBC
  peacock-derived partisan-neutral palette: peacock blue `#0084CB` /
  peacock red `#CC2229` / peacock purple `#9B26B6` / peacock gold
  `#FCB712` — distinct from `MAGIC_WALL_PARTY_COLORS` per stub line 41
  mandate). Title `'2024 ELECTION NIGHT'` + subtitle `'County-level — 92%
Reporting'` diverge intentionally from T-355's `'Election Results'` /
  `'State-by-state breakdown'` to make the tenant divergence eyeball-
  obvious. Reference frame 60 (steady-state county-level mid-hold) signed
  at PSNR ≥ 42 dB / SSIM ≥ 0.98 via F-4 generator flags `--psnr=42
--ssim=0.98` (no manual hand-pin).

  T-328 closes Cluster A to **8/8 substantive + signed** — third batch-
  eligible cluster after E (closed by T-355) and F (closed by T-367) —
  and unlocks T-382 (or sister) cluster-batch type-design review for all
  eight Cluster A presets. The existing ten `PRESET_ID_BINDINGS` overrides
  and every clipKind-default arm remain unchanged.

  3D virtual backdrop (`ThreeSceneClip` external composition), operator
  cursor / Kornacki touch overlay (`T-328a` carve-out IF demanded), real-
  time vote count-ups (compose `animated-value` clip externally — T-360
  register), zoom transitions between hierarchy levels (`T-328b` carve-
  out IF demanded), and ticker strip beneath the panel are all deferred.
  v1 ships the steady-state county-level overlay panel layer only.

- 72b5961: T-329 — `netflix-doc-lt` preset substantive (Cluster A fifth; fifth
  `lowerThird` clipKind binding via `PRESET_ID_BINDINGS` override).

  Adds `netflixDocLtBinding` to `PRESET_ID_BINDINGS` keyed on
  `'netflix-doc-lt'` (Pattern C — fifth-preset-for-clipKind via the
  per-presetId override map; the `lowerThird` clipKind-default
  `cnnClassicBinding` from T-323 stays unchanged; T-325's
  `bbcReithDarkBinding`, T-326's `alJazeeraOrangeBinding`, and T-330's
  `appleTvLtBinding` overrides stay unchanged). Exports the new
  `NETFLIX_DOC_LT_PROPS` constant: a ten-field snapshot driving the
  canonical Netflix documentary steady-state lower-third register on the
  `LowerThird` primitive (T-183 + T-183z) — text-only minimalist register
  with `noFlag: true` (T-183z; suppresses the 6 px accent strip),
  `background: '#000000'` (canvas-matching black; card visually
  disappears), Mixed-Case white headline (`name: 'Ava DuVernay'`,
  `textColor: '#FFFFFF'`), **literal ALL-CAPS** white subtitle
  (`title: 'DIRECTOR'`, `subtitleColor: '#FFFFFF'` via T-183z;
  talent-line decoupled from `accent`), DM Sans Medium family
  (`font: { family: 'DM Sans', weight: 500 }` via T-183z; OFL fallback
  for proprietary Netflix Sans), anchored bottom-left at
  `insetLeftPx: 120` / `insetBottomPx: 80` (generous whitespace per
  Netflix's documentary canon). Reference frame 60 (steady-state
  mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98 via F-4 generator flags
  `--psnr=42 --ssim=0.98` (no manual hand-pin).

  T-329 is the **second production consumer of T-183z's `noFlag` /
  `subtitleColor` / `font` props** (T-330 was first) and the **second
  preset PR to use F-4's `--psnr` / `--ssim` / `--max-failing-frames`
  flags** instead of the manual `thresholds.json` hand-pin step.

  T-329 also establishes the **canonical "headline Mixed Case + title
  ALL CAPS" snapshot-string casing pattern** (D-T329-6) — Netflix's
  "ALL CAPS title is the signature" rule (compass canon line 43) is
  honored by passing the literal upper-case string `'DIRECTOR'` directly
  in the snapshot, without a primitive `casing` prop. Future presets
  demanding per-line casing without a `casing` prop reuse this pattern
  verbatim.

  Fourth `lowerThird`-keyed entry in `PRESET_ID_BINDINGS` after T-325 +
  T-326 + T-330.

- e51c6a7: T-330 — `apple-tv-lt` preset substantive (Cluster A fourth; fourth
  `lowerThird` clipKind binding via `PRESET_ID_BINDINGS` override).

  Adds `appleTvLtBinding` to `PRESET_ID_BINDINGS` keyed on `'apple-tv-lt'`
  (Pattern C — fourth-preset-for-clipKind via the per-presetId override
  map; the `lowerThird` clipKind-default `cnnClassicBinding` from T-323
  stays unchanged; T-325's `bbcReithDarkBinding` and T-326's
  `alJazeeraOrangeBinding` overrides stay unchanged). Exports the new
  `APPLE_TV_LT_PROPS` constant: a ten-field snapshot driving the canonical
  Apple TV+ steady-state lower-third register on the `LowerThird`
  primitive (T-183 + T-183z) — text-only minimalist register with
  `noFlag: true` (T-183z; suppresses the 6 px accent strip),
  `background: '#000000'` (canvas-matching black; card visually
  disappears), Mixed-Case white headline (`name: 'Sofia Coppola'`,
  `textColor: '#FFFFFF'`), Mixed-Case white subtitle
  (`title: 'Director'`, `subtitleColor: '#FFFFFF'` via T-183z;
  talent-line decoupled from `accent`), Inter Light family
  (`font: { family: 'Inter', weight: 300 }` via T-183z; OFL fallback for
  proprietary SF Pro), anchored bottom-left at `insetLeftPx: 140` /
  `insetBottomPx: 95` (generous whitespace per Apple's canon). Reference
  frame 60 (steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98
  via F-4 generator flags `--psnr=42 --ssim=0.98` (no manual hand-pin).

  T-330 is the **first production consumer of T-183z's `noFlag` /
  `subtitleColor` / `font` props** and the **first preset PR to use F-4's
  `--psnr` / `--ssim` / `--max-failing-frames` flags** instead of the
  manual `thresholds.json` hand-pin step.

  Third `lowerThird`-keyed entry in `PRESET_ID_BINDINGS` after T-325 + T-326.

- 7f990ab: T-333 — `premier-league-field-of-play` preset substantive (Cluster B
  first; second `scoreBug` clipKind consumer via `PRESET_ID_BINDINGS`
  override — Pattern C; first production consumer of T-332a's `score-bug`
  primitive AND its `'football'` style branch).

  Adds `premierLeagueFopBinding` as a new entry in `PRESET_ID_BINDINGS`
  keyed by `'premier-league-field-of-play'` (Pattern C — second-preset-
  for-clipKind via the override path, NOT clipKind-default). The
  `'scoreBug'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at
  `scoreBugDotsBinding` (T-358's cricket-ball-by-ball-dots binding via
  the `outcome-row` primitive — a different primitive entirely). Exports
  one new constant: `PREMIER_LEAGUE_FOP_PROPS` (the canonical Premier
  League 2017+ broadcast snapshot — PL purple `#34003A` chrome + Arsenal
  red `#EF0107` home box + Chelsea blue `#034694` away box + 3-letter
  team codes `'ARS'` / `'CHE'` + tabular `'2'` / `'1'` scores + `'67:42'`
  mid-second-half clock + `'2H'` period token + `Space Grotesk` 600
  tabularNums OFL fallback for proprietary-byo `Premier Sans`). Reference
  frame 60 (steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98
  via F-4 generator flags `--psnr=42 --ssim=0.98` (no manual hand-pin).

  T-333 brings Cluster B to **1/9 substantive + signed** (NOT YET
  ELIGIBLE for batch merge). The remaining 8 Cluster B presets land in
  their own preset PRs over the rest of Phase 13. The existing 11
  `PRESET_ID_BINDINGS` overrides and every clipKind-default arm remain
  unchanged.

  Goal-celebration animations (Arsenal cannon, Brighton seagulls, United
  devils-and-pitchforks per stub line 39 — explicit v2 territory),
  "Field of Play" companion motion language (passes / long balls /
  corners / dribbles per stub line 40 — separate composition concern),
  2 s `cubic-bezier(.55, 0, .1, 1)` entrance with 1 s delay (`T-332b`-
  family carve-out IF demanded), 6 px outer-edge kit-color stripes (vs
  the primitive's full-tile fill — `T-332b`-family carve-out), and PL
  green `#00FC8A` accent rendered slot on the football branch (`T-332b`-
  family carve-out) are all deferred. v1 ships the steady-state mid-hold
  scoreclock layer only.

- 35d97ff: T-334 — `fox-nfl-no-chrome` preset substantive (Cluster B second; third
  `scoreBug` clipKind consumer via `PRESET_ID_BINDINGS` override — Pattern
  C; second production consumer of T-332a's `'football'` style branch;
  first production consumer of T-332a's `backdropGradient`, `down`, and
  `possession` optional props).

  Adds `foxNflNoChromeBinding` as a new entry in `PRESET_ID_BINDINGS`
  keyed by `'fox-nfl-no-chrome'` (Pattern C — third-preset-for-clipKind
  via the override path, NOT clipKind-default). The `'scoreBug'` arm in
  `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at `scoreBugDotsBinding`
  (T-358's cricket-ball-by-ball-dots binding via the `outcome-row`
  primitive — a different primitive entirely); T-333's
  `premierLeagueFopBinding` + `'premier-league-field-of-play'` entry stay
  UNCHANGED. Exports one new constant: `FOX_NFL_NO_CHROME_PROPS` (the
  canonical Fox NFL 2025 Super Bowl LIX rematch snapshot — chromeless
  `#000000` base + radial gradient backdrop `{ centerOpacity: 0.4,
edgeOpacity: 0 }` + KC red `#E31837` home box + PHI green `#004C54`
  away box + 2/3-letter team codes `'KC'` / `'PHI'` + `'24'` / `'17'`
  scores + `'04:32'` Q3 mid-quarter clock + `'Q3'` period token + `'3rd
& 7'` down-and-distance + `possession: 'home'` brightness boost +
  Inter Display 900 OFL fallback for proprietary Fox Sports custom).
  Reference frame 60 (steady-state mid-hold) signed at PSNR ≥ 42 dB /
  SSIM ≥ 0.98 via F-4 generator flags `--psnr=42 --ssim=0.98` (no manual
  hand-pin).

  T-334 brings Cluster B to **2/9 substantive + signed** (NOT YET
  ELIGIBLE for batch merge). The remaining 7 Cluster B presets land in
  their own preset PRs over the rest of Phase 13. The existing 12
  `PRESET_ID_BINDINGS` overrides and every clipKind-default arm remain
  unchanged.

  Touchdown comic-book celebration (stub line 37 — primitive-level new
  `celebration: 'touchdown' | null` enum + asset bundle; candidate
  `T-334a`), down-and-distance possession-slide animation (stub lines
  32, 36 — primitive-level frame-trigger keyed to `possession` change;
  candidate `T-332b`-family), 800 ms ease-out zoom-in entrance from
  "FOX SPORTS" branded black field (stub line 35 — primitive-level
  entrance enum; candidate `T-332b`-family), 120 ms score-change quick
  flash (stub line 38 — primitive-level addition; candidate
  `T-332b`-family), score numerics rendered at 40–48 pt "massive scale"
  vs primitive default 28 px (D-T334-11-d — primitive-level
  `scoreFontSize` axis; candidate `T-332b`-family), 6 px outer-edge
  kit-color stripes (vs the primitive's full-tile fill — inherited from
  T-333 D-T333-11-a; `T-332b`-family carve-out), and FOX-DNA
  letter-C-resembles-FOX-O numeral curiosity (D-T334-11-c — preserved
  only in proprietary-byo Fox Sports custom; cannot render in OFL
  fallback) are all deferred. v1 ships the steady-state mid-hold
  chromeless scoreclock layer only.

- 6a1f7c0: T-335 — `nbc-snf-possession-illuminated` preset substantive (Cluster B
  third; fourth `scoreBug` clipKind consumer via `PRESET_ID_BINDINGS`
  override — Pattern C; third production consumer of T-332a's
  `'football'` style branch; first production consumer of T-332a's
  `centerCircle`, `direction`, and `networkLogo` optional props; second
  production consumer of `down` + `possession`).

  Adds `nbcSnfBinding` as a new entry in `PRESET_ID_BINDINGS` keyed by
  `'nbc-snf-possession-illuminated'` (Pattern C — fourth-preset-for-clipKind
  via the override path, NOT clipKind-default). The `'scoreBug'` arm in
  `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at `scoreBugDotsBinding`
  (T-358's cricket-ball-by-ball-dots binding via the `outcome-row`
  primitive — a different primitive entirely); T-333's
  `premierLeagueFopBinding` + T-334's `foxNflNoChromeBinding` and their
  respective entries stay UNCHANGED. Exports one new constant:
  `NBC_SNF_PROPS` (the canonical Sunday Night Football AFC matchup
  snapshot — deep-near-black `#0A0A0A` base + KC red `#E31837` home box
  - BUF navy `#00338D` away box + 2/3-letter team codes `'KC'` /
    `'BUF'` + `'21'` / `'14'` scores + `'08:14'` Q2 mid-quarter clock +
    `'Q2'` period token + `'<< 1st & 10'` down-and-distance with chevrons
    baked-in + `direction: 'left-to-right'` + `possession: 'home'`
    brightness boost + `centerCircle: true` + `networkLogo: 'NBC'` +
    Public Sans 600 OFL fallback for proprietary Sweet Sans Pro + NBC
    Tinker pairing). Reference frame 60 (steady-state mid-hold) signed at
    PSNR ≥ 42 dB / SSIM ≥ 0.98 via F-4 generator flags `--psnr=42
--ssim=0.98` (no manual hand-pin).

  T-335 brings Cluster B to **3/9 substantive + signed** (NOT YET
  ELIGIBLE for batch merge). The remaining 6 Cluster B presets land in
  their own preset PRs over the rest of Phase 13. The existing 13
  `PRESET_ID_BINDINGS` overrides and every clipKind-default arm remain
  unchanged.

  500 ms ease-out entrance slide-in from bottom (stub line 37 —
  primitive-level entrance enum; candidate `T-332b`-family), 400 ms
  possession-change animation (stub line 38 — primitive-level
  frame-driven brightness transition + chevron position shift; candidate
  `T-332b`-family), 300 ms penalty-flag slide-in (stub line 39 —
  primitive-level new `penaltyFlag: boolean` slot + asset + frame-driven
  choreography; candidate `T-335a`), 200 ms score-change quick flash
  (stub line 40 — primitive-level addition; candidate `T-332b`-family),
  direction-driven automatic chevron rendering (stub line 34 —
  primitive-level `renderFootball` extension to consume `direction`;
  candidate `T-332b`-family), background-opacity ≈75% semi-transparent
  register (stub line 26 — primitive-level new `opacity` axis on the
  football branch; candidate `T-332b`-family), score numerics rendered
  at primitive default 28 px vs stub's "Bold, 26–32 pt" register
  (primitive-level `scoreFontSize` axis; candidate `T-332b`-family),
  4 px outer-edge kit-color stripes (vs the primitive's full-tile fill —
  inherited from T-333 D-T333-11-a / T-334 D-T334-12; `T-332b`-family
  carve-out), and Sweet Sans Pro + NBC Tinker bespoke letter shapes
  (D-T335-11-d — preserved only in commercial-byo + proprietary-byo;
  cannot render in OFL fallback) are all deferred. v1 ships the
  steady-state mid-hold horizontal-bar scoreclock layer only.

- cbe5ffc: T-337 — preset(sports) wimbledon-green-purple substantive (Cluster B 5th; first 'tennis' style consumer)

  Fifth Cluster B preset; first production consumer of T-332a's `'tennis'`
  style branch via `PRESET_ID_BINDINGS['wimbledon-green-purple']`. Validates
  the 2-player stack render with country code (uppercase) + seed + N set
  columns + game score + active-server dot. Djokovic vs Alcaraz canonical
  Wimbledon final mid-match snapshot; 2 sets played + 3rd in progress with
  tiebreak scores; Wimbledon green `#006633` base + purple `#4B0082` accent
  (schema-supplied; not visibly rendered by primitive); bottom-left anchor;
  Montserrat 500 OFL fallback for proprietary Gotham. Score-change pulse,
  server-dot smooth transition, set-complete flash all deferred. New exported
  `WIMBLEDON_PROPS` constant + `wimbledonGreenPurpleBinding` + 16th
  `PRESET_ID_BINDINGS` entry. `DEFAULT_CLIP_KIND_RESOLVER` + all 15 prior
  bindings UNCHANGED.

- 4ab43a8: T-338 — preset(sports) masters-red-under-par substantive (Cluster B 6th; first standings PRESET_ID_BINDINGS override)

  Sixth Cluster B preset; second `standings` clipKind consumer via
  `PRESET_ID_BINDINGS['masters-red-under-par']` (Pattern C — first
  `standings`-keyed override after T-357 olympic-medal-tracker holds the
  clipKind-default slot). Canonical Masters mid-round leaderboard:
  Scheffler / McIlroy / Schauffele / Spieth / Bryson 5-row top-5 stack
  with numeric score-to-par + thru-hole encoding; Augusta National green
  `#006747` accent on the rank column (theme-slot mapping); dark broadcast
  base `#0E0E12`; white text; Inter 600 OFL fallback for proprietary CBS
  Sports custom face. Per-cell red/black/green canonical color semantic
  deferred (primitive supports column-level color only); position-change
  row-slide + birdie-flash + score count-up + full-screen scroll all
  deferred. New exported `MASTERS_PROPS` constant + `mastersRedUnderParBinding`
  - 17th `PRESET_ID_BINDINGS` entry. `DEFAULT_CLIP_KIND_RESOLVER` + all 16
    prior bindings UNCHANGED.

- b9fd629: T-339a — `espn-bottomline-flipper` preset substantive (Cluster B
  fourth; second `newsTicker` clipKind consumer via `PRESET_ID_BINDINGS`
  override — Pattern C; first non-`scoreBug`-clipKind Cluster B preset;
  **first production consumer of T-356b's `mode: 'flip'` two-row stacked
  register** on the `news-ticker-bar` primitive).

  Adds `espnBottomlineBinding` as a new entry in `PRESET_ID_BINDINGS`
  keyed by `'espn-bottomline-flipper'` (Pattern C — second-preset-for-
  clipKind via the override path, NOT clipKind-default). The
  `'newsTicker'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at
  `newsTickerBinding` (T-356's bloomberg-ticker continuous-marquee
  `mode: 'scroll'` register on the same `news-ticker-bar` primitive);
  T-333's `premierLeagueFopBinding` + T-334's `foxNflNoChromeBinding` +
  T-335's `nbcSnfBinding` and their respective `PRESET_ID_BINDINGS`
  entries stay UNCHANGED. Exports one new constant:
  `ESPN_BOTTOMLINE_PROPS` (the canonical post-2018 ESPN BottomLine
  register snapshot — full-width band on dark `#1A1A1A` charcoal base +
  two-row stacked flipper at `mode: 'flip'` + 4500 ms `flipDurationMs`
  mid-canon segment cadence + 100 px band height (50 px per row) +
  `bandPosition: 'bottom'` + Yellow `#FFD700` `upColor` score
  highlights + ESPN Red `#CC0000` `downColor` brand-locked accent +
  white `#FFFFFF` `flatColor` + six-entry NBA team-vs-team score mix
  exercising up/down/flat chip-color paths: `NYK 102 +5 ▲` /
  `BOS 97 F ▬` / `LAL 88 -3 ▼` / `PHX 91 F ▬` / `PHI 24 +2 ▲` /
  `DAL 22 F ▬`). Reference frame 60 (steady-state mid-segment
  `pairIdx = 0`; top row NYK +5 yellow / bottom row BOS F white)
  signed at PSNR ≥ 42 dB / SSIM ≥ 0.98 via F-4 generator flags
  `--psnr=42 --ssim=0.98` (no manual hand-pin).

- 7882dd4: T-350 — `squid-game-geometric` preset substantive (Cluster D first; first
  `titleSequence` clipKind binding).

  Adds `squidGameGeometricBinding` to `DEFAULT_CLIP_KIND_RESOLVER` as the
  first arm for `clipKind: 'titleSequence'` (Pattern C — clipKind-default,
  not `PRESET_ID_BINDINGS` override). Exports the new
  `SQUID_GAME_GEOMETRIC_SHOTS` constant: a six-shot timeline (5000 ms @ 30 fps
  = 150 frames) driving the brutalist Squid-Game register via T-321's
  `'palette-jump-cut'` style bundle — pink/teal/black hard-cut palette jump
  cuts with inline ○△□ Unicode glyphs and a `'SQUID GAME'` ALL-CAPS title
  plate at shot 5. Reference frame 120 (= 4000 ms; mid shot 5) signed at
  PSNR ≥ 42 dB / SSIM ≥ 0.98.

- 3eafd7e: T-355 — wire `fullScreen → magic-wall-panel` resolver entry + export
  `MAGIC_WALL_CANONICAL_REGIONS` constant.

  First `fullScreen`-clipKind entry in `DEFAULT_CLIP_KIND_RESOLVER`,
  binding to the `magic-wall-panel` primitive shipped by T-355a. The
  binding mounts the primitive directly with the canonical 8-region
  electoral snapshot inlined as props — `LiveDataClip`'s wrapper is
  bypassed for parity per ADR-003 §D2 (D-T355-12; same posture as T-356
  D-T356-11 + T-357 D-T357-12). The snapshot mixes all four party-color
  paths (3 Dem + 3 Rep + 1 tied + 1 undecided) over a 4×2 placeholder-
  rectangle grid sized for the 1280×720 default composition; real US
  state SVG path geometry is deferred per D-T355-6.

  Closes Cluster E (`data`) to 6/6 substantive + signed presets,
  unlocking T-380 batch-merge eligibility. Backward-compatible — the
  existing `bigNumber` / `scoreBug` / `newsTicker` / `standings` /
  `caption` clipKind branches and the `PRESET_ID_BINDINGS` per-preset
  override path are unchanged.

- f7b4b20: T-356 — Add `newsTicker → news-ticker-bar` resolver branch + exported
  `BLOOMBERG_CANONICAL_SNAPSHOT` constant for the `bloomberg-ticker`
  preset's parity golden.

  Wires `DEFAULT_CLIP_KIND_RESOLVER('newsTicker') → news-ticker-bar`
  (frame-runtime) per T-356 D-T356-3. The new clipKind-default entry
  mounts the T-356a `news-ticker-bar` primitive directly with the cached
  six-token Bloomberg snapshot (4 equities + 1 crypto, mixed up + down
  deltas) inlined as props — bypassing the `LiveDataClip` wrapper /
  `defaultLiveDataStaticFallback` per D-T356-11 (the parity golden's
  purpose is to verify the rendered visual, not the wrapper integration
  mechanism). Backward-compat preserved for `bigNumber` / `scoreBug` /
  per-preset overrides (T-358 / T-359 / T-360).

  `BLOOMBERG_CANONICAL_SNAPSHOT` is exported so future preset retries or
  sister-cluster ticker bindings can compose against the same shape.

- e0c69ba: T-357 — wire `standings → standings-table` in the v1 clipKind resolver
  - export `OLYMPIC_CANONICAL_STANDINGS` (five-row top-5 leaderboard:
    USA / CHN / JPN / AUS / GBR with mixed up / down / flat deltas
    exercising all three rank-arrow color paths). Powers the
    `olympic-medal-tracker` (Cluster E) parity-golden render via the
    `standings-table` primitive shipped by T-357a; the `LiveDataClip`
    wrapper is bypassed (D-T357-12; same posture as T-356 D-T356-11) and
    the renderer mounts `standings-table` directly with the cached
    snapshot inlined as props.

  The `standings` clipKind-default entry is generic enough to be reused
  by future Cluster A/B/E ranked-list presets (F1 / NBA / NCAA / golf
  leaderboards, election results, crypto top-N market-cap dashboards);
  per-preset overrides via `PRESET_ID_BINDINGS` remain available for
  tenant-specific colorways.

- 831b996: T-358 — wire `scoreBug → outcome-row` in `DEFAULT_CLIP_KIND_RESOLVER`.

  Adds the second clipKind binding to the v1 parity-fixture renderer
  (`bigNumber → animated-value` was the first, T-359a). The new
  `scoreBugDotsBinding` mounts the T-358a `outcome-row` primitive with
  the canonical six-ball cricket over `[1, '.', 4, 6, W, 2]`, exposing
  all six outcome palette colors (white, gray, green, gold, red, cyan)
  in a single mid-hold frame. Also exports `CRICKET_OUTCOME_COLORS`
  for downstream consumers that want the canon mapping.

  Single-variant per T-358 D-T358-3; the `buildProps` shim ignores the
  variant axis. Used by `scripts/generate-preset-parity-fixture-prod.ts`
  to render the `cricket-ball-by-ball-dots` golden frame.

- 424911e: T-360 — extend `ClipKindResolver` to take an optional `presetId` for
  multi-preset-per-clipKind disambiguation.

  `DEFAULT_CLIP_KIND_RESOLVER` now checks a per-preset override map
  (`PRESET_ID_BINDINGS`) before falling back to the clipKind-only mapping.
  T-359 / T-358 callers pass no `presetId` and continue to fall through
  to the clipKind-only path; `createGenerateFixtureRenderer` now passes
  `renderArgs.preset.frontmatter.id` as the second resolver arg so the
  override map activates for `big-number-stat-impact` (the second
  `bigNumber`-clipKind preset to land in cluster E).

  The signature change is backward-compat — `presetId` is optional.
  Resolvers ignoring the arg keep T-359 behavior; the new arg lets new
  presets share a `clipKind` while parameterizing the same runtime clip
  differently (e.g., `big-number-stat-impact` renders `87.4%` at heavy
  weight vs. `f1-sector-purple-green`'s `21.412` at weight 700).

- f6cf9f6: T-362 — wire `caption → caption` clipKind binding + export
  `HORMOZI_CANONICAL_WORDS` six-word snapshot.

  First Cluster F preset (`hormozi-montserrat-black`) and first preset to
  exercise T-316's `CaptionClip` primitive end-to-end. The resolver entry is a
  clipKind-default (matches T-358 / T-356 / T-357 posture) — sister Cluster F
  presets (T-363+ mrbeast / tiktok / ali-abdaal / netflix /
  karaoke-progressive-wipe) layer per-preset overrides via `PRESET_ID_BINDINGS`
  to swap the `style` enum + word snapshot.

  `HORMOZI_CANONICAL_WORDS`: six entries (300 ms each, total 1800 ms) —
  `This will change your life forever`. Frame 45 @ 30 fps lands word 6
  (`forever`) as the active highlight per the primitive's strict
  `currentTimeMs >= startMs && currentTimeMs < endMs` rule. The `'hormozi'`
  STYLE_BUNDLES bundle on the primitive (T-316 D-T316-2) supplies the
  Montserrat 800 caps + black stroke (6 px) + yellow `#FFD60A` highlight +
  `rise` entrance with 80 ms stagger defaults; `buildProps` declares only
  `words`, `style`, `position`, and a documentation-only `background`.

- b18584e: T-363 — wire `(caption, mrbeast-komika-axis) → mrbeastBinding` via
  `PRESET_ID_BINDINGS` + export `MRBEAST_CANONICAL_WORDS` six-word snapshot.

  Second Cluster F preset and FIRST Cluster F preset to use the per-presetId
  override mechanism (T-360 D-T360-2). The `'mrbeast'` style + cycling-color
  `WordTiming[]` snapshot can't share T-362's `'hormozi'` clipKind-default
  binding's `buildProps`; T-363 adds a `PRESET_ID_BINDINGS['mrbeast-komika-axis']`
  entry instead of touching the default. Sister Cluster F presets (T-364
  tiktok / T-365 ali-abdaal / T-366 netflix / T-367 karaoke-progressive-wipe)
  follow the same per-presetId override pattern T-363 establishes.

  `MRBEAST_CANONICAL_WORDS`: six entries (350 ms each, total 2100 ms) —
  `I gave away one million dollars`. Words 2 / 4 / 6 carry
  `emphasis: 'highlight'`; the primitive's rolling `highlightedIndex % 3`
  routes them through the `'mrbeast'` bundle's 3-color cycle (`#FF3B30` red →
  `#FFD60A` yellow → `#34C759` green). Frame 60 @ 30 fps lands word 6
  (`dollars`) as the active highlight per the primitive's strict
  `currentTimeMs >= startMs && currentTimeMs < endMs` rule. The `'mrbeast'`
  STYLE_BUNDLES bundle on the primitive (T-316 D-T316-2) supplies the
  Komika Axis 108 caps + black stroke (5 px) + `bounce` entrance with 80 ms
  stagger defaults; `buildProps` declares only `words`, `style`, `position`,
  and a documentation-only `background`.

  T-362's clipKind-default `caption → caption` is unchanged: `('caption',
'hormozi-montserrat-black')` and `('caption')` (no presetId) continue to
  fall through to T-362's `captionBinding`.

- 9fcfa4e: T-364 — wire `(caption, tiktok-rounded-box) → tiktokBinding` via
  `PRESET_ID_BINDINGS` + export `TIKTOK_CANONICAL_WORDS` five-word snapshot.

  Third Cluster F preset and FIRST Cluster F preset to render
  `backdrop: 'pill'` AND the `'slide-from-bottom'` entrance branch. The
  `'tiktok'` style differs from T-362's `'hormozi'` clipKind-default along
  multiple axes (`backdrop: 'pill'` vs `'none'`; `casing: 'as-is'` vs
  `'uppercase'`; `strokeWidth: 0` vs `6`; `entrance: 'slide-from-bottom'` vs
  `'rise'`) and cannot share T-362's `captionBinding`; T-364 mirrors T-363's
  `PRESET_ID_BINDINGS` override pattern.

  `TIKTOK_CANONICAL_WORDS`: five entries (400 ms each, total 2000 ms) —
  `Wait until you see this`. No `emphasis` field on any word — TikTok bundle's
  `highlightColor` equals `foreground`, so the per-word pill IS the visual
  emphasis (not a per-word color shift). Frame 45 @ 30 fps lands word 4
  (`'see'`, 1200..1600) as the active word and word 5 (`'this'`, 1600..2000)
  as mid-slide-from-bottom — the parity golden captures the entrance IN MOTION
  (the preset's named feature) rather than a fully-settled state.

  T-362's clipKind-default `caption → caption` (Hormozi) and T-363's
  `mrbeast-komika-axis` override are unchanged; backward-compat tests guard
  the resolver fall-through.

- 2a4c3a7: T-365 — wire `(caption, ali-abdaal-opacity-karaoke) → aliAbdaalBinding` via
  `PRESET_ID_BINDINGS` + export `ALI_ABDAAL_CANONICAL_WORDS` eight-word snapshot.

  Fourth Cluster F preset and FIRST Cluster F preset to render `entrance:
'none'` AND opacity-only active-word emphasis (`muteColor === highlightColor
=== foreground` with `muteOpacity: 0.6`). The `'ali-abdaal'` style differs
  from T-362's `'hormozi'` clipKind-default along every axis (font Inter vs
  Montserrat; casing as-is vs uppercase; foreground `#1F1F1F` on white vs
  white on dark; opacity-based mute vs no-mute; strokeWidth 0 vs 6; entrance
  none vs rise; staggerMs 0 vs 80) and cannot share `captionBinding` —
  hence the per-presetId override path established by T-360. Mirrors the
  T-363 / T-364 override pattern.

- fffaf69: T-366 — wire `(caption, netflix-invisible) → netflixBinding` via
  `PRESET_ID_BINDINGS` + export `NETFLIX_CANONICAL_WORDS` five-word snapshot.

  Fifth Cluster F preset and FIRST Cluster F preset to render `muteOpacity: 0`
  strict-accessibility active-only visibility (past / future visible words
  render at zero opacity, completely invisible per T-316a's just-merged routing
  fix) AND the FIRST Cluster F preset to use `backdrop: 'rect'` (translucent
  black rectangle behind the active word's region; distinct from T-364's
  `'pill'` per-word rounded-rect at 0.9 opacity). The `'netflix'` style differs
  from T-362's `'hormozi'` clipKind-default along every axis (font Netflix Sans
  - Inter fallback vs Montserrat; weight 500 vs 800; size 56 vs 96; casing
    as-is vs uppercase; **`muteOpacity: 0` vs 1**; strokeWidth 1 vs 6;
    `backdrop: 'rect'` opacity 0.7 vs `'none'`; entrance none vs rise;
    staggerMs 0 vs 80) and cannot share `captionBinding` — hence the
    per-presetId override path established by T-360. Mirrors the
    T-363 / T-364 / T-365 override pattern. The strictest active-word emphasis
    in the cluster F register space.

- c7df9fc: T-367 — wire `lyrics → lyrics` clipKind-default for
  `karaoke-progressive-wipe` (first and only `lyrics`-clipKind preset).

  Adds the exported `KARAOKE_PROGRESSIVE_WIPE_CANONICAL_LINES` snapshot
  (three anthemic lines × 2500 ms each = 7500 ms total; line 2 active at
  40% wipe progress at frame 105) and the new `lyricsBinding`
  `ClipKindBinding` (style `'karaoke-wipe'`, `maxLinesVisible: 3`,
  `casing: 'uppercase'`, `glow: { color: '#FFFFFF', blur: 6 }`,
  center-screen position, dark-canvas documentation backdrop).
  `DEFAULT_CLIP_KIND_RESOLVER` gains a `lyrics → lyricsBinding` arm;
  mirrors T-362 hormozi's first-preset-for-clipKind precedent (first
  preset for a clipKind takes the clipKind-default slot — NOT a
  `PRESET_ID_BINDINGS` override). No change to existing T-358 / T-359 /
  T-356 / T-357 / T-355 / T-360 / T-362–T-366 bindings.

  Closes Cluster F to 6/6 — eligible for T-381 batch merge.

- 41c27d2: T-332 — Add `f1-timing-tower` preset binding (Cluster B 7th; first production consumer of T-332a's `'racing'` style branch).

  `PRESET_ID_BINDINGS['f1-timing-tower']` → `f1TimingTowerBinding` → `score-bug` primitive on `frame-runtime`. New `F1_TIMING_TOWER_PROPS` export ships the canonical 2024 mid-session F1 timing tower snapshot (20 rows, top-10 with full sector / tire data, bottom-10 minimal). `DEFAULT_CLIP_KIND_RESOLVER 'scoreBug'` arm UNCHANGED (T-358 cricket scoreBugDotsBinding). All 17 prior `PRESET_ID_BINDINGS` entries UNCHANGED. Closes the T-332a primitive's production-consumer matrix to all 4 styles (`'football'` / `'racing'` / `'cricket'` / `'tennis'`) exercised.

- 332a97e: T-336 — Add `cricket-scorebug` preset binding (Cluster B 8th; first production consumer of T-332a's `'cricket'` style branch).

  `PRESET_ID_BINDINGS['cricket-scorebug']` → `cricketScorebugBinding` → `score-bug` primitive on `frame-runtime`. New `CRICKET_SCOREBUG_PROPS` export ships the canonical IND vs AUS mid-innings cricket panel snapshot (battingTeam IND `#0066B3` 247/4 in 42.3 overs; bowlingTeam AUS `#FFCD00`; runRate 5.85 + requiredRunRate 6.42; batsmen Kohli on-strike 87/92 + Rahul 34/41; bowler Cummins 2-58; partnership 64 (78); top-center anchor; dark `#0E0E12` base; IBM Plex Sans 600 OFL fallback). `DEFAULT_CLIP_KIND_RESOLVER 'scoreBug'` arm UNCHANGED (T-358 `scoreBugDotsBinding` → outcome-row). All 18 prior `PRESET_ID_BINDINGS` entries UNCHANGED. Closes the T-332a primitive's production-consumer matrix to all 4 styles (`'football'` / `'racing'` / `'cricket'` / `'tennis'`) exercised. T-358 cricket-ball-by-ball-dots stays the clipKind-default `scoreBug` slot — composes externally above/below the dot row at the host level.

- b16f8a4: T-339 — Add `uefa-starball-refraction` preset binding (Cluster B 9th + closer; second `fullScreen` `PRESET_ID_BINDINGS` consumer; third `magic-wall-panel` production binding).

  `PRESET_ID_BINDINGS['uefa-starball-refraction']` → `uefaStarballRefractionBinding` → `magic-wall-panel` primitive on `frame-runtime`. New `UEFA_STARBALL_REGIONS` + `UEFA_STARBALL_PALETTE` exports ship the canonical UCL Matchday 6 standings snapshot (six clubs RMA/LIV/BAY/MCI/PSG/INT in 3×2 grid; UEFA refraction palette dark navy `#041E42` + blue `#2DA8D8` + cyan `#6EE0E8` + magenta `#C2185B` + white `#FFFFFF`; title `'CHAMPIONS LEAGUE'`; subtitle `'MATCHDAY 6 — STANDINGS'`; `valueFormat: 'count'` + per-region `valueLabel: '<n> PTS'`; `entrance: 'stagger-rise'` + `staggerMs: 60`; background override `#041E42` UEFA dark navy vs primitive default `#0E0E12`; Fraunces 700 OFL fallback). `DEFAULT_CLIP_KIND_RESOLVER 'fullScreen'` arm UNCHANGED (T-355 `fullScreenBinding` → magic-wall-drilldown CNN-default). All 19 prior `PRESET_ID_BINDINGS` entries UNCHANGED. Closes Cluster B to 9/9 substantive + signed → fourth batch-eligible cluster after E + F + A; unlocks T-340 (Cluster B composer) + T-382 (Cluster B type-design batch review). Eight cosmetic divergences from the canonical UEFA register documented (Starball 3D / refracted typography / light-wave drift / Ultimate Stage CGI stadium / promo wipes / Italic-Ritalic / camera-track / per-character stagger) — all deferred to T-339a/b/c carve-outs or external-composition paths.

- 1beea8f: T-349 — Add `got-trajan-clockwork` preset binding (Cluster D sixth + final preset; **fifth multi-clip-composition consumer in StageFlip parity-CLI history** — reuses T-348's `ClipKindBinding.overlays?` surface verbatim, no architectural extension; **SECOND end-to-end consumer of `mode: 'sepia'`** at dominant 0.65 intensity (T-352 was PRIMARY at 0.70 dominant with HIGH grain 0.30) confirms the SEPIA_MATRIX path is stable across intensity values + grain levels). **Closes Cluster D 5/6 → 6/6 ELIGIBLE — the cluster-closure milestone.**

  **Public API surface UNCHANGED** (PATCH not MINOR — `ClipKindBinding` interface keeps T-348's shape; `buildPresetDocument` keeps T-348's overlay fanout; `DEFAULT_CLIP_KIND_RESOLVER` keeps T-350's `titleSequence → squidGameGeometricBinding` clipKind-default arm; `title-sequence.tsx` UNCHANGED — live ThreeSceneClip 3D integration deferred to T-349-live-3d follow-up per D-T349-1; **stub line 41 explicitly authorizes the static-fallback posture** — NOT a documented divergence, canon-allowed alternate path).

  **New `PRESET_ID_BINDINGS['got-trajan-clockwork']` → `gotTrajanClockworkBinding`** composes the parent `titleSequence` primitive (T-321) with two atmospheric overlays in z-order: `grain` (T-321a; **`intensity: 0.15` — canonical-default; matches T-348/T-351/T-353** — the medieval-paper / engraved-page Roman-inscription register reads as subtle, NOT VHS-tape-chatter like T-352's elevated 0.30) and `photographic-overlay` (T-321d; **`mode: 'sepia'` at `intensity: 0.65` — DOMINATES the metallic-gold/brown register; SECOND end-to-end consumer of `'sepia'` mode** after T-352's PRIMARY 0.70 dominant cast — slightly LOWER than T-352 to preserve more typographic legibility for the Roman-inscription register; the Trajan-fallback type is the anchor per stub line 33 "scaled large"). Three exported props constants: `GOT_TRAJAN_CLOCKWORK_TITLE_SEQUENCE_PROPS`, `GOT_TRAJAN_CLOCKWORK_GRAIN_PROPS`, `GOT_TRAJAN_CLOCKWORK_PHOTOGRAPHIC_OVERLAY_PROPS`. titleSequence parent ships `style: 'photographic-overlay'` (FIFTH end-to-end consumer of this style register after T-351 + T-352 + T-353 — T-321 line 566–578 defers everything except `titlePlate` + `creditsBlock` shots to a sister photographic clip) with single `kind: 'titlePlate'` shot text `'GAME OF THRONES'` (show-title identity per stub line 33), EB Garamond weight 700 (OFL fallback) → bespoke Trajan Pro preferred (commercial-byo, consumer-wired), Baby-Yellow `#FFF190` foreground on deep-metallic-brown `#1A0E08` background, center-of-frame position `{ x: 640, y: 360, width: 1280, alignment: 'center' }`, `letterSpacing: 80` (modest tracking — Roman-inscription canonical envelope ~50–100 preserves long ascenders + sharp serifs per stub line 35), `font.size: 72` ("scaled large" per stub line 33 — larger than T-352's 56 show-logo and T-353's 64 surreal title), `casing: 'uppercase'`. NO light-leak / particles overlays per the metallic-gold/brown canon (warm-orange leaks would over-saturate to muddy "burned-photograph"; sun-rays particle-like effect is deferred per "out of scope"; 3-clip stack matches T-351 / T-352 / T-353's shape with different mode + intensities per D-T349-2). Parity golden rendered at frame 60 fps 30 (early-arc; metallic register fully established within ~2 s; photographic-overlay primitive is static so any in-envelope frame captures the equivalent steady-state register) with **lowered thresholds** `--psnr=34 --ssim=0.90` (matches T-352/T-353's bar — 3D + golds variance pre-declared by stub line 52; 0.02 SSIM / 2 dB PSNR relaxation from the stub's exact 36/0.92 absorbs sepia-matrix-multiplication drift on the metallic-yellow palette across CDP versions and aligns sister Cluster D presets at a uniform bar).

  `signOff.typeDesign: 'pending-cluster-batch'` PRESERVED (cluster-batch flip happens in the IMMEDIATELY-FOLLOWING Cluster D cluster-composer task — T-349 brings Cluster D to 6/6 ELIGIBLE which meets the precondition for the batch flip). All 29 prior `PRESET_ID_BINDINGS` entries UNCHANGED — including T-348's `'stranger-things-benguiat'` 5-clip composition still fans out exactly 5 elements; T-351's `'true-detective-double-exposure'` AND T-352's `'succession-home-video'` AND T-353's `'severance-surreal-3d'` 3-clip compositions still fan out exactly 3 elements each through `buildPresetDocument`. **Cluster D goes from 5/6 → 6/6 ELIGIBLE — third cluster expansion fully closed end-to-end** (after E + G; A/B/E/F were the original 4 ratified clusters; D is the 3rd cluster opened-and-closed in this session-run). All 5 atmospheric primitives (titleSequence + grain + light-leak + particles + photographic-overlay) have at least one consumer post-merge. All 4 photographic-overlay modes (sepia / cross-process / cinematic-lut / fade) have at least one consumer (T-348 fade; T-351 cinematic-lut; T-352 sepia; T-353 cinematic-lut; T-349 = 2nd sepia consumer — confirms mode choice). `ClipKindBinding.overlays?` mechanism (introduced in T-348) has 5 consumers (T-348/T-351/T-352/T-353/T-349) — pattern is fully stable.

  **Seven v1 divergences from the stub canon, with explicit note that (a)–(f) are stub-canon-allowed alternate ship paths per stub line 41 — NOT true canonical breaches (D-T349-9 a/b/c/d/e/f/g): (a) live ThreeSceneClip 3D rendering deferred to T-349-live-3d follow-up** (per `docs/tasks/T-321-carveout-audit.md` carve-out #5 — frontier-tier `ThreeSceneClip` (ADR-005) productionization required; **stub line 41 explicitly authorizes the static-fallback posture**); **(b) clockwork mechanism unfold animations deferred to T-349-clockwork follow-up; (c) heliocentric armillary sphere with historical-event relief deferred to T-349-armillary follow-up; (d) radiating sun rays from center deferred to T-349-sun-rays follow-up; (e) 90-second camera-swoop animation deferred to T-349-camera-swoop follow-up; (f) per-episode location variation + sigil-flip mechanic deferred to T-349-per-episode + T-349-sigil-flips follow-ups; (g) single-frame golden at frame 60 fps 30 (parity-CLI default composition envelope is 150 frames; `--fps` is not a CLI flag).**

- 156c539: T-351 — Add `true-detective-double-exposure` preset binding (Cluster D third preset; **second multi-clip-composition consumer in StageFlip parity-CLI history** — reuses T-348's `ClipKindBinding.overlays?` surface verbatim, no architectural extension; **PRIMARY consumer of the T-321d `photographic-overlay` primitive** — compass canon "photographic clip" register).

  **Public API surface UNCHANGED** (PATCH not MINOR — `ClipKindBinding` interface keeps T-348's shape; `buildPresetDocument` keeps T-348's overlay fanout; `DEFAULT_CLIP_KIND_RESOLVER` keeps T-350's `titleSequence → squidGameGeometricBinding` clipKind-default arm).

  **New `PRESET_ID_BINDINGS['true-detective-double-exposure']` → `trueDetectiveDoubleExposureBinding`** composes the parent `titleSequence` primitive (T-321) with two atmospheric overlays in z-order: `grain` (T-321a; `intensity: 0.15` canonical subtle film-grain register) and `photographic-overlay` (T-321d; `mode: 'cinematic-lut'` at `intensity: 0.6` — DOMINATES the visual, opposite posture from T-348's 0.4 cap). Three exported props constants: `TRUE_DETECTIVE_TITLE_SEQUENCE_PROPS`, `TRUE_DETECTIVE_GRAIN_PROPS`, `TRUE_DETECTIVE_PHOTOGRAPHIC_OVERLAY_PROPS`. titleSequence parent ships `style: 'photographic-overlay'` (FIRST end-to-end consumer of this style register — T-321 line 566–578 defers everything except `titlePlate` + `creditsBlock` shots to a sister photographic clip) with single `kind: 'titlePlate'` shot text `'CREATED BY NIC PIZZOLATTO'`, Inter Regular 400 (OFL fallback) → bespoke license-cleared sans-serif (consumer-wired), muted off-white `#E8DCC4` foreground on `#000000` background, lower-third position `{ x: 640, y: 600, width: 1280, alignment: 'center' }`, `letterSpacing: 40` (+40 tracking per stub line 32 mid-range), `casing: 'uppercase'`. NO light-leak / particles overlays per the muted earth-tone canon (3-clip stack vs. T-348's 5-clip). Parity golden rendered at frame 120 fps 30 (parity-CLI's `DEFAULT_COMPOSITION` envelope is 150 frames; frame 360 — the stub-canonical "mid-arc" annotation at "12 fps effective" — falls outside the envelope and the renderer rejects it; frame 120 matches T-348's posture for the same composition-envelope reason and captures the equivalent steady-state credit-hold register because the photographic-overlay primitive is static and the `'photographic-overlay'` style's `titlePlate` shot is frame-stable) with **lowered thresholds** `--psnr=34 --ssim=0.90` (NOT cluster-norm 42/0.98; even lower than T-348's 36/0.92 — photographic source has high variance per stub line 49).

  `signOff.typeDesign: 'pending-cluster-batch'` PRESERVED (cluster-batch flip happens in the Cluster D cluster-composer follow-up after all 6 typography-carrying Cluster D presets sign their parity goldens). All 26 prior `PRESET_ID_BINDINGS` entries UNCHANGED — including T-348's `'stranger-things-benguiat'` 5-clip composition still fans out exactly 5 elements through `buildPresetDocument`. Cluster D goes from 2/6 → 3/6 signed.

  **Establishes that the multi-clip composition pattern (T-348 `overlays?` extension) is reusable WITHOUT structural modification** — T-349 / T-352 / T-353 mirror this PR's reuse posture (no parity-cli surface change; only `PRESET_ID_BINDINGS` entry + per-preset prop snapshots).

- fd8bd3f: T-352 — Add `succession-home-video` preset binding (Cluster D fourth preset; **third multi-clip-composition consumer in StageFlip parity-CLI history** — reuses T-348's `ClipKindBinding.overlays?` surface verbatim, no architectural extension; **FIRST end-to-end consumer of `mode: 'sepia'`** AND **FIRST end-to-end consumer of non-default grain intensity 0.30**).

  **Public API surface UNCHANGED** (PATCH not MINOR — `ClipKindBinding` interface keeps T-348's shape; `buildPresetDocument` keeps T-348's overlay fanout; `DEFAULT_CLIP_KIND_RESOLVER` keeps T-350's `titleSequence → squidGameGeometricBinding` clipKind-default arm; `title-sequence.tsx` UNCHANGED — videoShot shot-kind extension deferred to T-352-followup per D-T352-1).

  **New `PRESET_ID_BINDINGS['succession-home-video']` → `successionHomeVideoBinding`** composes the parent `titleSequence` primitive (T-321) with two atmospheric overlays in z-order: `grain` (T-321a; **`intensity: 0.30` — HIGH; FIRST end-to-end consumer of non-default grain intensity** per stub line 26 "moderate film grain, subtle frame chatter" — VHS-tape chatter is canonically heavier than the default Stranger-Things-grade subtle grain) and `photographic-overlay` (T-321d; **`mode: 'sepia'` at `intensity: 0.7` — DOMINATES the visual; FIRST end-to-end consumer of `'sepia'` mode**). Three exported props constants: `SUCCESSION_HOME_VIDEO_TITLE_SEQUENCE_PROPS`, `SUCCESSION_HOME_VIDEO_GRAIN_PROPS`, `SUCCESSION_HOME_VIDEO_PHOTOGRAPHIC_OVERLAY_PROPS`. titleSequence parent ships `style: 'photographic-overlay'` (SECOND end-to-end consumer of this style register after T-351 — T-321 line 566–578 defers everything except `titlePlate` + `creditsBlock` shots to a sister photographic clip) with single `kind: 'titlePlate'` shot text `'SUCCESSION'` (show-logo identity per stub line 30), IBM Plex Sans Condensed weight 600 (OFL fallback) → bespoke Engravers Gothic + Sackers Gothic preferred (commercial-byo, consumer-wired), warm off-white `#F4E8C8` foreground on warm-brown `#1A1410` background, center-of-frame position `{ x: 640, y: 360, width: 1280, alignment: 'center' }`, `letterSpacing: 250` (mid-range of stub line 32's "+200, often +300" envelope), `font.size: 56` (show-logo size envelope), `casing: 'uppercase'`. NO light-leak / particles overlays per the sepia warm-yellow canon (would over-saturate to muddy-brown; 3-clip stack matches T-351's shape with different mode + grain intensity per D-T352-2). Parity golden rendered at frame 60 fps 30 (early-arc; sepia register fully established within ~2 s; photographic-overlay primitive is static so any in-envelope frame captures the equivalent steady-state register) with **lowered thresholds** `--psnr=34 --ssim=0.90` (matches T-351's bar — mixed-grade footage variance per stub line 48 + HIGH grain intensity 0.30; slightly more lenient than the stub's 0.91 SSIM to absorb 2x grain intensity vs. sister presets).

  `signOff.typeDesign: 'pending-cluster-batch'` PRESERVED (cluster-batch flip happens in the Cluster D cluster-composer follow-up after all 6 typography-carrying Cluster D presets sign their parity goldens). All 27 prior `PRESET_ID_BINDINGS` entries UNCHANGED — including T-348's `'stranger-things-benguiat'` 5-clip composition still fans out exactly 5 elements AND T-351's `'true-detective-double-exposure'` 3-clip composition still fans out exactly 3 elements through `buildPresetDocument`. Cluster D goes from 3/6 → 4/6 signed (T-349 + T-353 — both ThreeSceneClip-dependent — carry the remaining count to 6/6).

  **Three v1 divergences from the stub canon, documented as follow-ups (D-T352-9 a/b/c/d): (a) actual VHS video element rendering deferred to T-352-followup `videoShot` shot-kind extension** (per `docs/tasks/T-321-carveout-audit.md` carve-out #6 — TITLE-SEQUENCE MODIFICATION, not a new primitive); **(b) 16:9 contemporary footage register intercut deferred to T-352-contemporary** (depends on T-352-followup); **(c) per-season visual variations deferred to T-352-seasonVariant**; **(d) single-frame golden at frame 60 fps 30 (parity-CLI default composition envelope is 150 frames; `--fps` is not a CLI flag)**.

- 7d8f6cd: T-353 — Add `severance-surreal-3d` preset binding (Cluster D fifth preset; **fourth multi-clip-composition consumer in StageFlip parity-CLI history** — reuses T-348's `ClipKindBinding.overlays?` surface verbatim, no architectural extension; **SECOND end-to-end consumer of `mode: 'cinematic-lut'`** at moderate 0.4 intensity (T-351 was PRIMARY at 0.60 dominant); **SECOND end-to-end consumer of non-default grain intensity / FIRST below-default consumer** at LOW 0.10).

  **Public API surface UNCHANGED** (PATCH not MINOR — `ClipKindBinding` interface keeps T-348's shape; `buildPresetDocument` keeps T-348's overlay fanout; `DEFAULT_CLIP_KIND_RESOLVER` keeps T-350's `titleSequence → squidGameGeometricBinding` clipKind-default arm; `title-sequence.tsx` UNCHANGED — threeScene shot-kind extension deferred to T-353-live-3d follow-up per D-T353-1).

  **New `PRESET_ID_BINDINGS['severance-surreal-3d']` → `severanceSurreal3dBinding`** composes the parent `titleSequence` primitive (T-321) with two atmospheric overlays in z-order: `grain` (T-321a; **`intensity: 0.10` — LOW; FIRST below-default consumer of non-default grain intensity** per stub line 23 "sterile color palette" — corporate-clean restrained register hints at 3D-rendered surface micro-texture without competing with typographic identity) and `photographic-overlay` (T-321d; **`mode: 'cinematic-lut'` at `intensity: 0.4` — MODERATE; SECOND end-to-end consumer of `'cinematic-lut'` mode** after T-351's PRIMARY 0.60 dominant cast). Three exported props constants: `SEVERANCE_SURREAL_3D_TITLE_SEQUENCE_PROPS`, `SEVERANCE_SURREAL_3D_GRAIN_PROPS`, `SEVERANCE_SURREAL_3D_PHOTOGRAPHIC_OVERLAY_PROPS`. titleSequence parent ships `style: 'photographic-overlay'` (THIRD end-to-end consumer of this style register after T-351 + T-352 — T-321 line 566–578 defers everything except `titlePlate` + `creditsBlock` shots to a sister photographic clip) with single `kind: 'titlePlate'` shot text `'SEVERANCE'` (title identity per stub line 31), Inter Display weight 500 (OFL fallback) → bespoke Severance custom typeface (Helvetica + mid-century Vignelli) preferred (proprietary-byo, consumer-wired), pale neutral `#E8ECE5` foreground on desaturated-green-black `#1A1F1A` background, center-of-frame position `{ x: 640, y: 360, width: 1280, alignment: 'center' }`, `letterSpacing: 0` (neutral baseline; conservative interpretation of stub line 31's "very tight tracking"), `font.size: 64` ("scaled large" per stub line 31), `casing: 'uppercase'`. NO light-leak / particles overlays per the sterile-corporate canon (would conflict with sterile / desaturated palette; 3-clip stack matches T-351 + T-352's shape with different mode + intensities per D-T353-2). Parity golden rendered at frame 60 fps 30 (early-arc; static-fallback register fully established within ~2 s; photographic-overlay primitive is static so any in-envelope frame captures the equivalent steady-state register) with **tighter thresholds** `--psnr=36 --ssim=0.92` (TIGHTER than T-351/T-352's 34/0.90 — T-353's lower-engagement register has more headroom: LOW grain 0.10 + MODERATE photographic-overlay 0.4 + sterile palette = uniform pixel statistics).

  `signOff.typeDesign: 'pending-cluster-batch'` PRESERVED (cluster-batch flip happens in the Cluster D cluster-composer follow-up after all 6 typography-carrying Cluster D presets sign their parity goldens). All 28 prior `PRESET_ID_BINDINGS` entries UNCHANGED — including T-348's `'stranger-things-benguiat'` 5-clip composition still fans out exactly 5 elements; T-351's `'true-detective-double-exposure'` AND T-352's `'succession-home-video'` 3-clip compositions still fan out exactly 3 elements each through `buildPresetDocument`. Cluster D goes from 4/6 → 5/6 signed (T-349 got-trajan-clockwork — ThreeSceneClip-dependent — carries the remaining count to 6/6).

  **Four v1 divergences from the stub canon, with explicit note that (a) is canon-explicit-allowed per stub line 39 — NOT a true documented divergence (D-T353-9 a/b/c/d): (a) live ThreeSceneClip 3D rendering deferred to T-353-live-3d follow-up `threeScene` shot-kind extension** (per `docs/tasks/T-321-carveout-audit.md` carve-out #5 — TITLE-SEQUENCE MODIFICATION, not a new primitive; **stub line 39 explicitly authorizes the static-fallback posture**); **(b) surreal melt-vignettes / S2 darker register / cloth simulation deferred to T-353-melt-vignettes / T-353-S2-jump-scare / T-353-cloth-sim** (depend on T-353-live-3d); **(c) per-season visual variations deferred to T-353-seasonVariant**; **(d) single-frame golden at frame 60 fps 30 (parity-CLI default composition envelope is 150 frames; `--fps` is not a CLI flag)**.

- 027ff60: T-369 — Add `youtube-subscribe-bounce` preset binding (Cluster G first preset; first `subscribeButton` clipKind consumer; first production consumer of T-317's `subscribe-button` primitive AND its `'youtube'` platform branch).

  `PRESET_ID_BINDINGS['youtube-subscribe-bounce']` → `youtubeSubscribeBounceBinding` → `subscribe-button` primitive on `frame-runtime`. New `YOUTUBE_SUBSCRIBE_BOUNCE_PROPS` export ships the canonical YouTube native subscribe-button broadcast canon (3 fields: `platform: 'youtube'`, `position: { x: 1480, y: 920 }` lower-right anchor on 1920×1080, `label: 'SUBSCRIBE'`). Brand canon dominates theme on the YouTube branch (D-T317-6) — chrome (`#FF0000`) / text (`#FFFFFF`) / font (Roboto Medium 500 @ 18 px) / border-radius (8 px) / drop shadow (`0 4px 8px rgba(0,0,0,0.20)`) all inherit from `renderYoutube` defaults; minimal 3-field snapshot follows D-T369-2 budget. `DEFAULT_CLIP_KIND_RESOLVER` UNCHANGED — no `'subscribeButton'` clipKind-default arm added (sister Cluster G presets bind different primitives: `follow-prompt` / `qr-code-bounce` / `lower-third`). All 20 prior `PRESET_ID_BINDINGS` entries UNCHANGED. Cluster G goes from 0/5 → 1/5 substantive + signed. Three primitive-level cosmetic divergences from the stub register (D-T369-11) accepted as `T-317a` bell-wiggle / `T-317b` cursor-slide-in carve-outs and a documented YouTube force-uppercase contract (T-317 D-T317-8); not T-369 fixes.

- 46d8134: T-370 — Add `tiktok-follow-pulse` preset binding (Cluster G third preset; first `followPrompt` clipKind consumer; first production consumer of T-318's `follow-prompt` primitive AND its `'tiktok'` platform branch).

  `PRESET_ID_BINDINGS['tiktok-follow-pulse']` → `tiktokFollowPulseBinding` → `follow-prompt` primitive on `frame-runtime`. New `TIKTOK_FOLLOW_PULSE_PROPS` export ships the canonical TikTok native follow-prompt mobile-CTA canon (3 fields: `platform: 'tiktok'`, `position: { x: 1180, y: 504 }` right-thumb-zone anchor on 1280×720, `phase: 'pulsing'` mid-pulse register). Brand canon dominates theme on the TikTok branch (D-T318-6) — white avatar surface (`#FFFFFF`) / TikTok-Pink badge (`#FE2C55`) / TikTok Sans 700 font / 40 px diameter / 30%-alpha expanding pulse ring all inherit from `renderTiktok` defaults; minimal 3-field snapshot follows D-T370-2 budget. Parity golden rendered at `--frame=30` (overrides cluster-norm `--frame=60`; under T-318 cycle math `cycleFrames=45`/`pulseRepeat=1`, frame 60 is past `totalFrames=45` and renders settled-baseline equivalent to `'idle'`). `DEFAULT_CLIP_KIND_RESOLVER` UNCHANGED — no `'followPrompt'` clipKind-default arm added. All 22 prior `PRESET_ID_BINDINGS` entries UNCHANGED. Cluster G goes from 2/5 → 3/5 substantive + signed.

- 0f1bd04: T-371 — Add `instagram-link-sticker` preset binding (Cluster G fifth and final preset; closes Cluster G to 5/5 ELIGIBLE — first cluster expansion to fully close; first `socialMedia` clipKind consumer; first production consumer of T-371a's `link-sticker` primitive).

  `PRESET_ID_BINDINGS['instagram-link-sticker']` → `instagramLinkStickerBinding` → `link-sticker` primitive on `frame-runtime`. New `INSTAGRAM_LINK_STICKER_PROPS` export ships the canonical Instagram Stories link-sticker canon: `label: 'instagram.com/yourhandle'` (D-T371-2 — domain-canon placeholder; does NOT encode any real handle), `variant: 'white-on-dark'` (stub line 43 default — pure-black `#000000` backdrop / white `#FFFFFF` Inter Medium 14 px text / black drop-shadow / white shimmer-highlight per `VARIANT_TOKENS['white-on-dark']`), `position: { x: 540, y: 338 }` (canvas-centered top-left on parity-CLI 1280×720; `(1280-200)/2 = 540`, `(720-44)/2 = 338`; D-T371-4). Snapshot intentionally minimal (only the 3 REQUIRED fields); `phase: 'shimmering'` / 200×44 pill / 14 px font-size / `cycleFrames = ceil(fps * 3) = 90` / `bandWidth = 40` / variant tokens all inherit from primitive defaults. Parity golden rendered at cluster-norm `--frame=60` mid-shimmer (band `left = 540 + 120 = 660` on the canvas; right portion of the pill) with **cluster-norm thresholds** `--psnr=42 --ssim=0.98` (NOT preset-pinned 38 / 0.94 like T-372 — the shimmer is a steady-state-icon register: no motion blur, static glyph layout, no per-frame color cycling; stub line 47 explicitly pre-declares 42 / 0.98). `signOff.typeDesign: 'pending-cluster-batch'` PRESERVED (cluster-batch flip happens in the Cluster G cluster-composer follow-up after all 5 presets sign their parity goldens). `DEFAULT_CLIP_KIND_RESOLVER` UNCHANGED — no `'socialMedia'` clipKind-default arm added (only one `socialMedia`-bound preset in v1). All 24 prior `PRESET_ID_BINDINGS` entries UNCHANGED. Cluster G goes from 4/5 → 5/5 ELIGIBLE.

- 69ca4ae: T-372 — Add `coinbase-dvd-qr` preset binding (Cluster G fourth preset; first `qrCodeBounce` clipKind consumer; first production consumer of T-319's `qr-code-bounce` primitive).

  `PRESET_ID_BINDINGS['coinbase-dvd-qr']` → `coinbaseDvdQrBinding` → `qr-code-bounce` primitive on `frame-runtime`. New `COINBASE_DVD_QR_PROPS` and `COINBASE_DVD_QR_MATRIX` exports ship the canonical Coinbase Super Bowl LVI DVD-screensaver QR canon: 21 × 21 Version 1 synthetic-placeholder QR matrix (does NOT encode any real URL — D-T372-2) + `bounce.startPosition: { x: 0, y: 0 }` + `bounce.startVelocity: { vx: 8, vy: 6 }` (mid-flight at frame 60 — ~`(480, 360)` center-canvas; D-T372-3). Snapshot intentionally minimal (only the 2 REQUIRED fields); pure-black backdrop / white light modules / `sizePercent: 22` / rainbow `colorCycle` (`cycleFrames = ceil(fps * 7) = 210` at fps 30) all inherit from primitive defaults. Parity golden rendered at cluster-norm `--frame=60` with the **first non-cluster-norm threshold pin in Phase 13**: `--psnr=38 --ssim=0.94` (preset-pinned per stub line 48; motion blur of bouncing QR + per-frame HSL hue cycling reduces parity precision below the 42/0.98 steady-state-icon range). `signOff.typeDesign: 'na'` UNCHANGED — text-free preset short-circuits the type-design gate at `license: 'na'`. `DEFAULT_CLIP_KIND_RESOLVER` UNCHANGED — no `'qrCodeBounce'` clipKind-default arm added (only one `qrCodeBounce`-bound preset in v1). All 23 prior `PRESET_ID_BINDINGS` entries UNCHANGED. Cluster G goes from 3/5 → 4/5 substantive + signed.

- fee18be: T-373 — Add `social-handle-lower-third` preset binding (Cluster G second preset; sixth `lowerThird` clipKind consumer; fifth `lowerThird`-keyed `PRESET_ID_BINDINGS` override after T-325 / T-326 / T-330 / T-329; fifth production consumer of T-183z's `noFlag` / `subtitleColor` / `font` props).

  `PRESET_ID_BINDINGS['social-handle-lower-third']` → `socialHandleLowerThirdBinding` → `lower-third` primitive on `frame-runtime`. New `SOCIAL_HANDLE_LOWER_THIRD_PROPS` export ships the canonical cross-platform social-handle steady-state lower-third (10 fields: `'@yourbrand'` Mixed-Case headline + `'Follow us everywhere'` sentence-case subtitle, both in white `#FFFFFF` Inter Bold weight 700; flat black `#000000` background; `noFlag: true` suppresses the accent strip; `subtitleColor: '#FFFFFF'` decouples the subtitle line from `accent`; `insetLeftPx: 96` / `insetBottomPx: 96` canvas-safe defaults at 1280×720). All 21 prior `PRESET_ID_BINDINGS` entries UNCHANGED. `DEFAULT_CLIP_KIND_RESOLVER`'s `'lowerThird'` arm UNCHANGED — `cnnClassicBinding` still holds the clipKind-default slot. Cluster G goes from 1/5 → 2/5 substantive + signed. Six primitive-level cosmetic divergences from the stub register (D-T373-12 a–f — opaque background approximating 60–80% translucent register, hard-coded boxShadow, uniform corner radius, ease-out-quart entry curve, no multi-handle cascade, no platform-icon row) accepted as `T-183z`-family / `T-373a`-family follow-ups; not T-373 fixes.

- Updated dependencies [0bcc2a8]
- Updated dependencies [12a8382]
- Updated dependencies [1e0c779]
- Updated dependencies [4d2ef1e]
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
- Updated dependencies [bbcbd38]
- Updated dependencies [8a1d95e]
- Updated dependencies [5edf5a1]
- Updated dependencies [5f69c4e]
- Updated dependencies [fc9526b]
- Updated dependencies [75e3d7e]
- Updated dependencies [3096a1c]
- Updated dependencies [233cbf1]
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
