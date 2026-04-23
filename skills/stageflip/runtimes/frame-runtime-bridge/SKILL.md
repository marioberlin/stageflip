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

Every demo clip declares a Zod `propsSchema` (auto-inspected by the
editor's `<ZodForm>`) and, where palette-driven, a `themeSlots` map
binding default colour props to `palette.*` roles (T-131a).
`light-leak`, `particles`, `code-block` deliberately ship without
`themeSlots` — film-tone overlay, style-driven palettes, and fixed
editor look respectively.

The barrel `ALL_BRIDGE_CLIPS` is the canonical iterable that the
cdp-host-bundle passes to `createFrameRuntimeBridge`. All 31 bridge
clips are registered through it — see the tranche ledger below for
the breakdown.

## Implementation map

| File | Task | Purpose |
|---|---|---|
| `src/index.ts` | T-061, T-131b.1 | `defineFrameClip` (+ `propsSchema` / `themeSlots` passthrough) + `createFrameRuntimeBridge` + clip re-exports |
| `src/index.test.tsx` | T-061, T-131b.1 | Runtime shape, render behaviour, window gating, props passthrough, schema/themeSlots passthrough |
| `src/clips/*.tsx` | T-131b/d/e/f | Thirty-one reference-clip ports across ten tranches (light / medium / heavy / bridge-eligible lottie-three-shader / audit-driven standalones / bake-tier video+image / audio tranche / dashboard composites f.2a/b/c / financial statement f.3 / animated-map SVG fallback d.4) |
| `src/clips/index.ts` | T-131b/d/e/f | Barrel + `ALL_BRIDGE_CLIPS` constant (31 clips) |
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
