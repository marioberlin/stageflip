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
- `fragmentShader` — `string | ((props) => string)`. A plain string is
  validated at `defineShaderClip` call time (**must** declare a float
  precision — `precision highp|mediump|lowp float;` — to defeat
  cross-device drift). A **function** is the T-131d.2 user-shader
  escape hatch (`shader-bg`): GLSL is computed per render from props,
  define-time validation is skipped, and `ShaderClipHost` bails
  silently on compile/link failure so a malformed deck prop can't
  crash the rest of the slide. Receives `varying vec2 v_uv;` from the
  host's vertex shader either way.
- `uniforms?(ctx)` — callback returning uniform values keyed by name.
  Default maps to `u_progress`, `u_time`, `u_resolution`. Override to
  supply extra per-frame values (driven by props).
- `fontRequirements?(props)` — forwarded to T-072 FontManager (shader
  clips typically don't need fonts).
- `propsSchema?` / `themeSlots?` — forwarded to the produced
  `ClipDefinition`, mirroring `defineCssClip` (T-131a) and
  `defineFrameClip` (T-131b.1).
- `glContextFactory?(canvas)` — test seam overriding
  `canvas.getContext('webgl2' | 'webgl')`. Production always gets the
  default factory.

### `createShaderRuntime(clips?)`

`ClipRuntime` with `id: 'shader'`, `tier: 'live'`. Duplicate kinds throw.

### Demo clips (all shipped in-runtime)

- `flashThroughWhite` — triangular white pulse at progress=0.5.
- `swirlVortex` — rotating hypnotic bands.
- `glitch` — deterministic hash-noise channel shift + scanline tear.
- `shaderBg` (T-131d.2) — user-shader escape hatch. Props: `glsl`
  (fragment body) + `uniforms` (scalar float map). Identifier-
  filtered uniform names are prepended as `uniform float` decls on
  top of the standard `u_time` / `u_resolution`. Render-time compile
  failure → blank canvas, no throw.

Seeds for four parity fixtures (three T-067 authored shaders + the
T-131d.2 `shader-bg` escape hatch).

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
| `packages/runtimes/shader/src/clips/{flash-through-white,swirl-vortex,glitch}.ts` | Three authored demo shaders (scanned) |
| `packages/runtimes/shader/src/clips/shader-bg.ts` | T-131d.2 user-shader escape hatch — prop-driven fragment body + scalar uniforms |
| `packages/runtimes/shader/src/clips/shader-bg.test.ts` | T-131d.2 — composition, uniforms, and schema coverage |
| `packages/runtimes/shader/src/index.test.tsx` | Shape, gating, validation, GL lifecycle via stub |

## Frontier-tier `ShaderClip` (T-383)

The frame-deterministic shader runtime above is the §3 path. The
**interactive-tier** sibling — `family: 'shader'` per ADR-005 §D1 — wraps
the SAME `ShaderClipHost` so that `liveMount` (browser live-preview,
display-interactive, on-device-player) and `staticFallback`-poster
generation converge on identical pixels by construction (ADR-005 §D2).

```ts
import {
  ShaderClipFactoryBuilder,
  shaderClipFactory,
} from '@stageflip/runtimes-interactive/clips/shader';
import {
  RecordModeFrameSource,
  RAFFrameSource,
  interactiveClipRegistry,
} from '@stageflip/runtimes-interactive';

// Side-effect: importing the subpath registers `shaderClipFactory` against
// `interactiveClipRegistry` for `family: 'shader'`. Re-import throws.

// Live preview drives ticks via rAF.
const fs = new RAFFrameSource();
// Record / parity tests drive ticks deterministically.
const fs2 = new RecordModeFrameSource();
fs2.advance(30); // emit 30 frame ticks in order
```

### Reuse-the-runtime pattern

`ShaderClipFactoryBuilder.build()` produces a `ClipFactory` that mounts
`ShaderClipHost`. The two paths share a single rendering core; convergence
is enforced by AC #18 in T-383 (a unit test renders the same shader at
the same frame via both paths and asserts identical GL call streams,
epsilon = 0). The pattern is replicated by T-384 (`ThreeSceneClip` over
`@stageflip/runtimes-three`).

### `@uniformUpdater` JSDoc tag

T-309's shader sub-rule fires inside `clips/shader/**` AND on any
function carrying the `@uniformUpdater` JSDoc tag. The default updater
ships as `defaultShaderUniforms(frame, ctx)` in
`packages/runtimes/interactive/src/clips/shader/uniforms.ts`:

```ts
/** @uniformUpdater */
export function defaultShaderUniforms(
  frame: number,
  ctx: { fps: number; resolution: readonly [number, number]; props: ShaderClipProps },
): Readonly<Record<string, UniformValue>> {
  return {
    ...ctx.props.initialUniforms,
    uFrame: frame,
    uTime: frame / ctx.fps,
    uResolution: [ctx.resolution[0], ctx.resolution[1]],
  };
}
```

The first parameter is named `frame: number` so the sub-rule's signature
check (D-T309-2) finds it. The body must NOT call `Date.now`,
`performance.now`, `Math.random`, `setTimeout`/`setInterval`, or
`requestAnimationFrame`/`cancelAnimationFrame` — a uniform-updater is
frame-deterministic by construction; reading anything else defeats
ADR-005 §D2 convergence.

### `MountContext.frameSource`

Frame-driven families (`shader`, `three-scene`) consume a `FrameSource`
via `MountContext.frameSource`:

```ts
export interface FrameSource {
  subscribe(handler: (frame: number) => void): () => void;
  current(): number;  // synchronous read for first paint
}
```

Two implementations ship:

- **`RAFFrameSource`** — wraps `requestAnimationFrame` for browser
  live-preview. Lives at `runtimes-interactive/src/frame-source-raf.ts`,
  ABOVE the `clips/shader/**` directory; not subject to the sub-rule's
  path-based check.
- **`RecordModeFrameSource`** — externally-driven via `advance(N)`.
  Used by `renderer-cdp` in record mode and by the convergence test.

A frame-driven family that mounts WITHOUT a `frameSource` throws
`MissingFrameSourceError` — fail-fast surfaces integration bugs at the
caller boundary rather than producing a frozen first paint.

### `componentRef.module` resolution

`InteractiveClip.liveMount.component.module` for a shader clip resolves to:

```
@stageflip/runtimes-interactive/clips/shader#ShaderClip
```

The subpath export points at
`packages/runtimes/interactive/src/clips/shader/index.ts`, whose import
side-effect registers `shaderClipFactory` against `interactiveClipRegistry`.

### Telemetry

The factory emits via `MountContext.emitTelemetry`:

- `shader-clip.mount.start` — attrs: `family`, `fragmentShaderLength`, `width`, `height`.
- `shader-clip.mount.success` — attrs: `family`, `timeToFirstPaintUs` (0 in this directory; renderer-cdp records real timing).
- `shader-clip.mount.failure` — attrs: `family`, `reason: 'compile' | 'link' | 'context-loss' | 'invalid-props'`.
- `shader-clip.dispose` — attrs: `family`.

## Related

- Contract types + registry: `runtimes/contract/SKILL.md`
- Determinism rules: `concepts/determinism/SKILL.md`
- Parity fixture seeds: `packages/testing/fixtures/shader-*.json`
- Frontier-tier sibling: `concepts/runtimes/SKILL.md` §"Interactive runtime tier"
- Owning tasks: T-065 (initial), T-067 (fixtures), T-068 (this doc), T-383 (frontier-tier wrap).
