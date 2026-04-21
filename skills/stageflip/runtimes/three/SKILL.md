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

## Related

- Contract types + registry: `runtimes/contract/SKILL.md`
- Determinism rules: `concepts/determinism/SKILL.md`
- Parity fixture seed:
  `packages/testing/fixtures/three-three-product-reveal.json`
- Owning tasks: T-066 (initial), T-067 (fixture), T-068 (this doc).
