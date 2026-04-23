---
title: Lottie Runtime
id: skills/stageflip/runtimes/lottie
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
  - skills/stageflip/runtimes/shader/SKILL.md
  - skills/stageflip/runtimes/three/SKILL.md
  - skills/stageflip/clips/authoring/SKILL.md
---

# Lottie Runtime

`@stageflip/runtimes-lottie` wraps `lottie-web` 5.x animations as live
clip runtimes. Same seek discipline as the gsap runtime: load with
`autoplay: false`, drive via `goToAndStop(ms, false)` on every frame.

## When to reach for it

- Designer-authored vector animations (After Effects exports via
  Bodymovin).
- Reusing existing Lottie asset libraries.
- Scalable vector motion where SVG is acceptable output.

## When NOT

- Interactive animation that responds to runtime state — Lottie
  animations are playback-only from a static JSON payload.
- Extreme payload sizes — Lottie JSON scales with path complexity;
  a complex illustrated scene can exceed 1 MB.

## Architecture

```ts
import {
  createLottieRuntime,
  defineLottieClip,
  lottieLogo,
} from '@stageflip/runtimes-lottie';
import { registerRuntime } from '@stageflip/runtimes-contract';
import animationData from './my-animation.json';

const myLottie = defineLottieClip({
  kind: 'my-lottie',
  animationData,
});

registerRuntime(createLottieRuntime([lottieLogo, myLottie]));
```

### `defineLottieClip(input)`

- `kind` — globally unique clip identifier.
- `animationData` — raw Lottie JSON. Typically imported from a `.json`
  file; the demo clip inlines the payload for bundle simplicity.
- `fontRequirements?()` — forwarded to T-072 FontManager. Lottie
  animations can embed text — authors should declare fonts here; the
  FontManager walks clips to preload.
- `lottieFactory?()` — test seam overriding the default `lottie-web`
  import. Production consumers omit it. Lazy: fires on first render,
  not at `defineLottieClip` call time; cached afterwards.

### `createLottieRuntime(clips?)`

`ClipRuntime` with `id: 'lottie'`, `tier: 'live'`. Duplicate kinds throw.

### `lottieLogo`

Canonical demo (kind `lottie-logo`). Rounded pink square rotating
360° over 60 frames at 30 fps. Hand-authored Lottie 5.7 payload — tiny,
readable, scanned by `check-determinism`. Seed for T-067 parity fixture
(`lottie-lottie-logo`).

### `lottiePlayer` (T-131d.3)

Prop-driven variant (kind `lottie-player`). Accepts `animationData`
(object or JSON string) at **render time** — hand-rolled
`ClipDefinition` rather than going through `defineLottieClip` (which
bakes data at define time). Reuses `LottieClipHost` so the
determinism posture is identical. URL fetching is intentionally
**not** supported inside the clip — the reference clip's `fetch()`
path violates the determinism scope; deck authors resolve URLs
outside and hand the decoded JSON in. When `animationData` is
absent, renders an animated placeholder (three concentric pulsing
rings derived purely from the clip-local frame).

## Determinism contract

`goToAndStop(ms, false)` is time-based (milliseconds) — seek is
independent of the Lottie JSON's internal `fr`. Composition fps
changes don't require re-authoring payloads.

Host loads with `autoplay: false`; no `.play()` is ever called. No rAF,
no timers.

Clip source under `packages/runtimes/lottie/src/clips/**` is scanned by
`pnpm check-determinism`. Demo's animation data is a plain object
literal; real-world consumers importing `.json` files are also
deterministic input.

## License

`lottie-web` is MIT. No allowlist pairing needed.

## Bundle + size

`lottie-web` is ~200 KB min+gz — the heaviest of the live runtimes
before three.js. Test harness stubs lottie-web via
`vi.mock('lottie-web', () => ({ default: {} }))` because happy-dom's
canvas lacks the `getContext` support that lottie-web's
module-init CanvasFeatureDetect requires.

## Implementation map

| File | Purpose |
|---|---|
| `packages/runtimes/lottie/src/index.ts` | `defineLottieClip`, `createLottieRuntime`, re-export of demo clip |
| `packages/runtimes/lottie/src/host.tsx` | autoplay:false + goToAndStop(ms) host |
| `packages/runtimes/lottie/src/types.ts` | `LottiePlayer` / `LottieAnimationItem` narrow types |
| `packages/runtimes/lottie/src/clips/lottie-logo.ts` | Canonical demo clip |
| `packages/runtimes/lottie/src/clips/lottie-player.tsx` | T-131d.3 — prop-driven Lottie JSON player with animated placeholder fallback |
| `packages/runtimes/lottie/src/clips/lottie-player.test.tsx` | T-131d.3 — schema, placeholder rings, and fake-player host lifecycle |
| `packages/runtimes/lottie/src/index.test.tsx` | Runtime shape, window gating, lifecycle probes via stub |

## Related

- Contract types + registry: `runtimes/contract/SKILL.md`
- Determinism rules: `concepts/determinism/SKILL.md`
- Parity fixture seed:
  `packages/testing/fixtures/lottie-lottie-logo.json`
- Owning tasks: T-064 (initial), T-067 (fixture), T-068 (this doc).
