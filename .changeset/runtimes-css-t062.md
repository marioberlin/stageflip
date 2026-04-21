---
"@stageflip/runtimes-css": minor
---

Initial css runtime (T-062) — the simplest concrete ClipRuntime.

Exports:

- `defineCssClip<P>({ kind, render, fontRequirements? })` — wraps a
  pure `(props) => ReactElement` render function into a
  `ClipDefinition<unknown>`. The produced render gates on the clip
  window internally; outside the window it returns `null`.
- `createCssRuntime(clips?)` — builds the `ClipRuntime`
  (`id: 'css'`, `tier: 'live'`). Duplicate kinds throw.
- `solidBackgroundClip` + `SolidBackgroundProps` — canonical demo
  clip: absolutely-positioned div filling the clip area with a solid
  `color`. Used as the css-runtime fixture seed for T-067 parity.

Clips in this runtime have no frame dependence — the render
signature does not expose `ClipRenderContext`. If you need
frame-driven state, use `@stageflip/runtimes-frame-runtime-bridge`.
