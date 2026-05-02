---
title: Chart Runtime
id: skills/stageflip/runtimes/chart
tier: runtime
status: substantive
last_updated: 2026-05-01
owner_task: T-406
related:
  - skills/stageflip/runtimes/frame-runtime-bridge/SKILL.md
  - skills/stageflip/runtimes/frame-runtime/SKILL.md
  - skills/stageflip/runtimes/live-data/SKILL.md
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
---

# Chart Runtime

A unified `chart` ClipDefinition in
`@stageflip/runtimes-frame-runtime-bridge` consumes the existing
`ChartElement` schema (`@stageflip/schema/elements/chart.ts`) and
renders all seven chart kinds — `bar`, `line`, `area`, `pie`, `donut`,
`scatter`, `combo` — as frame-deterministic SVG.

This is the chart primitive **Cluster E presets** (T-355–T-360) bind
to, and the chart primitive the **LiveData chart-rendering follow-up**
wires into the LiveDataClip pair (`^liveData-v1` ADR-005 §D1 footnote).

The clip is **frame-deterministic, not interactive** — each rendered
SVG is a pure function of `(frame, props, palette)`. Same frame number
→ same pixels. Subject to the broad §3 rule (no `Math.random`, no
`Date.now`, no `performance.now`, no `fetch`, no timers, no rAF).

## Files

```
packages/runtimes/frame-runtime-bridge/src/clips/chart/
├─ index.tsx       — chartPropsSchema, ChartClip dispatcher, chartClip ClipDefinition
├─ constants.ts    — CANVAS_W/H, PADDING, STAGGER_FRAMES, ENTRANCE_FRACTION,
│                    EASE_OUT_EXPO, DEFAULT_PALETTE, Palette type
├─ axes.tsx        — shared <Axes> renderer (x/y axis lines, gridlines, tick labels)
├─ legend.tsx      — shared <Legend> renderer (one row per series)
├─ bar.tsx         — <BarChart>: rise + fade-in stagger
├─ line.tsx        — <LineChart>: stroke-dasharray draw-on per series
├─ area.tsx        — <AreaChart>: line + filled polygon (fill opacity sweep)
├─ pie.tsx         — <PieChart>: arc-path slices, terminal-angle progress
├─ donut.tsx       — <DonutChart>: pie with inner-radius hole (0.55 default)
├─ scatter.tsx     — <ScatterChart>: <circle> per (series, valueIndex), per-point fade
└─ combo.tsx       — <ComboChart>: series[0] as bars, series[1+] as lines
```

## Public API

### `chartPropsSchema` (Zod)

Strict object — extra keys are rejected.

| Key | Type | Default | Notes |
|---|---|---|---|
| `chartKind` | `'bar' \| 'line' \| 'area' \| 'pie' \| 'donut' \| 'scatter' \| 'combo'` | (required) | from `chartKindSchema` |
| `data` | `ChartData` | (required) | inline only; `DataSourceRef` (`^ds:<id>$`) rejected with a T-167-citing error |
| `legend` | `boolean` | `true` | rendered in the upper-right gutter |
| `axes` | `boolean` | `true` | ignored by `pie` and `donut` (no axes) |

### `chartClip: ClipDefinition`

Registered in `ALL_BRIDGE_CLIPS`. Theme slots:

| Slot | Role | Used by |
|---|---|---|
| `series0` … `series7` | rotating `primary` / `secondary` / `accent` | line/area/scatter strokes; bar/combo bar fills; pie/donut slice fills |
| `axis` | `foreground` | x/y axis lines |
| `gridline` | `surface` | horizontal grid |
| `text` | `foreground` | tick labels + legend text |

Cluster E presets bind to clipKind `chart` and supply
`chartKind`/`data`. They MUST NOT bind to the standalone
`chart-build` / `pie-chart-build` / `line-chart-draw` clips from T-131b
— those have separate props schemas and remain available only for
direct preset-target use cases.

## Per-kind constraints (v1)

- **bar**: single-series-only. Multi-series input renders only
  `series[0]`; subsequent series are silently dropped. Multi-series
  stacked bars are a v2 enhancement; the dual-series case is covered
  by `combo`.
- **pie / donut**: single-series-only by construction (one set of
  slice shares). Subsequent series ignored.
- **line / area / scatter**: multi-series with per-series stagger.
- **combo**: `series[0]` renders as bars, `series[1+]` as draw-on
  lines.

## Animation contract

All seven kinds share one entrance contract:

1. Entrance occupies `[0, floor(ENTRANCE_FRACTION × durationInFrames)]`
   (`ENTRANCE_FRACTION = 0.6`). After this point the chart is settled
   for the remainder of the clip.
2. Per-element stagger of `STAGGER_FRAMES = 5` frames between
   bars / line series / area series / pie slices / scatter points /
   combo bars and combo line series.
3. `buildFrames = max(1, targetEnd − lastStaggerDelay)` so the LAST
   staggered element completes at exactly the settled frame. AC #13.
4. Easing is `EASE_OUT_EXPO` (a `cubicBezier(0.16, 1, 0.3, 1)`); same
   curve for size, opacity, and progress interpolations.

## Hard rules

- Renderers are pure functions of `(frame, props, palette)`. Pinned by
  `pnpm check-determinism` (broad §3 rule covers
  `frame-runtime-bridge/**`) and by determinism tests
  (two renders → identical SVG).
- Pure SVG output. No `<canvas>`, no WebGL, no DOM measurements.
- Theme tokens injected via `defineFrameClip`'s `themeSlots`
  mechanism. NO inline hex literals in renderers — palette colors
  flow from `themeSlots` through `Palette`. Tests-side fixtures may
  use literals.
- `DataSourceRef` (`^ds:<id>$`) rejected at parse time until T-167
  (data-source-bindings bundle) lands. The error message names T-167
  so consumers know where the resolution layer will land.

## When to reach for it

- A frame-deterministic chart in a presentation export (MP4 / PPTX /
  PDF). The chart animates in then settles to its terminal state.
- A LiveDataClip's `staticFallback` rendering a cached snapshot as a
  chart (`^liveData-v1` follow-up — separate post-T-406 task).
- Cluster E presets that need bar / line / area / pie / donut /
  scatter / combo with a unified API.

## When NOT

- An interactive chart with hover / tooltips / zoom / drilldown. The
  `chart` clip is frame-deterministic. Interactive charts would be a
  separate family (e.g., `family: 'interactive-chart'`).
- The existing 3 standalone preset-target chart clips
  (`chart-build` / `pie-chart-build` / `line-chart-draw`) — they have
  their own props schemas + animation choreography, distinct from
  T-406's unified family. They remain available for presets that
  bind to them directly. T-406 ADDS the unified `chart`; it does NOT
  refactor the standalone three (D-T406-9).
- Charts that animate BETWEEN data states (data updates mid-clip).
  v1 charts are static after entrance animation completes.

## Cross-references

- T-131b.1 / T-131b.2 — existing 3 standalone chart clips
  (`chart-build` / `pie-chart-build` / `line-chart-draw`). T-406 is
  shape-similar but distinct.
- T-167 — future data-source-bindings bundle. T-406 defers
  `DataSourceRef` resolution to it.
- T-391 / T-392 (LiveDataClip pair) — the LiveData chart-rendering
  follow-up replaces the JSON-pretty-print body TextElement in
  `defaultLiveDataStaticFallback` with a T-406 chart Element when
  `cachedSnapshot.body` is `ChartData`-shaped. Documented in
  ADR-005 §D1 footnote `^liveData-v1`.
- ADR-005 §D1 — the runtime-tier table.
- Cluster E preset skill (T-361, future) — bindings from individual
  Cluster E presets to T-406's unified `chart` clipKind.
