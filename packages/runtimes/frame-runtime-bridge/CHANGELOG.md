# @stageflip/runtimes-frame-runtime-bridge

## 0.1.0

### Minor Changes

- 6e3b7cf: T-131d.4 — `animated-map` (SVG fallback only). Closes reference-clip
  coverage at 32/32 (`ALL_BRIDGE_CLIPS` → 31).

  Reference's `mapbox-gl` real-tiles branch deliberately NOT ported:
  network tile fetches + imperative `useEffect` DOM mutation on a
  canvas element both violate frame-runtime determinism invariants. A
  bridge-tier preview clip gated on a Mapbox account token is also the
  wrong posture regardless — real Mapbox belongs in a future bake-tier
  `animated-map-real` clip that pre-renders tiles during export, not in
  a determinism-scoped preview clip. The SVG fallback — what the
  reference itself renders whenever no token is supplied — is the sole
  implementation here.

  Zero new runtime deps → no `THIRD_PARTY.md` change.
  - `animated-map` — SVG grid + dashed route line drawn from a fixed
    start anchor to an eased-progress endpoint, camera center/zoom
    linearly interpolated by an in-out-cubic bezier progress value,
    pulse ring around the advancing dot (`0.3 + sin(frame * 0.3) *
0.3` opacity — deterministic). Three hand-tuned palettes via the
    `style` enum (`dark` / `light` / `satellite`); three of the four
    palette-overridable colour props (`backgroundColor`, `accentColor`,
    `textColor`) participate in `themeSlots` (background / primary /
    foreground). `gridColor` is overrideable but deliberately NOT a
    theme slot (hand-tuned tonal shift off the style's background —
    mapping to arbitrary theme roles produces wrong contrast).

  KNOWN_KINDS allowlist, cdp-host-bundle clip-count test (30 → 31),
  parity fixture, and plan row all updated. SKILL tranche ledger
  updated with a new `animated-map` row and the provenance note that
  reference-clip coverage is now 32/32.

- af04052: T-131e.1 — video / image tranche lands on the frame-runtime bridge.
  Two new clips ported from SlideMotion reference against the
  `<FrameVideo>` / `<FrameImage>` surface from T-131e.0:
  - `video-background` — full-bleed muted `<FrameVideo>` with timed
    title + subtitle overlay. `themeSlots`: `titleColor` →
    `palette.foreground`, `subtitleColor` → `palette.secondary`.
  - `gif-player` — fade + scale entrance around an `<img>` (via
    `<FrameImage>`). GIF frame advance stays browser-controlled in
    the preview path; deterministic export decodes via the bake
    runtime (dispatcher wiring tracked separately). `themeSlots`:
    `backgroundColor` → `palette.background`, `titleColor` →
    `palette.foreground`.

  `ALL_BRIDGE_CLIPS` now exposes 22 clips.

- 208f1f9: T-131e.2 — audio tranche lands on the frame-runtime bridge. Two new
  reference ports:
  - `voiceover-narration` — text + SVG-waveform visualization of timed
    narration segments. Extends the reference with an optional
    `audioUrl` prop that mounts a hidden `<FrameAudio>` for
    playback-clock-synced narration. `themeSlots`: `background` →
    `palette.background`, `textColor` → `palette.foreground`, `color` →
    `palette.primary`.
  - `audio-visualizer-reactive` — real-audio variant of T-131f.1's
    simulated `audio-visualizer`. Drives bar heights from
    `useAudioVisualizer` (live AnalyserNode) on a FrameClock-synced
    `<audio>` element. Editor / preview determinism only — deterministic
    export pre-decodes samples via the bake runtime (dispatcher wiring
    tracked separately). `themeSlots`: `color` → `palette.primary`,
    `background` → `palette.background`, `titleColor` →
    `palette.foreground`.

  Sub-exports of `BarsViz` / `WaveViz` / `CircularViz` (and the
  `VizProps` type) added to `audio-visualizer.tsx` so the reactive clip
  can reuse the shared viz primitives.

  `ALL_BRIDGE_CLIPS` now exposes 24 clips.

- 012cd98: T-131f.2a — dashboard composites tranche 1/3. Two new clips on the
  frame-runtime bridge:
  - `hr-dashboard` — KPI strip (headcount / open positions / avg
    attrition) + per-department table (headcount, open, attrition,
    distribution bar) + optional metrics panel. Flat-prop schema
    avoids importing a domain `HrContent` type from the Phase 7
    agent layer.
  - `marketing-dashboard` — KPI strip (spend / revenue / ROAS /
    conversions + optional extra KPI) + mode switch between channel
    bars/table and funnel bars. Same flat-prop discipline.

  Both clips declare `themeSlots`: `background` → `palette.background`,
  `textColor` → `palette.foreground`, `surface` → `palette.surface`.
  Entry animation is a single 0..15-frame fade-in — no spring physics
  (reference clips had no frame-driven entrance at all).

  `ALL_BRIDGE_CLIPS` now exposes 26 clips. KNOWN_KINDS +
  cdp-host-bundle clip-count test + parity fixtures + plan row all
  updated. Plan row T-131f.2 marked `[in-progress]`; follow-ups
  T-131f.2b (product + okr) and T-131f.2c (sales) track the remaining
  three dashboards.

- 5989a43: T-131f.2b — dashboard composites tranche 2/3. Two new clips on the
  frame-runtime bridge:
  - `product-dashboard` — KPI strip (shipped / in-progress / blocked) +
    four display modes driven by `reportType`: sprint_review and
    release_notes show a 2-column feature card grid; roadmap shows
    Now/Next/Later lanes; metrics_dashboard shows a right-side panel
    with optional sparklines + alert borders on threshold breach.
  - `okr-dashboard` — KPI strip (avg progress, on-track, at-risk,
    behind, key-result completion) + four modes: `dashboard` /
    `objective_detail` show an `ObjectiveCard` grid (SVG circular
    progress ring + KR progress bars); `team_comparison` shows
    per-team columns; `roadmap` shows Now/Next/Later lanes with
    status-mapped objective cards. `ObjectiveCard` is inlined (not a
    separate package — the OKR dashboard is its sole consumer) and
    exported for reuse.

  Both clips follow the f.2a pattern: flat Zod `propsSchema` over just
  the fields rendered (no `@slidemotion/schema` domain types), shared
  helpers from `_dashboard-utils.ts`, `themeSlots` for
  `background` / `textColor` / `surface`, and a single 0..15-frame
  fade-in entrance.

  `ALL_BRIDGE_CLIPS` now exposes 28 clips. KNOWN_KINDS +
  cdp-host-bundle clip-count test + parity fixtures + plan row all
  updated. Plan row T-131f.2 stays `[in-progress]`; T-131f.2c (sales)
  is the remaining sub-tranche.

- b8bd157: T-131f.2c — dashboard composites tranche 3/3. `sales-dashboard`
  closes the T-131f.2 dashboard tranche.
  - `sales-dashboard` — pipeline composite over `stages[]` + `deals[]`
    - optional `summary`. Five `pipelineType` modes:
    * `funnel` / `quarterly_review`: PipelineFunnel (per-stage bars
      sized by total deal value, at-risk badge, stage probability
      labels) + optional DealCard strip below when
      `settings.showDealCards` is set.
    * `forecast`: ForecastChart (closed-won / weighted / total
      pipeline bars vs quota line) + a summary-KPI column.
    * `deal_review`: full-bleed DealCard grid sorted by
      `settings.sortBy` (default: value desc).
    * `win_loss`: two-column Won / Lost DealCard split (the ONLY
      mode where lost deals render).

  `PipelineFunnel` / `ForecastChart` / `DealCard` are inlined as
  module-private helpers inside `sales-dashboard.tsx` (single
  consumer). Same flat-prop Zod schema + `_dashboard-utils.ts`
  helpers as the rest of the T-131f.2 tranche.

  Density (`executive` / `standard` / `detailed`) controls
  `maxDealsShown` default. Currency prefix auto-selects `$` for
  USD, `€` for EUR, empty for anything else.

  `ALL_BRIDGE_CLIPS` now exposes 29 clips. KNOWN_KINDS +
  cdp-host-bundle clip-count test + parity fixture + plan row all
  updated. T-131f.2 marked `[shipped]`.

- 7e977a2: T-131f.3 — financial-statement composite. Largest single port in
  the T-131 family.
  - `financial-statement` — hierarchical financial statement slide
    with four sub-components inlined as module-private helpers:
    - **KpiStrip** — semantic-role-keyed KPIs (revenue / ebitda /
      cash / etc.) extracted from table rows. Default role sets per
      `statementType` (pnl / balance_sheet / cash_flow).
    - **StatementTable** — hierarchical line / section / subtotal /
      total / note / spacer rows with indentation by level, period
      columns (primary period highlighted), optional variance
      columns (absolute + percent), negative-number style
      (`parentheses` default; `red` or `minus` alternatives),
      density-aware row heights (board / standard / appendix), zebra
      rows + `hiddenInBoardMode` filtering.
    - **CommentsRail** — priority-ordered side rail of commentary
      cards with type-driven accent colours. Cap per density (5 /
      8 / 3).

  Option B flat-prop Zod schema — no `StatementTableContent` /
  `StatementRow` / etc. domain types imported from
  `@slidemotion/schema`. `themeSlots`: `background` →
  `palette.background`, `textColor` → `palette.foreground`,
  `surface` → `palette.surface`. Single 0..15-frame fade-in
  entrance.

  Determinism: `toLocaleString('en-US', …)` with the locale argument
  pinned is deterministic (Intl ships with Node). The locale-
  sensitive form (`toLocaleString()` without args) is the one that
  drifts between CI runners — this port uses only the safe form.

  `ALL_BRIDGE_CLIPS` now exposes 30 clips. KNOWN_KINDS +
  cdp-host-bundle clip-count test + parity fixture + plan row all
  updated. T-131f.3 marked `[shipped]`.

- 8e199c0: T-183a: first three StageFlip.Video profile clips (overlay tranche).

  Registers the static-card-ish half of the `VIDEO_CLIP_KINDS` catalog
  introduced in T-180b. All three clips are deterministic — motion is
  derived from `useCurrentFrame` + `useVideoConfig` via `interpolate` —
  so the determinism gate stays clean.
  - **`lowerThirdClip`** (`kind: 'lower-third'`) — speaker chyron that
    slides in from the left, holds, slides out to the right. Accent bar
    - name + optional subtitle line. Theme-slotted on
      primary/background/foreground.
  - **`endslateLogoClip`** (`kind: 'endslate-logo'`) — closing brand
    card: centered wordmark + optional tagline with fade + scale
    entrance and fade exit. Theme-slotted on
    primary/background/foreground.
  - **`testimonialCardClip`** (`kind: 'testimonial-card'`) — quote card
    with attribution name + role; subtle translate-up entrance + fade
    out. Theme-slotted on surface/accent/foreground.

  Added to `ALL_BRIDGE_CLIPS` so the cdp-host-bundle picks them up for
  export/parity. Tests: +23 (7 lower-third + 8 endslate-logo + 8
  testimonial-card). Bridge total: 419/419 green.

  Follow-up: T-183b ships the motion-heavier trio — `hook-moment`,
  `product-reveal`, `beat-synced-text`.

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

- 89e8e3b: Phase 6 polish follow-ups (three items carried from `docs/handover-phase6-mid-6.md` §5.4).

  **1. Shader compile-failure dev-mode `console.warn`.**
  `ShaderClipHost` (T-131d.2) silent-fallbacked on shader compile/link failure by design — a bad GLSL prop shouldn't crash the surrounding deck. But authors hitting the fallback had no way to know WHY the canvas was blank. This adds a `console.warn` guarded by `NODE_ENV !== 'production'` that surfaces the GL info log. Production stays silent to avoid spam from decks shipping intentional-stub fragments.

  **2. `commentaryMode: 'inline'` now renders distinctly from `'rail'` (financial-statement).**
  T-131f.3's `financial-statement` clip advertised `commentaryMode: 'rail' | 'inline' | 'none'` in its schema but rendered the side rail for both `rail` and `inline`. The rail layout keeps the side panel; the new inline layout lays the comments as a horizontal strip below the table. Each layout carries its own data-testid (`financial-statement-comments-rail` / `financial-statement-comments-inline`) so downstream tooling can distinguish the two. `CommentsRail` gains a `layout?: 'rail' | 'inline'` prop.

  **3. Currency prefix expanded to 13 ISO currencies + sensible fallback.**
  Both `financial-statement` and `sales-dashboard` used a local 2-entry map (USD / EUR) and silently rendered bare numbers for anything else. Consolidated to a shared `currencyPrefix` helper in `_dashboard-utils.ts` that maps USD, EUR, GBP, JPY, CNY, INR, KRW, CHF, CAD, AUD, HKD, SGD, NZD to short display prefixes; unknown codes fall through to `<CODE> ` (e.g. `BRL 100K`) so the number is never unlabelled. Two clips now import from one source — drops duplicate code and fixes the silent-no-symbol bug.

  All three changes are backward-compatible. The currency schema stays `z.string().optional()` (enum narrowing would reject decks using the still-valid ISO fallback); the rail/inline split keeps `rail` as the default; the shader warn fires only when the clip was already silently failing.

- 2d725e3: Initial frame-runtime bridge (T-061). Adapts
  `@stageflip/frame-runtime` to the `ClipRuntime` contract from T-060.

  Exports:
  - `defineFrameClip<P>({ kind, component, fontRequirements? })` — wraps
    a React component that uses `useCurrentFrame` / `useVideoConfig`
    into a `ClipDefinition<unknown>`. The produced render gates on the
    clip window, remaps `frame` to `frame - clipFrom` (local time
    starting at 0), and exposes `clipDurationInFrames` as
    `useVideoConfig().durationInFrames`.
  - `createFrameRuntimeBridge(clips?)` — builds the `ClipRuntime`
    (`id: 'frame-runtime'`, `tier: 'live'`). Duplicate kinds throw.
    Register with `registerRuntime(bridge)` at app boot.

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

- 9b3691a: T-406: unified chart clip family in
  `@stageflip/runtimes-frame-runtime-bridge`.

  A new `chart` ClipDefinition consumes `ChartElement`-shaped props and
  dispatches on `chartKind` to seven frame-deterministic SVG renderers:
  `bar`, `line`, `area`, `pie`, `donut`, `scatter`, `combo`. All seven
  share a unified animation contract (entrance fraction 0.6, per-element
  stagger 5 frames, `EASE_OUT_EXPO` curve, settled at
  `floor(0.6 × durationInFrames)`).

  `chartPropsSchema` is a strict subset of `ChartElement` (no
  `elementBase`; no `DataSourceRef` — rejected at parse time with a
  T-167-citing error until the data-source-bindings bundle lands).

  Registered in `ALL_BRIDGE_CLIPS` (42 → 43 clips). Coexists with the
  existing standalone T-131b chart clips (`chart-build`,
  `pie-chart-build`, `line-chart-draw`); does not replace them
  (D-T406-9). Cluster E presets (T-355–T-360) bind to the unified
  `chart` clipKind.

- 233cbf1: T-321d — `photographic-overlay` primitive carve-out (Cluster D; film-grade tonal overlay; last new-primitive T-321 carve-out).

  Static film-grade tonal overlay rendered via SVG `<filter>` primitives. Sealed `mode: 'sepia' | 'cross-process' | 'cinematic-lut' | 'fade'` flat enum. SVG `<feColorMatrix>` for sepia / cinematic-LUT modes; `<feComponentTransfer>` for cross-process / fade modes. Pinned `color-interpolation-filters="sRGB"`; deterministic across CDP per SVG 1.1 §15.3 (Filter Effects spec).

  Primary consumer T-351 true-detective-double-exposure (compass canon "photographic clip" register); secondary T-348 stranger-things-benguiat.

  58th bridge clip. With T-321d merged, the T-321 carve-out roadmap is structurally complete: 4 of 6 done (T-321a grain + T-321b superseded + T-321c superseded + T-321d); remaining 2 (ThreeSceneClip integration + video-shot kind) are titleSequence modifications deferred to consumer presets.

  NO frame counter (static per D-T321d-8); NO theme slots (canonical pre-tuned values per D-T321d-9). v1 carve-outs: T-321d-animated (frame-driven LUT crossfade), T-321d-custom-lut (user 3D LUT input), T-321d-curves (per-channel curve editing), T-321d-modes (additional canonical modes).

### Patch Changes

- e0e284b: T-183z — `LowerThird` primitive supports `noFlag` / `subtitleColor` /
  `font` props.

  Bundles the three documented cosmetic divergences flagged by every
  Cluster A preset shipped this session (T-323 cnn-classic / T-325
  bbc-reith-dark / T-326 al-jazeera-orange — D-T323-3/-5/-13,
  D-T325-12 a/b/c, D-T326-12 a/b/c). All three new props are additive
  optional axes; defaults preserve existing behavior so no
  parity-golden bytes change.
  - `noFlag: boolean` — hides the 6 px-wide accent strip on the left
    edge. Unblocks T-329 netflix-doc-lt and T-330 apple-tv-lt
    minimalist registers.
  - `subtitleColor: string` — overrides the hard-bound accent-as-
    subtitle-color on the title subline (independent talent-line color).
  - `font: { family, weight? }` — overrides the hard-coded
    `'Plus Jakarta Sans, sans-serif'` family with an optional uniform
    weight applied to both name and title elements (when `weight`
    absent, the primitive's defaults — 700 for name, 500 for title —
    are preserved).

  Schema is `.strict()`; new props are all optional. Existing test
  contracts (entrance / hold / exit timing, theme slots, registry
  shape) preserved — 15 new vitest cases on top of the existing 10
  (25 pass total).

- b469cd3: T-316 — `caption` runtime-clip primitive.

  Word-level timed text with six built-in visual styles (`hormozi`,
  `mrbeast`, `tiktok`, `ali-abdaal`, `netflix`, `karaoke-wipe`). Frame-
  deterministic word visibility (`(currentTimeMs ∈ [word.startMs,
word.endMs))`); per-word entrance stagger anchored on each word's
  `startMs` minus `i * staggerMs` (`none` / `bounce` / `rise` /
  `slide-from-top` / `slide-from-bottom`, 12-frame settle); SVG `<text>`
  with `stroke` + `paint-order: stroke fill` when `strokeWidth > 0`
  (Hormozi 6 px black, MrBeast 5 px); per-word `<rect>` pill backdrops
  (TikTok rounded box) or single bounding-box rect (Netflix letterbox);
  `karaoke-wipe` style fills each word left-to-right via SVG `<clipPath>`
  driven by within-word ms-progress; casing transforms (`as-is` /
  `uppercase` / `lowercase` / `title-case`); MrBeast cycling highlight
  via `highlightColor: string[]` (i-th highlighted word picks
  `colors[i % len]`); theme-slot fallback (`background` →
  `palette.background`, `foreground` → `palette.foreground`,
  `highlightColor` → `palette.accent`, `muteColor` → `palette.foreground`,
  `strokeColor` → `palette.background`).

  Unblocks Cluster F captions (T-362 hormozi-montserrat-black, T-363
  mrbeast-komika-axis, T-364 tiktok-rounded-box, T-365
  ali-abdaal-opacity-karaoke, T-366 netflix-invisible, T-367
  karaoke-progressive-wipe) plus Cluster A breaking-news word reveals,
  Cluster B sports score callouts, and Cluster G CTA word emphasis.
  Cluster-specific palettes + canned `words[]` live in `parity-cli`
  resolver shims, not in this primitive.

  `ALL_BRIDGE_CLIPS` 46 → 47; `cdp-host-bundle` clip-count test and
  `@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.

- 7211b14: T-316a — `caption` `resolveColor` honors `muteOpacity` for non-tagged
  past/future words.

  Previously `resolveColor` only applied `muteOpacity` when a word was
  explicitly tagged `emphasis: 'mute'`; non-tagged past/future visible
  words fell through to the foreground branch and rendered at opacity
  `1.0`, defeating the bundle-level opacity-karaoke register described in
  D-T316-2 (e.g. `ali-abdaal` ships `muteOpacity: 0.6`). Adds a third
  branch between the highlight/active branch and the foreground fallback:
  when `resolved.muteOpacity < 1`, return the foreground color at that
  opacity. Active-word and explicit per-word `mute` paths are unchanged;
  the active branch precedes the new branch so the active word never
  picks up dim. Bundles shipping `muteOpacity: 1` (`hormozi`, `mrbeast`,
  `tiktok`, `netflix`, `karaoke-wipe`) hit an unreachable branch — output
  byte-identical.

  Unblocks T-365 `ali-abdaal-opacity-karaoke` retry. No clip-count or
  registry change; no schema change.

- fc067fd: T-316b — `caption.tsx` rect-backdrop is now multi-line aware.

  Bug: when caption content's approximate `totalWidth` exceeded the container `position.width`, content flex-wrapped to 2+ lines but the SVG rect backdrop was sized for 1 line — active words on wrapped lines rendered below the rect. Discovered during product-owner ratification of `netflix-invisible` 2026-05-06 (5 words at 56px in a 1024px container wrap to 2 lines; active word `for` on line 2 rendered outside the rect band).

  Fix: rect height now scales with `lineCount = ceil(totalWidth / containerWidth)`; rect width caps at `containerWidth` when wrapping. Two regression tests cover wrapped vs single-line content. Backdrop modes `'pill'` and `'none'` unchanged.

  Unblocks netflix-invisible re-signing → Cluster F closes to 6/6 ELIGIBLE.

- d11807c: T-321 — `titleSequence` runtime-clip primitive.

  Multi-shot prestige-TV title compositor with four sealed style bundles
  (`'letterform-assemble'` / `'plate-and-credits'` / `'palette-jump-cut'` /
  `'photographic-overlay'`), five shot kinds (`titlePlate` /
  `letterAnimation` / `creditsBlock` / `colorPanel` / `holdFrame`), three
  transition kinds (`'cut'` / `'fade'` / `'dissolve'`) with single-active
  - 1-shot overlap during fade / dissolve. Frame-deterministic shot
    dispatch; per-letter staggered entry; viewport-fill ALL-CAPS
    letterforms via `letterformScale`. Stable shot-id-derived
    clipPath / filter / per-letter IDs. Optional `glow?` halo on the
    active shot. Casing transforms at render time. Theme-slot fallback.
    Bridge clip count 49 → 50. Unblocks Cluster D presets T-348..T-353.

- 19eeaac: T-322 — `lyrics` runtime-clip primitive.

  Line-level music-synced lyric panel with three style bundles
  (`'karaoke-wipe'` — left-to-right color front sweeping across the
  active line driven by per-line ms-progress; `'three-line-stack'` —
  past dimmed at top / active highlighted in middle / next preview at
  bottom; `'highlight-current'` — active line only, full-screen).
  Frame-deterministic line visibility (`(currentTimeMs ∈ [line.startMs,
line.endMs))`); per-line entrance (`'none'` / `'fade'` default /
  `'rise'`, 12-frame settle anchored on each line's `startMs` frame);
  `'karaoke-wipe'` SVG `<clipPath>` fill driven by within-line
  ms-progress with stable line-index-derived clipPath IDs
  (`lyrics-line-clip-${i}`); optional `glow?: { color, blur }` halo on
  the active line via SVG Gaussian-blur `<filter>` with stable filter
  ID (`lyrics-glow-${i}`); `maxLinesVisible: 1 | 3 | 5` (default `3`;
  forced to `1` under `'highlight-current'`); `lineGap` (default 80)
  vertical spacing in the stack; casing transforms (`as-is` /
  `uppercase` / `lowercase` / `title-case`); theme-slot fallback
  (`background` → `palette.background`, `foreground` →
  `palette.foreground`). `lines: { text, startMs, endMs }[]` strict
  required input (1–40 entries; pre-computed beat-aligned line
  timings — beat detection / audio-track parsing is a host concern,
  not this primitive).

  Unblocks T-367 (`karaoke-progressive-wipe`, last Cluster F preset,
  6/6) and reusable for Cluster A music-show graphics + Cluster G
  social-music presets. Cluster-specific palettes + canned `lines[]`
  live in `parity-cli` resolver shims, not in this primitive.

  `ALL_BRIDGE_CLIPS` 48 → 49; `cdp-host-bundle` clip-count test and
  `@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.

- 0d00661: T-322a — LyricsClip rendering bugs (karaoke-wipe width, line overflow,
  line 3 missing, glow halo) (unblocks T-367).

  Surgical render-fix patch on `lyrics.tsx`. Four independent bugs found
  during T-367 (`karaoke-progressive-wipe`) parity review at frame 105
  (mid-line2, 40% wipe progress, three-line stack):
  1. **Karaoke-wipe `<rect>` width.** Was `width={karaokeProgress * 100}`
     — SVG reads unitless numbers as user-space px, so a 0.40-progress
     wipe rendered 40 px wide instead of 40% of the line region. Now
     `width={\`${karaokeProgress \* 100}%\`}`and`height="100%"` for
     symmetry (D-T322a-1).
  2. **Line overflow at default font.** A 25-char line at the prior
     `DEFAULT_FONT.size: 96` ran ~1250 px wide and clipped a 1024-px
     position region under `whiteSpace: 'nowrap'`. Reduced to 64 — same
     line ~800 px, fits the region (D-T322a-2).
  3. **Line 3 missing in 3-line stacks.** `computeLineEntrance` derives
     `entranceStartFrame` from each line's `startMs`; for a future-
     startMs preview line, `interpolate` clamped left → opacity 0 →
     "missing." Now bypassed for `entry.role !== 'active'`; only the
     active line plays the entrance (D-T322a-3).
  4. **Glow halo invisible.** The `<filter>` emitted only
     `<feGaussianBlur>` + `<feFlood>`, with no compositing. Added the
     standard SVG glow recipe — `<feComposite operator="in">` joins the
     flood to the blurred alpha, `<feMerge>` lays the colored blur under
     the source graphic (D-T322a-4).

  Stable line-index-derived clipPath / filter IDs unchanged. Schema,
  theme slots, registry, and `ALL_BRIDGE_CLIPS` count (49) unchanged.
  T-322's existing render contracts (other styles, casing, entrance
  timing for active line, theme slots) preserved — five new vitest
  regression cases on top of the existing 19 (24 pass total). Same
  pattern as T-316a → T-365 retry; T-367 retries unchanged after this
  lands.

- 136bb11: T-324a — add `breaking-banner` clip primitive (51st bridge clip; Cluster A `breakingBanner` clipKind).

  Single primitive serves both CNN-style horizontal slide-in banners (`mode: 'banner'`, default) and Fox-style persistent narrow slivers (`mode: 'sliver'`) via `slideAxis: 'horizontal' | 'vertical'`. Sliver mode skips entrance per Fox's persistent register canon. Required props: `headline` + `label: { text, fill, color }`. Optional: `endCap`, `background` (theme `palette.background`), `headlineColor` (theme `palette.foreground`), `font`, `casing`. LIVE pulse, ticker strip, red-block-wipe text-change, Fox searchlight morph, return-from-commercial sequence all deferred to follow-up carve-outs (T-324b/c, T-327a/b).

  Unblocks Cluster A presets T-324 (`cnn-breaking`) and T-327 (`fox-news-alert`).

- d91220a: T-332a — `score-bug` runtime-clip primitive.

  Single primitive serving six broadcast-sports score-bug presets across
  four sealed style bundles dispatched via Zod discriminated union on
  `style`: `'football'` (horizontal team-vs-team bar serving T-333 PL /
  T-334 Fox NFL / T-335 NBC SNF), `'racing'` (vertical N-driver tower
  serving T-332 F1), `'cricket'` (multi-row complex panel serving T-336),
  `'tennis'` (two-player stack serving T-337 Wimbledon). Frame-
  deterministic; static layouts in v1 (animation carve-outs T-332b/c/d,
  T-334a, T-335a, T-336a/b, T-337a/b deferred). Stable internal IDs
  (`score-bug-football-gradient`); no `crypto.randomUUID()`. Theme-slot
  fallback (`background` → `palette.background`, `foreground` →
  `palette.foreground`, `accent` → `palette.accent`). Default font
  `'Plus Jakarta Sans, sans-serif'` weight 700 with `tabular-nums` on
  by default. Sector-color palette (`'session-best'` purple /
  `'personal-best'` green / `'slower'` yellow / `'neutral'` transparent)
  baked in per F1 canon — not themable. Bridge clip count 51 → 52.
  Unblocks Cluster B presets T-332 / T-333 / T-334 / T-335 / T-336 /
  T-337.

- 350f0df: T-355a — `magic-wall-panel` runtime-clip primitive.

  Generic fullscreen layered hierarchical-data panel of N (1..56)
  labeled, color-shaded region tiles at absolute-positioned bounds
  (`{ x, y, width, height }` per region; canvas-pixel coordinates).
  Per-region hex `color` override with theme `foreground` fallback;
  optional top-of-panel `title` + `subtitle` (subtitle at 70% opacity);
  `valueFormat` dispatch (`'percent'` → `${value.toFixed(1)}%`,
  `'count'` → `value.toLocaleString('en-US')`, `'raw'` →
  `String(value)`) with optional per-region `valueLabel` override (e.g.,
  `'CALLED'` / `'Too Close'`); three entrance modes (`'stagger-rise'`
  default — fade + 12 px rise / `'fade'` — fade only / `'none'`), per-
  region delay `delay = i * staggerMs / (1000 / fps)`, 12-frame ramp;
  `tabular-nums` on numeric-formatted cells (`'percent'` / `'count'` /
  `'raw'`-numeric). Theme-slot fallback per D-T355a-6 (`background` →
  `palette.background`, `foreground` → `palette.foreground`).

  v1 ships placeholder rectangles via `region.bounds`; real US state
  SVG path geometry / county shapes / projection helper / `us-atlas`
  topology are a v2 follow-up (out of envelope per T-355 D-T355-6).
  Drilldown / zoom transitions live at runtime composition
  (ADR-003 §D2), not in the primitive.

  Unblocks T-355 (magic-wall-drilldown, Cluster E) and the broader
  Cluster A/B/C/E fullscreen-panel preset shape (msnbc-big-board,
  uefa-starball-refraction, twc-retrocast-8bit / twc-immersive-mixed-
  reality, future scientific heatmaps). Cluster-specific region
  geometry + palettes live in `parity-cli` resolver shims, not in this
  primitive.

  `ALL_BRIDGE_CLIPS` 47 → 48; `cdp-host-bundle` clip-count test and
  `@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.

- 1326430: T-356a — `news-ticker-bar` runtime-clip primitive.

  Generic horizontal scrolling chyron of N (1..24) symbol + price + delta
  - ▲ / ▼ / ▬ direction-arrow chips translating left at `scrollSpeed`
    px/sec, looping continuously via the doubled-row marquee pattern
    (modulo `rowWidth = entries.length * (chipWidth + chipGap)`). Fixed
    `chipWidth` (default 220 px) keeps the wrap math fully deterministic.
    Direction-driven colors (`upColor` / `downColor` / `flatColor`) with
    theme-slot fallback (both `upColor` and `downColor` map to
    `palette.accent` per D-T356a-6 — current `ThemePalette` exposes no
    `positive` / `negative` roles; `flatColor` maps to
    `palette.foreground`); band geometry (`bandHeight`, `bandPosition`:
    `'top'` / `'bottom'`) and `background` / `foreground` are configurable
    hex props with theme-slot fallback.

  Unblocks T-356 (Bloomberg market chyron) and the broader Cluster A/B/E
  ticker preset shape (CNN / Fox breaking-news lower-band, ESPN
  BottomLine sports score crawl, crypto / multi-asset dashboards).
  Cluster-specific palettes + entry payloads live in `parity-cli`
  resolver shims, not in this primitive.

  `ALL_BRIDGE_CLIPS` 44 → 45; `cdp-host-bundle` clip-count test and
  `@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.

- 4766460: T-356b — `news-ticker-bar` primitive adds `mode: 'scroll' | 'flip'` + `flipDurationMs` props.

  `'scroll'` (default; backward-compat) is the original continuous-marquee behaviour. `'flip'` is the post-2018 ESPN BottomLine canon: two rows stacked vertically, each row shows one ticker entry; pair advances every `flipDurationMs` ms (default 4500). v1 ships steady-state pair only — within-window flip animation is a v2 follow-up (`T-356c`).

  Schema: `mode?: z.enum(['scroll', 'flip'])`, `flipDurationMs?: z.number().positive()`. Both optional; defaults preserve existing behaviour. Existing bloomberg-ticker golden unchanged (no new props passed).

  Unblocks Cluster B preset T-339a `espn-bottomline-flipper`.

- 1dfd5eb: T-357a — `standings-table` runtime-clip primitive.

  Generic vertical ranked table of N (1..16) rows with K (2..8) columns
  of mixed kind (`rank` / `label` / `numeric` / `delta` / `total`); per-
  column hex `color` tinting (medal-style gold / silver / bronze); delta-
  arrow glyphs (↑ / ↓ / ▬) driven by string enum (`'up'` / `'down'` /
  `'flat'`) or numeric sign (positive → up, negative → down, zero →
  flat); frame-derived per-row entrance stagger (fade + slide, `delay =
i * staggerMs / (1000 / fps)`, 12-frame ramp, `translateY` `-8 → 0`
  px). Numeric cells (`rank` / `numeric` / `total`) carry
  `font-variant-numeric: tabular-nums` so digit columns align across
  rows regardless of the fallback font's proportional digits.
  Proportional column flex (default 1; per-column `flex` / fixed
  `width` overrides). Theme-slot fallback per D-T357a-6 (both `upColor`
  and `downColor` and `goldColor` map to `palette.accent`;
  `silverColor` / `bronzeColor` / `flatColor` map to `palette.foreground`;
  `background` / `foreground` to their namesakes).

  Unblocks T-357 (olympic-medal-tracker, Cluster E) and the broader
  Cluster A/B/E ranked-list preset shape (F1 / NBA / NCAA / golf
  leaderboards, election results, crypto top-N market-cap dashboards).
  Cluster-specific palettes + row payloads live in `parity-cli` resolver
  shims, not in this primitive.

  `ALL_BRIDGE_CLIPS` 45 → 46; `cdp-host-bundle` clip-count test and
  `@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.

- 3b861a2: T-358a — `outcome-row` runtime-clip primitive.

  Generic primitive that renders a horizontal row of N (1..12)
  independently color-coded chips with a staggered fade-in entrance
  (`delay = i * 4` frames, 12-frame ramp). Three shape variants:
  `circle` (default), `square`, `rounded`. Per-chip hex `color` is
  required; theme slots map `defaultFill` → `palette.surface`,
  `outlineColor` → `palette.foreground`, `background` →
  `palette.background`.

  Unblocks T-358 (cricket ball-by-ball dots) and the broader
  Cluster B/E scorebug-family preset shape (tennis tiebreak points,
  F1 sector history, soccer last-N-shots indicators). Cluster-specific
  outcome → color mapping lives in `parity-cli` resolver shims, not in
  this primitive.

  `ALL_BRIDGE_CLIPS` 43 → 44; `cdp-host-bundle` clip-count test and
  `@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.

- 1cc4da9: T-317 — `subscribe-button` runtime-clip primitive.

  Sealed-platform creator subscribe / follow CTA button serving Cluster G
  presets via Zod discriminated union on `platform`: `'youtube'` (rounded
  YouTube Red `#FF0000` pill with force-uppercase label, Roboto Medium
  500, drop shadow, post-press gray, optional bell glyph), `'tiktok'`
  (TikTok Pink `#FE2C55` rounded pill with optional `'+'` plus glyph,
  outline post-press), `'instagram'` (rounded rectangle with the canonical
  `linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)`
  backdrop, optional `gradient?` override, outlined post-press),
  `'generic'` (brand-neutral pill with theme-slot palette fallback,
  `postPressLabel?`). Three sealed animation phases (`'idle'` entrance
  bounce overshoot 0 → 1.10 → 1.00; `'pressing'` 1.00 → 0.95 → 1.00 dip;
  `'subscribed'` static post-press settled state). Optional `showCursor`
  static cursor glyph at the button's right edge in `'pressing'` phase
  (animated slide-in deferred to T-317b; bell wiggle deferred to T-317a).
  Brand canon dominates theme on branded platforms; theme-slot fallback
  only for `'generic'`. YouTube force-uppercases the label regardless of
  the `casing` prop per D-T317-8. Frame-deterministic — no `Date.now` /
  `Math.random` / `crypto.randomUUID` / `setTimeout` / `setInterval` /
  `requestAnimationFrame`. `fontRequirements` registers Roboto 500 +
  TikTok Sans 700 + Plus Jakarta Sans 700. Theme-slot fallback
  (`background` → `palette.background`, `foreground` →
  `palette.foreground`, `accent` → `palette.accent`). Bridge clip count
  52 → 53. Unblocks T-369 (`youtube-subscribe-bounce`, first Cluster G
  preset) and the broader Cluster G platform-button register.

- 25bb0c0: T-318 — `follow-prompt` runtime-clip primitive.

  Sealed-platform vertical-video right-thumb-zone follow CTA serving
  Cluster G presets via Zod discriminated union on `platform`: `'tiktok'`
  (40 × 40 white circular avatar with TikTok Pink `#FE2C55` "+" badge
  half-overlapping the bottom edge + optional 1–2 character monogram in
  TikTok Sans Bold 700), `'instagram'` (same circular avatar with magenta
  `#DD2A7B` badge + optional canonical
  `linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)` story-
  ring via `showRing: true` + `gradient?` overrides), `'youtube'` (same
  circular avatar with YouTube Red `#FF0000` badge + Roboto Medium 500
  monogram), `'generic'` (brand-neutral circular avatar with
  `avatarColor?` / `badgeColor?` / `avatarTextColor?` theme-slot
  fallback). Three sealed animation phases (`'idle'` default — static
  avatar; `'pulsing'` — bounded sustained-pulse 1.00 → 1.05 → 1.00 over
  `ceil(fps * 1.5)` frames per cycle, `pulseRepeat: 1..10` cycles, with
  optional 30%-alpha expanding pulse-ring; `'followed'` — "+" →
  checkmark `\u{2713}` glyph swap with 1.00 → 1.20 → 1.00 scale-pop on
  the badge over `ceil(fps * 0.3)` frames). Always-present register —
  never enters / exits. Brand canon dominates theme on branded platforms;
  theme-slot fallback only for `'generic'`. Frame-deterministic — no
  `Date.now` / `Math.random` / `crypto.randomUUID` / `setTimeout` /
  `setInterval` / `requestAnimationFrame`. `fontRequirements` registers
  TikTok Sans 700 + Roboto 500 + Plus Jakarta Sans 700. Theme-slot
  fallback (`background` → `palette.background`, `foreground` →
  `palette.foreground`, `accent` → `palette.accent`). Bridge clip count
  53 → 54. Unblocks T-370 (`tiktok-follow-pulse`, primary Cluster G
  consumer) and the broader Cluster G vertical-video follow-CTA register.

- 4d0879c: T-319 — `qr-code-bounce` runtime-clip primitive.

  Single-register Cluster G primitive serving the Coinbase Super Bowl
  DVD-screensaver QR canon: a square QR-code rectangle traversing a
  pure-black canvas with reflective-rebound bounce physics + uniform
  rainbow hue cycling across all dark modules. NO platform / register
  enum (single Zod `object().strict()` schema — QR is platform-
  agnostic), NO font surface (per D-T319-8 — QR has zero text content),
  NO phase enum (always-moving / always-cycling). Required props:
  `qrMatrix` (square 7×7..177×177 array of `'0'`/`'1'` row strings —
  `'1'` = dark module; `.refine()` enforces equal-length rows + square
  shape) and `bounce` (`startPosition: { x, y }` + `startVelocity:
{ vx, vy }` px/frame). Optional: `sizePercent` (5..80, default 22),
  `colorCycle.palette: 'rainbow'` (sealed in v1) + `colorCycle.
cycleFrames` (default `ceil(fps * 7)` — 7 s mid-range of 6–8 s
  canon), `background` (default `'#000000'` zero-brand canon dominates
  theme), `lightModuleColor` (default `'#FFFFFF'`, NOT theme-bound to
  preserve dark-on-light scannability). Closed-form bounce physics:
  `x_t = fold(x0 + vx * t, 2 * (W - rectW))` with reflective edge
  rebounds preserving angle of incidence; integer-pixel positions
  (`Math.round` at final render). Uniform HSL hue rotation:
  `hue(f) = (f % cycleFrames) / cycleFrames * 360`, fixed `s=100%` /
  `l=50%`, integer-channel RGB. Frame-deterministic — no `Date.now` /
  `Math.random` / `crypto.randomUUID` / `setTimeout` / `setInterval` /
  `requestAnimationFrame`. NO SVG instance-IDs in v1. Theme-slot
  fallback (`background` → `palette.background` only). Pre-rendered
  QR matrix in v1 (live URL→matrix encoding deferred to T-319a;
  branded variant with logo overlay T-319b; custom palettes T-319c).
  Bridge clip count 54 → 55. Unblocks T-372 (`coinbase-dvd-qr`,
  primary v1 consumer). With T-319 merged, all three Cluster G
  blocking primitives (T-317 `subscribe-button`, T-318 `follow-
prompt`, T-319 `qr-code-bounce`) are shipped and Cluster G closes.

- 74aece6: T-321a — `grain` runtime-clip primitive.

  First Cluster D atmospheric carve-out from T-321 (`titleSequence` —
  shipped 2026-05-06). Deterministic per-pixel film-grain noise overlay
  computed from `(x, y, frame, seed)` via a closed-form integer hash
  (xxhash32-style mixer using `Math.imul` and `>>>` for bit-exact 32-bit
  arithmetic across V8 versions). Single Zod `object().strict()` schema
  (NO `discriminatedUnion`, NO style/phase enum, NO theme slots, NO font
  surface) with all-optional props (`intensity` ∈ [0, 1] default 0.15,
  `cellSize` int ∈ [1, 16] default 1, `seed` int default 0, `position?:
{ x, y, width, height }` defaults to full canvas at runtime via
  `useVideoConfig().width × .height`; width ≤ 1920 / height ≤ 1080
  sealed bounds). The canonical Stranger Things-grade subtle grain
  renders with zero props.

  Always-animated: each frame's noise field shifts via
  `(x, y, frame, seed)` producing the perceived "moving grain" register;
  no static-mode opt-out in v1. Cell-based blocky noise when
  `cellSize > 1` (cells share one hash byte via floor-divided cell
  coordinates passed to the hash). Per-pixel luminance offset
  `((hash / 255) - 0.5) * 2 * intensity * 255`, applied to all 3 RGB
  channels equally (luminance-only — tinted grain deferred to
  T-321a-tint follow-up). Alpha `= round(intensity * 255)`.

  Renders via a single `<canvas>` element with `useEffect`-driven
  `ImageData` write through `ctx.putImageData(...)` (per D-T321a-5):
  SVG `<feTurbulence>` rejected for cross-CDP determinism hazard
  (turbulence parameters interpreted by the SVG engine, not by
  deterministic JS); per-pixel `<rect>` matrix rejected outright for
  DOM-size cost (~2M elements at 1080p). The `useEffect` is a pure
  function of `(frame, seed, intensity, cellSize, region.width,
region.height)` — no timers, no async, no event listeners; same
  inputs → byte-identical canvas pixel data.

  Frame-deterministic — no `Date.now` / `Math.random` /
  `crypto.randomUUID` / `setTimeout` / `setInterval` / `fetch` /
  `requestAnimationFrame` / `addEventListener`. NO SVG instance-IDs.
  Bridge clip count 56 → 57.

  Composes alongside `titleSequence` at host-html z-stack time per
  D-T321a-1 (separate clipKind, NOT a `TitleSequenceClip` prop —
  sealed at Option A; reusable across Cluster D presets without
  coupling grain logic to titleSequence). Mandatory for T-348
  `stranger-things-benguiat` per its compass canon line 45 ("Optical
  film grain is mandatory; clean digital looks wrong"); reusable
  across T-348, T-351, T-353. Acceptance bar at the consumer-preset
  level is PSNR ≥ 36 dB / SSIM ≥ 0.92 (lower than cluster-norm
  42/0.98 — film grain by definition reduces compression precision per
  D-T321a-12).

  v1 carve-outs: tinted grain — warm/cool color tints (T-321a-tint),
  blue-noise tile / Perlin / simplex noise models (T-321a-noise-
  quality), multi-octave noise (T-321a-octaves), ramped intensity
  (T-321a-ramp). First of five T-321 carve-outs (T-321a `grain` →
  T-321b `lightLeak` → T-321c `particles` → T-321d
  `photographicOverlay` → T-321 `ThreeSceneClip` integration). Sibling
  Cluster D atmospheric primitives ship separately. Cluster-specific
  `intensity` / `cellSize` / `seed` payloads live in `parity-cli`
  resolver shims, not in this primitive.

  T-348 (`stranger-things-benguiat`) requires T-321a + T-321b + T-321c
  shipped before its retry PR can promote (per visual-tokens lines
  25–27 trio). T-351 (`true-detective-double-exposure`) requires
  T-321a + T-321d. T-353 (`severance-surreal-3d`) requires T-321a +
  the ThreeSceneClip integration.

- 8f7dbd4: T-371a — `link-sticker` runtime-clip primitive.

  Single-register Cluster G primitive serving the Instagram-style link-
  sticker canon (`instagram-link-sticker.md`, `clipKind: socialMedia`):
  a rounded-pill (~200 × 44 px native) free-form-positioned link
  sticker on a Story frame with a closed-form linear shimmer / high-
  light sweep across the label glyphs (3 s default cycle). Single Zod
  `object().strict()` schema (NO `discriminatedUnion` — variant-
  specific fields are minimal) with sealed `variant` enum (4 values:
  `'white-on-dark' | 'dark-on-white' | 'frosted-glass' | 'brand-
color'`) and sealed `phase` enum (2 values: `'idle' | 'shimmering'`,
  default `'shimmering'`). Required props: `label` (1–80 chars),
  `variant`, `position: { x, y }` (free-form, no anchor canon).
  Optional: `phase`, `width` (80–600, default 200), `height` (28–96,
  default 44), `fontSize` (10–24, default 14), `brandColor`, `shimmer:
{ cycleFrames, bandWidth, highlightColor }` (defaults `ceil(fps * 3)`
  / 40 / per-variant), per-slot color overrides (`background` /
  `textColor` / `shadowColor`). Closed-form shimmer math: `shimmerX(f)
  = round(((f % cycleFrames) / cycleFrames) \* (pillWidth + bandWidth)
  - bandWidth)`. Per-variant token table: `'white-on-dark'`(black/white/black),`'dark-on-white'`(white/black/grey),`'frosted-
    glass'`(opaque`#CCCCCC`fallback —`backdrop-filter: blur`is not
deterministic across CDP versions, deferred to T-371a-blur),`'brand-color'` (`brandColor`prop or default`#E1306C`Instagram
pink / white / black). Resolution: consumer prop > brand-color
override (when`variant === 'brand-color'`AND`brandColor`set AND`background`unset) > variant default. Frame-deterministic — no`Date.now`/`Math.random`/`crypto.randomUUID`/`setTimeout`/`setInterval`/`requestAnimationFrame`/`fetch`/`addEventListener`. NO SVG instance-IDs in v1 (plain `<div>`rendering). Inter Medium (OFL, T-307) registered as the hard
fallback font; the Instagram proprietary system font is`platform-
    byo`(consumer-wired via`runtime.fonts`). Theme-slot fallback
(`background`→`palette.background`, `textColor`→`palette.foreground`, `shadowColor`→`palette.foreground`). Bridge
clip count 55 → 56. v1 carve-outs: tap-depress to 95 % scale +
link-preview card from bottom (T-371a-followup; reference frame 90
deferred), `backdrop-filter: blur(...)`for`'frosted-glass'`
(T-371a-blur), additional sticker kinds — mention / poll / GIF /
question / slider / music (T-371a-extend), real Instagram-domain
icon SVG (T-371a-glyph). Unblocks T-371 (`instagram-link-sticker`,
Cluster G's last unsigned preset; primary v1 consumer). With
T-371a merged, all four Cluster G blocking primitives (T-317
`subscribe-button`+ T-318`follow-prompt`+ T-319`qr-code-bounce`
  * T-371a `link-sticker`) are shipped; T-371 ships next as the
    consumer preset and Cluster G closes.

- Updated dependencies [019f79c]
- Updated dependencies [3871486]
- Updated dependencies [a248a29]
- Updated dependencies [ec428bb]
- Updated dependencies [844a620]
- Updated dependencies [6cb351f]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/runtimes-contract@0.1.0
  - @stageflip/frame-runtime@1.0.0
  - @stageflip/schema@0.1.0
