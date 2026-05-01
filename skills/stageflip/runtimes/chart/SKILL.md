---
title: Chart Runtime
id: skills/stageflip/runtimes/chart
tier: runtime
status: placeholder
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

**Status**: placeholder. This file exists so the
`orchestrator/T-406-chart-family-spec` spec PR has a target for
`check-skill-drift` and so future readers can locate the planned
runtime. Substantive content lands in **T-406**. See
`docs/tasks/T-406.md`.

## Planned shape (preview)

T-406 ships a unified `chart` ClipDefinition in
`@stageflip/runtimes-frame-runtime-bridge` that consumes the existing
`ChartElement` schema (`@stageflip/schema/elements/chart.ts`) and
renders all seven chart kinds — `bar`, `line`, `area`, `pie`, `donut`,
`scatter`, `combo` — as frame-deterministic SVG.

This is the chart primitive **Cluster E presets** (T-355–T-360) bind
to, and the chart primitive the **LiveData chart-rendering
follow-up** wires into the LiveDataClip pair (`^liveData-v1` ADR-005
§D1 footnote).

The clip is **frame-deterministic, not interactive** — each rendered
SVG is a pure function of `(frame, props, themeTokens)`. Same frame
number → same pixels. Subject to the broad §3 rule (no `Math.random`,
no `Date.now`, no `performance.now`, no `fetch`, no timers, no rAF).

## Hard rules (planned)

- Renderers are pure functions of `(frame, props, themeTokens)`. Pinned
  by `pnpm check-determinism` (broad §3 rule already covers
  `frame-runtime-bridge/**`) and per-renderer byte-for-byte-equal
  tests across two renders.
- Pure SVG output. No `<canvas>`, no WebGL, no DOM measurements.
- Theme tokens injected via `defineFrameClip`'s `themeSlots`
  mechanism. NO inline hex literals in renderers (grep-pinned test).
- `DataSourceRef` (`^ds:<id>$`) rejected at mount time until T-167
  (data-source-bindings bundle) lands.

## When to reach for it (planned)

- A frame-deterministic chart in a presentation export (MP4 / PPTX /
  PDF). The chart animates in (bars rise / line draws / pie fans)
  then settles to its terminal state.
- A LiveDataClip's `staticFallback` rendering a cached snapshot as a
  chart (the `^liveData-v1` follow-up).
- Cluster E presets that need bar / line / area / pie / donut /
  scatter / combo charts with a unified API.

## When NOT (planned)

- An interactive chart with hover / tooltips / zoom / drilldown. T-406
  is frame-deterministic. Interactive charts would be a separate
  family (e.g., `family: 'interactive-chart'` in the interactive tier).
- The existing 3 standalone preset-target chart clips
  (`chart-build` / `pie-chart-build` / `line-chart-draw`) — they have
  their own props schemas + animation choreography, distinct from
  T-406's unified family. They remain available for presets that
  bind to them directly.
- Charts that animate BETWEEN data states (data updates mid-clip).
  v1 charts are static after entrance animation completes.

## Cross-references (planned)

- T-131b.1 / T-131b.2 — existing 3 standalone chart clips
  (`chart-build` / `pie-chart-build` / `line-chart-draw`). T-406 is
  shape-similar but distinct (consumes `ChartElement` schema, not
  per-clip props).
- T-167 — future data-source-bindings bundle. T-406 defers
  `DataSourceRef` resolution to it.
- T-391 / T-392 (LiveDataClip pair) — the LiveData chart-rendering
  follow-up (a separate post-T-406 task) replaces the JSON-pretty-
  print body TextElement in `defaultLiveDataStaticFallback` with a
  T-406 chart Element when `cachedSnapshot.body` is
  `ChartData`-shaped. Documented in ADR-005 §D1 footnote
  `^liveData-v1`.
- ADR-005 §D1 — the runtime-tier table.
- Cluster E preset skill (T-361, future) — bindings from individual
  Cluster E presets to T-406's unified `chart` clipKind.
