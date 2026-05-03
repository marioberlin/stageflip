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

### Patch Changes

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
