---
title: Frame Runtime Bridge
id: skills/stageflip/runtimes/frame-runtime-bridge
tier: runtime
status: substantive
last_updated: 2026-04-22
owner_task: T-061
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/frame-runtime/SKILL.md
  - skills/stageflip/runtimes/css/SKILL.md
  - skills/stageflip/runtimes/gsap/SKILL.md
  - skills/stageflip/runtimes/lottie/SKILL.md
  - skills/stageflip/runtimes/shader/SKILL.md
  - skills/stageflip/runtimes/three/SKILL.md
  - skills/stageflip/clips/authoring/SKILL.md
---

# Frame Runtime Bridge

`@stageflip/runtimes-frame-runtime-bridge` adapts
`@stageflip/frame-runtime` to the `ClipRuntime` contract from T-060. It
lets clips written as React components (using `useCurrentFrame`,
`useVideoConfig`, `<Sequence>`, etc.) be addressed uniformly alongside
CSS, GSAP, Lottie, shader, three, and blender runtimes.

The bridge is the **first concrete consumer of the runtime contract**
and the shape every future runtime mirrors.

## API

```ts
import {
  defineFrameClip,
  createFrameRuntimeBridge,
} from '@stageflip/runtimes-frame-runtime-bridge';

// 1. Adapt each frame-runtime component into a ClipDefinition.
const textClip = defineFrameClip<{ label: string }>({
  kind: 'text-fade',
  component: Text,
  fontRequirements: (props) => [{ family: 'Inter' }],
});

// 2. Build the bridge with all your clips.
const bridge = createFrameRuntimeBridge([textClip]);

// 3. Register at app boot. The contract registry is module-level,
//    so one call per boot is enough.
import { registerRuntime } from '@stageflip/runtimes-contract';
registerRuntime(bridge);
```

## Render contract

`defineFrameClip` produces a `ClipDefinition<unknown>` whose `render`
does three things, in order:

1. **Window gate**: compute `localFrame = ctx.frame - ctx.clipFrom`.
   Return `null` if `localFrame < 0` or
   `localFrame >= ctx.clipDurationInFrames`. The dispatcher interprets
   `null` as "clip not mounted this frame" — same semantics as
   `<Sequence>`'s mount gate.
2. **FrameProvider wrap**: mount a `FrameProvider` with
   `frame = localFrame` and a `VideoConfig` that mirrors the
   composition's `width` / `height` / `fps` BUT uses
   `clipDurationInFrames` as `durationInFrames`. Inside the clip,
   `useVideoConfig().durationInFrames` reports the clip's own length,
   not the composition's — consistent with how nested
   `<Sequence>` + `<FrameProvider>` compose in frame-runtime.
3. **Render component**: `createElement(component, ctx.props)` as the
   provider's children.

## Why the bridge exists

Three reasons:

- **Uniform dispatch.** The Phase 4 CDP renderer-core walks the RIR
  and for every clip instance does `findClip(kind).render(ctx)`. The
  bridge is the only reason frame-runtime clips fit in that pipeline
  without a separate code path.
- **Bundle isolation.** A consumer that doesn't use frame-runtime-based
  clips (e.g. a deck assembled entirely from CSS + Lottie) skips
  importing this bridge, which transitively skips the full frame-runtime
  surface (flubber included, via the `/path` sub-entry).
- **Contract shape verification.** Having a live implementation before
  T-062..T-066 means we catch contract gaps early — `FontRequirement`
  flow, prop typing, window-gate responsibility — and lock the contract
  before six concrete runtimes codify any accidents.

## Generic erasure pattern

`defineFrameClip<P>` accepts a typed `ComponentType<P>` and returns
`ClipDefinition<unknown>` — the P generic is erased at the boundary.
This is deliberate: `ClipRuntime.clips` stores all clips uniformly as
`ClipDefinition<unknown>`, and TypeScript covariance on
`React.ComponentType` (via `GetDerivedStateFromProps`) blocks a direct
`ClipDefinition<P>` → `ClipDefinition<unknown>` assignment. A single
`as unknown as ClipDefinition<unknown>` at the return site is the
smallest honest cast; internals still see the `P`-typed props via the
closure.

## Not in scope

- **Zod schema validation** on props. The contract reserves
  `propsSchema` but does not require it; the bridge does not validate.
  Phase 7 (T-169 auto-gen tools) wires a `ZodType<P>` into
  `DefineFrameClipInput` when agent tool dispatch needs it.
- **Clip registration mutation after construction.** The bridge's
  `clips` is a read-only `Map` built once from the `createFrameRuntimeBridge`
  input. Hot-reload / dynamic-plugin scenarios are out of scope for T-061.
- **Server-side rendering.** The bridge renders React elements; if a
  consumer wants to serialize the output, that's a renderer-core
  concern (Phase 4 CDP export).

## Demo clips (T-131b.1+)

The bridge ships demonstrator clips ported from the SlideMotion reference
under `src/clips/`. The first tranche (T-131b.1) includes:

| kind | file | notes |
|---|---|---|
| `counter` | `src/clips/counter.tsx` | 0 → target ramp with ease-out-expo + `tabular-nums` |
| `kinetic-text` | `src/clips/kinetic-text.tsx` | per-word stagger fade + rise |
| `typewriter` | `src/clips/typewriter-clip.tsx` | char-by-char reveal + 16-frame caret blink |
| `logo-intro` | `src/clips/logo-intro.tsx` | fade + scale + accent textShadow glow that crests at fps×1.2 |
| `chart-build` | `src/clips/chart-build.tsx` | bar chart with per-bar 5-frame stagger |

Every demo clip declares a Zod `propsSchema` (auto-inspected by the
editor's `<ZodForm>`) and a `themeSlots` map binding default colour props
to `palette.*` roles (T-131a). The barrel `ALL_BRIDGE_CLIPS` is the
canonical iterable that the cdp-host-bundle passes to
`createFrameRuntimeBridge` — append new tranches there, not at every
call site. Subsequent T-131b sub-tranches (b.2: medium clips; b.3: heavy
clips) extend the same surface.

## Implementation map

| File | Task | Purpose |
|---|---|---|
| `src/index.ts` | T-061, T-131b.1 | `defineFrameClip` (+ `propsSchema` / `themeSlots` passthrough) + `createFrameRuntimeBridge` + clip re-exports |
| `src/index.test.tsx` | T-061, T-131b.1 | Runtime shape, render behaviour, window gating, props passthrough, schema/themeSlots passthrough |
| `src/clips/*.tsx` | T-131b.1 | Five reference-clip ports (counter / kinetic-text / typewriter / logo-intro / chart-build) |
| `src/clips/index.ts` | T-131b.1 | Barrel + `ALL_BRIDGE_CLIPS` constant |

## Related

- Contract types + registry: `runtimes/contract/SKILL.md`
- Underlying React frame engine: `runtimes/frame-runtime/SKILL.md`
- Owning tasks: T-061 (this), T-062..T-066 (concrete runtimes),
  T-072 (FontManager), T-083 (CDP dispatcher consumer), T-131b.1
  (light-tranche reference ports).
