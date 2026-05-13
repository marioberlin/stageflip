---
'@stageflip/pack-frontier-fx': patch
---

T-532 — Frontier Effects Pack: premium shaders bundle. Fills the
`premium-shaders` placeholder with **5 substantive shader presets**
(aurora-borealis / cosmic-nebula / liquid-metal / fire-portal /
data-stream) binding the existing `ShaderClip` primitive (T-383). Each
preset ships the design spec (palette + uniforms + animation +
register) — GLSL fragment source NOT in the archive; production
deployment ships shader bundles separately via the frontier-runtime
adapter surface. Manifest's `contributes.presets` grows from 4 to 8.
