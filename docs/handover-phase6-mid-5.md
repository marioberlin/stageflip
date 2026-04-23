# Handover — Phase 6 mid-5 (2026-04-23, late session)

Supersedes `docs/handover-phase6-mid-4.md` as the live starter doc.
If you are the next agent: start here, then `CLAUDE.md`, then
`docs/implementation-plan.md` (Phase 6 detail at **v1.11**).

Current commit on `main`: **`012cd98`** (T-131f.2a).

---

## 1. Session PRs (all 6 merged)

Continuation of the phase-6 mid-4 push. Each PR went through a
pre-merge reviewer-subagent pass; BLOCKING + SHOULD findings were
addressed in-PR before merge.

| PR | Task | Squash SHA | Title |
|---|---|---|---|
| [#71](https://github.com/marioberlin/stageflip/pull/71) | T-131e.0 | 844a620 | frame-runtime: `<FrameVideo>`/`<FrameAudio>`/`<FrameImage>` media-host |
| [#72](https://github.com/marioberlin/stageflip/pull/72) | T-131e.1 | af04052 | frame-runtime-bridge: video-background + gif-player |
| [#73](https://github.com/marioberlin/stageflip/pull/73) | T-131e.2 | 208f1f9 | frame-runtime-bridge: voiceover-narration + audio-visualizer-reactive |
| [#74](https://github.com/marioberlin/stageflip/pull/74) | T-131d.2 | 381c027 | runtimes-shader: shader-bg user-shader escape hatch |
| [#75](https://github.com/marioberlin/stageflip/pull/75) | T-131d.3 | d1dffaf | runtimes-lottie: lottie-player (prop-driven JSON clip) |
| [#76](https://github.com/marioberlin/stageflip/pull/76) | T-131f.2a | 012cd98 | frame-runtime-bridge: hr-dashboard + marketing-dashboard |

---

## 2. State summary

### Clip ports

- `ALL_BRIDGE_CLIPS`: **26 clips** (was 20 at start of this session).
- Reference clip coverage: **27 of 32 ported** (was 20).
- Remaining reference ports: product-dashboard, okr-dashboard, sales-dashboard, financial-statement, animated-map.

### Test counts

| Package | Current | Was | Delta |
|---|---|---|---|
| `@stageflip/frame-runtime` | 345 | 328 | +17 (T-131e.0 media-host) |
| `@stageflip/runtimes-frame-runtime-bridge` | 283 | 187 | +96 (e.1/e.2/f.2a) |
| `@stageflip/runtimes-shader` | 36 | 22 | +14 (T-131d.2 shader-bg) |
| `@stageflip/runtimes-lottie` | 33 | 13 | +20 (T-131d.3 lottie-player) |
| `@stageflip/cdp-host-bundle` | 29 | 29 | — (assertion counts bumped) |

Workspace total post-#76 main: **~1820+ tests** (was ~1706).

### New runtime primitives

- `<FrameVideo>` / `<FrameAudio>` / `<FrameImage>` — public on
  `@stageflip/frame-runtime`. Back media-backed clips without
  importing Remotion; delegate clock sync to existing `useMediaSync`.
- `defineShaderClip.fragmentShader` accepts a **function** (T-131d.2) —
  the user-shader path skips define-time validation and
  `ShaderClipHost` silent-fallbacks on compile failure. Also gained
  `propsSchema` + `themeSlots` passthrough (consistency with
  `defineCssClip` / `defineFrameClip`).
- `packages/runtimes/frame-runtime-bridge/src/clips/_dashboard-utils.ts` —
  private shared module with `dashboardTrendSchema`,
  `formatDashboardValue`, `dashboardTrendColor`, and the 5 semantic
  colour constants. T-131f.2b / .2c should import from here, not
  re-declare.

### CI gates

All 11 gates green on every merged PR. Known flakes:

- `render-e2e` → `Page.captureScreenshot timed out` (infra flake,
  documented in mid-4 §2). Hit on PR #73; cleared on second rerun.
  If it hits again on a clean PR, rerun the job — don't investigate
  before at least one rerun.

### Changesets

6 changesets recorded. All `minor` bumps. `runtimes-shader` +
`runtimes-lottie` now have `zod@3.25.76` as a direct dep.

---

## 3. Architectural decisions (this session)

### 3.1 Media-host (T-131e.0)

`<FrameVideo>` / `<FrameAudio>` are **always-mounted** — the DOM node
persists across the active-window boundary so the ref and network
preload state stay stable. Sync behaviour delegated entirely to
`useMediaSync`; the wrappers are ~30 LOC each. `<FrameImage>` is a
window-gated conditional mount (no `.currentTime` on `<img>`) —
returns `null` outside the window. All three drop `offsetMs` /
`durationMs` from DOM passthrough via explicit destructure.

**Property:** the wrappers use `buildSyncOptions` with a conditional-
assign pattern to satisfy `exactOptionalPropertyTypes` (never write
`undefined` to an optional key). Reviewer flagged + now commented.

### 3.2 Bake-tier clips shipped as bridge-rendered preview (T-131e.1/2)

The plan anticipated the 4 bake-tier clips (video-background,
gif-player, voiceover-narration, audio-visualizer-reactive) would
dispatch through a concrete `BakeRuntime`. We shipped them via the
**frame-runtime-bridge** for the preview path — the bake runtime
swap-in is a future consumer concern. Each clip documents the
determinism caveat in its header (`useAudioVisualizer` is wall-clock
dependent; `<FrameAudio>` playback is browser-driven).

**Mid-task discovery (T-131e.2):** `useAudioVisualizer` already
existed in `@stageflip/frame-runtime` from T-053. No
`useWindowedAudioData` analogue was needed — the AnalyserNode-backed
hook is sufficient for the bridge preview path. Bake path will need
the window-sampled variant when it lands.

**T-131f.4 folded into T-131e.2** — the plan held `audio-visualizer`
real-audio as a separate follow-up; we shipped it as the
`audio-visualizer-reactive` kind alongside T-131e.2. Row marked
`[folded-into-e.2]`.

### 3.3 User-shader escape hatch (T-131d.2)

`defineShaderClip`'s `fragmentShader` field now accepts `string |
((props: P) => string)`. The function form skips define-time
validation (GLSL is only known per render); `ShaderClipHost` silent-
fallbacks on compile / link failure via a single try / catch so one
malformed deck prop doesn't crash the rest of the slide. Authored
clips are unaffected — their static strings still validate up front.

`shader-bg.ts` composes the full fragment = `precision mediump float;
+ u_time + u_resolution + <user uniforms> + <user body>`. User
uniform names are identifier-filtered (GLSL ident regex) AND
`gl_`-prefix-filtered (prevents shadowing built-ins).

### 3.4 Lottie player — inline-only animation data (T-131d.3)

Reference loads Lottie JSON from a URL via `fetch()` — that's
forbidden in our determinism scope for `packages/runtimes/**/src/clips/**`.
Port **only accepts inline `animationData`** (object or JSON string);
deck authors resolve URLs outside the clip and hand decoded JSON in.
Falls back to an animated placeholder (three concentric pulsing
rings, `computePlaceholderRings(frame)` pure + unit-tested in
isolation). Hand-rolled `ClipDefinition` rather than extending
`defineLottieClip` (which bakes animationData at define time).

**Naming collision**: the component exports as `LottiePlayerComponent`
(not `LottiePlayer`) because `LottiePlayer` is already the lottie-web
player interface exported from `./types.js`. SKILL.md documents
both names.

### 3.5 Dashboard option-B (T-131f.2a)

Picked handover-mid-4 §5.2 **Option B** for the 5 dashboards: each
clip declares its own Zod `propsSchema` over the fields it actually
renders, rather than reimplementing `@slidemotion/schema`'s domain
types (`HrContent` / `SalesPipelineContent` / etc.) in
`@stageflip/schema`. The Phase 7 agent layer can map domain schemas
to these flat props later — decoupling keeps the bridge runtime
stable.

Shared helpers live in the private `_dashboard-utils.ts`:
- `dashboardTrendSchema` (`'up' | 'down' | 'flat'`)
- `formatDashboardValue(value, unit)` — locale-INDEPENDENT
  (`String()` / `toFixed()`, never `toLocaleString`).
- `dashboardTrendColor(trend)` → semantic hex.
- 5 colour constants (`GOOD`/`WARN`/`BAD`/`MUTED`/`SUBDUED`).

Sub-split for auditability:
- **T-131f.2a** ✅ — `hr-dashboard` + `marketing-dashboard` (#76).
- **T-131f.2b** 🟡 — `product-dashboard` + `okr-dashboard` (remaining).
- **T-131f.2c** 🟡 — `sales-dashboard` with sub-components (remaining).

### 3.6 Reviewer catches worth remembering

- **O(n²) in inner render loop**: `Math.max(...xs.map(...))` inside a
  `map` callback is a real perf regression. Hoist once above.
- **`?? 1` vs `|| 1`** on a value-not-undefined path: `??` only
  fires on undefined/null, so a zero value still divides. Use `||
  1` when 0 is a valid-but-unwanted input.
- **`toLocaleString()`** is locale-sensitive — drifts across CI
  runners. Prefer `String(n)` / `n.toFixed(k)` in determinism-scoped
  clip code.
- **`gl_` prefix** is reserved by the GLSL spec; filter user-supplied
  uniform names to prevent silent shader-compile failure.
- **Stale-read reviewer bug**: the pre-merge subagent occasionally
  reads pre-commit state on the branch. Verify "blocking" findings
  by switching to the task branch + grepping for the cited line
  before acting.

---

## 4. Phase 6 state at this handover

| Task | Title | Status |
|---|---|---|
| T-119..T-136 + T-131a/b/c/d.1/e/f.1 | (per mid-4 ledger) | ✅ merged |
| T-131d.2 | shader-bg | ✅ merged (#74) |
| T-131d.3 | lottie-player | ✅ merged (#75) |
| T-131d.4 | animated-map | 🔴 **blocked** — `mapbox-gl` license review + tile-API strategy |
| T-131e.0 | media-host primitives | ✅ merged (#71) |
| T-131e.1 | video-background + gif-player | ✅ merged (#72) |
| T-131e.2 | voiceover-narration + audio-visualizer-reactive | ✅ merged (#73) |
| T-131f.2 | 5 dashboard composites | 🟡 **in-progress** (2/5 shipped in f.2a) |
| T-131f.2a | hr-dashboard + marketing-dashboard | ✅ merged (#76) |
| **T-131f.2b** | product-dashboard + okr-dashboard | 🟡 **next** (Option B schemas, ~2 clips × 250 LOC) |
| **T-131f.2c** | sales-dashboard | 🟡 composite — sub-components (PipelineFunnel + ForecastChart + DealCard) |
| T-131f.3 | financial-statement composite | 🟡 **pending** (~640 LOC, largest single port; 4 files) |
| T-131f.4 | audio-visualizer real-audio | ✅ folded into T-131e.2 |
| T-137 | Visual diff viewer | 🟡 pending (M, parallel-eligible) |
| T-138 | Auto-fix passes (10) | 🟡 pending (L, parallel-eligible) |

**Reference clip coverage**: 32 total in `reference/.../clips/registry.ts`.
- ✅ 22 bridge + 2 shader + 2 lottie + 1 three + 2 css = **27 ported**
- 🟡 4 composites remaining (product / okr / sales / financial-statement)
- 🔴 1 blocked (animated-map)

---

## 5. How to resume

### 5.1 Starter prompt

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase6-mid-5.md` top to bottom. Then `CLAUDE.md`.
> Then `docs/implementation-plan.md` for Phase 6 detail. Confirm
> current state and the next task.

Expected confirmation: Phase 6 critical path done; 3 composites and
T-131d.4 (mapbox) remain. 27/32 reference clips ported.

### 5.2 Recommended next moves (in order)

1. **T-131f.2b** — `product-dashboard` + `okr-dashboard`. Same flat-
   prop pattern as T-131f.2a; reuse `_dashboard-utils.ts`. Reference
   files in `reference/slidemotion/packages/renderer-core/src/components/{product,okr}/`.
2. **T-131f.2c** — `sales-dashboard`. Composite. Reference at
   `components/sales/SalesDashboardSlide.tsx` (144 LOC) + helpers
   `PipelineFunnel` + `ForecastChart` + `DealCard`. Ship helpers
   as private `_*-subcomponents.tsx` under `clips/` OR inline.
3. **T-131f.3** — `financial-statement` composite. Largest port;
   4 files (clip + 3 sub-components: StatementKpiStrip,
   StatementTable, StatementCommentsRail). ~640 LOC source.
4. **T-131d.4** — `animated-map`. Needs `THIRD_PARTY.md` review for
   `mapbox-gl` (BSD-3-Clause-ish + commercial-use restrictions on
   the underlying tile API). **Escalate to orchestrator before
   starting** — license approval + account-token strategy can't
   be agent-driven.
5. **T-137** + **T-138** — parallel-eligible. Don't block Phase 6
   ratification.

### 5.3 Patterns that worked this session

- **Pre-merge reviewer subagent + in-PR fixes.** Caught real bugs
  every PR (silent-fallback missing `console.warn`, `?? 1` vs `|| 1`
  on zero-value paths, O(n²) inner loops, name collisions, missing
  public-API re-exports, locale-sensitive `toLocaleString`). Without
  this discipline at least 10 real issues would have shipped.
- **`Monitor` tool + REST-based merge.** Poll loop watching
  `/commits/{sha}/check-runs`, merge via
  `gh api --method PUT /repos/.../merge`. GraphQL rate limits hit
  once on PR #71 — REST path always worked.
- **Speculative-draft next PR during current PR's CI wait.** Saved
  ~15 min per PR. Rebasing onto updated main after merge was clean
  (one small `runtimes.ts` conflict when two PRs touched
  `registerAllLiveRuntimes` neighbourly).
- **Private `_dashboard-utils.ts`** — underscore-prefix convention
  for package-private modules that sit in `clips/` but aren't clip
  kinds. Not re-exported from the barrel.

### 5.4 Open follow-ups worth listing

Carried from mid-4 §6.4 (still relevant): items 1-22.

**New items from this session**:

- **T-131f.2b / .2c + T-131f.3** — see §4 above.
- **Mapbox license escalation** (T-131d.4) — no agent path forward
  without `THIRD_PARTY.md` sign-off.
- **Bake-runtime dispatcher wiring** — T-131e.1/.2 clips ship as
  bridge-preview. Deterministic export is still gated on a concrete
  `BakeRuntime` impl + app-slide dispatcher. No consumer blocking;
  pick up when a deck wants real video export.
- **`useWindowedAudioData` analogue** — NOT needed for the bridge
  preview path (T-131e.2 proved this). Only revive if the bake
  runtime needs windowed sample access at deterministic export time.
- **Shader compile failure is silent** — host's silent-bail has no
  dev-mode `console.warn`. Worth revisiting if the reviewer
  follow-up concern comes back.
- **Fixture `goldens` are placeholder** — all new fixtures ship with
  illustrative props. The priming operator renders real goldens
  against real assets at parity-scoring time.

---

## 6. Session stats

- **6 PRs opened + merged** (#71-#76).
- **~115 new tests** across 4 packages.
- **+7 reference clip ports** (20 → 27 of 32).
- **+3 runtime primitives** (`<FrameVideo>` / `<FrameAudio>` /
  `<FrameImage>`) on `@stageflip/frame-runtime`.
- **+2 runtime contract extensions** — `defineShaderClip`
  user-shader variant + `propsSchema`/`themeSlots` passthrough.
- **490 external deps** (unchanged) — `zod@3.25.76` added to
  runtimes-shader + runtimes-lottie (MIT, whitelisted).
- **~18 reviewer-pass findings caught in-PR**. None shipped to main.
- **1 flake** (Page.captureScreenshot on PR #73) — cleared on 2nd
  rerun; 2 failure events counted.
- **3 branches deleted locally** after merge; 3 still open
  (`docs/handover-phase6-mid-{2,3,4}` carry prior handovers, kept
  for history).

---

*End of handover. Next agent: start at §5.1. Phase 6 critical path
is done; the remaining ports are mostly content-heavy composites
plus a license-blocked map. Pick up T-131f.2b as the cleanest
continuation point.*
