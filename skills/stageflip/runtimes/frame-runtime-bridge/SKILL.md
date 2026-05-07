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

**T-183 / T-183z (lower-third primitive)**

| kind | file | notes |
|---|---|---|
| `lower-third` | `src/clips/lower-third.tsx` | Speaker / interview-subject chyron that slides in from the left, holds, and slides out to the right. Required `name`; optional `title` subline. Theme-slot fallback (`accent` → `palette.primary`, `background` → `palette.background`, `textColor` → `palette.foreground`). T-183z added three additive optional axes for cluster-specific cosmetic divergences without changing defaults: `noFlag: boolean` hides the 6 px-wide accent strip on the left edge (unblocks minimalist registers like netflix-doc-lt / apple-tv-lt); `subtitleColor: string` overrides the hard-bound `accent` color on the title subline (used by cnn-classic / bbc-reith-dark / al-jazeera-orange where the talent line's color is independent of the accent); `font: { family, weight? }` overrides the hard-coded `'Plus Jakarta Sans, sans-serif'` family with optional uniform weight (when `weight` absent, the primitive's defaults — 700 for name, 500 for title — are preserved). All three default to existing behavior so parity goldens stay byte-identical for presets that don't pass them. Cluster-specific bindings live in `parity-cli` resolver shims, not in this primitive. |

**T-316 (caption primitive)**

| kind | file | notes |
|---|---|---|
| `caption` | `src/clips/caption.tsx` | word-level timed caption with six built-in visual styles (`hormozi` / `mrbeast` / `tiktok` / `ali-abdaal` / `netflix` / `karaoke-wipe`). Frame-derived word visibility (`(currentTimeMs ∈ [word.startMs, word.endMs))`); per-word entrance stagger anchored on each word's `startMs` minus `i * staggerMs` (5 entrance shapes: `none` / `bounce` / `rise` / `slide-from-top` / `slide-from-bottom`, 12-frame settle); SVG `<text>` with `stroke` + `paint-order: stroke fill` when `strokeWidth > 0` (Hormozi 6 px black / MrBeast 5 px); per-word `<rect>` pill backdrops (TikTok rounded box) or single bounding-box rect (Netflix letterbox); `karaoke-wipe` per-word `<clipPath>` fill driven by within-word ms-progress (`pct = clamp((currentTimeMs - startMs) / (endMs - startMs), 0, 1) * 100`); casing transforms (`as-is` / `uppercase` / `lowercase` / `title-case`); MrBeast cycling highlight via `highlightColor: string[]` (i-th highlighted word picks `colors[i % len]`); theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`, `highlightColor` → `palette.accent`, `muteColor` → `palette.foreground`, `strokeColor` → `palette.background`). `WordTiming[]` is a strict required input (1–200 entries). Unblocks Cluster F captions (T-362 hormozi-montserrat-black / T-363 mrbeast-komika-axis / T-364 tiktok-rounded-box / T-365 ali-abdaal-opacity-karaoke / T-366 netflix-invisible / T-367 karaoke-progressive-wipe) plus Cluster A breaking-news word reveals, Cluster B sports score callouts, and Cluster G CTA word emphasis. Cluster-specific palettes + canned `words[]` live in `parity-cli` resolver shims, not in this primitive. |

**T-322 (lyrics primitive)**

| kind | file | notes |
|---|---|---|
| `lyrics` | `src/clips/lyrics.tsx` | line-level music-synced lyric panel with three style bundles (`'karaoke-wipe'` — left-to-right color front sweeping across the active line driven by per-line ms-progress; `'three-line-stack'` — past dimmed at top / active highlighted in middle / next preview at bottom; `'highlight-current'` — active line only, full-screen). Frame-derived line visibility (`(currentTimeMs ∈ [line.startMs, line.endMs))`); per-line entrance (`'none'` / `'fade'` default / `'rise'`, 12-frame settle anchored on each line's `startMs` frame; rise translates 12 → 0 px); `'karaoke-wipe'` SVG `<clipPath>` fill driven by within-line ms-progress (`pct = clamp((currentTimeMs - startMs) / (endMs - startMs), 0, 1) * 100`) with stable line-index-derived clipPath IDs (`lyrics-line-clip-${i}`); casing transforms (`as-is` / `uppercase` / `lowercase` / `title-case`); optional `glow?: { color, blur }` halo on the active line via SVG `<filter>` with stable filter ID (`lyrics-glow-${i}`); `maxLinesVisible: 1 | 3 | 5` (default `3`; forced to `1` under `'highlight-current'`); `lineGap` controls vertical spacing in the stack; theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`). `lines: { text, startMs, endMs }[]` is a strict required input (1–40 entries; pre-computed beat-aligned line timings — beat detection / audio-track parsing is a host concern, not this primitive). Unblocks T-367 (`karaoke-progressive-wipe`, last Cluster F preset) and reusable for Cluster A music-show graphics + Cluster G social-music presets. Cluster-specific palettes + canned `lines[]` live in `parity-cli` resolver shims, not in this primitive. |

**T-324a (breaking-banner primitive)**

| kind | file | notes |
|---|---|---|
| `breaking-banner` | `src/clips/breaking-banner.tsx` | Single "BREAKING NEWS" register serving CNN-style horizontal slide-in banners (`mode: 'banner'`, default; full-width strip at `insetBottomPx` default `80`) and Fox-style persistent narrow slivers (`mode: 'sliver'`; partial-width via `sliverWidthPct` default `0.30`; `sliverAnchor` default `'top-left'`; sliver mode skips entrance per D-T324a-6 — Fox's canonical posture is a persistent register, not an entrance). `slideAxis: 'horizontal'` (default) mirrors `lower-third`'s X-axis enter/exit translate; `slideAxis: 'vertical'` swaps the same math to translateY (Fox vertical slide). `EASE_OUT_QUART` enter / `EASE_IN_QUART` exit over `ceil(fps * 0.45)` / `ceil(fps * 0.35)` windows. Required: `headline` string + `label: { text, fill, color }` badge (independent of banner background). Optional: `endCap?: { fill, position: 'left' | 'right' }` flag, `background?` (theme `palette.background` fallback), `headlineColor?` (theme `palette.foreground` fallback), `font?: { family, weight }` (default `'Plus Jakarta Sans, sans-serif'` weight 800 — T-183z pattern), `casing?: 'as-is' | 'uppercase' | 'lowercase' | 'title-case'` (applies to headline). Out of v1: LIVE pulse bug (T-324b), red-block-wipe text-change between consecutive headlines (T-324c), Fox searchlight morph (T-327a), return-from-commercial multi-stage sequence (T-327b); ticker strip composes externally via existing `news-ticker-bar` primitive. Unblocks T-324 (cnn-breaking) and T-327 (fox-news-alert). Cluster-specific palettes, labels, headlines live in `parity-cli` resolver shims. |

**T-332a (score-bug primitive)**

| kind | file | notes |
|---|---|---|
| `score-bug` | `src/clips/score-bug.tsx` | Single primitive serving six broadcast-sports score-bug presets across four sealed style bundles dispatched via Zod discriminated union on `style`. `'football'` — horizontal team-vs-team bar (home/away sections with codes + scores + kit-color stripe edges; centered clock + period; optional `centerCircle: true` round backdrop; optional `possession: 'home' \| 'away'` static `filter: brightness(1.12)` boost on the active side; optional `down` row anchored to the possession side; optional `direction: 'left-to-right' \| 'right-to-left'` ASCII chevron flank `<<` / `>>`; optional `backdropGradient: { centerOpacity, edgeOpacity }` SVG `<radialGradient>` with stable id `score-bug-football-gradient`). Serves T-333 PL / T-334 Fox NFL / T-335 NBC SNF. `'racing'` — vertical N-row driver tower (rows 1..24, anchored left or right via `anchor`; per-row leading 4 px team-color stripe via `row.teamColor`; position number; 3-letter driver code; gap delta string verbatim; optional 1..3 sector cells with canonical purple/green/yellow palette enum mapping `'session-best'` → `#6F2E9E` / `'personal-best'` → `#00B54A` / `'slower'` → `#F0C800` / `'neutral'` transparent — palette baked in, NOT themable; optional tire-compound glyph mapping `'soft'` → `#E10600` / `'medium'` → `#F0C800` / `'hard'` → `#FFFFFF` / `'inter'` → `#00B54A` / `'wet'` → `#1E5BC6`; optional `row.highlighted` accent tint). Serves T-332 F1. `'cricket'` — multi-row complex panel anchored top-left/center/right (default `'top-center'`; team line with team-color block + code + runs/wickets + overs always present; optional `runRate` line with optional `requiredRunRate`; optional 0..2 batsmen rows with optional `*` strike marker; optional bowler line with figures; optional partnership line). Serves T-336 cricket-scorebug. `'tennis'` — two-player stack (exactly 2 players via `z.tuple`; per-player surname + always-uppercase country code + optional seed + 1..5 set columns + optional game score + optional active-server dot at `activeServerIndex: 0 \| 1`; anchored top-left/right or bottom-left/right via `anchor`, default `'bottom-left'`). Serves T-337 wimbledon-green-purple. Common base props (`position` required; `background?` / `foreground?` / `accent?` theme-slot fallback; `font?: { family, weight, tabularNums? }` default `'Plus Jakarta Sans, sans-serif'` weight 700; `casing?` JS-string transform applied to non-numeric fields only; tennis country code always uppercase regardless of `casing` per Wimbledon canon; `borderRadius?` default 0; `backdropOpacity?` default 1, applied via `rgba(...)` synthesis on the backdrop fill). `tabularNums` defaults to `true` — emits `font-variant-numeric: tabular-nums` on every numeric text element (mandatory for column alignment per Wimbledon stub line 45 / F1 stub line 51). Frame-deterministic; static layouts in v1 (no per-frame interpolation — animation carve-outs T-332b sector flash / T-332c F1 row-position slide / T-332d universal score pulse / T-334a Fox NFL gradient dynamics / T-335a NBC SNF possession transition / T-336a cricket per-ball flash / T-336b cricket between-overs expand / T-337a Wimbledon match clock / T-337b Wimbledon server-dot transition deferred). Stable internal IDs static / style-derived (`score-bug-football-gradient`); no `crypto.randomUUID()`. Theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`, `accent` → `palette.accent`). Unblocks Cluster B presets T-332 (f1-timing-tower) / T-333 (premier-league-field-of-play) / T-334 (fox-nfl-no-chrome) / T-335 (nbc-snf-possession-illuminated) / T-336 (cricket-scorebug) / T-337 (wimbledon-green-purple). Cluster-specific palettes, fonts, team / driver / batsman / player payloads live in `parity-cli` resolver shims, not in this primitive. |

**T-317 (subscribe-button primitive)**

| kind | file | notes |
|---|---|---|
| `subscribe-button` | `src/clips/subscribe-button.tsx` | Sealed-platform creator subscribe / follow CTA button serving Cluster G presets via Zod discriminated union on `platform`. Four sealed bundles: `'youtube'` (rounded YouTube Red `#FF0000` pill, border-radius 8, white text, force-uppercase label, Roboto Medium 500, drop shadow `0 4 8 rgba(0,0,0,0.20)`; `'subscribed'` flips to gray `#AAAAAA` background + `subscribedLabel` default `'SUBSCRIBED'` + optional bell glyph `\u{1F514}` controlled by `showBell` default `true` — bell-wiggle animation deferred to T-317a). `'tiktok'` (TikTok Pink `#FE2C55` rounded pill, border-radius 8, white text, mixed-case label, TikTok Sans 700; optional `'+'` plus glyph left of label via `showPlus` default `true`; `'subscribed'` flips to outline pill `1px solid #FE2C55` + transparent background + `followingLabel` default `'Following'`). `'instagram'` (rounded rectangle, border-radius 4, canonical gradient `linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)` rendered as inline CSS — no SVG `<linearGradient id>` per D-T317-9; `gradient?: { start, mid, end }` overrides; `'subscribed'` adds `1px solid #FFFFFF` outline over a dimmed gradient + `followingLabel`). `'generic'` (brand-neutral rounded pill, border-radius 8; theme-slot palette fallback drives colors when no explicit `background` / `foreground` passed; `postPressLabel?` consumed in `'subscribed'` phase, defaults to `label`). Three sealed animation phases (`'idle'` default — entrance bounce overshoot via piecewise `interpolate(frame, [0, ceil(fps*0.30), ceil(fps*0.50)], [0, 1.10, 1.00], { easing: cubicBezier(0.34, 1.56, 0.64, 1) })`; `'pressing'` — scale dip 1.00 → 0.95 → 1.00 over `2 * ceil(fps*0.083)` frames; `'subscribed'` — static at scale 1.00). Optional `showCursor: true` renders a static cursor glyph at the button's right edge in `'pressing'` phase (animated cursor slide-in deferred to T-317b). Brand canon dominates theme on `'youtube'` / `'tiktok'` / `'instagram'` (per D-T317-6 — `background?` / `foreground?` props are no-op on branded platforms; `accent?` MAY tint the bell glyph). YouTube force-uppercases the label regardless of the `casing` prop (per D-T317-8). Casing transforms (`as-is` / `uppercase` / `lowercase` / `title-case`) applied via JS string transform (NOT CSS `text-transform`) for parity-golden byte-stability. Frame-deterministic — no `Date.now` / `Math.random` / `crypto.randomUUID` / `setTimeout` / `setInterval` / `requestAnimationFrame`. The "click" is simulated via the `phase` prop driven by the consumer's scene timing (no DOM event handlers per CLAUDE.md §3). `fontRequirements: () => [{ family: 'Roboto', weight: 500 }, { family: 'TikTok Sans', weight: 700 }, { family: 'Plus Jakarta Sans', weight: 700 }]`. Theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`, `accent` → `palette.accent`). Unblocks T-369 (`youtube-subscribe-bounce`, first Cluster G preset) and the broader Cluster G platform-button register. Sibling Cluster G primitives ship separately: T-318 `follow-prompt` (animated face / hand-cursor pointing at a follow badge), T-319 `qr-code-bounce` (DVD-screensaver-bouncing QR rectangle). Cluster-specific palettes, fonts, label payloads live in `parity-cli` resolver shims, not in this primitive. |

**T-318 (follow-prompt primitive)**

| kind | file | notes |
|---|---|---|
| `follow-prompt` | `src/clips/follow-prompt.tsx` | Sealed-platform vertical-video right-thumb-zone follow CTA serving Cluster G presets via Zod discriminated union on `platform`. Four sealed bundles: `'tiktok'` (default 40 × 40 white circular avatar with TikTok Pink `#FE2C55` "+" badge half-overlapping the bottom edge; optional 1–2 character monogram in TikTok Sans Bold 700; `'idle'` static; `'pulsing'` bounded sustained-pulse 1.00 → 1.05 → 1.00 over `ceil(fps*1.5)` frames per cycle with optional 30%-alpha expanding ring; `'followed'` "+" → checkmark `\u{2713}` glyph swap with 1.00 → 1.20 → 1.00 scale-pop on the badge over `ceil(fps*0.3)` frames). `'instagram'` (same circular avatar with magenta `#DD2A7B` badge; optional canonical `linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)` story-ring around the avatar via `showRing: true`; `gradient?: { start, mid, end }` overrides). `'youtube'` (same circular avatar with YouTube Red `#FF0000` badge; Roboto Medium 500 monogram; no story-ring). `'generic'` (brand-neutral circular avatar; `avatarColor?` / `badgeColor?` / `avatarTextColor?` theme-slot fallback drives colors; Plus Jakarta Sans Bold 700). Three sealed animation phases (`'idle'` default — static avatar visible; `'pulsing'` — bounded sustained-pulse driven by `useCurrentFrame()`, `pulseRepeat: 1..10` controls cycle count, scale settles at 1.00 after `cycleFrames * pulseRepeat` frames; `'followed'` — badge-only scale-pop, avatar surface stays at 1.00). Optional 30%-alpha pulse-ring rendered as a concentric `border` `<div>` whose `width` / `height` interpolates from `size` to `size * 1.5` and `opacity` fades from 0.30 → 0 over the same cycle window; suppressed when `showPulseRing: false`. Always-present register — never enters / exits (per `tiktok-follow-pulse.md` "always-present, no entry — the pulse animation is the only attention mechanism"). Brand canon dominates theme on `'tiktok'` / `'instagram'` / `'youtube'` (per D-T318-6 — `badgeColor?` no-op on branded platforms; `avatarColor?` overridable). Frame-deterministic — no `Date.now` / `Math.random` / `crypto.randomUUID` / `setTimeout` / `setInterval` / `requestAnimationFrame`. The "follow" is simulated via the `phase` prop driven by the consumer's scene timing (no DOM event handlers per CLAUDE.md §3). NO casing transform on `avatarText` per D-T318-8 (the monogram convention is canonical and consumer-pre-cased). Inline CSS `linear-gradient` for the Instagram story-ring — no SVG `<linearGradient id>` instance-IDs. `fontRequirements: () => [{ family: 'TikTok Sans', weight: 700 }, { family: 'Roboto', weight: 500 }, { family: 'Plus Jakarta Sans', weight: 700 }]`. Theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`, `accent` → `palette.accent`). Carve-outs: algorithmic toast surface (T-318a; tenant-data-gated, default off), continuous-breathing pulse without bound (T-318b), Instagram story-ring v2 trim (T-318c). Sibling Cluster G primitives: T-317 `subscribe-button` (horizontal pill register; landed), T-319 `qr-code-bounce` (DVD-screensaver-bouncing QR rectangle; ships separately). Unblocks T-370 (`tiktok-follow-pulse`, primary v1 consumer) and the broader Cluster G vertical-video follow-CTA register. Cluster-specific palettes, fonts, monogram payloads live in `parity-cli` resolver shims, not in this primitive. |

**T-319 (qr-code-bounce primitive)**

| kind | file | notes |
|---|---|---|
| `qr-code-bounce` | `src/clips/qr-code-bounce.tsx` | Single-register Cluster G primitive serving the Coinbase Super Bowl DVD-screensaver QR canon — a square QR-code rectangle traversing a pure-black canvas with reflective-rebound bounce physics + uniform rainbow hue cycling on all dark modules. NO platform / register enum (single Zod object schema, `.strict()`); NO font surface (per D-T319-8 — QR has zero text content); NO phase enum (always-moving / always-cycling — per D-T319-6). Required props: `qrMatrix` (square 7×7..177×177 array of `'0'`/`'1'` row strings — `'1'` = dark module; smallest QR-spec version is 21×21 but synthetic 7×7 accepted for tests; largest is version 40 = 177×177; rows.length === rows[0].length enforced via `.refine()`); `bounce` (`startPosition: { x, y }` + `startVelocity: { vx, vy }` — px/frame, sign indicates direction). Optional: `sizePercent` (5..80, default 22 — mid-range of 20–25 % per `coinbase-dvd-qr.md` line 27); `colorCycle.palette: 'rainbow'` (sealed in v1; `'mono'` / `'theme'` / custom palettes deferred to T-319c); `colorCycle.cycleFrames` (default `ceil(fps * 7)` — 7 s mid-range of 6–8 s canon, coprime with most commercial-spot durations to avoid loop-points); `background` (default `'#000000'` — zero-brand canon dominates theme per D-T319-7); `lightModuleColor` (default `'#FFFFFF'` — NOT theme-bound to preserve dark-on-light scannability invariant). **Bounce physics** (per D-T319-4): closed-form fold + mod triangle wave on each axis — `period_x = 2 * (W - rectW)`, naive `x_t = x0 + vx * t`, wrapped into `[0, period_x)`, folded back symmetrically when `wrapped > spanX`. Same for `y`. Integer-pixel positions (`Math.round` applied at the final render step only — float drift in intermediate steps is acceptable). Reflective rebounds preserve angle of incidence; |vx|, |vy| magnitudes preserved across rebounds (signs flipped implicitly via the fold). **Color cycle** (per D-T319-5): uniform HSL hue rotation across all dark modules — `hue(f) = (f % cycleFrames) / cycleFrames * 360`, fixed `s=100%`, `l=50%`, converted to integer-channel RGB via standard HSL→RGB then formatted `#RRGGBB` (uppercase) for byte-stable inline CSS. Light modules render at `lightModuleColor` (skipped per-cell — the rectangle's outer `backgroundColor` covers them). **Rendering**: outer wrapper sized to canvas (`width: 100%, height: 100%`) with `backgroundColor: background`; inner rectangle absolutely positioned at the bounce position with `width = height = round(min(W, H) * sizePercent / 100)` and `backgroundColor: lightModuleColor`; per-cell dark-module `<div>` elements at offset `(col * moduleSize, row * moduleSize)`. Frame-deterministic — no `Date.now` / `Math.random` / `crypto.randomUUID` / `setTimeout` / `setInterval` / `requestAnimationFrame`. NO SVG instance-IDs in v1 (plain `<div>` rendering avoids any `<filter id="...">` / `<linearGradient id="...">` / `<clipPath id="...">`). Theme-slot fallback (`background` → `palette.background` only — `lightModuleColor` intentionally NOT theme-bound per D-T319-7). Pre-rendered QR matrix in v1; live URL→matrix encoding deferred to T-319a; branded variant (logo overlay, corner-rounded modules, brand-tinted palettes) deferred to T-319b; custom palettes (`'mono'`, `'theme'`) deferred to T-319c. Sibling Cluster G primitives: T-317 `subscribe-button` (horizontal pill register; landed), T-318 `follow-prompt` (circular avatar register; landed). Unblocks T-372 (`coinbase-dvd-qr`, primary v1 consumer) — 60-second commercial duration is the canonical use case; PSNR ≥ 38 dB / SSIM ≥ 0.94 acceptance bar (relaxed from cluster-norm 42/0.98 due to motion blur applied downstream by the renderer). With T-319 merged, all three Cluster G blocking primitives are shipped (T-317 + T-318 + T-319) and Cluster G closes. Cluster-specific palettes / pre-rendered matrices live in `parity-cli` resolver shims, not in this primitive. |

**T-321 (title-sequence primitive)**

| kind | file | notes |
|---|---|---|
| `titleSequence` | `src/clips/title-sequence.tsx` | multi-shot prestige-TV title compositor with four sealed style bundles (`'letterform-assemble'` — ALL-CAPS letterforms scaled-to-viewport with per-letter staggered entry; `'plate-and-credits'` — title plate + credits block two-card register; `'palette-jump-cut'` — hard-cut color panels with optional `glyph` foreground (cut-only enforced regardless of shot-level `transitionOut`); `'photographic-overlay'` — typography-only pass over a sister photographic clip). Five shot kinds (`titlePlate` / `letterAnimation` / `creditsBlock` / `colorPanel` / `holdFrame`) discriminated on `kind`; three transition kinds (`'cut'` default / `'fade'` / `'dissolve'`) with single-active + 1-shot overlap during fade / dissolve (`transform: translateX(±2px)` jitter on the outgoing layer for dissolve). Active shot = unique shot whose `[startMs, endMs)` window contains the current ms-time (`(frame / fps) * 1000`); when `transitionOut !== 'cut'` and current time is within the last `transitionDurationMs` of the active window, the next shot also renders simultaneously with progressive opacity. Per-shot entrance (`'none'` / `'fade'` default / `'rise'`, 12-frame settle); `letterAnimation` shots in `'letterform-assemble'` ignore per-shot entrance (per-letter stagger IS the entrance — `letterStartMs = shot.startMs + i * (shot.content.staggerMs ?? 200)`, 400 ms letter fade window, opacity 0 → 1). Viewport-fill letterform sizing (`viewport.height * letterformScale` per letter, default `letterformScale = 0.7`). Stable shot-id-derived IDs (`title-sequence-shot-${shot.id}-letter-${i}`, `title-sequence-glow-${shot.id}`) — no `crypto.randomUUID()`. Optional `glow?: { color, blur }` halo via SVG Gaussian-blur filter applied to the active shot only. Casing transforms (`as-is` / `uppercase` / `lowercase` / `title-case`) at render time. Theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`). `shots[]` is a strict required input (1–16 entries; per-shot ms-windows enforce `startMs < endMs`); `letterAnimation.text` capped at 36 chars; `creditsBlock.lines` 1–12 entries; `colorPanel.color` hex; `colorPanel.glyph` 1–3 chars. Optional `musicCue?: { startMs, bpm? }` passthrough — primitive does NOT audio-decode (host concern). Out of v1: optical film grain (T-321a), light leaks (T-321b), atmospheric dust particles (T-321c), photographic double-exposure (T-321d), curved-text via `<textPath>` (T-321e), 3D rendering (delegated to `ThreeSceneClip` per ADR-005). Unblocks Cluster D presets T-348 (stranger-things-benguiat) / T-349 (got-trajan-clockwork) / T-350 (squid-game-geometric) / T-351 (true-detective-double-exposure) / T-352 (succession-home-video) / T-353 (severance-surreal-3d). Cluster-specific palettes, fonts, shot timings live in `parity-cli` resolver shims, not in this primitive. |

Every demo clip declares a Zod `propsSchema` (auto-inspected by the
editor's `<ZodForm>`) and, where palette-driven, a `themeSlots` map
binding default colour props to `palette.*` roles (T-131a).
`light-leak`, `particles`, `code-block` deliberately ship without
`themeSlots` — film-tone overlay, style-driven palettes, and fixed
editor look respectively.

The barrel `ALL_BRIDGE_CLIPS` is the canonical iterable that the
cdp-host-bundle passes to `createFrameRuntimeBridge`. All 55 bridge
clips are registered through it (32 reference-clip ports across ten
tranches + 10 profile-tier clips for StageFlip.Video and
StageFlip.Display + the 1 unified T-406 chart family + the T-358a
`outcome-row` primitive + the T-356a `news-ticker-bar` primitive + the
T-357a `standings-table` primitive + the T-316 `caption` primitive +
the T-355a `magic-wall-panel` primitive + the T-322 `lyrics` primitive
+ the T-321 `title-sequence` primitive + the T-332a `score-bug`
primitive + the T-317 `subscribe-button` primitive + the T-318
`follow-prompt` primitive + the T-319 `qr-code-bounce` primitive) —
see the tranche ledger below for the breakdown.

## Implementation map

| File | Task | Purpose |
|---|---|---|
| `src/index.ts` | T-061, T-131b.1 | `defineFrameClip` (+ `propsSchema` / `themeSlots` passthrough) + `createFrameRuntimeBridge` + clip re-exports |
| `src/index.test.tsx` | T-061, T-131b.1 | Runtime shape, render behaviour, window gating, props passthrough, schema/themeSlots passthrough |
| `src/clips/*.tsx` | T-131b/d/e/f | Thirty-two reference-clip ports across ten tranches (light / medium / heavy / bridge-eligible lottie-three-shader / audit-driven standalones / bake-tier video+image / audio tranche / dashboard composites f.2a/b/c / financial statement f.3 / animated-map SVG fallback d.4) |
| `src/clips/chart/*.tsx` | T-406 | Unified `chart` clip family — one ClipDefinition consuming `ChartElement`-shaped props, dispatching to seven per-kind renderers (bar / line / area / pie / donut / scatter / combo). See `runtimes/chart/SKILL.md`. |
| `src/clips/index.ts` | T-131b/d/e/f, T-183, T-202, T-316, T-317, T-318, T-319, T-321, T-322, T-324a, T-332a, T-355a, T-356a, T-357a, T-358a, T-406 | Barrel + `ALL_BRIDGE_CLIPS` constant (55 clips: 32 reference-clip ports + 10 StageFlip.Video / StageFlip.Display profile clips + the unified `chart` family + the `outcome-row` primitive + the `news-ticker-bar` primitive + the `standings-table` primitive + the `caption` primitive + the `magic-wall-panel` primitive + the `lyrics` primitive + the `title-sequence` primitive + the `breaking-banner` primitive + the `score-bug` primitive + the `subscribe-button` primitive + the `follow-prompt` primitive + the `qr-code-bounce` primitive) |
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
| Title-sequence primitive | T-321 | title-sequence | Generic multi-shot prestige-TV title compositor with four sealed style bundles (`'letterform-assemble'` ALL-CAPS letterforms scaled-to-viewport with per-letter staggered entry; `'plate-and-credits'` title plate + credits block two-card register; `'palette-jump-cut'` hard-cut color panels with optional `glyph` foreground (cut-only enforced regardless of shot-level `transitionOut`); `'photographic-overlay'` typography-only pass over a sister photographic clip). Five shot kinds (`titlePlate` / `letterAnimation` / `creditsBlock` / `colorPanel` / `holdFrame`); three transition kinds (`'cut'` default / `'fade'` / `'dissolve'`) with single-active + 1-shot overlap during fade / dissolve. Stable shot-id-derived clipPath / filter / per-letter IDs (`title-sequence-shot-${shot.id}-letter-${i}`, `title-sequence-glow-${shot.id}`) — no `crypto.randomUUID()`. Per-shot entrance (`'none'` / `'fade'` default / `'rise'`, 12-frame settle); `letterAnimation` shots in `'letterform-assemble'` ignore per-shot entrance in favor of per-letter stagger (`letterStartMs = shot.startMs + i * (shot.content.staggerMs ?? 200)`, 400 ms letter fade window). Viewport-fill letterform sizing (`viewport.height * letterformScale`, default `letterformScale = 0.7`). Optional `glow?: { color, blur }` halo on the active shot via SVG Gaussian-blur filter. Casing transforms at render time. Theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`). `shots[]` is a strict required input (1–16 entries; per-shot ms-windows enforce `startMs < endMs`). Out of v1: optical film grain (T-321a), light leaks (T-321b), dust particles (T-321c), photographic double-exposure (T-321d), curved text (T-321e), 3D rendering (delegated to `ThreeSceneClip` per ADR-005). Unblocks Cluster D presets T-348..T-353 (stranger-things-benguiat / got-trajan-clockwork / squid-game-geometric / true-detective-double-exposure / succession-home-video / severance-surreal-3d). Cluster-specific palettes, fonts, shot timings live in `parity-cli` resolver shims. |
| Score-bug primitive | T-332a | score-bug | Single primitive serving six broadcast-sports score-bug presets across four sealed style bundles (`'football'` horizontal team-vs-team bar serving T-333 PL / T-334 Fox NFL / T-335 NBC SNF; `'racing'` vertical N-driver tower serving T-332 F1; `'cricket'` multi-row complex panel serving T-336; `'tennis'` two-player stack serving T-337 Wimbledon). Discriminated-union schema on `style`; per-style render functions dispatched from a single `switch (style)` block. Football: home + away team sections + clock/period + optional `centerCircle` / `possession` brightness boost / `down` row / `direction` chevrons / `backdropGradient` SVG `<radialGradient>`. Racing: rows 1..24 with team-color stripe + position + driver code + gap + optional sector cells (canonical purple/green/yellow palette enum, NOT themable) + tire-compound glyphs; anchored left or right via `anchor`. Cricket: team line (always) + optional run-rate line + 0..2 batsmen rows + bowler line + partnership; anchored top-left/center/right (default `'top-center'`). Tennis: exactly 2 players via `z.tuple`; per-player surname + always-uppercase country code + optional seed + 1..5 set columns + game score + optional active-server dot at `activeServerIndex: 0 \| 1`; anchored top-left/right or bottom-left/right (default `'bottom-left'`). Frame-deterministic; static layouts in v1 (animation carve-outs T-332b/c/d, T-334a, T-335a, T-336a/b, T-337a/b deferred). Stable internal IDs static / style-derived (`score-bug-football-gradient`); no `crypto.randomUUID()`. `tabularNums` defaults to `true` (mandatory per Wimbledon stub line 45 / F1 stub line 51 — column alignment). Theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`, `accent` → `palette.accent`). Unblocks Cluster B presets T-332..T-337. Cluster-specific palettes, fonts, team / driver / batsman / player payloads live in `parity-cli` resolver shims, not in this primitive. |
| Caption primitive | T-316 | caption | Generic word-level timed caption with six built-in visual styles (`hormozi` / `mrbeast` / `tiktok` / `ali-abdaal` / `netflix` / `karaoke-wipe`). Frame-derived word visibility (`(currentTimeMs ∈ [word.startMs, word.endMs))`); per-word entrance stagger anchored on each word's `startMs` minus `i * staggerMs` (5 entrance shapes: `none` / `bounce` / `rise` / `slide-from-top` / `slide-from-bottom`, 12-frame settle); SVG `<text>` with `stroke` + `paint-order: stroke fill` when `strokeWidth > 0` (Hormozi 6 px black around yellow / MrBeast 5 px); per-word `<rect>` pill backdrops (TikTok rounded box) or single bounding-box rect (Netflix letterbox); `karaoke-wipe` per-word `<clipPath>` fill driven by within-word ms-progress; casing transforms (`as-is` / `uppercase` / `lowercase` / `title-case`); MrBeast cycling highlight via `highlightColor: string[]` (i-th highlighted word picks `colors[i % len]`); theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`, `highlightColor` → `palette.accent`, `muteColor` → `palette.foreground`, `strokeColor` → `palette.background`). `WordTiming[]` is a strict required input (1–200 entries; no auto-timing — caller supplies explicit `{ text, startMs, endMs, emphasis? }` per word). Unblocks Cluster F captions (T-362..T-367) plus Cluster A breaking-news word reveals, Cluster B sports score callouts, and Cluster G CTA word emphasis. Cluster-specific palettes + canned `words[]` live in `parity-cli` resolver shims, not in this primitive. |
| Subscribe-button primitive | T-317 | subscribe-button | Sealed-platform creator subscribe / follow CTA button serving Cluster G presets via Zod discriminated union on `platform`. Four sealed bundles (`'youtube'` rounded YouTube Red `#FF0000` pill with force-uppercase label + Roboto Medium 500 + drop shadow + post-press gray + optional bell glyph; `'tiktok'` TikTok Pink `#FE2C55` rounded pill + optional `'+'` plus glyph + outline post-press; `'instagram'` rounded rectangle with canonical `linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)` background + `gradient?` override + outlined post-press; `'generic'` brand-neutral pill with theme-slot palette fallback + `postPressLabel?`). Three sealed animation phases (`'idle'` entrance bounce overshoot 0 → 1.10 → 1.00 over `[0, ceil(fps*0.30), ceil(fps*0.50)]` keyframes via `cubicBezier(0.34, 1.56, 0.64, 1)`; `'pressing'` 1.00 → 0.95 → 1.00 dip over `2 * ceil(fps*0.083)` frames; `'subscribed'` static at 1.00). Optional `showCursor` static cursor glyph at button right edge in `'pressing'` phase. Brand canon dominates theme on branded platforms (per D-T317-6 — `background?` / `foreground?` no-op on YouTube / TikTok / Instagram); theme-slot fallback only for `'generic'`. YouTube force-uppercases regardless of `casing` per D-T317-8. Casing applied via JS string transform for parity-golden byte-stability. Frame-deterministic — no `Date.now` / `Math.random` / `crypto.randomUUID` / `setTimeout` / `setInterval` / `requestAnimationFrame`. Carve-outs: bell-glyph wiggle (T-317a), animated cursor slide-in (T-317b), infinite-breathing idle pulse (T-317c). Sibling Cluster G primitives ship separately: T-318 `follow-prompt`, T-319 `qr-code-bounce`. `fontRequirements` registers Roboto 500 + TikTok Sans 700 + Plus Jakarta Sans 700. Theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`, `accent` → `palette.accent`). Unblocks T-369 (`youtube-subscribe-bounce`, first Cluster G preset) and the broader Cluster G platform-button register. Cluster-specific palettes, fonts, label payloads live in `parity-cli` resolver shims, not in this primitive. |
| Follow-prompt primitive | T-318 | follow-prompt | Sealed-platform vertical-video right-thumb-zone follow CTA serving Cluster G presets via Zod discriminated union on `platform`. Four sealed bundles (`'tiktok'` 40 × 40 white circular avatar with TikTok Pink `#FE2C55` "+" badge half-overlapping the bottom edge + optional 1–2 character monogram in TikTok Sans Bold 700; `'instagram'` same circular avatar with magenta `#DD2A7B` badge + optional canonical `linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)` story-ring around the avatar via `showRing: true` + `gradient?: { start, mid, end }` overrides; `'youtube'` same circular avatar with YouTube Red `#FF0000` badge + Roboto Medium 500 monogram; `'generic'` brand-neutral circular avatar with `avatarColor?` / `badgeColor?` / `avatarTextColor?` theme-slot fallback). Three sealed animation phases (`'idle'` default — static avatar visible; `'pulsing'` — bounded sustained-pulse 1.00 → 1.05 → 1.00 over `ceil(fps * 1.5)` frames per cycle (`pulseRepeat: 1..10` cycles, default 1) with optional 30%-alpha expanding pulse-ring concentric `border` `<div>` whose size interpolates from `size` to `size * 1.5` and `opacity` fades 0.30 → 0; settles at scale 1.00 after `cycleFrames * pulseRepeat`; `'followed'` — "+" → checkmark `\u{2713}` glyph swap with 1.00 → 1.20 → 1.00 scale-pop on the badge over `ceil(fps * 0.3)` frames; avatar surface stays at 1.00). Always-present register — never enters / exits. Brand canon dominates theme on `'tiktok'` / `'instagram'` / `'youtube'` (per D-T318-6 — `badgeColor?` no-op on branded platforms; `avatarColor?` overridable). Frame-deterministic — no `Date.now` / `Math.random` / `crypto.randomUUID` / `setTimeout` / `setInterval` / `requestAnimationFrame`. The "follow" is simulated via the `phase` prop (no DOM event handlers). NO casing transform on `avatarText` per D-T318-8. Inline CSS `linear-gradient` for the Instagram story-ring — no SVG `<linearGradient id>` instance-IDs. `fontRequirements` registers TikTok Sans 700 + Roboto 500 + Plus Jakarta Sans 700. Theme-slot fallback (`background` → `palette.background`, `foreground` → `palette.foreground`, `accent` → `palette.accent`). Carve-outs: algorithmic toast surface (T-318a, tenant-data-gated), continuous-breathing pulse without bound (T-318b), Instagram story-ring v2 trim (T-318c). Sibling Cluster G primitives: T-317 `subscribe-button` (horizontal pill register; landed), T-319 `qr-code-bounce`. Unblocks T-370 (`tiktok-follow-pulse`, primary v1 consumer) and the broader Cluster G vertical-video follow-CTA register. Cluster-specific palettes, fonts, monogram payloads live in `parity-cli` resolver shims, not in this primitive. |
| Qr-code-bounce primitive | T-319 | qr-code-bounce | Single-register Cluster G primitive serving the Coinbase Super Bowl DVD-screensaver QR canon — square QR-code rectangle traversing a pure-black canvas with reflective-rebound bounce physics + uniform rainbow hue cycling on all dark modules. NO platform / register enum (single Zod object schema, `.strict()`); NO font surface; NO phase enum (always-moving / always-cycling). Required: `qrMatrix` (square 7×7..177×177 array of `'0'`/`'1'` row strings — `'1'` = dark module; `.refine()` enforces equal-length rows + square shape) + `bounce` (`startPosition: { x, y }` + `startVelocity: { vx, vy }` px/frame). Optional: `sizePercent` (5..80, default 22), `colorCycle.palette: 'rainbow'` (sealed in v1) + `colorCycle.cycleFrames` (default `ceil(fps * 7)`), `background` (default `'#000000'` zero-brand canon), `lightModuleColor` (default `'#FFFFFF'`, NOT theme-bound to preserve dark-on-light scannability). Closed-form bounce physics: `period_x = 2 * (W - rectW)`, `wrapped = ((x0 + vx*t) mod period) wrapped to [0, period)`, `folded = wrapped > spanX ? period - wrapped : wrapped`. Same on y. Integer-pixel positions (`Math.round` at final render). Uniform HSL hue: `hue(f) = (f % cycleFrames) / cycleFrames * 360`, fixed `s=100%`, `l=50%`, converted to integer-channel RGB and formatted `#RRGGBB` (uppercase) for byte-stable inline CSS. Per-module render: `<div>` cells for dark modules only — light modules skipped (rectangle's outer `backgroundColor: lightModuleColor` covers them). Frame-deterministic. NO SVG instance-IDs in v1. Theme-slot fallback (`background` → `palette.background` only). Pre-rendered QR matrix in v1; live URL→matrix encoding T-319a; branded variant T-319b; custom palettes T-319c. Sibling Cluster G primitives: T-317 `subscribe-button`, T-318 `follow-prompt`. Unblocks T-372 (`coinbase-dvd-qr`, primary v1 consumer); 60-second commercial duration is canonical use case; PSNR ≥ 38 dB / SSIM ≥ 0.94 acceptance bar (relaxed from cluster-norm 42/0.98 due to motion blur applied downstream by the renderer). With T-319 merged, all three Cluster G blocking primitives are shipped (T-317 + T-318 + T-319) and Cluster G closes. Cluster-specific palettes / pre-rendered matrices live in `parity-cli` resolver shims, not in this primitive. |

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
