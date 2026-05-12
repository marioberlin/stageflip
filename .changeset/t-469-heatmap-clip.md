---
'@stageflip/schema': minor
'@stageflip/runtimes-audience': minor
'@stageflip/app-audience-join': minor
'@stageflip/rir': patch
'@stageflip/export-pptx': patch
---

T-469 — `HeatmapClip` family. Ninth audience-clip variant on disk; the
FIRST marquee differentiator (per ADR-010 §D1 + §D7): spatial input
via tap on an underlying image — a category that Slido / Mentimeter /
Poll Everywhere / Vevox / Wooclap structurally cannot reach.

Voters tap an `(x, y)` coordinate on the underlying image; the server
aggregates `(x, y, intensity)` tuples per tap; the renderer rasterises
the taps into a deterministic Gaussian-kernel heatmap composited as a
`<canvas>` overlay at ~70% opacity above an `<img>` of the underlying
asset.

Schema-side `heatmap` variant ships `{ prompt, imageRef, maxIntensity?
(default 1; bounded 1..20), gridResolution? (default { w: 32, h: 32 };
bounded 1..256 per dim), sessionId? }`. `imageRef` accepts either a
URL or a `cacheKey:`-prefixed reference; strict-format split goes to
a follow-up. `ELEMENT_TYPES` bumped 21 → 22.

Audience runtime ships a new pure helper `rasterizeHeatmap(taps,
gridResolution, canvasWidth, canvasHeight): ImageData` that Gaussian-
splats each tap (σ = 2 cells; iterate ±3σ) into a `Float32Array`
accumulation grid, normalises to `[0..1]`, upsamples to canvas dims
via nearest-neighbour, and colour-maps each pixel through a 4-bucket
piecewise-linear ramp (blue → green → yellow → red) with alpha capped
at 70%. Output bytes are bit-identical given identical input bytes —
the determinism perimeter (CLAUDE.md §3) stays clean.

Static-fallback renders the panel chrome, the underlying `<img>`, a
`<canvas>` overlay whose `useEffect` calls `putImageData` with the
rasteriser output, and the `${n} taps` total label. Idle routing
(zero taps + zero totalTaps) renders a "Waiting for taps…" overlay
above the image.

Voter UI captures normalised `(x, y)` from `event.clientX/Y -
rect.left/top` divided by `rect.width/height`, clamped to `[0, 1]`.
Voters may tap up to `maxIntensity` times before the target disables;
each tap emits `{ kind: 'heatmap', x, y, intensity: 1 }`. Dispatcher
registry bumped 8 → 9.

Cross-package: RIR lowering case for `heatmap` → `runtime: 'audience'`
+ `clipName: 'heatmap'`; PPTX writer fallthrough to the
`LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` loss flag.

§13 verification: option 1 (real-render integration test).
`render-e2e.test.ts` drives the static-fallback with a 4-tap snapshot
(`totalTaps: 11`) and asserts on observable DOM — root `data-state =
"aggregated"`, prompt label, `<img>` with matching `src`, `<canvas>`
with non-zero dimensions + `data-tap-count = 11`, total label "11
taps". The rasteriser's byte-identical determinism is verified
separately in `rasterize.test.ts`. The pixel-bucket assertion (`≥5%
non-transparent pixels`) is gated on `getImageData` availability —
happy-dom's canvas backend doesn't implement it fully; the test
guards with try/catch + skips when unsupported, with rasterize.test.ts
covering the byte-level evidence.

Out of scope: 3D-scene tap (couples to ThreeSceneClip + ray-casting;
punt to a future hardening pass), chart-overlay heatmap (couples to
chart-clip in audience namespace; punt), intensity-buildup animation
(static-fallback renders the final raster only), other clip families
(T-470 / T-471), Cluster I parity fixtures (T-476), native provider
(T-478), vendor adapters (none per ADR-010 §D7).
