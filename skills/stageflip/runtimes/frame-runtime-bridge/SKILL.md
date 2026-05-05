---
title: Frame Runtime Bridge
id: skills/stageflip/runtimes/frame-runtime-bridge
tier: runtime
status: substantive
last_updated: 2026-04-23
owner_task: T-061
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/frame-runtime/SKILL.md
  - skills/stageflip/runtimes/css/SKILL.md
  - skills/stageflip/runtimes/gsap/SKILL.md
  - skills/stageflip/runtimes/lottie/SKILL.md
  - skills/stageflip/runtimes/shader/SKILL.md
  - skills/stageflip/runtimes/three/SKILL.md
  - skills/stageflip/clips/authoring/SKILL.md
---

# Frame Runtime Bridge

`@stageflip/runtimes-frame-runtime-bridge` adapts
`@stageflip/frame-runtime` to the `ClipRuntime` contract from T-060. It
lets clips written as React components (using `useCurrentFrame`,
`useVideoConfig`, `<Sequence>`, etc.) be addressed uniformly alongside
CSS, GSAP, Lottie, shader, three, and blender runtimes.

The bridge is the **first concrete consumer of the runtime contract**
and the shape every future runtime mirrors.

## API

```ts
import {
  defineFrameClip,
  createFrameRuntimeBridge,
} from '@stageflip/runtimes-frame-runtime-bridge';

// 1. Adapt each frame-runtime component into a ClipDefinition.
const textClip = defineFrameClip<{ label: string }>({
  kind: 'text-fade',
  component: Text,
  fontRequirements: (props) => [{ family: 'Inter' }],
});

// 2. Build the bridge with all your clips.
const bridge = createFrameRuntimeBridge([textClip]);

// 3. Register at app boot. The contract registry is module-level,
//    so one call per boot is enough.
import { registerRuntime } from '@stageflip/runtimes-contract';
registerRuntime(bridge);
```

## Render contract

`defineFrameClip` produces a `ClipDefinition<unknown>` whose `render`
does three things, in order:

1. **Window gate**: compute `localFrame = ctx.frame - ctx.clipFrom`.
   Return `null` if `localFrame < 0` or
   `localFrame >= ctx.clipDurationInFrames`. The dispatcher interprets
   `null` as "clip not mounted this frame" — same semantics as
   `<Sequence>`'s mount gate.
2. **FrameProvider wrap**: mount a `FrameProvider` with
   `frame = localFrame` and a `VideoConfig` that mirrors the
   composition's `width` / `height` / `fps` BUT uses
   `clipDurationInFrames` as `durationInFrames`. Inside the clip,
   `useVideoConfig().durationInFrames` reports the clip's own length,
   not the composition's — consistent with how nested
   `<Sequence>` + `<FrameProvider>` compose in frame-runtime.
3. **Render component**: `createElement(component, ctx.props)` as the
   provider's children.

## Why the bridge exists

Three reasons:

- **Uniform dispatch.** The Phase 4 CDP renderer-core walks the RIR
  and for every clip instance does `findClip(kind).render(ctx)`. The
  bridge is the only reason frame-runtime clips fit in that pipeline
  without a separate code path.
- **Bundle isolation.** A consumer that doesn't use frame-runtime-based
  clips (e.g. a deck assembled entirely from CSS + Lottie) skips
  importing this bridge, which transitively skips the full frame-runtime
  surface (flubber included, via the `/path` sub-entry).
- **Contract shape verification.** Having a live implementation before
  T-062..T-066 means we catch contract gaps early — `FontRequirement`
  flow, prop typing, window-gate responsibility — and lock the contract
  before six concrete runtimes codify any accidents.

## Generic erasure pattern

`defineFrameClip<P>` accepts a typed `ComponentType<P>` and returns
`ClipDefinition<unknown>` — the P generic is erased at the boundary.
This is deliberate: `ClipRuntime.clips` stores all clips uniformly as
`ClipDefinition<unknown>`, and TypeScript covariance on
`React.ComponentType` (via `GetDerivedStateFromProps`) blocks a direct
`ClipDefinition<P>` → `ClipDefinition<unknown>` assignment. A single
`as unknown as ClipDefinition<unknown>` at the return site is the
smallest honest cast; internals still see the `P`-typed props via the
closure.

## Not in scope

- **Zod schema validation** on props. The contract reserves
  `propsSchema` but does not require it; the bridge does not validate.
  Phase 7 (T-169 auto-gen tools) wires a `ZodType<P>` into
  `DefineFrameClipInput` when agent tool dispatch needs it.
- **Clip registration mutation after construction.** The bridge's
  `clips` is a read-only `Map` built once from the `createFrameRuntimeBridge`
  input. Hot-reload / dynamic-plugin scenarios are out of scope for T-061.
- **Server-side rendering.** The bridge renders React elements; if a
  consumer wants to serialize the output, that's a renderer-core
  concern (Phase 4 CDP export).

## Demo clips (T-131b.1+)

The bridge ships demonstrator clips ported from the SlideMotion reference
under `src/clips/`. Tranches:

**T-131b.1 (light)**

| kind | file | notes |
|---|---|---|
| `counter` | `src/clips/counter.tsx` | 0 → target ramp with ease-out-expo + `tabular-nums` |
| `kinetic-text` | `src/clips/kinetic-text.tsx` | per-word stagger fade + rise |
| `typewriter` | `src/clips/typewriter-clip.tsx` | char-by-char reveal + 16-frame caret blink |
| `logo-intro` | `src/clips/logo-intro.tsx` | fade + scale + accent textShadow glow that crests at fps×1.2 |
| `chart-build` | `src/clips/chart-build.tsx` | bar chart with per-bar 5-frame stagger |

**T-131b.2 (medium)**

| kind | file | notes |
|---|---|---|
| `subtitle-overlay` | `src/clips/subtitle-overlay.tsx` | karaoke-style word-by-word reveal with active/past colouring; supports auto-timed text or explicit `WordTiming[]` |
| `light-leak` | `src/clips/light-leak.tsx` | three blurred radial-gradient blobs animated by seeded sin/cos; off-palette by design (no themeSlots) |
| `pie-chart-build` | `src/clips/pie-chart-build.tsx` | SVG segments revealed via stroke-dasharray; supports filled or donut mode |
| `stock-ticker` | `src/clips/stock-ticker.tsx` | candlestick chart with per-candle stagger reveal; up/down colours stay literal (traffic-light convention) |
| `line-chart-draw` | `src/clips/line-chart-draw.tsx` | SVG path stroke-dashoffset draw + staggered dots + axis labels |

**T-131b.3 (heavy)**

| kind | file | notes |
|---|---|---|
| `animated-value` | `src/clips/animated-value.tsx` | reusable spring count-up primitive; also exports `AnimatedProgressBar` / `AnimatedProgressRing` as non-clip building blocks for dashboard compositions |
| `kpi-grid` | `src/clips/kpi-grid.tsx` | dashboard KPI grid composed of `AnimatedValue` cards with per-card spring stagger + trend ▲/▼ markers |
| `pull-quote` | `src/clips/pull-quote.tsx` | spring-scaled quote mark + typewriter quote body + attribution slide-in |
| `comparison-table` | `src/clips/comparison-table.tsx` | two-column comparison with staggered row reveal — rows slide in from their respective sides |

**T-131d.1 (lottie/three/shader tier — bridge-eligible portion)**

The clips originally tier-labelled "lottie/three/shader" turned out to
be mostly bridge-tier on inspection. These two land here; `shader-bg`
and `lottie-player` shipped in T-131d.2 / T-131d.3 respectively;
`animated-map` shipped in T-131d.4 as an SVG-fallback-only port.

| kind | file | notes |
|---|---|---|
| `scene-3d` | `src/clips/scene-3d.tsx` | CSS-3D transformed cube/sphere/torus/pyramid — no three.js or WebGL despite the name |
| `particles` | `src/clips/particles.tsx` | confetti/sparkles/snow/rain/bokeh driven by a seeded LCG; no `Math.random` |

**T-131d.4 (animated-map — SVG fallback only)**

The reference clip ships a conditional `mapbox-gl` real-tiles branch
that initialises when a `mapboxToken` prop is supplied; the bridge
deliberately does NOT port that branch. Network tile fetches plus
imperative `useEffect` DOM mutation on a canvas element both violate
frame-runtime determinism invariants. The SVG fallback — which the
reference itself renders whenever no token is supplied — is the sole
implementation. Real Mapbox is a future bake-tier question (a separate
`animated-map-real` clip that pre-renders tiles during export), not a
preview-clip concern.

| kind | file | notes |
|---|---|---|
| `animated-map` | `src/clips/animated-map.tsx` | SVG grid + dashed route line + eased camera center/zoom pan + deterministic pulse ring. `style` enum picks one of three hand-tuned palettes (dark / light / satellite); `backgroundColor` / `accentColor` / `textColor` overrides participate in `themeSlots`. `gridColor` overrideable but deliberately NOT a theme slot (hand-tuned tonal shift off the style's background). |

**T-131f.1 (bridge standalones not covered by b.1/b.2/b.3)**

Audit-driven catch-up after T-131c confirmation discovered nine
reference clips outside the b/d/e plans. These four are pure bridge
ports; dashboards (T-131f.2) and the financial-statement composite
(T-131f.3) follow.

| kind | file | notes |
|---|---|---|
| `code-block` | `src/clips/code-block.tsx` | own minimal language tokeniser (typescript/javascript/python/bash/json) + line-by-line stagger; intentionally fixed editor look, no themeSlots |
| `image-gallery` | `src/clips/image-gallery.tsx` | crossfade slideshow with optional captions; last image stays visible past end of cycle |
| `timeline-milestones` | `src/clips/timeline-milestones.tsx` | horizontal axis with sweeping progress dot + per-milestone spring pop; labels alternate above / below for readability |
| `audio-visualizer` | `src/clips/audio-visualizer.tsx` | simulated bar/wave/circular visualization driven by deterministic sin/cos; **no-audio path only** — real-audio reactive variant deferred to T-131f.4 (reference imports Remotion's `<Audio>`) |

**T-358a (outcome-row primitive)**

| kind | file | notes |
|---|---|---|
| `outcome-row` | `src/clips/outcome-row.tsx` | row of N (1–12) color-coded shapes (`circle` default / `square` / `rounded`) with staggered fade-in (`delay = i * 4`, 12-frame ramp); per-chip hex `color` required, theme slots for `defaultFill` / `outlineColor` / `background`. Generic primitive; cluster-specific outcome→color mapping lives in `parity-cli` resolver shims (cricket ball-by-ball, tennis tiebreak, F1 sectors, soccer last-N-shots). |

**T-356a (news-ticker-bar primitive)**

| kind | file | notes |
|---|---|---|
| `news-ticker-bar` | `src/clips/news-ticker-bar.tsx` | horizontal scrolling chyron of N (1–24) symbol+price+delta+▲/▼/▬ chips translating left at `scrollSpeed` px/sec; continuous-loop modulo `rowWidth = entries.length * (chipWidth + chipGap)` via doubled-row marquee; direction-driven up/down/flat colors with theme-slot fallback (`palette.accent` for `upColor` + `downColor` until `ThemePalette` widens to `positive` / `negative`; `palette.foreground` for `flatColor`); configurable `bandHeight` + `bandPosition` (`'top'` / `'bottom'`). Generic primitive; cluster-specific palettes + entry payloads live in `parity-cli` resolver shims (Bloomberg market data, ESPN sports score crawl, CNN breaking-news, crypto dashboards). |

**T-357a (standings-table primitive)**

| kind | file | notes |
|---|---|---|
| `standings-table` | `src/clips/standings-table.tsx` | vertical N-row (1–16) ranked table with K columns (2–8) of mixed kind (`rank` / `label` / `numeric` / `delta` / `total`); per-column hex `color` tinting (medal-style gold / silver / bronze); delta-arrow glyphs (↑ / ↓ / ▬) driven by string enum (`'up'` / `'down'` / `'flat'`) or numeric sign (positive → up, negative → down, zero → flat); frame-derived per-row entrance stagger (fade + slide, `delay = i * staggerMs / (1000 / fps)`, 12-frame ramp, `translateY` `-8 → 0` px); `tabular-nums` on numeric cells (`rank` / `numeric` / `total`); proportional column flex (default 1; override via `column.flex` or fixed `column.width`); theme-slot fallback (`background`/`foreground`/`goldColor`/`silverColor`/`bronzeColor`/`upColor`/`downColor`/`flatColor` — both `upColor` and `downColor` and `goldColor` map to `palette.accent`; `silverColor`/`bronzeColor`/`flatColor` map to `palette.foreground`). Generic primitive; cluster-specific palettes + row payloads live in `parity-cli` resolver shims (Cluster E olympic-medal-tracker, Cluster B F1 / NBA / NCAA / golf leaderboards, Cluster A election results, crypto top-N market-cap dashboards). |

**T-355a (magic-wall-panel primitive)**

| kind | file | notes |
|---|---|---|
| `magic-wall-panel` | `src/clips/magic-wall-panel.tsx` | fullscreen layered hierarchical-data panel of N (1–56) labeled, color-shaded region tiles at absolute-positioned bounds (`{ x, y, width, height }` per region); per-region hex `color` override with theme `foreground` fallback; optional top-of-panel `title` + `subtitle` (subtitle at 70% opacity); `valueFormat` dispatch (`'percent'` → `${value.toFixed(1)}%`, `'count'` → `value.toLocaleString('en-US')`, `'raw'` → `String(value)`) with optional per-region `valueLabel` override (e.g., `'CALLED'` / `'Too Close'`); three entrance modes (`'stagger-rise'` default — fade + 12 px rise / `'fade'` — fade only / `'none'` — instant), per-region delay `delay = i * staggerMs / (1000 / fps)` with 12-frame ramp; `tabular-nums` on numeric-formatted cells (`'percent'` / `'count'` / `'raw'`-numeric). Theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`). Generic primitive; cluster-specific region geometry + palettes live in `parity-cli` resolver shims (Cluster E magic-wall-drilldown, Cluster A msnbc-big-board, Cluster B uefa-starball-refraction, Cluster C twc-* presets, future weather radar / sports brackets / scientific heatmaps). |

**T-316 (caption primitive)**

| kind | file | notes |
|---|---|---|
| `caption` | `src/clips/caption.tsx` | word-level timed caption with six built-in visual styles (`hormozi` / `mrbeast` / `tiktok` / `ali-abdaal` / `netflix` / `karaoke-wipe`). Frame-derived word visibility (`(currentTimeMs ∈ [word.startMs, word.endMs))`); per-word entrance stagger anchored on each word's `startMs` minus `i * staggerMs` (5 entrance shapes: `none` / `bounce` / `rise` / `slide-from-top` / `slide-from-bottom`, 12-frame settle); SVG `<text>` with `stroke` + `paint-order: stroke fill` when `strokeWidth > 0` (Hormozi 6 px black / MrBeast 5 px); per-word `<rect>` pill backdrops (TikTok rounded box) or single bounding-box rect (Netflix letterbox); `karaoke-wipe` per-word `<clipPath>` fill driven by within-word ms-progress (`pct = clamp((currentTimeMs - startMs) / (endMs - startMs), 0, 1) * 100`); casing transforms (`as-is` / `uppercase` / `lowercase` / `title-case`); MrBeast cycling highlight via `highlightColor: string[]` (i-th highlighted word picks `colors[i % len]`); theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`, `highlightColor` → `palette.accent`, `muteColor` → `palette.foreground`, `strokeColor` → `palette.background`). `WordTiming[]` is a strict required input (1–200 entries). Unblocks Cluster F captions (T-362 hormozi-montserrat-black / T-363 mrbeast-komika-axis / T-364 tiktok-rounded-box / T-365 ali-abdaal-opacity-karaoke / T-366 netflix-invisible / T-367 karaoke-progressive-wipe) plus Cluster A breaking-news word reveals, Cluster B sports score callouts, and Cluster G CTA word emphasis. Cluster-specific palettes + canned `words[]` live in `parity-cli` resolver shims, not in this primitive. |

**T-322 (lyrics primitive)**

| kind | file | notes |
|---|---|---|
| `lyrics` | `src/clips/lyrics.tsx` | line-level music-synced lyric panel with three style bundles (`'karaoke-wipe'` — left-to-right color front sweeping across the active line driven by per-line ms-progress; `'three-line-stack'` — past dimmed at top / active highlighted in middle / next preview at bottom; `'highlight-current'` — active line only, full-screen). Frame-derived line visibility (`(currentTimeMs ∈ [line.startMs, line.endMs))`); per-line entrance (`'none'` / `'fade'` default / `'rise'`, 12-frame settle anchored on each line's `startMs` frame; rise translates 12 → 0 px); `'karaoke-wipe'` SVG `<clipPath>` fill driven by within-line ms-progress (`pct = clamp((currentTimeMs - startMs) / (endMs - startMs), 0, 1) * 100`) with stable line-index-derived clipPath IDs (`lyrics-line-clip-${i}`); casing transforms (`as-is` / `uppercase` / `lowercase` / `title-case`); optional `glow?: { color, blur }` halo on the active line via SVG `<filter>` with stable filter ID (`lyrics-glow-${i}`); `maxLinesVisible: 1 | 3 | 5` (default `3`; forced to `1` under `'highlight-current'`); `lineGap` controls vertical spacing in the stack; theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`). `lines: { text, startMs, endMs }[]` is a strict required input (1–40 entries; pre-computed beat-aligned line timings — beat detection / audio-track parsing is a host concern, not this primitive). Unblocks T-367 (`karaoke-progressive-wipe`, last Cluster F preset) and reusable for Cluster A music-show graphics + Cluster G social-music presets. Cluster-specific palettes + canned `lines[]` live in `parity-cli` resolver shims, not in this primitive. |

Every demo clip declares a Zod `propsSchema` (auto-inspected by the
editor's `<ZodForm>`) and, where palette-driven, a `themeSlots` map
binding default colour props to `palette.*` roles (T-131a).
`light-leak`, `particles`, `code-block` deliberately ship without
`themeSlots` — film-tone overlay, style-driven palettes, and fixed
editor look respectively.

The barrel `ALL_BRIDGE_CLIPS` is the canonical iterable that the
cdp-host-bundle passes to `createFrameRuntimeBridge`. All 49 bridge
clips are registered through it (32 reference-clip ports across ten
tranches + 10 profile-tier clips for StageFlip.Video and
StageFlip.Display + the 1 unified T-406 chart family + the T-358a
`outcome-row` primitive + the T-356a `news-ticker-bar` primitive + the
T-357a `standings-table` primitive + the T-316 `caption` primitive +
the T-355a `magic-wall-panel` primitive + the T-322 `lyrics`
primitive) — see the tranche ledger below for the breakdown.

## Implementation map

| File | Task | Purpose |
|---|---|---|
| `src/index.ts` | T-061, T-131b.1 | `defineFrameClip` (+ `propsSchema` / `themeSlots` passthrough) + `createFrameRuntimeBridge` + clip re-exports |
| `src/index.test.tsx` | T-061, T-131b.1 | Runtime shape, render behaviour, window gating, props passthrough, schema/themeSlots passthrough |
| `src/clips/*.tsx` | T-131b/d/e/f | Thirty-two reference-clip ports across ten tranches (light / medium / heavy / bridge-eligible lottie-three-shader / audit-driven standalones / bake-tier video+image / audio tranche / dashboard composites f.2a/b/c / financial statement f.3 / animated-map SVG fallback d.4) |
| `src/clips/chart/*.tsx` | T-406 | Unified `chart` clip family — one ClipDefinition consuming `ChartElement`-shaped props, dispatching to seven per-kind renderers (bar / line / area / pie / donut / scatter / combo). See `runtimes/chart/SKILL.md`. |
| `src/clips/index.ts` | T-131b/d/e/f, T-183, T-202, T-316, T-322, T-355a, T-356a, T-357a, T-358a, T-406 | Barrel + `ALL_BRIDGE_CLIPS` constant (49 clips: 32 reference-clip ports + 10 StageFlip.Video / StageFlip.Display profile clips + the unified `chart` family + the `outcome-row` primitive + the `news-ticker-bar` primitive + the `standings-table` primitive + the `caption` primitive + the `magic-wall-panel` primitive + the `lyrics` primitive) |
| `src/clips/_dashboard-utils.ts` | T-131f.2a | Private shared helpers for the dashboard composites (trend schema, value formatter, colour constants) |

## Tranche ledger

| Tranche | Tasks | Clips added | Notes |
|---|---|---|---|
| Light | T-131b.1 | counter, kinetic-text, typewriter, logo-intro, chart-build | First bridge ports |
| Medium | T-131b.2 | subtitle-overlay, light-leak, pie-chart-build, stock-ticker, line-chart-draw | SVG-heavy |
| Heavy | T-131b.3 | animated-value, kpi-grid, pull-quote, comparison-table | Spring physics + composite primitives |
| Bridge-eligible d | T-131d.1 | scene-3d, particles | Named-tier mismatch; these two don't need the lottie/three/shader runtimes |
| Standalones | T-131f.1 | code-block, image-gallery, timeline-milestones, audio-visualizer | Audit-driven catch-up |
| Bake tier · video/image | T-131e.1 | video-background, gif-player | Preview path via `<FrameVideo>` / `<FrameImage>` from T-131e.0 |
| Bake tier · audio | T-131e.2 | voiceover-narration, audio-visualizer-reactive | `useAudioVisualizer` drives the reactive viz |
| Dashboards · standalones | T-131f.2a, .2b | hr-, marketing-, product-, okr-dashboard | Option B flat-prop schemas; `_dashboard-utils.ts` shared |
| Dashboards · composites | T-131f.2c, .3 | sales-dashboard, financial-statement | Inlined private sub-components |
| Animated map (SVG fallback) | T-131d.4 | animated-map | `mapbox-gl` real-tiles path deliberately not ported — network tile fetches + imperative `useEffect` DOM mutation violate determinism. Ships the SVG simulation only (the reference's own no-token default). Closes reference-clip coverage at 32/32. |
| Unified chart family | T-406 | chart | One ClipDefinition (`kind: 'chart'`) consuming `ChartElement`-shaped props with `chartKind` discriminator. Dispatches to bar / line / area / pie / donut / scatter / combo renderers. NOT a reference-clip port — a new family that Cluster E presets bind to. Coexists with the standalone T-131b chart clips (chart-build / pie-chart-build / line-chart-draw); does not replace them (D-T406-9). See `runtimes/chart/SKILL.md`. |
| Outcome-row primitive | T-358a | outcome-row | Generic row of N (1–12) color-coded chips (circle / square / rounded) with staggered fade-in (`delay = i * 4`, 12-frame ramp). Per-chip hex `color` required; theme slots for `defaultFill` / `outlineColor` / `background`. Unblocks the T-358 cricket ball-by-ball preset and other Cluster B/E scorebug-family presets (tennis tiebreak, F1 sectors, soccer last-N-shots). Cluster-specific outcome→color mapping lives in `parity-cli` resolver shims, not in this primitive. |
| News-ticker-bar primitive | T-356a | news-ticker-bar | Generic horizontal scrolling chyron of N (1–24) symbol+price+delta+▲/▼/▬ chips translating left at `scrollSpeed` px/sec; continuous-loop modulo `rowWidth = entries.length * (chipWidth + chipGap)` via doubled-row marquee. Direction-driven up/down/flat colors with theme-slot fallback (both `upColor` and `downColor` map to `palette.accent` per D-T356a-6 — current `ThemePalette` exposes no `positive` / `negative` roles; widen later if needed; `flatColor` maps to `palette.foreground`); configurable `bandHeight` + `bandPosition` (top / bottom). Unblocks T-356 (Bloomberg market chyron) and Cluster A/B/E ticker presets (CNN/Fox breaking-news, ESPN BottomLine, crypto dashboards). Cluster-specific palettes + entry payloads live in `parity-cli` resolver shims, not in this primitive. |
| Standings-table primitive | T-357a | standings-table | Generic vertical ranked table of N (1–16) rows × K (2–8) columns of mixed kind (`rank` / `label` / `numeric` / `delta` / `total`). Per-column hex `color` (medal-style gold / silver / bronze tinting); delta-arrow glyphs (↑ / ↓ / ▬) driven by string enum (`'up'` / `'down'` / `'flat'`) or numeric sign; frame-derived per-row entrance stagger (fade + slide, `delay = i * staggerMs / (1000 / fps)`, 12-frame ramp, `translateY` `-8 → 0` px). `tabular-nums` on numeric cells (`rank` / `numeric` / `total`) keeps digit columns aligned across the fallback font's proportional digits. Proportional column flex (default 1; per-column `flex` / fixed `width` overrides). Theme-slot fallback per D-T357a-6 (both `upColor` and `downColor` and `goldColor` map to `palette.accent`; `silverColor`/`bronzeColor`/`flatColor` map to `palette.foreground`; `background`/`foreground` to their namesakes). Unblocks T-357 (olympic-medal-tracker) and Cluster A/B/E ranked-list presets (F1 / NBA / NCAA / golf leaderboards, election results, crypto top-N market-cap dashboards). Cluster-specific palettes + row payloads live in `parity-cli` resolver shims, not in this primitive. |
| Magic-wall-panel primitive | T-355a | magic-wall-panel | Generic fullscreen layered hierarchical-data panel of N (1–56) labeled, color-shaded region tiles at absolute-positioned bounds (`{ x, y, width, height }` per region; canvas-pixel coordinates); per-region hex `color` override with theme `foreground` fallback; optional top-of-panel `title` + `subtitle` (subtitle at 70% opacity); `valueFormat` dispatch (`'percent'` → `${value.toFixed(1)}%`, `'count'` → `value.toLocaleString('en-US')`, `'raw'` → `String(value)`) with optional per-region `valueLabel` override (e.g., `'CALLED'`); three entrance modes (`'stagger-rise'` default — fade + 12 px rise / `'fade'` — fade only / `'none'`), per-region delay `delay = i * staggerMs / (1000 / fps)`, 12-frame ramp; `tabular-nums` on numeric-formatted cells. Theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`). v1 ships placeholder rectangles via `region.bounds`; real US state SVG path geometry / county shapes / projection helper / `us-atlas` topology are a v2 follow-up (out of envelope per T-355 D-T355-6). Drilldown / zoom transitions live at runtime composition (ADR-003 §D2), not in the primitive. Unblocks T-355 (magic-wall-drilldown, Cluster E) and the broader Cluster A/B/C/E fullscreen-panel preset shape (msnbc-big-board, uefa-starball-refraction, twc-retrocast-8bit / twc-immersive-mixed-reality, future scientific heatmaps). Cluster-specific region geometry + palettes live in `parity-cli` resolver shims, not in this primitive. |
| Lyrics primitive | T-322 | lyrics | Generic line-level music-synced lyric panel with three style bundles (`'karaoke-wipe'` left-to-right color front sweep across the active line driven by per-line ms-progress; `'three-line-stack'` past dimmed / active highlighted / next preview vertical register; `'highlight-current'` active-only mono-line full-screen). Frame-derived line visibility (`(currentTimeMs ∈ [line.startMs, line.endMs))`); per-line entrance (`'none'` / `'fade'` default / `'rise'`, 12-frame settle anchored on each line's `startMs` frame); stable line-index-derived clipPath IDs (`lyrics-line-clip-${i}`) and filter IDs (`lyrics-glow-${i}`) — no `crypto.randomUUID()`; optional `glow?: { color, blur }` halo via SVG Gaussian-blur filter applied to the active line only; `maxLinesVisible: 1 | 3 | 5` (default `3`; forced to `1` under `'highlight-current'`); `lineGap` (default 80) controls vertical spacing in the stack; casing transforms (`as-is` / `uppercase` / `lowercase` / `title-case`); theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`). `lines: { text, startMs, endMs }[]` is a strict required input (1–40 entries; pre-computed beat-aligned line timings — beat detection / audio-track parsing is a host concern per D-T322-5). Unblocks T-367 (`karaoke-progressive-wipe`, last Cluster F preset, 6/6) and reusable for Cluster A music-show graphics + Cluster G social-music presets. Cluster-specific palettes + canned `lines[]` live in `parity-cli` resolver shims, not in this primitive. |
| Caption primitive | T-316 | caption | Generic word-level timed caption with six built-in visual styles (`hormozi` / `mrbeast` / `tiktok` / `ali-abdaal` / `netflix` / `karaoke-wipe`). Frame-derived word visibility (`(currentTimeMs ∈ [word.startMs, word.endMs))`); per-word entrance stagger anchored on each word's `startMs` minus `i * staggerMs` (5 entrance shapes: `none` / `bounce` / `rise` / `slide-from-top` / `slide-from-bottom`, 12-frame settle); SVG `<text>` with `stroke` + `paint-order: stroke fill` when `strokeWidth > 0` (Hormozi 6 px black around yellow / MrBeast 5 px); per-word `<rect>` pill backdrops (TikTok rounded box) or single bounding-box rect (Netflix letterbox); `karaoke-wipe` per-word `<clipPath>` fill driven by within-word ms-progress; casing transforms (`as-is` / `uppercase` / `lowercase` / `title-case`); MrBeast cycling highlight via `highlightColor: string[]` (i-th highlighted word picks `colors[i % len]`); theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`, `highlightColor` → `palette.accent`, `muteColor` → `palette.foreground`, `strokeColor` → `palette.background`). `WordTiming[]` is a strict required input (1–200 entries; no auto-timing — caller supplies explicit `{ text, startMs, endMs, emphasis? }` per word). Unblocks Cluster F captions (T-362..T-367) plus Cluster A breaking-news word reveals, Cluster B sports score callouts, and Cluster G CTA word emphasis. Cluster-specific palettes + canned `words[]` live in `parity-cli` resolver shims, not in this primitive. |

## Related

- Contract types + registry: `runtimes/contract/SKILL.md`
- Underlying React frame engine: `runtimes/frame-runtime/SKILL.md`
- Owning tasks: T-061 (this), T-062..T-066 (concrete runtimes),
  T-072 (FontManager), T-083 (CDP dispatcher consumer). T-131
  family: b.1/b.2/b.3/d.1/f.1 shipped in Phase 6 mid-3 and mid-4;
  e.0/e.1/e.2/d.2/d.3/f.2a shipped in Phase 6 mid-5; f.2b/f.2c/f.3
  shipped in Phase 6 mid-6; d.4 (`animated-map`, SVG-fallback-only
  port — `mapbox-gl` real-tiles branch deliberately omitted) closes
  reference-clip coverage at 32/32. T-131f.4 folded into e.2 as
  `audio-visualizer-reactive`.
