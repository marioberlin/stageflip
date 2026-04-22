---
'@stageflip/runtimes-frame-runtime-bridge': minor
'@stageflip/cdp-host-bundle': minor
---

T-131d.1 — bridge-eligible portion of the lottie/three/shader tier.
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
