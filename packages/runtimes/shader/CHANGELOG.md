# @stageflip/runtimes-shader

## 0.1.0

### Minor Changes

- 925bb66: Initial shader runtime (T-065). WebGL fragment shaders as live
  ClipRuntime clips, driven from the FrameClock.

  Exports:
  - `defineShaderClip<P>({ kind, fragmentShader, uniforms?, fontRequirements?, glContextFactory? })` —
    adapts a fragment shader source. The host compiles it against a
    standard fullscreen-quad vertex shader, mounts a `<canvas>`,
    obtains the WebGL context via the (optionally injected) factory,
    and re-draws on every frame change with uniforms computed from
    (progress, timeSec, frame, fps, resolution, props).
  - `createShaderRuntime(clips?)` — builds the `ClipRuntime`
    (`id: 'shader'`, `tier: 'live'`). Duplicate kinds throw.
  - `validateFragmentShader(source, kind)` — explicit-precision rule
    from the T-065 spec. Throws unless the shader declares
    `precision lowp|mediump|highp float;`; tolerates comments.
  - Three demo clips: `flashThroughWhite`, `swirlVortex`, `glitch`.
    All live under `src/clips/**` and are scanned by
    `check-determinism`; motion is parameterised entirely by
    `u_progress` — no Math.random, no wall-clock.

  Default uniforms: `u_progress`, `u_time`, `u_resolution`. Override by
  passing a `uniforms` callback; it receives
  `{ progress, timeSec, frame, fps, resolution, props }`.

  Test seam: `glContextFactory` lets tests inject a stub so lifecycle
  and draw flow can be asserted without real GPU. Happy-dom has no
  WebGL; the host bails silently when the context factory returns
  `null`, so real browsers always get the GL path and tests always
  get the stubbed one.

- 381c027: T-131d.2 — user-shader escape hatch in the shader runtime.
  - `defineShaderClip`'s `fragmentShader` field now accepts a function
    `(props: P) => string` in addition to the existing static-string
    form. The function variant skips define-time validation (the source
    is only known per render) and is the mechanism behind the new
    `shader-bg` clip, which takes arbitrary GLSL via props.
  - `ShaderClipHost` silent-fallbacks on compile / link failure — a
    malformed deck prop now leaves a blank canvas instead of crashing
    the rest of the slide. Authored clips (`flash-through-white`,
    `swirl-vortex`, `glitch`) are unaffected because their GLSL is
    validated at define time.
  - `defineShaderClip` gains `propsSchema` + `themeSlots` passthrough
    (matching the T-125b / T-131a pattern already on `defineCssClip`
    and `defineFrameClip`).
  - New demo clip `shaderBg` with `kind: 'shader-bg'`. Header composes
    `precision mediump float;` + `u_time` + `u_resolution` + one
    `uniform float <name>;` per identifier-filtered user-supplied key.

  Closes the last open row in the T-131d tier except `d.4` (mapbox).

### Patch Changes

- 89e8e3b: Phase 6 polish follow-ups (three items carried from `docs/handover-phase6-mid-6.md` §5.4).

  **1. Shader compile-failure dev-mode `console.warn`.**
  `ShaderClipHost` (T-131d.2) silent-fallbacked on shader compile/link failure by design — a bad GLSL prop shouldn't crash the surrounding deck. But authors hitting the fallback had no way to know WHY the canvas was blank. This adds a `console.warn` guarded by `NODE_ENV !== 'production'` that surfaces the GL info log. Production stays silent to avoid spam from decks shipping intentional-stub fragments.

  **2. `commentaryMode: 'inline'` now renders distinctly from `'rail'` (financial-statement).**
  T-131f.3's `financial-statement` clip advertised `commentaryMode: 'rail' | 'inline' | 'none'` in its schema but rendered the side rail for both `rail` and `inline`. The rail layout keeps the side panel; the new inline layout lays the comments as a horizontal strip below the table. Each layout carries its own data-testid (`financial-statement-comments-rail` / `financial-statement-comments-inline`) so downstream tooling can distinguish the two. `CommentsRail` gains a `layout?: 'rail' | 'inline'` prop.

  **3. Currency prefix expanded to 13 ISO currencies + sensible fallback.**
  Both `financial-statement` and `sales-dashboard` used a local 2-entry map (USD / EUR) and silently rendered bare numbers for anything else. Consolidated to a shared `currencyPrefix` helper in `_dashboard-utils.ts` that maps USD, EUR, GBP, JPY, CNY, INR, KRW, CHF, CAD, AUD, HKD, SGD, NZD to short display prefixes; unknown codes fall through to `<CODE> ` (e.g. `BRL 100K`) so the number is never unlabelled. Two clips now import from one source — drops duplicate code and fixes the silent-no-symbol bug.

  All three changes are backward-compatible. The currency schema stays `z.string().optional()` (enum narrowing would reject decks using the still-valid ISO fallback); the rail/inline split keeps `rail` as the default; the shader warn fires only when the clip was already silently failing.

- 2f0ae52: T-383: `ShaderClip` frontier-tier primitive — first γ-core dispatch.

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

- Updated dependencies [019f79c]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [36d0c5d]
  - @stageflip/runtimes-contract@0.1.0
