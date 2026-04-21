---
title: CSS Runtime
id: skills/stageflip/runtimes/css
tier: runtime
status: substantive
last_updated: 2026-04-21
owner_task: T-068
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/frame-runtime/SKILL.md
  - skills/stageflip/runtimes/frame-runtime-bridge/SKILL.md
  - skills/stageflip/runtimes/gsap/SKILL.md
  - skills/stageflip/runtimes/lottie/SKILL.md
  - skills/stageflip/runtimes/shader/SKILL.md
  - skills/stageflip/runtimes/three/SKILL.md
  - skills/stageflip/clips/authoring/SKILL.md
---

# CSS Runtime

`@stageflip/runtimes-css` renders static clips — pure CSS-styled React
elements parameterised only by clip props. The simplest of the concrete
runtimes and a deliberate reference point: everything a runtime needs to
do at minimum is visible here.

## When to reach for it

- Solid fills, static backgrounds, simple text with no animation.
- Frame-independent visuals parameterised by props — colours, gradients,
  border radii, static typography.
- A starting point for a composition: lay down the css background, then
  stack an animated runtime on top.

## When NOT

- Anything that changes over time — use the frame-runtime bridge
  (`useCurrentFrame` + `interpolate`), GSAP, Lottie, shader, or three.
- DOM elements that need to query the clip window locally — the css
  render signature hides `ClipRenderContext` intentionally.

## API

```ts
import {
  createCssRuntime,
  defineCssClip,
  solidBackgroundClip,
} from '@stageflip/runtimes-css';
import { registerRuntime } from '@stageflip/runtimes-contract';

const runtime = createCssRuntime([
  solidBackgroundClip,
  defineCssClip<{ label: string }>({
    kind: 'static-title',
    render: ({ label }) => <h1 style={{ fontSize: 96 }}>{label}</h1>,
  }),
]);

registerRuntime(runtime);
```

### `defineCssClip<P>(input)`

- `kind` — globally unique clip identifier.
- `render(props)` — pure `(P) => ReactElement`. No `ctx`, no frame.
- `fontRequirements?(props)` — forwarded to T-072 FontManager.

The produced `ClipDefinition<unknown>` gates on the clip window internally;
outside `[clipFrom, clipFrom + duration)` it returns `null`.

### `createCssRuntime(clips?)`

Builds a `ClipRuntime` with `id: 'css'`, `tier: 'live'`. Duplicate kinds
throw with `createCssRuntime: duplicate clip kind '...'`.

### `solidBackgroundClip`

Canonical demo — absolutely-positioned `<div>` filling the clip area with
a CSS colour. Props: `{ color: string }`. Used as the T-067 parity fixture
seed (`css-solid-background`).

## Render-signature intent

The css clip render is `(props) => ReactElement`, not
`(ctx) => ReactElement | null`. Window gating lives in the adapter so clip
authors can't forget it. Trade-off: css clips lose access to `frame` /
`fps` / `dimensions`. Correct trade-off: clips that need those should use
the frame-runtime bridge — keeps this runtime single-purpose.

## Invariants

- **I-2 Determinism** — clip source under `packages/runtimes/css/src/clips/**`
  is scanned by `pnpm check-determinism`. No wall-clock APIs, no
  `Math.random`. This runtime makes it trivial to comply because the
  render signature accepts no time input.
- **I-6 No Remotion** — `check-remotion-imports`.

## Bundle + license

- License: runtime package has no external runtime deps; react is
  peer-dep only.
- Bundle: tiny (sub-1 KB own code). No `size-limit` entry required.

## Implementation map

| File | Purpose |
|---|---|
| `packages/runtimes/css/src/index.ts` | `defineCssClip`, `createCssRuntime`, `solidBackgroundClip` |
| `packages/runtimes/css/src/index.test.tsx` | Runtime shape, window gating, static-render assertions, demo clip rendering |

## Related

- Contract types + registry: `runtimes/contract/SKILL.md`
- The frame-runtime bridge for animated clips: `runtimes/frame-runtime/SKILL.md`
- Parity fixture seed: `packages/testing/fixtures/css-solid-background.json`
- Owning tasks: T-062 (initial), T-067 (fixture), T-068 (this doc), T-072
  (FontManager aggregation).
