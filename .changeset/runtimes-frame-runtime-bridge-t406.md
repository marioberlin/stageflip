---
"@stageflip/runtimes-frame-runtime-bridge": minor
---

T-406: unified chart clip family in
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

Registered in `ALL_BRIDGE_CLIPS` (32 → 33 clips). Coexists with the
existing standalone T-131b chart clips (`chart-build`,
`pie-chart-build`, `line-chart-draw`); does not replace them
(D-T406-9). Cluster E presets (T-355–T-360) bind to the unified
`chart` clipKind.
