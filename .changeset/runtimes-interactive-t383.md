---
"@stageflip/runtimes-interactive": minor
"@stageflip/schema": minor
"@stageflip/runtimes-shader": patch
---

T-383: `ShaderClip` frontier-tier primitive — first γ-core dispatch.

`@stageflip/runtimes-interactive`:

- New subpath export `@stageflip/runtimes-interactive/clips/shader`. The
  module's import side-effect registers `shaderClipFactory` against
  `interactiveClipRegistry` for `family: 'shader'`. Re-importing throws
  `InteractiveClipFamilyAlreadyRegisteredError`.
- `ShaderClipFactoryBuilder.build({ uniforms?, glContextFactory?, fps? })`
  produces a `ClipFactory`. The factory wraps `ShaderClipHost` from
  `@stageflip/runtimes-shader` (D-T383-1: reuse-the-runtime pattern) so
  `liveMount` and `staticFallback` poster generation share a single
  rendering core (ADR-005 §D2 convergence-by-construction).
- `MountContext` extended with `frameSource?: FrameSource`. Backward-
  compatible — pre-existing T-306 consumers neither read nor depend on
  the field. Frame-driven families (`shader`, `three-scene`) require it
  and throw `MissingFrameSourceError` otherwise.
- `RAFFrameSource` (browser live-preview) and `RecordModeFrameSource`
  (renderer-cdp record mode + parity tests) ship as the two
  reference implementations.
- `defaultShaderUniforms(frame, ctx)` — `@uniformUpdater`-tagged default
  uniform updater mapping `(frame, fps, resolution)` to
  `uFrame`/`uTime`/`uResolution`. Lives under `clips/shader/**` and is
  the first non-trivial target inspected by T-309's path-based shader
  sub-rule. `pnpm check-determinism` passes.
- Telemetry events emitted by the factory: `shader-clip.mount.start`,
  `shader-clip.mount.success`, `shader-clip.mount.failure` (reasons:
  `compile` / `link` / `context-loss` / `invalid-props`),
  `shader-clip.dispose`.
- Convergence pinned at the GL-call-stream level (epsilon = 0):
  `liveMount` at frame=N produces an identical recorded GL state to
  `ShaderClipHost` rendered standalone at frame=N.

`@stageflip/schema`:

- New `shaderClipPropsSchema` + `uniformValueSchema` at
  `@stageflip/schema/clips/interactive/shader-props` (also re-exported
  from the package root). First per-family `liveMount.props` narrowing
  per the discriminated-union pattern hinted at by T-305. Browser-safe
  (pure Zod). Strict-shaped: unknown keys rejected.
- `check-preset-integrity` gains invariant 8 (`shader-props`): when
  raw frontmatter declares `family: 'shader'`, `liveMount.props` must
  parse against `shaderClipPropsSchema`.

`@stageflip/runtimes-shader`:

- `ShaderClipHost` + `ShaderClipHostProps` + `defaultGlContextFactory`
  added to the public surface so the interactive-tier factory can wrap
  the existing rendering primitive without duplicating the host.
