---
"@stageflip/runtimes-shader": minor
---

Initial shader runtime (T-065). WebGL fragment shaders as live
ClipRuntime clips, driven from the FrameClock.

Exports:

- `defineShaderClip<P>({ kind, fragmentShader, uniforms?, fontRequirements?, glContextFactory? })` —
  adapts a fragment shader source. The host compiles it against a
  standard fullscreen-quad vertex shader, mounts a `<canvas>`,
  obtains the WebGL context via the (optionally injected) factory,
  and re-draws on every frame change with uniforms computed from
  (progress, timeSec, frame, fps, resolution, props).
- `createShaderRuntime(clips?)` — builds the `ClipRuntime`
  (`id: 'shader'`, `tier: 'live'`). Duplicate kinds throw.
- `validateFragmentShader(source, kind)` — explicit-precision rule
  from the T-065 spec. Throws unless the shader declares
  `precision lowp|mediump|highp float;`; tolerates comments.
- Three demo clips: `flashThroughWhite`, `swirlVortex`, `glitch`.
  All live under `src/clips/**` and are scanned by
  `check-determinism`; motion is parameterised entirely by
  `u_progress` — no Math.random, no wall-clock.

Default uniforms: `u_progress`, `u_time`, `u_resolution`. Override by
passing a `uniforms` callback; it receives
`{ progress, timeSec, frame, fps, resolution, props }`.

Test seam: `glContextFactory` lets tests inject a stub so lifecycle
and draw flow can be asserted without real GPU. Happy-dom has no
WebGL; the host bails silently when the context factory returns
`null`, so real browsers always get the GL path and tests always
get the stubbed one.
