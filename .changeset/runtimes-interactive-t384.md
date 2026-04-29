---
"@stageflip/runtimes-interactive": minor
"@stageflip/schema": minor
"@stageflip/runtimes-three": patch
---

T-384: `ThreeSceneClip` frontier-tier primitive — second γ-core dispatch.

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
