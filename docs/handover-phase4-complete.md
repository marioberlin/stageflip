# Handover — Phase 4 complete (2026-04-21)

Supersedes `docs/handover-phase3-complete.md` as the live starter doc.
If you are the next agent: start here, then `CLAUDE.md`, then
`docs/implementation-plan.md` for Phase 5.

Current commit on `main`: `ac1b609` (Merge T-091). Working tree
clean. Every gate green.

---

## 1. Where we are

- **Phase 0 (Bootstrap)** — ratified 2026-04-20. T-001..T-017 done.
- **Phase 1 (Schema + RIR + Determinism)** — ratified 2026-04-20.
  T-020..T-034 done; T-035..T-039 (Firebase) deferred.
- **Phase 2 (Frame Runtime)** — ratified-ready (per
  `handover-phase2-complete.md`). T-040..T-055 done (16/16).
- **Phase 3 (Runtime Contract + Concrete Runtimes)** — ✅ **Ratified
  2026-04-21** in `docs/implementation-plan.md`. 11/11 done.
- **Phase 4 (Vendored CDP Engine + Export Dispatcher)** —
  **implementation complete; awaiting human ratification** per
  CLAUDE.md §2. 13/13 tasks merged.

### Phase 4 tasks as shipped

| ID | Task | Commit on `main` |
|---|---|---|
| T-080 | Vendor `@hyperframes/engine` at pinned commit | `be811df` |
| T-081 | `vendor/NOTICE` (Apache-2.0 attribution) | `a1525e6` |
| T-082 | `vendor/README.md` (what, why, upgrade protocol) | `c95e63d` |
| T-083 [rev] | Live-tier CDP adapter + dispatcher + core helpers | `bd000aa` |
| T-084 | Export dispatcher + preflight + frame sink | `c9b95e5` |
| T-084a | Asset preflight (collect + resolve + rewrite) | `7008a3f` |
| T-085 | FFmpeg integration — encoder + profiles + doctor | `69a9b10` |
| T-086 | Video-frame pre-extraction | `2180a55` |
| T-087 | Audio mixer — filter graph + mux | `9ac8441` |
| T-088 [rev] | Artifact store (interface + in-memory + local-FS) | `82c0874` |
| T-089 [rev] | Bake-runtime scaffolding + two-pass orchestration | `2da5ef6` |
| T-090 | Reference render tests — 3 fixtures → MP4 → ffprobe | `eb75b0a` |
| T-091 | `reference/export-formats` SKILL.md + gitignore fix | `ac1b609` |

### Exit criteria (from plan)

> `stageflip render` produces valid MP4 from a fixture document; no
> Remotion imports; asset preflight resolves all remote URLs to
> `file://` before capture.

- **3 reference fixtures → real MP4 → ffprobe-verified** ✅
  `reference-render.e2e.test.ts` guarded by
  `canRunReferenceRenders()` — on a host with Chrome + ffmpeg +
  ffprobe, every fixture ends up as a 320×240 h264/yuv420p MP4 with
  the expected duration (±1 frame). Hot path: real puppeteer-core →
  `page.screenshot` → `FFmpegEncoder` stdin → ffmpeg → ffprobe.
- **Zero Remotion imports** ✅ `pnpm check-remotion-imports` scanned
  237 files at Phase 4 exit; zero matches.
- **Asset preflight rewrites remote URLs to `file://`** ✅ T-084a
  shipped `collectAssetRefs` + `resolveAssets` + `rewriteDocumentAssets`;
  `exportDocument`'s optional `assetResolver` threads the rewritten
  document to `adapter.mount`. Refs the resolver refuses land in
  `ExportResult.lossFlags`.

### Escalation closed in-phase

`docs/escalation-T-083.md` — raised at the start of T-083 (CLAUDE.md
§6 trigger: "architectural question not covered by existing skills").
Orchestrator accepted all three proposals:

- **B1** — drop two-pass bake from T-083, fold into T-089.
- **B2** — "one mapping per runtime kind" → "single live-tier adapter
  backed by the shared registry".
- **B3 option (a)** — reimplement the two `@hyperframes/core` helpers
  in `renderer-cdp/src/` and patch three vendored engine files with a
  `// Modified by StageFlip, 2026-04-21` header. First real exercise
  of the T-081 modification protocol.

---

## 2. Test + dependency surface

### Per-package test counts on `main` (end of Phase 4)

| Package | Cases | Change |
|---|---|---|
| `@stageflip/schema` | 92 | unchanged |
| `@stageflip/rir` | 36 | unchanged |
| `@stageflip/storage` | 23 | unchanged |
| `@stageflip/frame-runtime` | 328 | unchanged |
| `@stageflip/determinism` | 14 | unchanged |
| `@stageflip/skills-core` | 14 | unchanged |
| `@stageflip/testing` | 10 | unchanged |
| `@stageflip/runtimes-contract` | 14 | unchanged |
| `@stageflip/runtimes-frame-runtime-bridge` | 14 | unchanged |
| `@stageflip/runtimes-css` | 13 | unchanged |
| `@stageflip/runtimes-gsap` | 12 | unchanged |
| `@stageflip/runtimes-lottie` | 13 | unchanged |
| `@stageflip/runtimes-shader` | 22 | unchanged |
| `@stageflip/runtimes-three` | 15 | unchanged |
| `@stageflip/fonts` | 23 | unchanged |
| **`@stageflip/renderer-cdp`** | **203** | **+203** (net from Phase 3 stub) |
| **Total** | **846** | **+203 vs Phase 3 complete** |

Breakdown of the 203 in `@stageflip/renderer-cdp`:

| File | Cases | Task |
|---|---|---|
| `vendor-integrity.test.ts` | 12 | T-080, T-081, T-082 |
| `vendor-core-helpers.test.ts` | 10 | T-083 |
| `dispatch.test.ts` | 8 | T-083 |
| `adapter.test.ts` | 6 | T-083 |
| `frame-sink.test.ts` | 4 | T-084 |
| `preflight.test.ts` | 10 | T-084 (+2 for reviewer coverage) |
| `export-dispatcher.test.ts` | 11 | T-084 (+2 asset-preflight integration from T-084a) |
| `asset-refs.test.ts` | 10 | T-084a |
| `asset-resolver.test.ts` | 9 | T-084a (+1 reviewer regression) |
| `ffmpeg-profiles.test.ts` | 7 | T-085 |
| `ffmpeg-encoder.test.ts` | 18 | T-085 (+1 concurrent-close reviewer regression) |
| `ffmpeg-doctor.test.ts` | 7 | T-085 |
| `video-frame-extractor.test.ts` | 11 | T-086 |
| `audio-mixer.test.ts` | 17 | T-087 |
| `artifact-store.test.ts` | 21 | T-088 (+2 reviewer regressions) |
| `bake.test.ts` | 13 | T-089 |
| `puppeteer-session.test.ts` | 11 | T-090 (+2 concurrent / transient-reject from reviewer) |
| `ffprobe.test.ts` | 9 | T-090 |
| `reference-render.test.ts` | 6 | T-090 |
| `reference-render.e2e.test.ts` | 3 | T-090 (guarded) |

### Dependencies added in Phase 4

All Apache-2.0 or MIT. `pnpm check-licenses` went 473 → 479 deps
scanned at Phase 4 exit.

| Package | Version | Install site | License |
|---|---|---|---|
| `puppeteer-core` | **23.11.1** | `@stageflip/renderer-cdp` dependencies | Apache-2.0 |

`puppeteer-core` was pre-pinned in `docs/dependencies.md` §3 for
this phase. T-090 Audit 7 addendum records the install site and
notes the lazy-import strategy: `createPuppeteerBrowserFactory`
dynamic-imports `puppeteer-core` so consumers that never instantiate
a `PuppeteerCdpSession` don't pay the module-init cost.

**Not a regular npm dep**: `@hyperframes/engine` is vendored into
`packages/renderer-cdp/vendor/engine/` at commit
`d1f992570a2a2d7cb4fa0b4a7e31687a0791803d` (Apache-2.0). See
`docs/dependencies.md` §5 for the pin table + `THIRD_PARTY.md` §2
for the modification protocol. Current modification: three engine
files (`src/index.ts`, `src/services/frameCapture.ts`,
`src/services/screenshotService.ts`) re-routed from
`@hyperframes/core` to
`packages/renderer-cdp/src/vendor-core-helpers.ts`. Logged in
`vendor/NOTICE` "Modifications by StageFlip".

### CI gate surface (9 gates, all green)

```
pnpm typecheck | lint | test | build
pnpm check-licenses             — 479 deps scanned, PASS
pnpm check-remotion-imports     — 237 files scanned, PASS
pnpm check-skill-drift          — PASS (link-integrity + tier-coverage)
pnpm skills-sync:check          — PASS (reference/schema in sync)
pnpm check-determinism          — 21 files scanned, PASS (scope unchanged;
                                  renderer-cdp is outside the scanned globs
                                  by design — see §4)
pnpm size-limit                 — PASS (frame-runtime 19.52 kB / 25 kB)
pnpm e2e                         — optional
```

Plus a new **e2e reference-render suite** inside renderer-cdp that
runs only when `canRunReferenceRenders()` detects Chrome + ffmpeg +
ffprobe on PATH or via env vars. On a bare CI host the suite
cleanly skips with the reason surfaced in vitest output.

### Changesets recorded in Phase 4

All minor bumps on `@stageflip/renderer-cdp` (still `private: true`
so no publish yet):

- `renderer-cdp-t080.md`
- `renderer-cdp-t081.md`
- `renderer-cdp-t082.md`
- `renderer-cdp-t083.md`
- `renderer-cdp-t084.md`
- `renderer-cdp-t084a.md`
- `renderer-cdp-t085.md`
- `renderer-cdp-t086.md`
- `renderer-cdp-t087.md`
- `renderer-cdp-t088.md`
- `renderer-cdp-t089.md`
- `renderer-cdp-t090.md`
- `renderer-cdp-t091.md` is NOT written — T-091 is docs-only, no
  publishable package surface changed.

---

## 3. Architectural decisions (Phase 4)

Layered on top of Phase 2 + 3 handover decisions.

### 4.1 Vendored code integration via Modified-by-StageFlip pattern

`@hyperframes/engine` sits in `packages/renderer-cdp/vendor/engine/`
preserved verbatim. The ONLY modifications are three `// Modified
by StageFlip, YYYY-MM-DD — <reason>` header-commented edits that
re-route the engine's `@hyperframes/core` imports to our reimpl.
Every modification is logged in `vendor/NOTICE`. Future re-pins
follow the upgrade protocol in `vendor/README.md` (ADR-gated;
4-location checklist).

The modification-log protocol was established by T-081/T-082 as
documentation and first exercised for real by T-083's reimpl work.

### 4.2 ChildRunner seam as a universal pattern

Every module that spawns a child process uses the same
`ChildRunner` interface introduced in T-085:

```
ChildRunner.spawn(command, args) → SpawnedProcess
SpawnedProcess.stdin.write / .end
SpawnedProcess.wait() → { code: number | null, stderr: string }
SpawnedProcess.kill()
```

Callers:

- `ffmpeg-encoder.ts` — pipe PNGs to ffmpeg stdin.
- `ffmpeg-doctor.ts` — `ffmpeg -version` one-shot.
- `video-frame-extractor.ts` — `ffmpeg -i ... -vf fps=N ...` one-shot.
- `audio-mixer.ts` — `ffmpeg -filter_complex ... mux`.
- `ffprobe.ts` — `ffprobe -print_format json`.

Tests inject `FakeChildRunner`s that record argv + resolve with a
synthetic `{ code, stderr }`. The production `createNodeChildRunner()`
uses `node:child_process.spawn` with `stdio: ['pipe', 'pipe', 'pipe']`
and captures both stdout and stderr into the single `stderr` field
(historical name; see §4.5 below).

### 4.3 Preflight-then-dispatch architecture

Export runs are two stages:

1. **Preflight** (sync, pure): `preflight(document)` returns
   `PreflightReport` with blockers, font agg, asset refs, live/bake
   tier split. Zero IO.
2. **Dispatch** (async): `exportDocument` runs preflight, fails loud
   on blockers via `PreflightBlockedError`, then opens a session,
   mounts, loops frames, closes.

The split keeps the analysis path testable without any async setup
and makes fail-loud refusal a structural property, not a late
discovery.

### 4.4 Single code path for all 6 live runtimes

The live-tier adapter (T-083) has no per-kind branching. One
`LiveTierAdapter.mount(document)` call produces one dispatch plan
via `findClip(kind)` and one session mount. The export dispatcher
loops frames; per-kind concerns (WebGL context, lottie loadAnimation,
GSAP timeline build) all live INSIDE the runtime packages and flow
through the shared CdpSession contract.

### 4.5 CdpSession seam — interface first, concrete second

T-083 defined `CdpSession` as an interface. T-090 shipped the first
concrete implementation (`PuppeteerCdpSession`, backed by
`puppeteer-core`). The interface is minimal on purpose:

```
mount(plan, config): Promise<SessionHandle>
seek(handle, frame): Promise<void>
capture(handle): Promise<Uint8Array>  // PNG bytes
close(handle): Promise<void>
```

Alternative CdpSession impls (vendored-engine BeginFrame, remote
browser pool) can slot in without touching anything above. Note
`SpawnedProcess.wait()` returns a `stderr` field whose name is
historical — it's actually stdout+stderr concatenated (T-085
reviewer fix; commented in `child-runner.ts` and `ffprobe.ts`).

### 4.6 Loss-flag first-class error discipline

Per-ref failures that don't stop the export surface as loss-flags,
not exceptions:

- `ExportResult.lossFlags` holds refs the asset resolver refused.
- Downstream can decide: rasterize-via-screenshot, fail, or proceed
  degraded.

Structural blockers (unresolved clips, bake-tier work without a
runtime, empty fps/duration) are different and fail loud via
`PreflightBlockedError` BEFORE the session opens.

### 4.7 Sink ownership with exact-once close

`FrameSink.close()` is idempotent per the interface contract. The
export dispatcher owns close lifecycle from the moment it's called
— every exit path reaches exactly one `sink.close()`:

- Preflight blocker → close once, then throw `PreflightBlockedError`.
- Invalid frame range → throws inside the try; finally closes.
- Capture-loop failure → try/finally always closes.
- Success → closes in finally.

Double-close was a live bug in T-084 that T-090 fixed: a secondary
`sink.close()` failure in the preflight-blocked path used to mask
the actual `PreflightBlockedError`. Now swallowed with a
`.catch(() => {})` so the real diagnostic reaches the caller.

### 4.8 Factory-Promise caching for async concurrency

`PuppeteerCdpSession.ensureBrowser` caches the in-flight browser
promise (not the resolved browser). Two concurrent `mount()` calls
both await the same promise and share one browser. On factory
rejection the cache clears so a subsequent mount retries. This
pattern should propagate to any future async resource where two
callers could race the initial launch.

### 4.9 Fake-runner seam discipline for every spawn

No test spawns a real process. Every spawn-using module takes an
optional `runner?: ChildRunner` option; tests pass a fake; production
defaults to `createNodeChildRunner()`. Same discipline as Phase 3's
`glContextFactory` / `lottieFactory` seams. The e2e suite
(`reference-render.e2e.test.ts`) is the deliberate exception,
guarded by `canRunReferenceRenders()`.

### 4.10 Two-pass bake as interfaces-only

T-089 [rev] shipped `BakeJob` / `BakeArtifact` / `BakeRuntime` /
`BakeCache` / `BakeOrchestrator` interfaces + `InMemoryBakeCache`
+ `InMemoryBakeOrchestrator` reference impls, but NO concrete
bake runtime. T-084's preflight still refuses bake-tier documents
with a `bake-not-implemented` blocker. Phase 12 (or a future
orchestrator-led task) fills the concrete-runtime gap.

### 4.11 Capability detection for optional infra

`canRunReferenceRenders()` auto-detects Chrome
(`PUPPETEER_EXECUTABLE_PATH` / `CHROME_BIN` / standard paths) +
ffmpeg + ffprobe (PATH / `FFMPEG_PATH` / `FFPROBE_PATH`) so the e2e
suite cleanly skips on hosts without them. Pattern for any future
integration suite that depends on external tooling.

### 4.12 "Decoded pixels identical, argv shape deliberately different"

Vendor-adaptation honesty (T-086 reviewer finding): when reusing a
vendored engine's flag semantics but adding house-style flags like
`-hide_banner -loglevel error`, the adaptation preserves *behaviour*
(decoded pixels byte-identical) without preserving *argv shape*.
Skill + changeset prose calls out the specific deviations so
parity-test consumers that do argv-equality checks know what to
expect.

### 4.13 `check-determinism` scope is deliberately narrow

The determinism scanner covers
`packages/frame-runtime/**`, `packages/runtimes/**/src/clips/**`,
and `packages/renderer-core/src/clips/**` — NOT `renderer-cdp`.
The renderer package spawns processes and does IO by design; a
static wall-clock-ban doesn't apply. Determinism posture is instead
enforced structurally by:

- Frame quantization via `quantizeTimeToFrame(time, fps)`.
- Content-hash cache keys (caller-generated).
- Pure preflight with no IO.
- Seek-only CdpSession with no timer-driven animation.

BeginFrame-based pixel determinism is T-100's deliverable, not T-090's.

---

## 4. Conventions established / reinforced

- **Every spawn-based module ships a pure `buildXArgs(opts)` argv
  builder + an async `spawnOrchestrator(opts)` that composes
  `buildArgs` + `ChildRunner`.** Tests exercise argv correctness
  without touching the process layer.
- **Every orchestrator close raises a named error with `code | null`
  + `stderr`.** `FFmpegEncoderError`, `ExtractVideoFramesError`,
  `MixAudioError`, `FfprobeError` all follow the same shape.
- **Idempotent close via pre-await flag check.** The check happens
  BEFORE the first `await` so two concurrent callers both see the
  same in-flight close promise (T-085 reviewer fix pattern).
- **Reviewer subagent per task, confidence-ranked findings.** Every
  Phase 4 PR went through `feature-dev:code-reviewer` before merge.
  The reviewer caught load-bearing bugs on every L-task: vendor-
  integrity hash-pin, T-084 sink leak, T-085 stdout-discard,
  T-090 double-close + browser-race, T-088 key round-trip, etc.
- **Bidirectional skill cross-references.** Every spoke that
  references export-formats got a back-link, same pattern as
  Phase 3 closeout.
- **"Modified by StageFlip, YYYY-MM-DD — <reason>"** is now a
  real-in-use protocol, not just documentation.
- **Deferrals tracked in plan row `[rev]` markers + changeset prose.**
  T-088 [rev], T-089 [rev], T-083 [rev] all carry explicit deferral
  notes in the plan itself.

---

## 5. CI gates + dev-harness commands

```sh
# All 9 gates (from repo root)
pnpm typecheck
pnpm lint
pnpm test
pnpm check-licenses
pnpm check-remotion-imports
pnpm check-skill-drift
pnpm skills-sync:check
pnpm check-determinism
pnpm size-limit
pnpm e2e                              # optional browser install required

# Phase 4 reference render suite (auto-skips if Chrome/ffmpeg absent)
pnpm --filter @stageflip/renderer-cdp test

# ffmpeg install validator
node -e "import('@stageflip/renderer-cdp').then(m => m.doctor().then(r => console.log(JSON.stringify(r, null, 2))))"
```

E2E suite expectations on a capable host:

- Chrome at a standard path OR `PUPPETEER_EXECUTABLE_PATH` /
  `CHROME_BIN` set.
- `ffmpeg` + `ffprobe` on PATH OR `FFMPEG_PATH` / `FFPROBE_PATH`
  env vars.
- Render budget per fixture: 60s (vitest timeout). Actual ~1s/fixture
  on Apple Silicon.

Dev harness (still 5 Phase 2 demos; no Phase 3/4 runtime demos):

```sh
pnpm --filter @stageflip/app-dev-harness dev
```

---

## 6. Flagged risks + follow-ups (by urgency)

### Active — may need attention at the next relevant task

1. **BeginFrame-based capture still unused.** T-090 shipped screenshot-
   based capture via `page.screenshot()`. Pixel determinism across
   runs is NOT guaranteed — Chrome's compositor cadence leaks
   through. T-100 parity harness owns the BeginFrame integration
   that uses the vendored engine's `frameCapture.ts` properly.
2. **Canvas placeholder host HTML is a placeholder.** T-090's
   `canvasPlaceholderHostHtml` paints a deterministic frame-number
   gradient; it does NOT mount the 6 real live runtimes. A real
   host bundle needs Vite/tsup to produce an IIFE-bundled JS that
   registers the runtime packages + mounts the composition. Phase 5
   territory (alongside T-100).
3. **No CI infra for Chrome + ffmpeg yet.** The e2e suite auto-skips,
   so `pnpm test` is green on bare CI — but that hides whether the
   real pipeline regresses between merges. Phase 5 or infra task
   should wire a dedicated e2e job that installs both.
4. **Dev harness still has no Phase 3/4 demos.** Same flag as the
   Phase 3 handover carried in. Natural landing spot: alongside the
   real host bundle when T-100 lands.
5. **60fps scrub exit criterion (carried from Phase 2)** still
   unmeasured.
6. **`readFrameContextValue` identity function (carried from Phase 2)**
   still public API. T-083's CDP bridge was its natural retirement
   point but T-083 [rev] didn't touch it. Flag for the real-runtime
   host bundle task.
7. **GSAP publish-gate legal review (carried from Phase 3).**
   Blocks `private: false` on `@stageflip/runtimes-gsap` at Phase 10.
8. **Three newly-tracked reference skill placeholders** (`cli/`,
   `validation-rules/`, `schema` auto-gen) discovered via T-091's
   gitignore fix. `cli/` waits for the CLI task; `validation-rules/`
   for T-107; schema is auto-regenerated by `skills-sync`.

### Deferred — waiting on a later phase

9. **CDP font pre-embedding** (`@fontsource` base64 +
   `document.fonts.check` verification). Natural home: next touches
   to T-084a or a new font-specific task in Phase 5.
10. **Chromium `--font-render-hinting=none`** — needs the real
    launch-args wiring in PuppeteerCdpSession. Phase 5.
11. **Per-package size-limit budgets** beyond frame-runtime.
    Renderer-cdp is currently unconstrained.
12. **Parity harness PNG generation** (T-100). Scores the T-067
    fixtures + 3 Phase 4 fixtures against goldens.
13. **Firebase storage backend** (T-035..T-039 from Phase 1 +
    Firebase `ArtifactStore` from Phase 4). Non-blocking.
14. **Concrete bake runtime** (Blender, heavy three). Phase 12.
15. **`stageflip doctor` CLI subcommand.** Currently consumers call
    `doctor()` directly. CLI task (future).
16. **Puppeteer-screenshot rasterization for unsupported embeds**
    (YouTube, arbitrary iframes). Future touches to T-084a.
17. **Surround / channel-aware audio pan, per-track bit-depth.**
    Future audio-mixer iterations.

### Resolved this phase

- T-083 escalation (B1 + B2 + B3a) — bake moved to T-089, adapter
  scope narrowed, `@hyperframes/core` helpers reimplemented.
- T-084 sink-ownership contract — `finally`-block close + preflight-
  blocked-path close, with reviewer fix to prevent masking.
- T-085 stdout-discard bug — reviewer caught that `ffmpeg -version`
  writes to stdout on modern builds; child-runner now captures both
  streams.
- T-085 concurrent-close race — `closeResult` assigned before first
  `await` so concurrent callers share the in-flight promise.
- T-088 Firebase-adapter deferral — pattern consistent with
  Phase 1's T-035..T-039 Firebase deferrals.
- T-089 cache-lookup TOCTOU — orchestrator uses `get` alone, not
  `has + get`, so disk-backed caches don't race.
- T-090 double-close + browser-race — reviewer-caught; fixed with
  `sinkClosed` guard + `browserPromise` cache.
- T-090 vendor-adaptation honesty — changed "byte-compatible" doc
  claim to spell out deliberate argv-shape deviations.
- T-091 gitignore scope bug — pre-existing unanchored `reference/`
  silently ignored the entire `skills/stageflip/reference/` tree.
  Four skills tracked retroactively.

### Low-urgency cleanups carried forward

- Auto-generated schema skill "object object object…" artifact
  (Phase 1 §6.10).
- `spawndamnit` + `gsap` in `REVIEWED_OK` allowlist.
- Turbo remote cache not enabled.
- `back-in` / `back-out` easings overshoot.

---

## 7. How to resume

### 7.1 Starter prompt for the next session

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase4-complete.md` top to bottom. Then `CLAUDE.md`.
> Then `docs/implementation-plan.md` Phase 5. Confirm your
> understanding of the current state and the next task.

Expected confirmation shape: "On `main` at `<hash>`. Phase 0+1+2+3
ratified. Phase 4 implementation complete; awaiting ratification.
Next task is T-100 (Parity harness infrastructure — PSNR + SSIM
comparator against golden PNG frames). Ready."

### 7.2 Orchestrator checklist for Phase 4 ratification

Before stamping "Ratified 2026-04-xx" in
`docs/implementation-plan.md`:

- [ ] `pnpm install --frozen-lockfile` clean.
- [ ] All 9 gates green: `pnpm typecheck lint test check-licenses
      check-remotion-imports check-skill-drift skills-sync:check
      check-determinism size-limit`.
- [ ] E2E reference-render suite green on a host with Chrome +
      ffmpeg + ffprobe (`pnpm --filter @stageflip/renderer-cdp test`
      — 203 tests, 3 of which are the e2e fixtures).
- [ ] `docs/implementation-plan.md` Phase 4 row gets the ✅ Ratified
      banner.
- [ ] Decide on follow-ups §1–§4 (BeginFrame + real host HTML +
      CI chrome/ffmpeg + dev-harness demos). Either defer explicitly
      to Phase 5 / T-100 or wire small fixes pre-T-100.
- [ ] Verify `docs/escalation-T-083.md` is kept for historical
      record (not deleted).

### 7.3 What Phase 5 looks like

Phase 5 is shorter but density-heavy: the parity harness + the
pre-render linter. Task headline: `T-100 Parity harness: PSNR +
SSIM comparators; runs each T-067 + T-090 fixture through CDP + a
second backend; fails if score drift > threshold`.

Complexity spots to plan for:

- **BeginFrame wiring** finally happens here. The vendored engine's
  `frameCapture.ts` is the natural source; the T-083 Modified-by
  header protocol covers the adaptation.
- **Real host HTML bundle** — Vite or tsup emitting an IIFE that
  registers the 6 live runtimes + mounts a composition from a
  post-message RIR payload.
- **Golden PNG corpus** — need a deterministic set of reference
  frames. Decision point: commit PNGs to git (simple, big repo),
  or commit hashes + regenerate on demand (clever, fragile).
- **Score thresholds** per profile — h264/h265/vp9 have different
  baseline PSNR budgets; ProRes near-lossless.
- **Linter** (T-101+): static analysis of RIR documents for common
  render-wrecking mistakes (odd dimensions, missing font families,
  unresolved clip kinds, bake-tier without orchestrator, etc.).

---

## 8. File map — Phase 4 additions

```
packages/renderer-cdp/
  package.json                            [MOD] +deps: @stageflip/rir, runtimes-contract, fonts, puppeteer-core
  src/
    index.ts                              [MOD] ~50 re-exports, layered-outermost-first
    vendor-core-helpers.ts                [NEW] T-083 B3a reimpl of the two @hyperframes/core helpers
    dispatch.ts                           [NEW] T-083 — dispatchClips(RIRDocument) → DispatchPlan
    adapter.ts                            [NEW] T-083 — LiveTierAdapter + CdpSession seam + DispatchUnresolvedError
    frame-sink.ts                         [NEW] T-084 — FrameSink + InMemoryFrameSink
    preflight.ts                          [NEW] T-084 — preflight(doc) + PreflightReport
    export-dispatcher.ts                  [NEW] T-084/T-084a — exportDocument + PreflightBlockedError + lossFlags
    asset-refs.ts                         [NEW] T-084a — collect + rewrite (pure)
    asset-resolver.ts                     [NEW] T-084a — AssetResolver + InMemoryAssetResolver + resolveAssets
    child-runner.ts                       [NEW] T-085 — ChildRunner + SpawnedProcess + createNodeChildRunner
    ffmpeg-profiles.ts                    [NEW] T-085 — 4 codec constants + getEncoderProfile
    ffmpeg-encoder.ts                     [NEW] T-085 — FFmpegEncoder (FrameSink) + FFmpegEncoderError + buildFfmpegArgs
    ffmpeg-doctor.ts                      [NEW] T-085 — doctor(opts?) → DoctorReport
    video-frame-extractor.ts              [NEW] T-086 — extractVideoFrames + buildExtractFramesArgs
    audio-mixer.ts                        [NEW] T-087 — mixAudio + buildMixAudioArgs + AudioTrack + MixAudioError
    artifact-store.ts                     [NEW] T-088 — ArtifactStore + InMemoryArtifactStore + LocalFsArtifactStore
    bake.ts                               [NEW] T-089 — BakeJob + BakeOrchestrator + InMemory refs
    puppeteer-session.ts                  [NEW] T-090 — PuppeteerCdpSession + canvasPlaceholderHostHtml + BrowserFactory
    ffprobe.ts                            [NEW] T-090 — ffprobe(filePath) + FfprobeReport + parseFfprobeJson
    reference-fixtures.ts                 [NEW] T-090 — 3 fixture RIRDocuments
    reference-render.ts                   [NEW] T-090 — renderReferenceFixture + canRunReferenceRenders
    {all the above}.test.ts               [NEW] matching unit suites
    reference-render.e2e.test.ts          [NEW] T-090 — guarded by canRunReferenceRenders()
  vendor/
    NOTICE                                [NEW T-081, MOD T-083] attribution + modification log
    README.md                             [NEW T-082] what, why, upgrade protocol
    engine/                               [NEW T-080] full vendored engine payload
      LICENSE                             upstream Apache-2.0, byte-identical
      PIN.json                            upstream/package/commit/vendoredAt/license
      src/index.ts                        [MOD T-083] Modified-by header + @hyperframes/core re-route
      src/services/frameCapture.ts        [MOD T-083] Modified-by header + re-route
      src/services/screenshotService.ts   [MOD T-083] Modified-by header + re-route
      ... (26 files total, upstream-verbatim otherwise)

.changeset/
  renderer-cdp-t080.md ... renderer-cdp-t090.md    (12 changesets; T-091 is docs-only)

docs/
  escalation-T-083.md                     [NEW] scope refinement → resolved in-PR
  dependencies.md                         [MOD] §4 Audit 7 + §5 pin table filled for engine
  implementation-plan.md                  [MOD] Phase 3 ratified banner, Phase 4 [rev] markers on T-083/T-088/T-089
  handover-phase4-complete.md             [NEW] this doc

skills/stageflip/
  reference/export-formats/SKILL.md       [REWRITE T-091] placeholder → substantive (269 lines)
  reference/cli/SKILL.md                  [NEW] force-added; pre-existing placeholder
  reference/schema/SKILL.md               [NEW] force-added; auto-generated
  reference/validation-rules/SKILL.md     [NEW] force-added; pre-existing placeholder
  concepts/determinism/SKILL.md           [MOD T-091] +1 back-link
  concepts/fonts/SKILL.md                 [MOD T-091] +1 back-link
  concepts/loss-flags/SKILL.md            [MOD T-091] +1 back-link
  concepts/rir/SKILL.md                   [MOD T-091] +1 back-link
  runtimes/contract/SKILL.md              [MOD T-091] +1 back-link
  runtimes/blender/SKILL.md               [MOD T-091] +1 back-link

.gitignore                                [MOD T-091] /reference/ anchored to repo root
```

---

## 9. Statistics — end of Phase 4

- **~50 commits** on `main` across Phase 4 (Merge T-080 → Merge T-091).
- **846 test cases** across **16 packages** (+203 from Phase 3).
- **479 external deps** license-audited (PASS).
- **237 source files** scanned for Remotion imports (PASS).
- **21 source files** scanned for determinism (PASS) — scope
  unchanged; renderer-cdp intentionally outside the globs.
- **9 CI gates** (+ optional e2e + the guarded e2e-reference suite).
- **12 changesets** pending flush to Phase 10 publish (was 9 end of
  Phase 3; +12 in Phase 4 minus T-072's existing = net +12).
  Correction: Phase 3 left 9 pending; Phase 4 added 12 more.
  Pending total now 21. T-091 added none (docs-only).
- **2 ADRs** accepted (ADR-001, ADR-002) — unchanged in Phase 4.
  Potential Phase 5 ADR for BeginFrame integration strategy.
- **6 concrete live runtimes** registered — unchanged.
- **1 concrete CdpSession impl** shipped (PuppeteerCdpSession).
- **3 reference fixtures** + **7 Phase 3 parity fixtures** queued
  for T-100 scoring.
- **1 escalation** raised + resolved in-phase.

---

*End of handover. Next agent: go to §7.1 for the starter prompt.
Phase 5 starts at T-100 (parity harness).*
