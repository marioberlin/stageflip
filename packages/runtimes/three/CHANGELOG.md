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

- 6cfbb4c: T-384: `ThreeSceneClip` frontier-tier primitive — second γ-core dispatch.

  `@stageflip/runtimes-interactive`:
  - New subpath export `@stageflip/runtimes-interactive/clips/three-scene`.
    The module's import side-effect registers `threeSceneClipFactory`
    against `interactiveClipRegistry` for `family: 'three-scene'`. Re-
    importing throws `InteractiveClipFamilyAlreadyRegisteredError`.
  - `ThreeSceneClipFactoryBuilder.build({ importer?, fps?, clipDurationInFrames? })`
    produces a `ClipFactory`. The factory wraps `ThreeClipHost` from
    `@stageflip/runtimes-three` (D-T384-1: reuse-the-runtime pattern set by
    T-383, now structural for every γ-core family) so `liveMount` and
    `staticFallback` poster generation share a single rendering core
    (ADR-005 §D2 convergence-by-construction).
  - New `createSeededPRNG(seed)` (xorshift32). The wrapper hands the PRNG
    to the author setup callback as `setup({ container, width, height,
props, prng })` — `prng` is a top-level field on `ThreeClipSetupArgs`
    (additive, optional in `@stageflip/runtimes-three`'s public type), not
    smuggled through `props`. Authors have a byte-identical-across-runs
    substitute for `Math.random()` (which is forbidden in
    `clips/three-scene/**` by T-309's path-based shader sub-rule, tightened
    by T-309a).
  - New `installRAFShim(frameSource)` — mount-scoped
    `requestAnimationFrame` shim that retargets all in-mount rAF traffic
    to the FrameSource clock (per ADR-005 §D2). Caveats documented in the
    file header: global mutation with LIFO stack discipline, frame-number
    argument (not `DOMHighResTimeStamp`).
  - New `resolveSetupRef(componentRef)` — dynamic-import + named-symbol
    resolution for the three-scene preset's `setupRef`. First non-React-
    component use of `componentRefSchema`.
  - Telemetry events emitted by the factory: `three-scene-clip.mount.start`,
    `three-scene-clip.mount.success`, `three-scene-clip.mount.failure`
    (reasons: `setup-throw` / `setupRef-resolve` / `invalid-props`),
    `three-scene-clip.dispose`.
  - Convergence pinned at the scene-call-stream level (epsilon = 0):
    `liveMount` at frame=N produces an identical recorded scene-call
    stream to `ThreeClipHost` rendered standalone at frame=N. Pixel-level
    convergence tracked under T-383a (covers both shader and three-scene).
  - Factory ships as TOP-LEVEL FUNCTIONS — not the static-class workaround
    T-383 needed inside `clips/shader/**`. T-309a (PR #270) tightened the
    sub-rule scope and dropped the missing-frame check, making clean top-
    level functions sub-rule-clean in this directory.

  `@stageflip/schema`:
  - New `threeSceneClipPropsSchema` at
    `@stageflip/schema/clips/interactive/three-scene-props` (also re-
    exported from the package root). Mirrors the discriminator pattern set
    by `shaderClipPropsSchema`: strict-shaped, browser-safe (pure Zod).
    Fields: `setupRef` (`<package>#<Symbol>`), `width`, `height`,
    `setupProps`, `posterFrame`, `prngSeed`.
  - `check-preset-integrity` gains invariant 9 (`three-scene-props`):
    when raw frontmatter declares `family: 'three-scene'`, `liveMount.props`
    must parse against `threeSceneClipPropsSchema`.

  `@stageflip/runtimes-three`:
  - `ThreeClipHost` + `ThreeClipHostProps` added to the public surface so
    the interactive-tier factory can wrap the existing rendering primitive
    without duplicating the host (D-T384-2). Patch-bump only — no
    behavioural change to the existing public surface.

- Updated dependencies [019f79c]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [36d0c5d]
  - @stageflip/runtimes-contract@0.1.0
