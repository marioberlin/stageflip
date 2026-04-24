# @stageflip/runtimes-three

## 0.1.0

### Minor Changes

- 8812795: Initial three runtime (T-066). Third seek-based runtime (after gsap,
  lottie). Deliberately THREE-agnostic: the runtime itself doesn't
  import `three`; clip authors bring their own THREE instance inside
  `setup`.

  Exports:

  - `defineThreeClip<P>({ kind, setup, fontRequirements? })` — adapts
    a setup callback that returns
    `{ render({ progress, timeSec, frame, fps, props }), dispose?() }`.
    Window-gated at the clip level; host invokes render on every frame
    change and dispose on unmount.
  - `createThreeRuntime(clips?)` — builds the `ClipRuntime`
    (`id: 'three'`, `tier: 'live'`). Duplicate kinds throw.
  - `threeProductReveal` — canonical demo clip (kind
    `three-product-reveal`). A rotating cube under directional +
    ambient lighting; uses real `three` 0.184.0. Seed for T-067 parity.

  Determinism: host never starts `renderer.setAnimationLoop`; render
  is a synchronous useEffect keyed on (localFrame, fps). Demo clip's
  motion is parameterised by progress alone — no Math.random, no
  Date.now, no requestAnimationFrame. Device-pixel-ratio pinned to 1
  at setup time to keep cross-device rasterisation stable.

  Tests: 14 cases covering runtime shape, window gating, host lifecycle
  (setup once, render per frame, dispose on unmount, Infinity duration,
  silent bail when setup throws). Real WebGL verification deferred to
  the dev harness and T-067 fixtures.

### Patch Changes

- Updated dependencies [019f79c]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [36d0c5d]
  - @stageflip/runtimes-contract@0.1.0
