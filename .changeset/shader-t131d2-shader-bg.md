---
'@stageflip/runtimes-shader': minor
---

T-131d.2 — user-shader escape hatch in the shader runtime.

- `defineShaderClip`'s `fragmentShader` field now accepts a function
  `(props: P) => string` in addition to the existing static-string
  form. The function variant skips define-time validation (the source
  is only known per render) and is the mechanism behind the new
  `shader-bg` clip, which takes arbitrary GLSL via props.
- `ShaderClipHost` silent-fallbacks on compile / link failure — a
  malformed deck prop now leaves a blank canvas instead of crashing
  the rest of the slide. Authored clips (`flash-through-white`,
  `swirl-vortex`, `glitch`) are unaffected because their GLSL is
  validated at define time.
- `defineShaderClip` gains `propsSchema` + `themeSlots` passthrough
  (matching the T-125b / T-131a pattern already on `defineCssClip`
  and `defineFrameClip`).
- New demo clip `shaderBg` with `kind: 'shader-bg'`. Header composes
  `precision mediump float;` + `u_time` + `u_resolution` + one
  `uniform float <name>;` per identifier-filtered user-supplied key.

Closes the last open row in the T-131d tier except `d.4` (mapbox).
