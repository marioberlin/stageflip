---
title: Reference — Export Formats
id: skills/stageflip/reference/export-formats
tier: reference
status: substantive
last_updated: 2026-04-21
owner_task: T-091
related:
  - skills/stageflip/concepts/determinism/SKILL.md
  - skills/stageflip/concepts/rir/SKILL.md
  - skills/stageflip/concepts/loss-flags/SKILL.md
  - skills/stageflip/concepts/fonts/SKILL.md
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/blender/SKILL.md
---

# Reference — Export Formats

How an `RIRDocument` becomes a video file. Surface lives in
`@stageflip/renderer-cdp`. Everything in this skill is either shipped
behaviour or a declared interface with a test — no speculation. If a
claim here conflicts with the package, the package is the source of
truth and this file is wrong.

## Pipeline at a glance

```
RIRDocument
   │
   ├─ preflight()              pure; fonts agg + tier split + asset refs
   │    blockers? ─── yes ──▶ PreflightBlockedError
   │
   ├─ resolveAssets()          async; runs if assetResolver supplied
   │    rewrites remote URLs → file:// ; surfaces loss-flags
   │
   ├─ LiveTierAdapter.mount()  opens CdpSession; builds dispatch plan
   │
   ├─ for frame in [start, end):
   │     session.seek(frame)
   │     session.capture()     ── PNG bytes ──▶ sink.onFrame(frame, buf)
   │
   └─ adapter.close() + sink.close()
                                 │
                                 └─ FFmpegEncoder ▶ <output>.(mp4|webm|mov)
                                                     │
                                                     └─ ffprobe() verify
```

Two-pass bake (offline-prerender → cached artifact → live playback) is
scaffolded via `BakeJob` / `BakeOrchestrator` / `BakeCache` (T-089
[rev]) but NO concrete bake runtime ships in Phase 4 — preflight still
blocks exports that contain bake-tier work. Blender runtime and heavy
three scenes pick up this path in Phase 12.

## Encoder profiles

Four profiles, one per codec. All constants; no per-call synthesis.
Lookup by id via `getEncoderProfile('h264')` or import the const:
`PROFILE_H264`, `PROFILE_H265`, `PROFILE_VP9`, `PROFILE_PRORES_4444`.

| id              | Container | Pixel fmt       | CRF range       | Alpha | Typical use |
|-----------------|-----------|-----------------|-----------------|-------|-------------|
| `h264`          | `.mp4`    | `yuv420p`       | 0..51, default 23 | no   | The default. Broadest compatibility (web, social, Slack). |
| `h265`          | `.mp4`    | `yuv420p`       | 0..51, default 28 | no   | ~50% smaller than H.264 at similar quality; Safari/QuickTime via `-tag:v hvc1`. |
| `vp9`           | `.webm`   | `yuv420p`       | 0..63, default 31 | no   | WebM targets; `-b:v 0` unlocks constant-quality (without it, CRF is a bitrate ceiling). |
| `prores-4444`   | `.mov`    | `yuva444p10le`  | not CRF-based   | **yes** | Alpha-preserving post-production output; 10-bit. Ignores `crf`; throws loudly if supplied. |

Invariants the encoder enforces up-front (before any ffmpeg spawn):

- Width + height are positive even integers. `yuv420p` requires even
  sides; this enforces universally across profiles.
- FPS is a positive finite number.
- CRF, when supplied, is inside the profile's range. Out-of-range is
  a `RangeError`, not a clamp.

### Input side

ffmpeg reads frames as a concatenated PNG stream on stdin:

```
-f image2pipe -c:v png -r <fps> -i -
```

One complete PNG per `sink.onFrame(frame, buffer)` call. The `-r` flag
appears on **both** the input and output sides so container metadata
stays synced to capture cadence.

### System ffmpeg — not WASM

FFmpeg runs via `child_process.spawn` through the T-085 `ChildRunner`
seam. WASM-ffmpeg is deliberately not used: 2–5× slower, 30 MB bundle.
See `docs/dependencies.md` §6 for the forbid-list entry.

Validate the install via `doctor()`:

```ts
import { doctor } from '@stageflip/renderer-cdp';
const report = await doctor(); // { ok, version, codecs: { libx264, libx265, libvpx, prores }, issues }
```

The report's `ok` is `false` if any required `--enable-<lib>` is
missing or the binary can't spawn. `prores_ks` is bundled with ffmpeg,
so it counts as present whenever the version output parses.

## CdpSession abstraction

`CdpSession` is the seam between the frame-producing side (a headless
browser) and the dispatcher. One interface, swappable implementations:

```ts
interface CdpSession {
  mount(plan, config): Promise<SessionHandle>;
  seek(handle, frame): Promise<void>;
  capture(handle): Promise<Uint8Array>; // PNG bytes
  close(handle): Promise<void>;
}
```

Concrete implementation in Phase 4: **`PuppeteerCdpSession`**
(T-090). Uses `puppeteer-core` + a system Chrome/Chromium binary;
`page.screenshot({ type: 'png' })` per frame. Deterministic seek is
the host page's responsibility — it must expose
`window.__sf.setFrame(n)` and `window.__sf.ready = true`.

- BeginFrame-based capture stays vendored-engine territory (T-080
  payload) and is a T-100 parity-harness deliverable; screenshot
  capture is sufficient for Phase 4's "valid MP4" exit criterion.
- Host HTML is **pluggable** via `HostHtmlBuilder`. The default
  `canvasPlaceholderHostHtml` is a minimal canvas page — enough to
  prove the pipeline end-to-end without a React bundle. Real
  runtime-mounting host HTML lands with the parity harness.

## Asset preflight (T-084a)

Before the capture loop, every URL-bearing content ref is resolved
through a pluggable `AssetResolver`:

```ts
AssetResolver.resolve(ref) →
  { status: 'ok', localUrl: 'file:///...' } |
  { status: 'loss-flag', reason: '...' }
```

Successful resolutions produce a rewritten `RIRDocument` where
`srcUrl` / `src` fields point at `file://`. Loss-flags surface in
`ExportResult.lossFlags` — the document keeps the remote URL,
downstream decides whether to rasterize (future), fail, or proceed
degraded. See `concepts/loss-flags/SKILL.md`.

Covers `image`, `video`, `audio`, `embed` content types. Font
requirements flow through `@stageflip/fonts.aggregateFontRequirements`
separately — see `concepts/fonts/SKILL.md`.

## Video frame pre-extraction (T-086)

Source videos are NOT decoded live during CDP capture (non-
deterministic under BeginFrame). Instead, the export path pre-
extracts each source into per-frame PNGs at the composition fps via
`extractVideoFrames()`. Output pattern is `frame_%05d.png` (or
`.jpg`) — byte-compatible with the vendored engine's extractor at
the same inputs. Details in `video-frame-extractor.ts` file header.

## Audio mixing (T-087)

N `AudioTrack`s (RIR-shape: source + comp-time window + trim + loop
+ gain + pan + fades) are mixed into the final container via one
ffmpeg `-filter_complex` graph, then muxed with the video at
`-c:v copy -c:a aac`. Zero tracks → pure stream-copy; no re-encode.
Pan is a stereo-matrix approximation (RIR's pan field is stereo-
only today). Full filter chain documented in `audio-mixer.ts`.

## Artifact storage (T-088 [rev])

Completed exports live behind the `ArtifactStore` interface:

```ts
interface ArtifactStore {
  put(key, sourcePath): Promise<StoredArtifact>;
  has(key): Promise<boolean>;
  get(key): Promise<StoredArtifact | null>;
  list(): Promise<readonly string[]>;
  delete(key): Promise<void>;
}
```

Ships two implementations:

- `InMemoryArtifactStore` — zero-IO, test-friendly.
- `LocalFsArtifactStore({ rootDir })` — one file per key; sub-dirs
  created on demand; sanitiser + defence-in-depth `resolve` block
  writes outside `rootDir`.

Firebase Storage adapter is deferred — same pattern as Phase 1's
Firebase storage deferrals (T-035..T-039); plan row T-088 [rev].

Keys are path-safe: `[A-Za-z0-9._-]` segments joined by single-level
`/`. Absolute paths, `..`, double slashes, non-ASCII are rejected
at the sanitiser.

## Fixture conventions

Three reference documents ship with the package:
`solidBackgroundFixture`, `multiElementFixture`, `videoClipFixture`.
All are clip-free by design — the e2e suite must not depend on
runtime registration, and the canvas placeholder host HTML ignores
element content anyway. Real-runtime fixtures arrive with the T-100
parity harness.

- Every fixture carries `meta.digest` — the deterministic compiler
  identity. Distinct across the three.
- Dimensions are even integers (encoder requirement).
- Runtime pickers (future parity fixtures) will use the same shape
  with `content.type: 'clip'` referencing a concrete runtime kind.

## Determinism posture

Everything in the export pipeline is deterministic by construction:

- No wall-clock, no `Math.random`, no `setTimeout` / `setInterval`
  inside the renderer package's hot paths (same discipline as
  `concepts/determinism/SKILL.md`, though the scanned globs don't
  cover `renderer-cdp` — enforced structurally by the APIs here).
- Frame quantization via `quantizeTimeToFrame(time, fps)` — byte-
  identical algorithm to the upstream hyperframes helper we
  substituted in T-083 B3(a).
- Content-hash cache keys drive bake cache and asset cache (callers
  canonicalise before hashing).

BeginFrame vs screenshot capture is the one deterministic-fidelity
gap today: screenshot capture inherits Chrome's compositor cadence
and is NOT pixel-perfect across runs. T-100 parity harness
introduces the BeginFrame path via the vendored engine.

## Module surface (what to import)

From `@stageflip/renderer-cdp`:

| Import | Purpose | Task |
|---|---|---|
| `exportDocument(doc, { session, sink, assetResolver?, frameRange? })` | Top-level dispatcher | T-084, T-084a |
| `preflight(doc)` | Pure preflight report | T-084 |
| `LiveTierAdapter` + `CdpSession` | Session seam | T-083 |
| `PuppeteerCdpSession`, `createPuppeteerBrowserFactory` | Concrete session | T-090 |
| `dispatchClips(doc)` | RIR → DispatchPlan | T-083 |
| `collectAssetRefs`, `rewriteDocumentAssets`, `resolveAssets`, `InMemoryAssetResolver` | Asset preflight | T-084a |
| `InMemoryFrameSink`, `FrameSink` | Frame output seam | T-084 |
| `FFmpegEncoder`, `buildFfmpegArgs`, `ENCODER_PROFILES` | Encoder | T-085 |
| `doctor()` | ffmpeg install validation | T-085 |
| `extractVideoFrames`, `buildExtractFramesArgs` | Video frame pre-extraction | T-086 |
| `mixAudio`, `buildMixAudioArgs`, `AudioTrack` | Audio mixer + filter graph | T-087 |
| `ArtifactStore`, `InMemoryArtifactStore`, `LocalFsArtifactStore` | Post-export storage | T-088 [rev] |
| `BakeOrchestrator`, `BakeJob`, `BakeCache`, `InMemoryBakeOrchestrator` | Bake scaffolding (interfaces + ref impl) | T-089 [rev] |
| `ffprobe()`, `FfprobeReport` | MP4 verification | T-090 |
| `REFERENCE_FIXTURES`, `renderReferenceFixture`, `canRunReferenceRenders` | Reference render harness | T-090 |

## Deferred work carried into later phases

| Item | Owner task / phase |
|---|---|
| BeginFrame-based deterministic capture (via vendored engine) | T-100 / Phase 5 |
| Real React + runtime-mounting host HTML | T-100 / Phase 5 |
| Concrete bake runtime (Blender, heavy three) | Phase 12 |
| Firebase Storage `ArtifactStore` adapter | Phase 10+ (mirrors Phase 1 Firebase deferrals) |
| CDP font pre-embedding (`@fontsource` base64 + `document.fonts.check`) | Next touches to T-084a |
| `--font-render-hinting=none` + fixed DPR for byte-exact font output | Phase 5 |
| Puppeteer-screenshot rasterization for unsupported embeds (YouTube, arbitrary iframes) | Future touches to T-084a |
| `stageflip doctor` CLI subcommand | CLI task (future) |
| Surround / channel-aware audio pan | Future audio-mixer iteration |
| Per-track bit-depth control | Future audio-mixer iteration |
