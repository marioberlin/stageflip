# @stageflip/runtimes-css

## 0.1.0

### Minor Changes

- 8990222: Initial css runtime (T-062) — the simplest concrete ClipRuntime.

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

- 49d4533: T-131a — `defineCssClip` now forwards optional `propsSchema` and
  `themeSlots` onto the produced `ClipDefinition`. Ships
  `gradientBackgroundClip` as a second demonstrator alongside
  `solidBackgroundClip`: a two-stop linear gradient with `from` /
  `to` / `direction` props, a Zod-validated `propsSchema`, and
  `themeSlots` binding `from → palette.primary` and `to → palette.background`.
  Parity fixture `css-gradient-background.json` registered.

### Patch Changes

- Updated dependencies [019f79c]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/runtimes-contract@0.1.0
  - @stageflip/schema@0.1.0
