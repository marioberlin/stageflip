---
title: Shader Runtime
id: skills/stageflip/runtimes/shader
tier: runtime
status: substantive
last_updated: 2026-04-21
owner_task: T-068
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
  - skills/stageflip/runtimes/frame-runtime-bridge/SKILL.md
  - skills/stageflip/runtimes/css/SKILL.md
  - skills/stageflip/runtimes/gsap/SKILL.md
  - skills/stageflip/runtimes/lottie/SKILL.md
  - skills/stageflip/runtimes/three/SKILL.md
  - skills/stageflip/clips/authoring/SKILL.md
---

# Shader Runtime

`@stageflip/runtimes-shader` renders GLSL fragment shaders as live clip
runtimes. The host compiles the author's fragment against a standard
fullscreen-quad vertex shader, obtains a WebGL context, and re-draws
every frame with uniforms derived from the FrameClock.

## When to reach for it

- Pixel effects — colour grading, vignettes, scanline / CRT
  simulations, film grain, chromatic aberration, etc.
- Transition wipes — procedural masks driven by `u_progress`.
- Lightweight real-time generative visuals with deterministic motion.

## When NOT

- Anything that needs scene graph / 3D meshes — use the three runtime.
- Simple colour fills — use css.
- Post-processing on existing DOM — shader clips render to their own
  canvas; they can't sample the backing DOM.

## Architecture

```ts
import {
  createShaderRuntime,
  defineShaderClip,
  flashThroughWhite,
  glitch,
  swirlVortex,
} from '@stageflip/runtimes-shader';
import { registerRuntime } from '@stageflip/runtimes-contract';

const ripple = defineShaderClip<{ amplitude: number }>({
  kind: 'ripple',
  fragmentShader: `
    precision highp float;
    varying vec2 v_uv;
    uniform float u_progress;
    uniform float u_amp;
    void main() {
      float wave = sin(v_uv.y * 40.0 + u_progress * 6.283) * u_amp;
      vec3 color = vec3(v_uv.x + wave, v_uv.y, 1.0 - v_uv.x);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  uniforms: ({ progress, props }) => ({
    u_progress: progress,
    u_amp: props.amplitude,
  }),
});

registerRuntime(createShaderRuntime([flashThroughWhite, swirlVortex, glitch, ripple]));
```

### `defineShaderClip<P>(input)`

- `kind` — globally unique clip identifier.
- `fragmentShader` — GLSL source. **Must** declare a float precision
  (`precision highp|mediump|lowp float;`); validated at
  `defineShaderClip` call time. Implicit precision is rejected to
  avoid cross-device drift. Receives `varying vec2 v_uv;` from the
  host's vertex shader.
- `uniforms?(ctx)` — callback returning uniform values keyed by name.
  Default maps to `u_progress`, `u_time`, `u_resolution`. Override to
  supply extra per-frame values (driven by props).
- `fontRequirements?(props)` — forwarded to T-072 FontManager (shader
  clips typically don't need fonts).
- `glContextFactory?(canvas)` — test seam overriding
  `canvas.getContext('webgl2' | 'webgl')`. Production always gets the
  default factory.

### `createShaderRuntime(clips?)`

`ClipRuntime` with `id: 'shader'`, `tier: 'live'`. Duplicate kinds throw.

### Demo clips (all shipped in-runtime)

- `flashThroughWhite` — triangular white pulse at progress=0.5.
- `swirlVortex` — rotating hypnotic bands.
- `glitch` — deterministic hash-noise channel shift + scanline tear.

Seeds for three T-067 parity fixtures.

## Explicit-precision rule

Every fragment shader registered through `defineShaderClip` must
declare an explicit float precision. The check tolerates comments
(`//` and `/* */`) and rejects sources where `precision` only
appears in a comment. Rationale: mobile GPUs default to `mediump`
while desktop GPUs effectively use `highp`; implicit precision drifts
between devices and defeats the parity harness.

The host does NOT prepend a declaration — requiring the author's
declaration keeps the concern visible at review time rather than
buried in runtime wrapping.

## Determinism contract

Render is pure given `(localFrame, fps, clipDurationInFrames, props)`.
Uniforms derive entirely from those. WebGL is used synchronously; no
rAF, no timers. Clip source under `packages/runtimes/shader/src/clips/**`
is scanned by `pnpm check-determinism` — the three shipped demos
generate "randomness" via deterministic hash functions keyed on
`v_uv` + `u_progress`.

For WebGL context creation in happy-dom (which lacks WebGL), the host
bails silently when the factory returns `null`. Real browsers always
get a context.

## Bundle + size

No external animation library — WebGL is browser-native. The runtime
code itself (host + validate + types) is small; shader strings live
as string literals in consumer bundles. No `size-limit` entry yet.

## Implementation map

| File | Purpose |
|---|---|
| `packages/runtimes/shader/src/index.ts` | `defineShaderClip`, `createShaderRuntime`, re-exports |
| `packages/runtimes/shader/src/validate.ts` | `validateFragmentShader` (precision rule) |
| `packages/runtimes/shader/src/host.tsx` | Canvas + WebGL compile / link / draw |
| `packages/runtimes/shader/src/types.ts` | `GlContextFactory`, `UniformsForFrame`, `UniformValue`, default factory |
| `packages/runtimes/shader/src/clips/{flash-through-white,swirl-vortex,glitch}.ts` | Three demo shaders (scanned) |
| `packages/runtimes/shader/src/index.test.tsx` | Shape, gating, validation, GL lifecycle via stub |

## Related

- Contract types + registry: `runtimes/contract/SKILL.md`
- Determinism rules: `concepts/determinism/SKILL.md`
- Parity fixture seeds: `packages/testing/fixtures/shader-*.json`
- Owning tasks: T-065 (initial), T-067 (fixtures), T-068 (this doc).
