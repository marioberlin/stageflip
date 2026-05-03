# @stageflip/cdp-host-bundle

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

- 12a8382: Runtime bundle host — register all 6 live runtimes + bundleDoctor (T-100e).

  **Completes the bundle host.** T-100d shipped the scaffold with just
  the CSS runtime; T-100e wires in the remaining five — GSAP, Lottie,
  Shader, Three, and frame-runtime-bridge — so every live-tier
  `clip` in an RIR document can dispatch to its real runtime instead
  of the labelled placeholder box T-100d's composition falls back to.

  **Runtime registration**:
  - CSS — `createCssRuntime([solidBackgroundClip])`
  - GSAP — `createGsapRuntime([motionTextGsap])`
  - Lottie — `createLottieRuntime([lottieLogo])`
  - Shader — `createShaderRuntime([flashThroughWhite, swirlVortex, glitch])`
  - Three — `createThreeRuntime([threeProductReveal])`
  - frame-runtime-bridge — `createFrameRuntimeBridge([])` (meta-runtime;
    no demo clips, but id `frame-runtime` registers so user-defined
    React clips can bridge in at runtime)

  Extracted into `registerAllLiveRuntimes()` in `src/runtimes.ts` so the
  browser entry boot and the unit tests share one source of truth for
  registration. The `LIVE_RUNTIME_IDS` readonly tuple is the canonical
  list — length 6, insertion order matches `Phase 3 handover §4`.

  **New export — `bundleDoctor({ warnAtBytes? })`**:

  Diagnostic hook: reads the compiled bundle, reports `sizeBytes`,
  `warnAtBytes`, `warn` flag, and a human-readable `message`.
  Default warning threshold is 1.75 MB raw; current bundle is
  ~1.59 MB raw, leaving ~160 KB headroom. Intended for the parity
  CLI (T-101) and any operator-facing doctor utility — surfaces
  bundle bloat without needing a hard CI gate (size-limit covers
  that). Returns `exists: false` with an actionable message if the
  bundle hasn't been built yet.

  **Bundle-size budget**:

  `.size-limit.json` entry for `@stageflip/cdp-host-bundle` updated
  from 100 KB (T-100d CSS-only) → 500 KB (T-100e all six). Current
  actual is 313.82 KB gzipped per `pnpm size-limit`, leaving ~186 KB
  headroom. Vite reports 1,589.28 KB raw / 441.40 KB gzipped — the
  discrepancy with size-limit is because size-limit uses level-9 gzip
  plus tree-shaking while Vite's dev reporter uses a faster but less
  aggressive gzip path. Both paths are honest, different
  measurement methodologies.

  **Test-lane canvas polyfill**:

  `lottie-web` calls `canvas.getContext('2d').fillStyle = …` at module
  load. happy-dom returns `null` from `getContext('2d')`, crashing the
  import. Added `src/test-setup.ts` that overrides
  `HTMLCanvasElement.prototype.getContext` to return a Proxy-based
  no-op 2D stub when happy-dom returns null. Real Chrome (the actual
  bundle consumer) provides a working canvas — the polyfill only
  exists for the test lane. Wired via `vitest.config.ts`
  `setupFiles`.

  **Tests**: 14 → 26 in cdp-host-bundle. New file
  `runtimes.test.ts` (9 cases — 6 runtime-id presence + 4 specific
  clip dispatches + 1 re-registration guard). `index.test.ts` grew
  +3 for `bundleDoctor` (found + sizeBytes + message; above-threshold
  warn; under-threshold pass).

  **Scope commitment — NOT in scope**: rewiring the e2e
  `reference-render.e2e.test.ts` suite from `canvasPlaceholderHostHtml`
  to `createRuntimeBundleHostHtml`. That lets parity fixtures actually
  exercise clip rendering end-to-end and belongs with T-102 (formal
  fixture format) and T-103 (CI integration); doing it here would
  duplicate work the fixture format should own.

  **Skill**: `skills/stageflip/reference/export-formats/SKILL.md`
  updated — the pluggable-host section's third bullet no longer
  says "T-100d registers the CSS runtime only"; all 6 runtimes are
  now listed. Module-surface table adds the T-100e exports. The
  deferred-work row for the remaining runtimes has been removed.

- c3d84bd: T-202a: StageFlip.Display profile clips — attention tranche.

  Adds the first three of five `DISPLAY_CLIP_KINDS` declared in T-200,
  registered in `ALL_BRIDGE_CLIPS` and the cdp-host-bundle runtime suite:
  - `click-overlay` — invisible full-canvas anchor that routes through the
    IAB `clickTag` macro (default `%%CLICK_URL_UNESC%%%%DEST_URL%%`); opens
    in `_blank` with `rel="noopener noreferrer"` by default; requires a
    non-empty `ariaLabel` for screen-reader compliance.
  - `countdown` — frame-indexed deadline timer counting down from
    `startFromSeconds` via `max(0, start - frame/fps)`; supports `mm:ss`,
    `hh:mm:ss`, and `dd hh:mm:ss` formats; theme-slotted (accent / text /
    background); monospace digits for jitter-free layout.
  - `cta-pulse` — call-to-action button pulsing on a deterministic
    `(1 - cos)/2` envelope (`pulseHz` reads as pulses-per-second with rest
    at period boundaries and peak at half-period); theme-slotted (accent +
    text); schema caps `pulseHz ≤ 4` and `peakScale ∈ [1, 1.5]`.

  All three are deterministic (no `Date.now()` / `Math.random()` / timers).
  Bridge clip count 37 → 40; cdp-host-bundle runtime test bumped. T-202b
  lands `price-reveal` + `product-carousel` next.

  47 new tests across the three clips, 100% line + branch + function
  coverage on each.

- f57dbd0: T-202b: StageFlip.Display profile clips — data tranche.

  Closes out the five `DISPLAY_CLIP_KINDS` declared in T-200 with the two
  data-driven clips (T-202a shipped the three attention-tranche clips):
  - `price-reveal` — "before / after" price animation. Old price holds at
    full opacity for the first ~40% of the clip, then fades to 35%; new
    price slides up with a scale pop at the midpoint. Required `oldPrice`
    - `newPrice` strings; optional `oldLabel` / `newLabel` (default
      "Was" / "Now"; pass `''` to hide). Theme-slotted (accent for new price,
      foreground for labels, background for the card).
  - `product-carousel` — rotates 2–5 items with a deterministic
    `(hold + crossfade) * items.length` loop. Schema-capped `holdSeconds ∈
(0, 10]` and `crossfadeSeconds ∈ (0, 2]`. `carouselSlotsAtFrame(...)`
    is exported for tests (and for clips that want to key other animations
    off the same loop). Opacities always sum to 1, so both slots render as
    two absolutely-positioned layers with no z-fighting.

  Both are deterministic (no `Date.now` / `Math.random` / timers). Bridge
  clip count 40 → 42; cdp-host-bundle runtime test bumped. 32 new tests,
  100% line + branch + function coverage on each.

- 8a1d95e: T-131b.1 — light tranche of the frame-runtime-bridge port:
  `counter`, `kinetic-text`, `typewriter`, `logo-intro`, `chart-build`.
  Each clip is a fresh implementation against `@stageflip/frame-runtime`
  (zero Remotion imports per CLAUDE.md §3) and ships with a Zod
  `propsSchema` + `themeSlots` map that binds default colour props to
  `palette.primary` / `palette.foreground` / `palette.accent` /
  `palette.background` roles. `defineFrameClip` now forwards `propsSchema`
  - `themeSlots` onto the produced ClipDefinition (mirrors T-131a's
    `defineCssClip` change). New `ALL_BRIDGE_CLIPS` barrel constant lets
    downstream registrations append future tranches without touching the
    call site. cdp-host-bundle now wires the 5 clips into the live runtime
    registry; parity fixtures land for each.
- 5edf5a1: T-131b.2 — medium tranche of the frame-runtime-bridge port:
  `subtitle-overlay`, `light-leak`, `pie-chart-build`, `stock-ticker`,
  `line-chart-draw`. Each is a fresh implementation against
  `@stageflip/frame-runtime` (zero Remotion imports per CLAUDE.md §3).
  Per-clip palette wiring via `themeSlots` where appropriate;
  `light-leak` deliberately ships without `themeSlots` since its film-
  tone palette is intentionally off-theme. `ALL_BRIDGE_CLIPS` now
  exposes 10 clips (b.1 + b.2). cdp-host-bundle picks them up via the
  existing `ALL_BRIDGE_CLIPS` registration. Parity fixtures land for
  each. KNOWN_KINDS allowlist updated. The remaining T-131b.3 tranche
  (pull-quote, comparison-table, kpi-grid, animated-value) extends the
  same surface.
- 5f69c4e: T-131b.3 — heavy tranche of the frame-runtime-bridge port. Closes
  T-131b: `ALL_BRIDGE_CLIPS` now exposes 14 clips across b.1 / b.2 / b.3.

  Clips landed:
  - `animated-value` — reusable spring count-up primitive; also exports
    `AnimatedProgressBar` / `AnimatedProgressRing` as non-clip building
    blocks for dashboard compositions.
  - `kpi-grid` — dashboard grid composed of `AnimatedValue` cards with
    per-card spring stagger + trend ▲/▼ markers.
  - `pull-quote` — spring-scaled decorative quote mark + typewriter
    quote body + attribution slide-in.
  - `comparison-table` — two-column comparison with staggered row reveal
    (rows slide in from their respective sides).

  All four are fresh implementations against `@stageflip/frame-runtime`
  (zero Remotion imports per CLAUDE.md §3). Each declares a Zod
  `propsSchema` and a `themeSlots` map binding default colour props to
  `palette.*` roles. Parity fixtures land for each. KNOWN_KINDS
  allowlist extended. cdp-host-bundle picks them up automatically via
  the existing `ALL_BRIDGE_CLIPS` registration; the runtimes test now
  verifies all 14 kinds resolve.

- fc9526b: T-131d.1 — bridge-eligible portion of the lottie/three/shader tier.
  Mid-task survey discovered the 5 originally-scoped clips don't fit
  their named tier: `scene-3d` is pure CSS-3D (no three.js), `particles`
  is seeded LCG (no special libs), `shader-bg` is an escape-hatch
  needing runtime extension, `lottie-player` imports forbidden
  `@remotion/lottie`, `animated-map` brings mapbox-gl licensing.

  This sub-task ships the two clips that fit the bridge tier as-is:
  - `scene-3d` — CSS-3D transformed cube/sphere/torus/pyramid; rotates
    per-frame via `transform: rotateX/rotateY` + `transformStyle:
preserve-3d`. themeSlots bind color/background/titleColor.
  - `particles` — confetti/sparkles/snow/rain/bokeh effects driven by
    a seeded linear-congruential RNG (no `Math.random`, fully
    deterministic). Initial particle state memoised on
    (seed, count, width, height, effectColors). No themeSlots —
    palettes are deliberately style-driven.

  `ALL_BRIDGE_CLIPS` now exposes 16 clips. The remaining 3 (shader-bg,
  lottie-player, animated-map) are deferred under explicit plan rows
  T-131d.2 / .3 / .4 with named blockers documented for a future agent.

  Parity fixtures land for both clips. KNOWN_KINDS allowlist extended.
  cdp-host-bundle picks them up automatically through the existing
  ALL_BRIDGE_CLIPS registration; the runtimes test now verifies all 16.

- 75e3d7e: T-131f.1 — bridge standalones not covered by T-131b. Audit-driven
  catch-up after T-131c confirmation: `reference/.../clips/registry.ts`
  has 32 clips total; T-131b family covers 14, T-131d.1 covers 2,
  deferred T-131d.2/.3/.4 + T-131e cover 7. The remaining 9 split into
  this PR's 4 standalones plus T-131f.2 (5 dashboards) and T-131f.3
  (financial-statement composite).

  Clips landed:
  - `code-block` — own minimal language tokeniser (typescript /
    javascript / python / bash / json) + line-by-line stagger reveal.
    Intentionally fixed editor look (One-Dark-derived); no themeSlots.
  - `image-gallery` — crossfade slideshow with optional captions; last
    image stays visible past end of cycle.
  - `timeline-milestones` — horizontal axis with sweeping progress dot
    - per-milestone spring "pop"; labels alternate above / below the
      axis for readability.
  - `audio-visualizer` — simulated bar / wave / circular visualization
    driven by deterministic sin/cos. **No-audio path only**: real-audio
    reactive variant (T-131f.4) defers because reference imports
    Remotion's `<Audio>` component, which is forbidden per CLAUDE.md §3.

  `ALL_BRIDGE_CLIPS` now exposes 20 clips (b.1 + b.2 + b.3 + d.1 + f.1).
  cdp-host-bundle picks them up automatically through the existing
  barrel registration; the runtimes test verifies all 20 kinds resolve.
  Parity fixtures land for each. KNOWN_KINDS allowlist extended.

### Patch Changes

- 1e0c779: T-119e: fix bundle-boot regression in real Chrome.

  `vite.config.ts` was missing a `define` for `process.env.NODE_ENV`.
  In library mode (what we're in for the IIFE build) Vite does NOT
  auto-substitute the constant like it does in app mode. The browser
  IIFE contained 12 raw `process.env.NODE_ENV` references (mostly from
  React + react-dom) which threw `ReferenceError: process is not
defined` at boot — `window.__sf.ready` never flipped, and any
  consumer using `createRuntimeBundleHostHtml` timed out waiting.

  The 28 unit tests under happy-dom didn't catch this because happy-dom
  provides a `process` polyfill. The existing `reference-render.e2e`
  suite didn't catch it because it uses `canvasPlaceholderHostHtml`,
  not the real bundle. T-119b surfaced the symptom; T-119e pins the
  root cause and fixes it in 3 lines.

  After the fix:
  - Bundle shrinks 1.58MB → 1.27MB raw (production-mode React)
  - Gzipped size 313.82KB → 323KB (still well under the 500KB budget)
  - `pnpm parity:prime --reference-fixtures --out …` produces all 9
    PNGs in ~5s locally; render-e2e CI job firms up T-119c's
    previously-lenient `continue-on-error` guard.

  No public API change.

- 1257b50: T-183b: remaining three StageFlip.Video profile clips (motion tranche).

  Closes out the six `VIDEO_CLIP_KINDS` declared in T-180b:
  - **`hookMomentClip`** (`kind: 'hook-moment'`) — opening attention-grabber:
    claim text zooms in with a brightness pulse, supporting tagline slides
    up after. Theme slots: `foreground` / `accent` / `background`.
  - **`productRevealClip`** (`kind: 'product-reveal'`) — product-hero card:
    image slides up + zooms in; name + price strip in from the right.
    Theme slots: `foreground` / `accent` / `background`.
  - **`beatSyncedTextClip`** (`kind: 'beat-synced-text'`) — cycles phrases
    on each beat-frame, pulses a scale bump + glow at each beat; exports
    a `currentBeatIndex` helper for consumers wanting to reason about the
    active beat without mounting. Theme slots: `foreground` / `accent` /
    `background`.

  All deterministic (motion derived from `useCurrentFrame`); all registered
  in `ALL_BRIDGE_CLIPS`. Tests: +22 across the three clips. Bridge total:
  425/425 green. `cdp-host-bundle` clip-count test bumped to reflect the
  three new kinds.

  Pairs with T-183a (overlay tranche). If both PRs land, expect the
  cdp-host-bundle count to settle at 37.

- 3096a1c: T-220: `@stageflip/skills-sync` — four new generators to auto-emit
  skill files from the canonical source of truth:
  - `generateClipsCatalogSkill` (ClipsCatalogPkg) →
    `skills/stageflip/clips/catalog/SKILL.md`.
  - `generateToolsIndexSkill` (ToolsIndexPkg) →
    `skills/stageflip/tools/SKILL.md`.
  - `generateRuntimesIndexSkill` (RuntimesIndexPkg) →
    `skills/stageflip/runtimes/SKILL.md`.
  - `generateCliReferenceSkill` (CliReferencePkg) — ready for T-226
    to wire against `apps/cli`'s command registry; not yet invoked.

  `scripts/sync-skills.ts` produces all three new skill files.
  `packages/cdp-host-bundle/src/runtimes.test.ts` gains a drift test
  that cross-checks the hand-maintained `LIVE_RUNTIME_MANIFEST`
  against `listRuntimes()` after `registerAllLiveRuntimes()` fires
  in happy-dom — keeps the manifest honest without running
  browser-only runtime deps in the node sync script.

- Updated dependencies [019f79c]
- Updated dependencies [3871486]
- Updated dependencies [a248a29]
- Updated dependencies [6e3b7cf]
- Updated dependencies [af04052]
- Updated dependencies [208f1f9]
- Updated dependencies [012cd98]
- Updated dependencies [5989a43]
- Updated dependencies [b8bd157]
- Updated dependencies [7e977a2]
- Updated dependencies [8e199c0]
- Updated dependencies [1257b50]
- Updated dependencies [c3d84bd]
- Updated dependencies [f57dbd0]
- Updated dependencies [ec428bb]
- Updated dependencies [844a620]
- Updated dependencies [6cb351f]
- Updated dependencies [d1dffaf]
- Updated dependencies [89e8e3b]
- Updated dependencies [bbcbd38]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [8990222]
- Updated dependencies [49d4533]
- Updated dependencies [2d725e3]
- Updated dependencies [8a1d95e]
- Updated dependencies [5edf5a1]
- Updated dependencies [5f69c4e]
- Updated dependencies [fc9526b]
- Updated dependencies [75e3d7e]
- Updated dependencies [9b3691a]
- Updated dependencies [0b8c1c6]
- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [141dc86]
- Updated dependencies [925bb66]
- Updated dependencies [8812795]
- Updated dependencies [381c027]
- Updated dependencies [36d0c5d]
  - @stageflip/runtimes-contract@0.1.0
  - @stageflip/frame-runtime@1.0.0
  - @stageflip/runtimes-frame-runtime-bridge@0.1.0
  - @stageflip/runtimes-lottie@0.1.0
  - @stageflip/runtimes-shader@0.1.0
  - @stageflip/rir@0.1.0
  - @stageflip/runtimes-css@0.1.0
  - @stageflip/runtimes-gsap@0.1.0
  - @stageflip/runtimes-three@0.1.0
