---
"@stageflip/editor-shell": minor
---

T-181b (scoped): headless React primitives for the multi-track timeline.

Builds on T-181's shared math + track layout with opinion-free React
components the video app (T-187) and future modes can compose into
full timeline UIs:

- **`useTimelineScale`** — hook returning a `TimelineScale` from a
  composition fps + base px/sec, with a zoom knob (`setZoom`,
  `zoomBy`, `reset`) clamped to `[minZoom, maxZoom]`. Non-finite
  input is silently rejected so wheel-zoom handlers don't panic on
  deltas that produce NaN.
- **`<TimelineRuler>`** — renders ticks + labels across
  `[0, durationFrames]` using `rulerTickFrames` for sensible
  spacing; accepts `tickFrames` + `formatLabel` overrides.
- **`<TimelineStack>`** — render-prop wrapper that sizes itself to
  the total track-stack height and renders one child per row.
- **`<TrackRow>`** — absolutely-positioned row band, exposes
  `data-track-id/-kind/-index` + CSS custom properties
  (`--sf-tl-row-top`, `--sf-tl-row-height`) for host styling.
- **`<ElementBlock>`** — absolutely-positioned clip block inside a
  row; publishes `data-element-id` + `data-selected` + CSS vars
  (`--sf-tl-block-left`, `--sf-tl-block-width`).

All four components carry zero app-specific CSS — `className` /
`style` / `data-*` / CSS custom properties are the only styling
seams.

Tests: +18 (10 components + 8 hook) on top of T-181's 29 math/layout
tests. 310/310 editor-shell green; slide app unchanged.
