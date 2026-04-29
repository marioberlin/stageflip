---
title: Three.js Runtime
id: skills/stageflip/runtimes/three
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
  - skills/stageflip/runtimes/shader/SKILL.md
  - skills/stageflip/clips/authoring/SKILL.md
---

# Three.js Runtime

`@stageflip/runtimes-three` wraps three.js scenes as live clip runtimes.
Seek-driven: authors build a scene + renderer in `setup`, then the host
calls the returned `render(args)` callback on every frame change.
`renderer.setAnimationLoop` is NEVER called.

The runtime itself is **THREE-agnostic** — it does not import `three`.
Authors bring their own THREE instance inside `setup`. Keeps the host
thin; allows alternative three-compatible libraries.

## When to reach for it

- 3D scenes — meshes, lights, cameras, materials.
- GLTF / FBX model reveals for product demos.
- Parallax or depth-backed compositions.
- Post-processing stacks built against three's `EffectComposer`.

## When NOT

- 2D pixel effects — the shader runtime is lighter (one draw call).
- Heavy offline renders that can't meet editor-scrub frame budgets —
  use a `bake` tier runtime (T-089+ scaffolding).

## Architecture

```ts
import * as THREE from 'three';
import {
  createThreeRuntime,
  defineThreeClip,
  threeProductReveal,
} from '@stageflip/runtimes-three';
import { registerRuntime } from '@stageflip/runtimes-contract';

const cube = defineThreeClip<{ color: string }>({
  kind: 'my-cube',
  setup: ({ container, width, height, props }) => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    container.appendChild(renderer.domElement);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: props.color }),
    );
    scene.add(mesh);
    scene.add(new THREE.DirectionalLight(0xffffff, 1.5).position.set(5, 5, 5));
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    return {
      render: ({ progress }) => {
        mesh.rotation.y = progress * Math.PI * 2;
        renderer.render(scene, camera);
      },
      dispose: () => {
        renderer.dispose();
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) mesh.material.dispose();
      },
    };
  },
});

registerRuntime(createThreeRuntime([threeProductReveal, cube]));
```

### `defineThreeClip<P>(input)`

- `kind` — globally unique clip identifier.
- `setup({ container, width, height, props })` — called once per mount.
  Construct scene / camera / renderer, append `renderer.domElement` to
  `container`, return `{ render(args), dispose?() }`.
- `fontRequirements?(props)` — forwarded to T-072 FontManager.

`setup` may throw — the host catches the error and silently no-ops
(WebGL unavailable in test environments; real browsers always
succeed). No recovery is attempted.

### `createThreeRuntime(clips?)`

`ClipRuntime` with `id: 'three'`, `tier: 'live'`. Duplicate kinds throw.

### `threeProductReveal`

Canonical demo (kind `three-product-reveal`). Pink
`MeshStandardMaterial` cube with key + fill `DirectionalLight` plus
`AmbientLight`. Rotation parameterised by `progress` alone — no
Math.random, no Date.now, no `renderer.setAnimationLoop`.
`setPixelRatio(1)` pinned to keep rasterisation deterministic across
devices. Seed for T-067 parity fixture
(`three-three-product-reveal`).

## Determinism contract

- Host never calls `renderer.setAnimationLoop`. Authors: don't call it
  either. Animations must come from the `render` callback's
  `{ progress, timeSec, frame, fps, props }` args.
- Setup is one-shot. Authors: no timers, no random seeds, no
  `Date.now` in setup. Anything that needs to change per frame goes
  inside the render callback.
- Clip source under `packages/runtimes/three/src/clips/**` is scanned
  by `pnpm check-determinism`.
- `setPixelRatio(1)` is the device-normalisation trick — the one
  wall-clock-like number three might otherwise read without asking.
  Authors creating their own clips should pin it.

## License

`three` is MIT. No allowlist pairing needed.

## Bundle + size

`three` is ~150 KB min+gz. The runtime itself (no `import 'three'` in
the host) adds negligible overhead; the cost belongs to any clip that
uses three. No `size-limit` entry yet.

## Implementation map

| File | Purpose |
|---|---|
| `packages/runtimes/three/src/index.ts` | `defineThreeClip`, `createThreeRuntime`, re-exports |
| `packages/runtimes/three/src/host.tsx` | Setup + per-frame render host; silent bail on setup failure |
| `packages/runtimes/three/src/types.ts` | `ThreeClipHandle`, `ThreeClipRenderArgs`, `ThreeClipSetup` |
| `packages/runtimes/three/src/clips/three-product-reveal.ts` | Canonical demo (scanned) |
| `packages/runtimes/three/src/index.test.tsx` | Shape, gating, lifecycle via non-THREE handles |

## Frontier-tier `ThreeSceneClip` (T-384)

The seek-driven three-scene runtime above is the §3 path. The
**interactive-tier** sibling — `family: 'three-scene'` per ADR-005 §D1 —
wraps the SAME `ThreeClipHost` so that `liveMount` (browser live-preview,
display-interactive, on-device-player) and `staticFallback`-poster
generation converge on identical pixels by construction (ADR-005 §D2).

```ts
import {
  ThreeSceneClipFactoryBuilder,
  threeSceneClipFactory,
} from '@stageflip/runtimes-interactive/clips/three-scene';
import {
  RecordModeFrameSource,
  RAFFrameSource,
  interactiveClipRegistry,
} from '@stageflip/runtimes-interactive';

// Side-effect: importing the subpath registers `threeSceneClipFactory`
// against `interactiveClipRegistry` for `family: 'three-scene'`. Re-import
// throws InteractiveClipFamilyAlreadyRegisteredError.
```

### Reuse-the-runtime pattern

`ThreeSceneClipFactoryBuilder.build()` produces a `ClipFactory` that
mounts `ThreeClipHost`. The two paths share a single rendering core;
convergence is pinned by AC #26 (a unit test renders the same scene at
the same frame via both paths and asserts identical scene-call streams,
epsilon = 0). The pattern, first set by T-383 (`ShaderClip` over
`@stageflip/runtimes-shader`) and replicated here, is now STRUCTURAL —
every γ-core family wraps its existing §3 runtime rather than greenfield-
ing a parallel implementation.

### `setupRef` indirection

Three.js scenes are imperative JavaScript and cannot be serialised inline
the way GLSL fragment shaders can. The preset declares a
`<package>#<Symbol>` reference under `setupRef`; the runtime resolves it
at mount time via dynamic `import()` and asserts the resolved value is
a function. This is the first non-React-component use of
`componentRefSchema` (T-305) — `componentRef.module` regex still applies
and constrains the symbol after `#` to PascalCase.

### Seeded PRNG (D-T384-5)

The wrapper supplies authors a deterministic random source. Authors
read it from `props.__prng` inside their setup callback:

```ts
export const MySetup: ThreeClipSetup<{ __prng: SeededPRNG; count: number }> =
  ({ container, width, height, props }) => {
    const { __prng, count } = props;
    // ... use __prng.random() in place of Math.random()
  };
```

`__prng.random()` returns a deterministic float in `[0, 1)`. The same
seed produces the same sequence across runs / nodes / OSes (xorshift32;
pure 32-bit integer arithmetic). `__prng.reset()` returns to the seed-
zero state — useful for replay scenarios (record-mode scrub-back,
convergence comparison runs).

`Math.random()` is forbidden inside `clips/three-scene/**` by T-309's
path-based shader sub-rule (tightened by T-309a). The PRNG is the opt-in
determinism path; authors who skip the seam see their preset rejected at
the `check-determinism` gate.

### rAF shim (D-T384-6) — caveats

The wrapper installs a mount-scoped `requestAnimationFrame` shim that
retargets `window.requestAnimationFrame` to the FrameSource clock. Two
caveats are load-bearing:

1. **Global mutation, LIFO scope.** Multiple concurrent ThreeSceneClip
   mounts STACK their installs; uninstall is reverse-order safe. Out-of-
   order uninstall is detected only structurally — keep dispose paths
   tied to mount lifetimes.
2. **Argument is the FRAME NUMBER, not a `DOMHighResTimeStamp`.**
   Standard rAF passes a wall-clock-like float. The shim passes the
   integer frame index emitted by the FrameSource. Libraries that read
   the argument as wall-clock will misbehave; libraries that REQUIRE
   true wall-clock are incompatible with the interactive tier and
   authors must not bring them in.

The shim file lives under `clips/three-scene/**` and is path-matched by
T-309's tightened sub-rule. The body assigns to
`window.requestAnimationFrame` (assignment is not a call) but does not
INVOKE any forbidden API; sub-rule clean.

### `componentRef.module` resolution

`InteractiveClip.liveMount.component.module` for a three-scene clip
resolves to:

```
@stageflip/runtimes-interactive/clips/three-scene#ThreeSceneClip
```

The subpath export points at
`packages/runtimes/interactive/src/clips/three-scene/index.ts`, whose
import side-effect registers `threeSceneClipFactory` against
`interactiveClipRegistry`.

### Telemetry

The factory emits via `MountContext.emitTelemetry`:

- `three-scene-clip.mount.start` — attrs: `family`, `width`, `height`, `setupRefModule`.
- `three-scene-clip.mount.success` — attrs: `family`.
- `three-scene-clip.mount.failure` — attrs: `family`, `reason: 'setup-throw' | 'setupRef-resolve' | 'invalid-props'`.
- `three-scene-clip.dispose` — attrs: `family`.

## Related

- Contract types + registry: `runtimes/contract/SKILL.md`
- Determinism rules: `concepts/determinism/SKILL.md`
- Parity fixture seed:
  `packages/testing/fixtures/three-three-product-reveal.json`
- Frontier-tier sibling: `runtimes/shader/SKILL.md` §"Frontier-tier ShaderClip"
- Owning tasks: T-066 (initial), T-067 (fixture), T-068 (this doc), T-384 (frontier-tier wrap).
