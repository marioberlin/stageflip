# @stageflip/renderer-cdp

## 0.1.0

### Minor Changes

- 0bcc2a8: Runtime bundle host — scaffold + CSS runtime (T-100d).

  **New package `@stageflip/cdp-host-bundle`**: a Vite-emitted browser
  IIFE that bundles React + ReactDOM + `@stageflip/frame-runtime` +
  `@stageflip/runtimes-contract` + `@stageflip/runtimes-css` + a
  React composition renderer. Inlined into the host HTML so Chrome
  loads one self-contained file — no module resolution, no network.

  **What the bundle does at boot**:

  1. Registers `@stageflip/runtimes-css` with the shared runtime
     registry (other 5 runtimes land with T-100e).
  2. Reads the `RIRDocument` from the `<script id="__sf_doc"
type="application/json">` tag that the host HTML embeds.
  3. Mounts `<BootedComposition>` (a `FrameProvider` wrapping a
     `<Composition>`) into `#__sf_root` at frame 0.
  4. Exposes `window.__sf.setFrame(n)` — every call re-renders via
     `createRoot().render()` so React diffs frame-to-frame instead
     of re-mounting.
  5. Sets `window.__sf.ready = true`.

  **Module surface**:

  - `Composition({ document, frame })` — React component. Walks
    `document.elements`, renders shape / text / clip / video-image /
    unknown. Clip elements dispatch through `findClip(kind)` and
    return a labelled `__sf_placeholder` when the runtime is missing
    or mismatched. Hides elements outside `[startFrame, endFrame)`
    AND when `element.visible === false` (same semantic as
    `richPlaceholderHostHtml` from T-100c).
  - `BootedComposition` — `<FrameProvider>` wrapping `<Composition>`.
    Lets runtime-rendered clips call `useCurrentFrame()`.
  - `loadBundleSource()` — async reads `dist/browser/bundle.js`
    relative to the package root. Walks up from `import.meta.url` to
    find `package.json` so it works both from `src/` (tests against
    source) and `dist/node/` (production).
  - `bundlePath()` — path-only variant.

  **Builder wiring in renderer-cdp**:

  - New `createRuntimeBundleHostHtml(bundleSource)` in
    `packages/renderer-cdp/src/puppeteer-session.ts`. Returns a
    `HostHtmlBuilder` that emits an HTML document containing
    `#__sf_root`, the document JSON in a `<script
type="application/json">` tag (with the same `</script` + U+2028/29
    escapes as `richPlaceholderHostHtml`), and the compiled IIFE.
  - Exported from `@stageflip/renderer-cdp`.

  **Intentionally NOT in scope (T-100e)**: GSAP, Lottie, Shader,
  Three, frame-runtime-bridge runtimes. Each adds significant
  bundle weight (three.js alone ≈ 1 MB) and each needs its own
  integration checks — better as separate reviewable units.

  **Build**: the package exposes `pnpm build` which runs Vite
  (emits `dist/browser/bundle.js` — ~636 KB, ~194 KB gzipped) then
  tsup (emits `dist/node/index.js` — ESM-only, dropping CJS because
  `import.meta.url` is unavailable there). The renderer-cdp
  workspace dep picks up both at runtime via the package `exports`
  map.

  **Plan-row split** in `docs/implementation-plan.md`: T-100d
  narrowed to "scaffold + CSS runtime" (M), T-100e added for "add
  GSAP / Lottie / Shader / Three / frame-runtime-bridge" (M). The
  original L-sized T-100d would have landed React + 6 runtimes + a
  Vite build pipeline in one PR — too much for one review. Plan
  version bumped v1.3 → v1.4.

  **Tests**: 13 new cases across
  `packages/cdp-host-bundle/src/composition.test.tsx` (11: shape /
  text / timing window / editorial visible / clip dispatch / missing
  runtime / runtime-id mismatch / zIndex / root dimensions / frame
  stamp / BootedComposition smoke) and
  `packages/cdp-host-bundle/src/index.test.ts` (2: `loadBundleSource`
  reads the compiled IIFE + `bundlePath` matches `loadBundleSource`'s
  read path). All 9 CI gates green.

  **Skill**: `skills/stageflip/reference/export-formats/SKILL.md`
  updated — the pluggable-host section now documents all three
  builders (third is partial), module-surface table adds the T-100d
  exports, deferred-work row re-aimed at T-100e.

- 28674f9: Vendor `@hyperframes/engine` into `packages/renderer-cdp/vendor/engine/` (T-080).

  - Upstream: https://github.com/heygen-com/hyperframes
  - Pinned commit: `d1f992570a2a2d7cb4fa0b4a7e31687a0791803d`
  - License: Apache-2.0 (upstream `LICENSE` preserved at vendor root)
  - Pin manifest: `packages/renderer-cdp/vendor/engine/PIN.json`

  Drop-only: no wiring, no adapter, no dispatcher. Subsequent Phase 4
  tasks build on top:

  - T-081 — NOTICE file with StageFlip modification attributions.
  - T-082 — vendor `README.md` explaining scope, modifications, and
    upgrade path.
  - T-083 — ClipRuntime ↔ CDP bridge adapter.

  Vendor directory is excluded from the package's typecheck (src-only
  `tsconfig.include`) and test discovery (new `vitest.config.ts` scopes
  `include` to `src/**`). The upstream engine's own test suite is kept
  verbatim alongside the source but is not executed here.

  Integrity is enforced by `src/vendor-integrity.test.ts` which asserts
  LICENSE preservation, PIN.json shape (upstream / package / 40-char
  commit / ISO date / license), and presence of the engine entrypoint.

- a7b3f85: Author `packages/renderer-cdp/vendor/NOTICE` (T-081).

  Satisfies Apache License 2.0 §4(d) attribution for the
  `@hyperframes/engine` payload vendored under T-080. Records:

  - Copyright holder (HeyGen Inc.).
  - Upstream URL, vendored package path, pinned commit, vendor date.
  - That upstream ships no NOTICE of its own — so there is nothing
    from upstream to preserve here; only StageFlip's own attribution.
  - Modification policy per THIRD_PARTY.md §2 (file-level
    "Modified by StageFlip, YYYY-MM-DD" comments). No modifications
    recorded yet.
  - Trademark posture for "Hyperframes".

  `vendor-integrity.test.ts` extended with 3 cases covering NOTICE
  existence, Apache-2.0 + commit attribution, and modification-policy
  text.

- 2c08812: Author `packages/renderer-cdp/vendor/README.md` (T-082).

  Human-readable index to the vendor directory: what's vendored, why
  we vendor rather than reimplement, how vendored code is excluded
  from the package's gates, the modification policy, and the upgrade
  protocol for re-pinning to a new upstream commit.

  Cross-links to `NOTICE`, `engine/LICENSE`, `engine/PIN.json`,
  `THIRD_PARTY.md` §2, and `docs/dependencies.md` §5 so the provenance
  story can be read starting from any of those files.

  Calls out the in-scope / out-of-scope boundary for the vendor drop:
  CDP engine is vendored; `@hyperframes/core`'s two helpers used by
  engine (`MEDIA_VISUAL_STYLE_PROPERTIES`, `quantizeTimeToFrame`) are
  NOT vendored — T-083 decides whether to re-implement or vendor a
  second payload.

  `vendor-integrity.test.ts` extended with 5 cases covering README
  existence, engine pin match, the "why + upgrade + ADR" rationale
  prose, the modifications section, and cross-references to the four
  canonical provenance files.

- 018d9f0: Live-tier CDP adapter + dispatcher (T-083).

  Phase 4's first substantive wiring task. Per the resolved escalation
  (`docs/escalation-T-083.md`):

  - **B1 accepted** — two-pass bake orchestration moved out of T-083 and
    into T-089 [rev]. No bake code here.
  - **B2 accepted** — "one mapping per runtime kind" replaced with
    "single live-tier adapter backed by the shared registry". All 6
    registered live runtimes (css, gsap, lottie, shader, three,
    frame-runtime-bridge) share one code path through this adapter; no
    per-kind branching.
  - **B3 option (a) accepted** — reimplemented `quantizeTimeToFrame` and
    `MEDIA_VISUAL_STYLE_PROPERTIES` in
    `src/vendor-core-helpers.ts`. Patched three vendored engine files
    (`vendor/engine/src/index.ts`, `services/frameCapture.ts`,
    `services/screenshotService.ts`) with "Modified by StageFlip,
    2026-04-21" headers so the engine's `@hyperframes/core` imports now
    resolve to our reimpl. First real exercise of the T-081
    modification protocol; modification entry appended to
    `vendor/NOTICE`.

  New modules (all under `packages/renderer-cdp/src/`):

  - `vendor-core-helpers.ts` — the two reimplemented symbols.
  - `dispatch.ts` — `dispatchClips(document) → DispatchPlan`. Walks the
    RIR document (recursing into groups), resolves each clip-content
    element via `findClip(kind)`, returns resolved + unresolved lists.
    Unresolved reasons: `'unknown-kind'` and `'runtime-mismatch'`.
  - `adapter.ts` — `LiveTierAdapter` + `CdpSession` integration seam +
    `DispatchUnresolvedError`. `mount(document)` produces a dispatch
    plan then calls `session.mount`; `renderFrame(mounted, frame)` runs
    `session.seek` + `session.capture`; `close` delegates. Fail-loud on
    unresolved clips (never silently renders a degraded document).

  `CdpSession` is the integration seam — tests inject a fake session;
  the real Puppeteer-backed implementation lands in T-084+, using the
  now-patched vendored engine.

  Package deps added: `@stageflip/rir`, `@stageflip/runtimes-contract`.

  Test surface: 36 cases across 4 files (12 integrity + 10 helpers +
  8 dispatch + 6 adapter).

- 988731e: Export dispatcher + preflight + frame sink (T-084).

  Top-level orchestrator that ties preflight, the T-083 live-tier
  adapter, and a pluggable output sink together. The dispatcher owns
  the capture loop:

  ```ts
  const result = await exportDocument(document, { session, sink });
  ```

  Steps:

  1. `preflight(document)` — pure analysis. Aggregates font
     requirements, tier-splits resolved clips into live / bake, and
     surfaces any reason to refuse the export. Blockers today:
     `unresolved-clips`, `bake-not-implemented` (T-089 is
     interfaces-only), `empty-fps`, `empty-duration`. Placeholder
     `assetRefs` field — T-084a populates.
  2. `LiveTierAdapter.mount(document)` — via the existing T-083
     surface.
  3. Per-frame loop over `[start, end)` — `adapter.renderFrame` →
     `sink.onFrame`. Defaults to the full document.
  4. `finally` — `adapter.close` + `sink.close`. Both fire exactly
     once even if the capture loop throws.

  Fails loud: preflight blockers raise `PreflightBlockedError` before
  the session is opened. Invalid frame ranges raise `RangeError`.

  New public surface (all under `packages/renderer-cdp/src/`):

  - `frame-sink.ts` — `FrameSink` interface + `InMemoryFrameSink`
    (test / inspection; production wiring = disk / FFmpeg-pipe in
    T-085+).
  - `preflight.ts` — `preflight(document) → PreflightReport`.
  - `export-dispatcher.ts` — `exportDocument(...)` +
    `PreflightBlockedError`.

  Tests: 19 new cases across 3 files. Total test surface in
  `@stageflip/renderer-cdp`: 55 across 7 files.

  Package deps added: `@stageflip/fonts` (for
  `aggregateFontRequirements` in preflight).

- 3f65147: Asset preflight (T-084a).

  Walks an RIRDocument for every URL-bearing content reference
  (image, video, audio, embed), passes each through a pluggable
  `AssetResolver` to fetch/cache it, and produces a rewritten
  document whose URLs point at local `file://` paths. Refs the
  resolver refuses (YouTube embeds, arbitrary iframes, offline
  URLs) come back as **loss-flags**: surfaced in the export result,
  left unrewritten in the document, never silently dropped.

  New modules (packages/renderer-cdp/src/):

  - `asset-refs.ts` — pure traversal.
    - `collectAssetRefs(document) → readonly AssetRef[]` — dedup by
      URL, annotated with `firstSeenElementId` + `referencedBy`.
    - `rewriteDocumentAssets(document, map) → RIRDocument` —
      immutable substitution of URLs via the resolution map.
  - `asset-resolver.ts` — asynchronous resolution.
    - `AssetResolver` interface + `InMemoryAssetResolver` (fixture
      map + call recorder for tests).
    - `AssetResolution = { status: 'ok', localUrl } | { status:
'loss-flag', reason }` — fail-visible by design.
    - `resolveAssets(document, resolver)` orchestrator — dedup fetch
      calls across duplicate URLs, build resolution map, apply
      rewriter. Resolver errors propagate (fail-loud).

  `preflight.ts` now populates `PreflightReport.assetRefs` by calling
  `collectAssetRefs` (no longer a stub). Resolution / rewrite is a
  separate async phase — `preflight` stays pure and sync.

  `exportDocument` extended:

  - New option: `assetResolver?: AssetResolver`. If provided, asset
    preflight runs after sync preflight and before `adapter.mount`;
    the session sees the rewritten document.
  - New result field: `lossFlags: readonly LossFlag[]`. Empty when
    no resolver was supplied.
  - Sink ownership contract unchanged — `sink.close` still fires
    exactly once on every exit path.

  Real HTTP fetch + content-hash disk cache + Puppeteer-screenshot
  rasterization for embeds will land alongside the T-085/T-090
  concrete CDP session. This task ships the contract and the
  orchestrator; tests inject `InMemoryAssetResolver`.

  Test surface: 78 cases across 9 files (+21 from T-084).

  - 10 asset-refs (collect + dedup + recurse + rewrite + non-mutation)
  - 8 asset-resolver (InMemoryAssetResolver + orchestrator dedup +
    loss-flag propagation + resolver-error propagation + identity
    passthrough)
  - 3 new export-dispatcher integration cases (rewrite before mount,
    loss-flag surfaced, no-resolver passthrough)

- 0abbeb7: FFmpeg integration (T-085).

  Frame-sink-backed encoder that pipes PNG buffers to a spawned
  `ffmpeg` process and writes H.264 / H.265 / VP9 / ProRes 4444
  (alpha) output. Drop-in replacement for `InMemoryFrameSink` when
  a consumer wants real video file output.

  New modules (packages/renderer-cdp/src/):

  - `child-runner.ts` — process-seam abstraction.
    `ChildRunner` + `SpawnedProcess` + `ChildStdin`. Tests inject a
    fake; the default `createNodeChildRunner()` uses Node's
    `child_process.spawn` with piped stdin / captured stderr.
  - `ffmpeg-profiles.ts` — the four codec profiles as const records
    (codecArgs, containerExt, pixFmt, supportsAlpha, crfRange).
    `PROFILE_H264`, `PROFILE_H265`, `PROFILE_VP9`,
    `PROFILE_PRORES_4444`, `ENCODER_PROFILES`, `getEncoderProfile`.
  - `ffmpeg-encoder.ts` — `FFmpegEncoder implements FrameSink`.
    `create(opts)` spawns eagerly (argv errors surface up-front).
    `onFrame` writes to stdin, `close` ends stdin + awaits exit;
    non-zero exit raises `FFmpegEncoderError` with stderr attached.
    Close is idempotent per the FrameSink contract.
    `buildFfmpegArgs` exposed for tests / introspection.
  - `ffmpeg-doctor.ts` — `doctor(opts?)` → `DoctorReport`. Runs
    `ffmpeg -version` once, parses the version line and the
    `--enable-*` configure flags; surfaces per-codec issues.

  Encoder details:

  - Input is `-f image2pipe -c:v png` — one complete PNG per
    `onFrame` call.
  - `-r <fps>` is emitted on both input and output sides so
    container metadata matches captured frame timing.
  - H.264 / H.265 use yuv420p + CRF; VP9 sets `-b:v 0` to unlock
    constant-quality mode (without it, CRF is a bitrate ceiling).
  - ProRes 4444 uses `-profile:v 4 -pix_fmt yuva444p10le`
    (10-bit alpha channel preserved) and rejects a CRF knob loudly
    rather than silently dropping it.
  - Dimensions validated as positive even integers (yuv420p needs
    even sides); fps as positive finite.

  Doctor details:

  - Single spawn of `ffmpeg -version`; parses both version + the
    `configuration:` line's `--enable-<lib>` flags.
  - Reports `ok: false` on missing codecs, unparseable version,
    empty output, or spawn failure (e.g. ENOENT).
  - `prores_ks` is bundled with ffmpeg, so it counts as present
    whenever the version output is non-empty.
  - CLI wiring (`stageflip doctor`) is future CLI-task territory;
    consumers today call `doctor()` directly.

  Test surface: 111 cases across 12 files (+31 from T-084a).

  - 7 child-runner is tested via encoder + doctor fake-runner
    paths (no separate suite — `createNodeChildRunner` touches
    the real `child_process`; integration tests land with
    T-090).
  - 8 ffmpeg-profiles (coverage, alpha, containers, CRF defaults,
    vp9 -b:v 0, prores profile/pixfmt, lookup throws)
  - 17 ffmpeg-encoder (argv, CRF validation, dimension/fps
    validation, -r on both sides, spawn/write/close orchestration,
    non-zero exit, idempotent close, after-close rejects,
    custom ffmpegPath)
  - 7 ffmpeg-doctor (happy path, custom path, missing codecs,
    spawn throw, empty output, unparseable version, ok=false
    with parsed version)

- ec54b0d: Video-frame pre-extraction (T-086).

  Spawns ffmpeg to decode a source video into one PNG (or JPG) per
  composition frame in a target directory. The CDP live-capture path
  then swaps these stills in instead of relying on HTML `<video>`
  playback during BeginFrame, which is non-deterministic.

  New module `packages/renderer-cdp/src/video-frame-extractor.ts`:

  - `buildExtractFramesArgs(opts)` — pure argv builder. Returns
    `{ args, framePattern, outputPath }`. Testable without spawning.
  - `extractVideoFrames(opts)` → `ExtractVideoFramesResult`. Spawns
    via the T-085 `ChildRunner` seam, closes stdin immediately, awaits
    exit, raises `ExtractVideoFramesError` (with stderr attached) on
    non-zero exit.

  Adapted from the vendored engine's
  `vendor/engine/src/services/videoFrameExtractor.ts`. Preserved
  behaviour: `-ss` before `-i` (fast keyframe seek), `-t` for
  duration, `-vf fps=N` output rate, 5-digit pattern
  `frame_%05d.<ext>`, upstream JPG quality curve
  `Math.ceil((100 - quality) / 3)`. Decoded pixels are identical to
  upstream for the same inputs.

  Deliberate argv deviations (decoded pixels unaffected):

  - Adds `-hide_banner -loglevel error` to match this package's own
    `ffmpeg-encoder.ts` house style.
  - Emits `-y` once up-front (upstream: at the end).
  - PNG path omits upstream's `-q:v 0` (PNG is lossless; that arg is
    a no-op). `-compression_level 6` preserved.

  The wrapper is fresh and uses our ChildRunner — no direct use of
  Node's `child_process`.

  Input validation is fail-loud:

  - `fps` positive finite.
  - `startTimeSec` non-negative finite (default 0).
  - `durationSec` positive finite when provided (omit for "to end").
  - `quality` 0..100 for JPG output.
  - `videoPath` non-empty.

  Test surface: 11 cases for the extractor (+ existing 112 = 123
  total across 13 files). Covers argv happy paths, PNG vs JPG
  divergence, validation errors, spawn orchestration, custom
  ffmpegPath, and non-zero-exit error propagation.

- 2b86717: Audio mixer — parse tracks, mix via ffmpeg filter graph, mux (T-087).

  Takes N `AudioTrack`s (source path + comp-time window + RIR-shaped
  knobs) plus the video produced by T-085, builds a
  `-filter_complex` graph, and muxes the mixed audio into the output
  container. No tracks → simple stream-copy through.

  New module `packages/renderer-cdp/src/audio-mixer.ts`:

  - `AudioTrack` — mirrors the RIR audio-content schema: sourcePath,
    startFrame/endFrame, trimStartMs/trimEndMs, loop, gain, pan,
    fadeInMs/fadeOutMs.
  - `buildMixAudioArgs(opts)` — pure. Emits ffmpeg argv + the
    filter-graph string. Fails loud on malformed input with
    per-track context (`track[N]: <field>`).
  - `mixAudio(opts)` — spawns via the T-085 `ChildRunner` seam,
    awaits exit, raises `MixAudioError` with stderr on non-zero.

  Per-track filter chain, applied in order:

  ```
  atrim=start=Ts:end=Te,
  asetpts=PTS-STARTPTS,
  aloop=loop=-1:size=2147483647  # when loop=true (INT32_MAX samples)
  volume=G                    # when G != 1
  pan=stereo|c0=...|c1=...    # stereo matrix from pan ∈ [-1,1]
  adelay=Dms|Dms              # comp-timing delay
  afade=t=in:st=D/1000:d=fIn  # when fadeInMs > 0
  afade=t=out:st=(D+dur-fOut)/1000:d=fOut   # when fadeOutMs > 0
  ```

  Then `amix=inputs=N:dropout_transition=0:normalize=0[mix]`, muxed
  with `-map 0:v -map [mix] -c:v copy -c:a aac -shortest`.

  Zero-track path emits `-i video -c copy out` — pure pass-through,
  no filter graph, no re-encode.

  Scope deferred: surround / channel-aware pan (stereo-only today;
  the RIR pan field is stereo-only too); ffprobe-derived duration
  overrides; per-track output bit-depth control.

  Test surface: 17 cases for the mixer (+ existing 123 = 140 total
  across 14 files). Covers 0/1/N track paths, every filter emission
  conditional (trim, loop, volume, pan, fade, delay), argv shape,
  validation, and orchestration (spawn + non-zero exit + custom
  path).

- dc34bc8: Export artifact storage (T-088 [rev]).

  Defines the `ArtifactStore` interface — the home for completed
  exports — and ships two reference implementations. Firebase Storage
  adapter is deferred (mirrors the T-035..T-039 Firebase deferral
  from Phase 1; non-blocking); plan row T-088 annotated `[rev]`.

  New module `packages/renderer-cdp/src/artifact-store.ts`:

  - `ArtifactStore` — `put(key, sourcePath)`, `has`, `get`, `list`,
    `delete`. Keys are path-safe: `[A-Za-z0-9._-]` segments joined by
    single-level `/`. `..`, absolute paths, double slashes, and
    non-ASCII characters are rejected.
  - `sanitizeArtifactKey(key)` — exposed so callers can pre-validate
    before building a key dynamically.
  - `InMemoryArtifactStore` — zero-IO, test-friendly; records every
    call via `.calls`, exposes `bytesFor(key)` for byte-level
    assertions. `localPath` is a synthetic `memory:<key>` URL.
  - `LocalFsArtifactStore({ rootDir })` — filesystem-backed, one file
    per key; sub-directories created on demand. Key sanitation plus
    defence-in-depth `resolve` check blocks any write outside
    `rootDir`.

  Test surface: 19 cases for the store (+ existing 140 = 159 total
  across 15 files). Covers sanitiser edge cases (empty, leading /
  trailing slash, `..`, invalid chars, non-string), in-memory +
  FS round-trips (put/has/get/list/delete), nested-key directory
  creation, missing-key null returns, list returns empty on
  missing rootDir, delete is a no-op on absent keys.

  Deferred: Firebase Storage adapter (tracked via the T-088 [rev]
  marker in `docs/implementation-plan.md`, alongside Phase 1's
  Firebase deferrals T-035..T-039).

- 6de5649: Bake-runtime scaffolding + two-pass orchestration (T-089 [rev]).

  The T-083 escalation moved two-pass bake orchestration out of
  T-083 and into this task (see `docs/escalation-T-083.md` §B1).
  This PR ships the interfaces and a minimal in-memory reference
  implementation. No concrete bake runtime (Blender, heavy three,
  offline shader) ships here — those arrive in Phase 12. No wiring
  into `exportDocument` yet either; the T-084 preflight still
  blocks bake-tier work with `bake-not-implemented`.

  New module `packages/renderer-cdp/src/bake.ts`:

  **Interfaces**:

  - `BakeJob` — `{ id, runtimeId, clipKind, params, width, height,
fps, durationFrames }`. `id` is a caller-supplied content hash
    used as the cache key.
  - `BakeArtifact` — `{ jobId, kind: 'frames' | 'video' | 'audio',
localPath, sizeBytes?, metadata? }`.
  - `BakeRuntime` — `canBake(clipKind)` + `bake(job)`.
  - `BakeCache` — `has / get / put / delete` keyed by `BakeJob.id`.
  - `BakeOrchestrator` — `register(runtime)`, `listRuntimes()`,
    `bakeAll(jobs) → { baked, cached, failed }`. Per-job failures
    are captured as `BakeFailure` (reason: `'no-runtime'` |
    `'bake-error'`), never thrown — callers decide whether to
    proceed with a partial bake.

  **Reference implementations**:

  - `InMemoryBakeCache` — Map-backed.
  - `InMemoryBakeOrchestrator({ cache? })` — sequential (determinism
    over parallelism). Per job: cache hit → `cached[]`; cache miss +
    matching runtime → `baked[]` + cache write-through; cache miss +
    no runtime → `failed[]` (no-runtime); runtime throw → `failed[]`
    (bake-error). First-registered runtime wins on clipKind tie.

  Test surface: 13 cases for bake (+ existing 161 = 174 total
  across 16 files). Covers cache round-trips, register idempotency

  - id uniqueness, bakeAll happy path, cache hits/misses, write-
    through, no-runtime failure, bake-error isolation (continues with
    remaining jobs), first-registered-wins tie-breaking, empty job
    list.

- eeecee8: Reference render tests — 3 fixtures → MP4 → ffprobe verify (T-090).

  **Phase 4 exit criterion reached**: three fixture RIR documents
  render end-to-end through a real headless browser, a real FFmpeg
  process, and a real ffprobe verification. No stubs on the hot path.

  New modules (packages/renderer-cdp/src/):

  - `puppeteer-session.ts` — concrete `CdpSession` backed by
    `puppeteer-core`. Browser-factory seam for tests (no chrome
    launch). Host HTML is pluggable; defaults to
    `canvasPlaceholderHostHtml` — a minimal canvas page that exposes
    `window.__sf.setFrame(n)` so the pipeline is exercised without a
    full React bundle (that lands with T-100 parity harness).
    Session reuses one browser across concurrent mounts; has a
    separate `closeSession()` to tear it down.
  - `ffprobe.ts` — `ffprobe(filePath)` →
    `{ format, streams, raw }`. Spawns via the T-085 `ChildRunner`
    seam, parses the `-print_format json` output, surfaces
    `FfprobeError` on non-zero exit.
  - `reference-fixtures.ts` — three deterministic RIR documents
    (`solidBackground`, `multiElement`, `videoClip`). None use clip
    content so the e2e suite doesn't depend on runtime registration.
  - `reference-render.ts` — `renderReferenceFixture(opts)` orchestrates
    session + encoder + ffprobe + returns `{ export, probe }`.
    `canRunReferenceRenders()` detects Chrome (standard paths +
    `PUPPETEER_EXECUTABLE_PATH` + `CHROME_BIN`) + ffmpeg + ffprobe
    (PATH + `FFMPEG_PATH` / `FFPROBE_PATH`) so the e2e suite skips
    cleanly on CI without them.

  **Tests split into two suites**:

  - Unit (`puppeteer-session.test.ts`, `ffprobe.test.ts`,
    `reference-render.test.ts`) — fake browser + fake runner; run
    everywhere; 24 new cases.
  - E2E (`reference-render.e2e.test.ts`) — real chrome + real ffmpeg
    - real ffprobe; 3 cases one per fixture; guarded by
      `canRunReferenceRenders()`. Per-test budget 60s. Vitest skips
      the whole `describe` with the reason surfaced in output when
      tooling is missing.

  **Behavioural fix in the dispatcher**: `exportDocument`'s
  preflight-blocked path now swallows a secondary `sink.close()`
  failure so the `PreflightBlockedError` reaches the caller. Before:
  if a real `FFmpegEncoder` was handed in, its close would fail with
  "Output file does not contain any stream" (ffmpeg got zero writes),
  masking the actual preflight diagnostic. Unit tests continue to
  pass because `InMemoryFrameSink.close()` never threw in the first
  place.

  **Dependency added**: `puppeteer-core@23.11.1`
  (pre-pinned in `docs/dependencies.md` §3 for T-090). MIT. Dynamic
  import inside `createPuppeteerBrowserFactory` so consumers that
  never instantiate a Puppeteer session don't pay the load cost.

  Test surface: 27 new cases (9 puppeteer-session + 9 ffprobe + 6
  reference-render unit + 3 reference-render e2e) = 201 total
  across 20 files (+ 27 from T-089's 174). E2E suite adds ~3s per
  run when tooling is present.

- 6dd3b44: BeginFrame capture integration for `PuppeteerCdpSession` (T-100b).

  **The deterministic-fidelity gap closes.** Before this task,
  `PuppeteerCdpSession.capture()` always went through
  `page.screenshot()` — non-deterministic across runs because
  Chrome's real compositor cadence leaks through. T-100b adds an
  alternative capture path using `HeadlessExperimental.beginFrame`,
  which drives the compositor atomically with a caller-supplied
  virtual clock. Same session API (`mount` / `seek` / `capture` /
  `close`), new `captureMode` option picks the protocol.

  **Capture mode selection** via the new `CaptureMode` type:

  - `'auto'` (default) — BeginFrame when the host platform is Linux
    AND the page exposes `createCDPSession` AND the runtime probe
    confirms `HeadlessExperimental.beginFrame` is callable;
    screenshot otherwise. Auto never throws — an unsupported
    environment silently downgrades so a macOS dev machine still
    produces (non-deterministic) captures without extra config.
  - `'beginframe'` — force BeginFrame. Throws at mount time if the
    page has no CDP client or if the probe fails. For CI on
    chrome-headless-shell.
  - `'screenshot'` — force the pre-T-100b behaviour.

  **New exports from `@stageflip/renderer-cdp`**:

  - `CaptureMode` type.
  - `BEGIN_FRAME_LAUNCH_ARGS` — frozen readonly array of the
    Chrome flags the BeginFrame protocol needs (`--deterministic-mode`,
    `--enable-begin-frame-control`, and friends). Cross-referenced
    with the vendored engine's `browserManager.ts`.
  - `probeBeginFrameSupport(cdp, { timeoutMs? })` — the runtime probe;
    returns boolean, never throws. Caller decides the fallback.
  - `PuppetCdpClient` interface (narrow `.send()` + `.detach()`
    slice of puppeteer-core's `CDPSession`).

  **API seam extensions**:

  - `PuppetPage.createCDPSession?()` is now an optional method on
    the `PuppetPage` interface. Production `puppeteer-core` pages
    satisfy it automatically; test fakes that only exercise the
    screenshot path can continue to omit it.
  - `PuppeteerCdpSessionOptions.captureMode` + `platform` options.
    The `platform` injection is a test-only escape hatch so the
    Linux-gated BeginFrame branch is exercisable from macOS CI.
  - `createPuppeteerBrowserFactory({ captureMode: 'beginframe' })`
    appends `BEGIN_FRAME_LAUNCH_ARGS` to the launch args. Other
    modes leave args untouched — `--enable-begin-frame-control`
    under screenshot mode wedges the compositor.

  **Per-handle BeginFrame state**:

  - `beginFrameIntervalMs` (= `1000 / fps`) initialised at mount.
  - `beginFrameTimeTicks` advanced by `seek(frame)` to
    `frame * intervalMs`. Absolute, not relative — non-monotonic
    seeks (scrub preview) still render correctly.
  - `close(handle)` detaches the CDP client before closing the page
    (detach errors swallowed).

  **Intentionally NOT in scope** (deferred to T-100c): real
  React + runtime-mounting host HTML bundle. The canvas placeholder
  remains the default host. BeginFrame is fully wired today but
  against the placeholder — the parity harness can still exercise
  the BeginFrame path via goldens captured under the placeholder.

  **Tests**: +15 cases in `puppeteer-session.test.ts` (11 → 26).
  Covers mode selection (auto on darwin/linux, explicit beginframe /
  screenshot), probe success / failure / timeout, BeginFrame clock
  advancement, forced secondary beginFrame when `screenshotData` is
  absent, error propagation, and `close(handle)` CDP detach
  ordering. The three-fixture e2e reference-render suite still
  passes on macOS (auto correctly falls through to screenshot).

  **Skill**: `skills/stageflip/reference/export-formats/SKILL.md`
  updated — the "Concrete implementation" section now documents
  both protocols + auto-fallback + per-frame clock; the
  "Determinism (structural)" section updates the old screenshot-gap
  language; the module-surface table gains the new T-100b exports;
  the deferred-work table drops the BeginFrame line (T-100c still
  owns the real host bundle).

- 93c6393: Host contract carries `RIRDocument` + `richPlaceholderHostHtml` (T-100c).

  Foundation for T-100d (runtime-bundle host) — with this change,
  host builders get full access to the element tree, not just
  dispatch metadata.

  **Contract change**:

  - `CdpSession.mount(plan, config, document)` — new required
    `document: RIRDocument` parameter. Single in-repo caller
    (`LiveTierAdapter.mount`) already has the document and threads
    it through; external implementers of `CdpSession` must update.
    Since `@stageflip/renderer-cdp` is `private: true` with zero
    external consumers, the break is harmless.
  - `HostHtmlBuilder` context adds `document: RIRDocument`. Existing
    builders that only need viewport + fps + duration continue to
    work (they just ignore the new field) — `canvasPlaceholderHostHtml`
    still shipped unchanged in behaviour.

  **New export — `richPlaceholderHostHtml`**:

  Renders non-clip RIR elements (text, shape, video/image
  placeholders) as absolutely-positioned inline DOM nodes with
  frame-reactive visibility:

  - Each element becomes a `<div class="__sf_el">` with CSS from its
    `transform` (position, size, opacity, rotation).
  - Shape elements get their `content.fill` as the background;
    `shape: 'ellipse'` gets `border-radius: 50%`.
  - Text elements render `content.text` with the font spec.
  - Video / image / clip elements render as labelled
    hatched-background placeholders.
  - `window.__sf.setFrame(n)` toggles each element's `display`
    based on whether `n ∈ [startFrame, endFrame)`. Animations are
    NOT applied — full animation resolution lands with T-100d.

  **Determinism posture**: safe under BeginFrame — the host page
  does zero network, zero timers, zero random numbers. Every
  frame's DOM state is a pure function of `(document, frame)`.

  **Script-injection defence**: the document JSON is embedded in a
  `<script type="application/json">` tag; the serialiser replaces
  `</script` with `<\/script` (a valid JSON escape for `/`) and
  escapes U+2028 / U+2029 line separators so text elements
  containing `</script` substrings or exotic whitespace cannot
  break out.

  **Plan doc change**: `docs/implementation-plan.md` updated —
  T-100c narrows to contract + smart placeholder (M), T-100d added
  for the runtime-bundle host (L). Plan version bumped v1.2 → v1.3.

  **Tests**: 224 → 229 in renderer-cdp. Five new cases cover
  document threading from the session through to the builder, and
  richPlaceholderHostHtml's dimension embedding, JSON embedding,
  `</script` escape, U+2028/U+2029 escape, and `window.__sf` boot.
  All 19 existing mount-callers updated to the 3-arg form (via a
  shared `mkDoc()` helper). E2E reference-render suite still green
  on macOS via the unchanged `canvasPlaceholderHostHtml`.

  **Skill**: `skills/stageflip/reference/export-formats/SKILL.md`
  updated — the pluggable-host section now documents all three
  builders (canvas, rich placeholder, runtime bundle); the module-
  surface table adds the T-100c exports; the deferred-work table
  points the runtime-bundle row at T-100d.

### Patch Changes

- fc85c58: T-119: `reference-render.e2e.test.ts` honors `STAGEFLIP_E2E_ARTIFACT_DIR`
  to route the 3 rendered MP4s to a stable path and skip the tmpdir
  cleanup. Lets the new `render-e2e` CI job upload the outputs as a
  build artifact. Default behavior (no env var) unchanged.
- Updated dependencies [0bcc2a8]
- Updated dependencies [12a8382]
- Updated dependencies [1e0c779]
- Updated dependencies [019f79c]
- Updated dependencies [1257b50]
- Updated dependencies [c3d84bd]
- Updated dependencies [f57dbd0]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [8a1d95e]
- Updated dependencies [5edf5a1]
- Updated dependencies [5f69c4e]
- Updated dependencies [fc9526b]
- Updated dependencies [75e3d7e]
- Updated dependencies [3096a1c]
- Updated dependencies [36d0c5d]
  - @stageflip/cdp-host-bundle@0.1.0
  - @stageflip/fonts@0.1.0
  - @stageflip/runtimes-contract@0.1.0
  - @stageflip/rir@0.1.0
