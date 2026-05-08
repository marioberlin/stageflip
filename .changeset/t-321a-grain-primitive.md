---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-321a — `grain` runtime-clip primitive.

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
