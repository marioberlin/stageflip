---
title: GSAP Runtime
id: skills/stageflip/runtimes/gsap
tier: runtime
status: substantive
last_updated: 2026-04-21
owner_task: T-068
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
  - skills/stageflip/runtimes/frame-runtime-bridge/SKILL.md
  - skills/stageflip/runtimes/css/SKILL.md
  - skills/stageflip/runtimes/lottie/SKILL.md
  - skills/stageflip/runtimes/shader/SKILL.md
  - skills/stageflip/runtimes/three/SKILL.md
  - skills/stageflip/clips/authoring/SKILL.md
---

# GSAP Runtime

`@stageflip/runtimes-gsap` wraps GSAP 3.x timelines as live clip
runtimes. Seek-driven: timelines are created **paused**, and the host
calls `timeline.seek(localFrame / fps, false)` on every frame change.
The GSAP ticker never advances our animations.

## When to reach for it

- Complex orchestrated motion — stagger, labels, nested timelines,
  ease variants that are tedious to hand-roll.
- Text-centric animation where GSAP's SplitText / MotionPath plugins
  (once wired into the workspace) save a lot of math.
- Parity with existing GSAP-authored assets from legacy projects.

## When NOT

- A simple keyframe with two endpoints — `interpolate` in
  `@stageflip/frame-runtime` is lighter.
- Anything that needs to run in a non-DOM environment — GSAP targets
  DOM elements via `querySelector`.

## Architecture

```ts
import {
  createGsapRuntime,
  defineGsapClip,
  motionTextGsap,
} from '@stageflip/runtimes-gsap';
import { registerRuntime } from '@stageflip/runtimes-contract';

const myClip = defineGsapClip<{ text: string }>({
  kind: 'my-text',
  render: ({ text }) => (
    <span data-tween-me style={{ fontSize: 96 }}>{text}</span>
  ),
  build: (_props, timeline, container) => {
    const target = container.querySelector('[data-tween-me]');
    if (target !== null) {
      timeline.from(target, { y: 60, opacity: 0, duration: 0.6, ease: 'power2.out' });
    }
  },
});

registerRuntime(createGsapRuntime([motionTextGsap, myClip]));
```

### `defineGsapClip<P>(input)`

- `kind` — globally unique clip identifier.
- `render(props)` — returns the clip's DOM (tween targets live in
  the returned subtree; convention is to mark them via
  `data-*` attributes).
- `build(props, timeline, container)` — one-shot configurator.
  Called ONCE per mount with a paused `gsap.core.Timeline` and the
  host's container element. Author adds `.from` / `.to` / `.fromTo`
  tweens here; no `.play()`, no side effects on the timeline after
  build returns.
- `fontRequirements?(props)` — forwarded to T-072 FontManager.

The produced `ClipDefinition<unknown>` gates on the clip window and
mounts a `GsapClipHost` that owns the timeline lifecycle.

### `createGsapRuntime(clips?)`

`ClipRuntime` with `id: 'gsap'`, `tier: 'live'`. Duplicate kinds throw.

### `motionTextGsap`

Canonical demo. Text that slides up and fades in (default) or fades in
only (`entrance: 'fade'`). Duration configurable via `durationSec`
(default 0.6s). Seed for T-067 parity fixture
(`gsap-motion-text-gsap`).

## Determinism contract

The host enforces seek-only semantics — build receives a paused
timeline and there's no way to start it playing through our API
surface. `tl.seek(seconds, false)` is a pure state update.

Clip source under `packages/runtimes/gsap/src/clips/**` is scanned by
`pnpm check-determinism`. Authors: keep `build` pure with respect to
props; don't read `Date.now`, don't call timers, don't introduce
randomness inside tween values. GSAP's own internals are not scanned
(node_modules) but they never run a ticker for timelines we create
paused.

## License

GSAP ships a URL-form npm license rather than an SPDX identifier. The
workspace has a Business Green license procured (see
`docs/dependencies.md` §3 Media / rendering row) AND an allowlist
entry in `scripts/check-licenses.ts` matching that procurement.

**Publish gate follow-up (Phase 10)**: redistributing GSAP through our
npm package needs legal review before `private: false`. See
`docs/dependencies.md` §4 Audit 5 addendum.

## Bundle + size

GSAP is ~60 KB min+gz — consumed by any app that registers this
runtime. No `size-limit` entry on this package yet; future budget
work will add one alongside other non-tiny runtimes.

## Implementation map

| File | Purpose |
|---|---|
| `packages/runtimes/gsap/src/index.ts` | `defineGsapClip`, `createGsapRuntime`, re-export of demo clip |
| `packages/runtimes/gsap/src/host.tsx` | Paused-timeline React host; seek-per-frame |
| `packages/runtimes/gsap/src/clips/motion-text-gsap.tsx` | Canonical demo clip (scanned by check-determinism) |
| `packages/runtimes/gsap/src/index.test.tsx` | Runtime shape, window gating, lifecycle probes |

## Related

- Contract types + registry: `runtimes/contract/SKILL.md`
- Determinism rules + escape hatches: `concepts/determinism/SKILL.md`
- Parity fixture seed:
  `packages/testing/fixtures/gsap-motion-text-gsap.json`
- Owning tasks: T-063 (initial), T-067 (fixture), T-068 (this doc).
