# @stageflip/schema

## 0.1.0

### Minor Changes

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

- 6474d98: T-387: `VoiceClip` `liveMount` — first γ-live family.

  `@stageflip/runtimes-interactive`:
  - New subpath export `@stageflip/runtimes-interactive/clips/voice`.
    The module's import side-effect registers `voiceClipFactory` against
    `interactiveClipRegistry` for `family: 'voice'`. Re-importing throws
    `InteractiveClipFamilyAlreadyRegisteredError`.
  - `VoiceClipFactoryBuilder.build({ browser?, transcriptionProvider? })`
    produces a `ClipFactory`. The factory is **standalone** — no §3
    runtime to wrap (D-T387-1, second γ pattern). Mounts a minimal
    React tree (record button + level-meter canvas + transcript live
    region) and returns a `VoiceClipMountHandle` with
    `startRecording`, `stopRecording`, and `onTranscript` lifecycle
    controls.
  - `MediaGraph` — owning resource holder for the live `MediaStream`,
    `MediaRecorder`, and Web Audio `AnalyserNode`. `dispose()` is the
    highest-attention path (D-T387-8): stops the recorder, every
    stream track, the analyser, the source node, and the
    `AudioContext`; idempotent.
  - `TranscriptionProvider` interface (D-T387-5). Two implementations
    ship: `WebSpeechApiTranscriptionProvider` (default; feature-detected
    via `window.SpeechRecognition` / `webkitSpeechRecognition`) and
    `InMemoryTranscriptionProvider` for tests. Cloud providers (Whisper /
    Deepgram / AssemblyAI) are deferred to Phase 14 ADR-006 (T-426a).
  - No `frameSource` dependency (D-T387-7) — voice is event-driven, not
    frame-driven. Mounting with `frameSource: undefined` succeeds.
  - No convergence test (D-T387-6) — voice has no rendered output to
    converge on.
  - Telemetry events emitted by the factory: `voice-clip.mount.start`,
    `voice-clip.mount.success`, `voice-clip.mount.failure` (reasons:
    `permission-denied` / `web-audio-unavailable` /
    `web-speech-unavailable` / `media-recorder-unsupported-mime` /
    `invalid-props`), `voice-clip.recording.started`,
    `voice-clip.recording.stopped`, `voice-clip.transcript.partial`,
    `voice-clip.transcript.final`, `voice-clip.dispose`.
  - **Privacy posture (D-T387-9, AC #16 + #24)**: transcript text body
    NEVER appears in telemetry attributes. The only text-derived
    attribute is `textLength` (integer) on
    `voice-clip.transcript.{partial,final}`.
  - **Pattern-evaluation outcome (D-T387-11)**: T-387 is the
    γ-pattern-evaluation moment. T-383 / T-384 / T-387 share
    conventions (schema file shape, subpath export, side-effect
    registration, telemetry naming) but no "three similar lines of
    meaningful logic". Per CLAUDE.md, **no shared abstraction is
    extracted**. Documented in
    `skills/stageflip/concepts/runtimes/SKILL.md` and
    `skills/stageflip/runtimes/voice/SKILL.md` for future Implementers.

  `@stageflip/schema`:
  - New `voiceClipPropsSchema` at
    `@stageflip/schema/clips/interactive/voice-props` (also re-exported
    from the package root). Mirrors the discriminator pattern set by
    `shaderClipPropsSchema` and `threeSceneClipPropsSchema`: strict-
    shaped, browser-safe (pure Zod). Fields: `mimeType`,
    `maxDurationMs`, `partialTranscripts`, `language`, `posterFrame`.
  - `check-preset-integrity` gains invariant 10 (`voice-props`): when
    raw frontmatter declares `family: 'voice'`, `liveMount.props` must
    parse against `voiceClipPropsSchema`.

- a36fcbe: T-388: `VoiceClip` `staticFallback` — waveform poster default. Closes
  the `family: 'voice'` pair started by T-387.

  `@stageflip/runtimes-interactive`:
  - New `defaultVoiceStaticFallback({ width, height, posterText?,
silhouetteSeed? })` helper at
    `@stageflip/runtimes-interactive/clips/voice` (also re-exported from
    the package root). Returns an `Element[]` of one `ImageElement`
    (SVG-waveform-silhouette `data:image/svg+xml,…` URL) plus an
    optional centred `TextElement` carrying `posterText`. **Byte-for-
    byte deterministic** (D-T388-2 + AC #4): same args → same Element
    tree across calls. No `Math.random`, no `Date.now`.
  - Mount-harness static-path extension (D-T388-4): when
    `clip.family === 'voice'` AND `clip.staticFallback.length === 0`,
    the harness substitutes the generator's output. Authored fallbacks
    always win (AC #13).
  - New telemetry event `voice-clip.static-fallback.rendered` emitted
    by the harness on every static-path render for `family: 'voice'`.
    Attributes: `family`, `reason` (`'permission-denied' |
'tenant-denied' | 'pre-prompt-cancelled' | 'authored'`), `width`,
    `height`, `posterTextLength`. **Privacy posture (AC #14)**:
    `posterTextLength` is the integer length, NEVER the body.
  - **PRNG primitive extraction (D-T388-3)**: `createSeededPRNG` moved
    from `clips/three-scene/prng.ts` to package-root
    `packages/runtimes/interactive/src/prng.ts`. The third application
    (T-384 three-scene + T-388 default-poster + planned future use)
    earned its place per CLAUDE.md "three similar lines beat a
    premature abstraction". The legacy import path
    `clips/three-scene/prng.js` is preserved as a re-export shim so
    T-384's call sites resolve unchanged (AC #11). Byte-for-byte
    sequences are pinned by the regression fingerprint in the new
    `prng.test.ts` (AC #10).

  `@stageflip/schema`:
  - `voiceClipPropsSchema` gains an optional `posterText` field
    (D-T388-1). Non-empty when present (AC #2). Existing T-387 fixtures
    without `posterText` continue to validate (AC #3). Browser-safe —
    pure Zod; no Node imports added.

- 8ddef40: T-389: `AiChatClip` `liveMount` — second γ-live family.

  `@stageflip/runtimes-interactive`:
  - New subpath export `@stageflip/runtimes-interactive/clips/ai-chat`.
    The module's import side-effect registers `aiChatClipFactory`
    against `interactiveClipRegistry` for `family: 'ai-chat'`.
    Re-importing throws
    `InteractiveClipFamilyAlreadyRegisteredError`. T-389 ships
    `liveMount` only — the `staticFallback` generator registration
    lands at T-390.
  - `AiChatClipFactoryBuilder.build({ chatProvider? })` produces a
    `ClipFactory`. The factory is **standalone** — no §3 runtime to
    wrap (D-T389-1, third application of the second γ pattern).
    Mounts a minimal React tree (output stream + textarea + send
    button) and returns an `AiChatClipMountHandle` with `send`,
    `onTurn`, and `reset` lifecycle controls.
  - `LLMChatProvider` interface (D-T389-5). Two implementations
    ship: `RealLLMChatProvider` (wraps `@stageflip/llm-abstraction`'s
    `LLMProvider` — accepts pre-built `provider` or
    `CreateProviderSpec`) and `InMemoryLLMChatProvider` for tests.
    Custom-provider tenant adapters are deferred to Phase 14
    ADR-006.
  - No `frameSource` dependency (D-T389-6) — ai-chat is event-driven,
    not frame-driven. Mounting with `frameSource: undefined`
    succeeds.
  - No convergence test — ai-chat has no rendered output to converge
    on.
  - Resource cleanup (D-T389-7): `dispose()` aborts the in-flight
    `streamTurn` call, drops accumulated history, unsubscribes all
    `onTurn` handlers, unmounts the React root, and is idempotent.
    `signal.abort` triggers the same path. AC #15-#19.
  - `multiTurn: false` rejects a second `send` with a typed
    `MultiTurnDisabledError` (NOT a silent no-op — D-T389-4 + AC
    #13).
  - Telemetry events emitted by the factory:
    `ai-chat-clip.mount.start`, `ai-chat-clip.mount.success`,
    `ai-chat-clip.mount.failure` (reasons:
    `invalid-props` / `provider-unavailable` / `permission-denied`),
    `ai-chat-clip.turn.started`, `ai-chat-clip.turn.finished`,
    `ai-chat-clip.turn.error`, `ai-chat-clip.dispose`.
  - **Privacy posture (D-T389-8, AC #20)**: neither user-message
    body NOR assistant-completion body appears in telemetry
    attributes. Text-derived attributes are integers only —
    `userMessageLength` (`turn.started`) and `tokenCount`
    (`turn.finished`). `errorKind` derives from `LLMError.kind`. Pinned
    via grep on captured event payloads in the factory test.
  - **Pattern-evaluation outcome (D-T389-10)**: T-389 is the third
    application of the second γ pattern. T-387 (voice) and T-389
    (ai-chat) share a provider-seam shape (interface + start /
    stream + in-memory test impl) — but with only two seams it isn't
    yet "three similar lines of meaningful logic". **No abstraction
    extracted at T-389**; the eligibility for a future
    `ProviderSeam<T>` extraction is documented in
    `skills/stageflip/runtimes/ai-chat/SKILL.md` and
    `skills/stageflip/concepts/runtimes/SKILL.md` for T-391
    (LiveDataClip — the third provider seam) to act on.
  - New runtime dependency: `@stageflip/llm-abstraction` (workspace).

  `@stageflip/schema`:
  - New `aiChatClipPropsSchema` at
    `@stageflip/schema/clips/interactive/ai-chat-props` (also
    re-exported from the package root). Mirrors the discriminator
    pattern set by `shaderClipPropsSchema`,
    `threeSceneClipPropsSchema`, and `voiceClipPropsSchema`: strict-
    shaped, browser-safe (pure Zod). Fields: `systemPrompt`,
    `provider`, `model`, `maxTokens`, `temperature`, `multiTurn`,
    `posterFrame`. T-390 will extend with `capturedTranscript?` for
    the captured-transcript static fallback.
  - `check-preset-integrity` gains invariant 11 (`ai-chat-props`):
    when raw frontmatter declares `family: 'ai-chat'`,
    `liveMount.props` must parse against `aiChatClipPropsSchema`.

- e054d6d: T-390: ship `staticFallback` for `family: 'ai-chat'`. Closes the γ-live
  `AiChatClip` family (T-389 + T-390); after T-390, both halves are
  structurally complete.

  `@stageflip/schema`:
  - `aiChatClipPropsSchema` gains an optional `capturedTranscript?: Array<{
role: 'user' | 'assistant'; text: string }>` field. Strict per-turn
    shape; `text` non-empty. Existing T-389 fixtures without the field
    continue to validate (T-390 AC #4). Browser-safe — pure Zod.
  - New exported type `AiChatCapturedTranscriptTurn`.

  `@stageflip/runtimes-interactive`:
  - New `defaultAiChatStaticFallback` generator: deterministic Element[]
    layout — a TextElement summarising the truncated `systemPrompt` plus
    one TextElement per turn in `capturedTranscript` (alternating
    alignment by role). When `capturedTranscript` is absent or empty, a
    single placeholder TextElement (empty text, host-replaceable via
    app-level i18n) is appended.
  - Byte-for-byte determinism across calls (T-390 AC #5). No
    `Math.random`, no `Date.now`. Same posture as
    `defaultVoiceStaticFallback`.
  - New `aiChatStaticFallbackGenerator` registered against
    `staticFallbackGeneratorRegistry` for `family: 'ai-chat'` at subpath
    import time. The harness's family-agnostic dispatch (T-388a) picks
    up the registration; no harness modifications.
  - Telemetry event `ai-chat-clip.static-fallback.rendered` carries
    integer-length attributes only — `transcriptTurnCount`,
    `systemPromptLength`. The systemPrompt body and per-turn bodies are
    NEVER attached to telemetry (D-T390-4 privacy posture; same as T-389
    D-T389-8).
  - Authored-path telemetry preserved per T-388a D-T388a-3: the harness
    invokes the generator with `reason: 'authored'` even when authored
    fallbacks are non-empty so per-family telemetry continues to fire on
    the authored path.

  After T-390, `family: 'ai-chat'` is structurally complete. T-391
  (LiveDataClip) is the next γ-live dispatch.

- 4fe6fda: T-391 — `LiveDataClip` `liveMount` (third γ-live family).
  - New `liveDataClipPropsSchema` on `@stageflip/schema` for `family: 'live-data'` props (`endpoint`, `method`, `headers`, `body`, `parseMode`, `refreshTrigger`, `posterFrame`).
  - New `liveDataClipFactory` + `LiveDataProvider` seam on `@stageflip/runtimes-interactive`. The clip wraps a host-injected `Fetcher` (no `globalThis.fetch` inside `clips/**`); two implementations ship — `HostFetcherProvider` and `InMemoryLiveDataProvider`.
  - One-shot at mount + manual `refresh()` only (no polling in v1; the determinism floor rules wall-clock cadences out).
  - Telemetry privacy posture: response body NEVER in attributes; `bodyByteLength` integer only. Same posture as T-389 / T-390.
  - `check-preset-integrity` gains invariant 12 for `family: 'live-data'`.
  - Skill expansion: `skills/stageflip/runtimes/live-data/SKILL.md` is now substantive; `concepts/runtimes/SKILL.md` records the `ProviderSeam<T>` ruling (no extraction at the third application); `concepts/clip-elements/SKILL.md` adds the `live-data` row.

  Pairs with T-392 (cached snapshot staticFallback). Chart-aware rendering for both halves is a follow-up gated on T-406's landing per ADR-005 §D1 footnote `^liveData-v1`.

- 12a98d3: T-392 — `LiveDataClip` `staticFallback` (cached-snapshot generator).
  - Adds optional `cachedSnapshot: { capturedAt, status, body }` field on `liveDataClipPropsSchema` (D-T392-1). Backward-compatible — T-391 fixtures without the field validate unchanged.
  - New `defaultLiveDataStaticFallback` generator emits a header TextElement (endpoint · status · capturedAt) plus a body TextElement (`JSON.stringify(body, null, 2)`) — both clamped to canvas bounds with T-390-style overflow guard. Placeholder TextElement when `cachedSnapshot` is absent.
  - New `liveDataStaticFallbackGenerator` wrapper registers against `staticFallbackGeneratorRegistry` for `family: 'live-data'` at subpath import time. Harness-routing matches T-388a's contract — authored fallback wins for rendering but the generator is still invoked with `reason: 'authored'` for telemetry.
  - Telemetry privacy posture: `hasSnapshot` boolean + `bodyByteLength` integer only — the response body NEVER in attributes (D-T392-4 / AC #13). Same posture as T-390 / T-391.
  - Determinism: pure transformation; no `Math.random` / `Date.now` / `performance.now`. `safeStringify` wraps `JSON.stringify` in try/catch defensively against circular bodies.

  Closes out `family: 'live-data'` (modulo chart rendering, deferred to T-406's landing per ADR-005 §D1 footnote `^liveData-v1`).

- ca945df: T-393 — `WebEmbedClip` `liveMount` (fourth γ-live family).
  - New `webEmbedClipPropsSchema` on `@stageflip/schema` for `family: 'web-embed'` props (`url`, `sandbox` tokens, `allowedOrigins`, optional width/height overrides, `posterFrame`).
  - New `webEmbedClipFactory` on `@stageflip/runtimes-interactive`. **No provider seam** — the browser's `<iframe>` element IS the runtime; the factory just creates and disposes the DOM. Mounts a single sandboxed iframe under the supplied root with `src` / `sandbox` / `width` / `height` attributes.
  - `WebEmbedClipMountHandle` exposes `reload()` / `postMessage(msg)` / origin-filtered `onMessage(handler)`. `postMessage` forwards `targetOrigin = origin(props.url)` (NOT `'*'`).
  - Two-stage inbound message filter: `event.source === iframe.contentWindow` AND `event.origin ∈ allowedOrigins`. Drops emit `web-embed-clip.message.dropped` with distinct `reason: 'source-mismatch' | 'origin-not-allowed' | ...` for security observability.
  - 5-step dispose: remove window listener → `iframe.src='about:blank'` BEFORE detach → remove from DOM → clear handlers → emit telemetry. Idempotent.
  - Telemetry privacy: `byteLength` integer + `targetOrigin` / `origin` / `url` ONLY — postMessage payload bodies NEVER in attributes (D-T393-8 / AC #17). Same posture as T-389 / T-391. `safeByteLength` wraps `JSON.stringify` in try/catch defensively against non-serializable data (Blob / ArrayBuffer / circular).
  - `check-preset-integrity` gains invariant 13 for `family: 'web-embed'`.
  - Skill expansion: `skills/stageflip/runtimes/web-embed/SKILL.md` placeholder → substantive; `concepts/runtimes/SKILL.md` adds fourth-family entry + reaffirms `ProviderSeam<T>` ruling at four shapes (no extraction); `concepts/clip-elements/SKILL.md` adds the `web-embed` row.

  Pairs with T-394 (poster-screenshot staticFallback). After T-394 lands, `family: 'web-embed'` is structurally complete.

- 5af6789: T-394 — `WebEmbedClip` `staticFallback` (poster-screenshot generator).
  - Adds optional `posterImage: { src, contentType? }` field on `webEmbedClipPropsSchema`. v1 accepts ONLY `data:` URLs (the refine enforces this); `http(s):` URLs deferred per the out-of-scope deferral. Backward-compatible — T-393 fixtures without the field validate unchanged.
  - New `defaultWebEmbedStaticFallback` generator emits a single `ImageElement` filling the canvas with `src = posterImage.src` (data URL cast as `ImageElement['src']` — same posture as `defaultVoiceStaticFallback`). Placeholder `TextElement` when `posterImage` is absent.
  - New `webEmbedStaticFallbackGenerator` wrapper registers against `staticFallbackGeneratorRegistry` for `family: 'web-embed'` at subpath import time. Harness routing matches T-388a's contract — authored fallback wins for rendering but the generator is still invoked with `reason: 'authored'` for telemetry.
  - Telemetry privacy posture: `hasPoster` boolean + `posterSrcLength` integer only — the URL string itself NEVER in attributes (a 50KB inline data URL would balloon every event). Same posture as T-390 / T-391 / T-392 / T-393.
  - Determinism: pure transformation; no `Math.random` / `Date.now` / `performance.now` / fetch.

  Closes out `family: 'web-embed'` structurally. Final γ-live family pair pending: T-395/T-396 AiGenerativeClip (no specs yet).

- 22d44d6: T-395 — `AiGenerativeClip` `liveMount` (fifth and final γ-live family).
  - New `aiGenerativeClipPropsSchema` on `@stageflip/schema` for `family: 'ai-generative'` props (`prompt`, `provider`, `model`, `negativePrompt?`, `seed?`, `width?`, `height?`, `posterFrame`). v1 is image-only; no `modality` field (adding one when audio/video lands is non-breaking).
  - New `aiGenerativeClipFactory` + `AiGenerativeProvider` seam on `@stageflip/runtimes-interactive`. Host injects a `Generator` callable that returns `Promise<{ blob: Blob; contentType: string }>`; clip never references `globalThis.fetch` directly. Two implementations ship: `HostInjectedAiGenerativeProvider` and `InMemoryAiGenerativeProvider`.
  - Mount renders the resolved blob into a single `<img>` element via `URL.createObjectURL`. Mount-time generation deferred via `queueMicrotask` so callers can subscribe `onResult`/`onError` first.
  - **Blob-URL discipline**: `dispose()` MUST `URL.revokeObjectURL` the active blob URL — `createObjectURL` is a hidden GC root not handled by ordinary DOM teardown. Pinned in tests with spies on both `createObjectURL` and `revokeObjectURL`.
  - Telemetry privacy posture: `promptLength` + `blobByteLength` integers only; prompt body, negativePrompt body, and generated blob bytes NEVER in attributes. Same posture as T-389 / T-391 / T-393.
  - `check-preset-integrity` gains invariant 14 for `family: 'ai-generative'`.
  - Pattern-eval reaffirmation at FIVE families (D-T395-10): NO `ProviderSeam<T>` extraction. Five shapes — Transcription / LLMChat / LiveData (text) / no-seam-WebEmbed / AiGenerative (binary Blob) — cannot share a generic abstraction.
  - Skill expansion: `skills/stageflip/runtimes/ai-generative/SKILL.md` placeholder → substantive; `concepts/runtimes/SKILL.md` adds fifth-family entry + reaffirms `ProviderSeam<T>` ruling at five shapes; `concepts/clip-elements/SKILL.md` adds the `ai-generative` row + invariant 14 numbering note (Phase 13's seven frontier families now all ship a discriminator).

  Pairs with T-396 (curated-example staticFallback). After T-396 lands, `family: 'ai-generative'` is structurally complete and **all five γ-live family pairs ship** — Phase 13 γ-live coverage closes.

- b6d2229: T-396 — `AiGenerativeClip` `staticFallback` (curated-example generator).
  - Adds optional `curatedExample: { src, contentType? }` field on `aiGenerativeClipPropsSchema`. v1 accepts ONLY `data:` URLs (refine enforces this); `http(s):` URLs deferred per the out-of-scope deferral. Same posture as T-394's `posterImage` (the F-2 fix from spec PR #289 review). Backward-compat — T-395 fixtures without the field validate unchanged.
  - New `defaultAiGenerativeStaticFallback` generator emits a single `ImageElement` filling the canvas with `src = curatedExample.src` (data URL cast as `ImageElement['src']` — same posture as `defaultVoiceStaticFallback` / `defaultWebEmbedStaticFallback`). Placeholder `TextElement` when `curatedExample` is absent.
  - New `aiGenerativeStaticFallbackGenerator` wrapper registers against `staticFallbackGeneratorRegistry` for `family: 'ai-generative'` at subpath import time. Harness routing matches T-388a's contract — authored fallback wins for rendering but the generator is still invoked with `reason: 'authored'` for telemetry.
  - Telemetry privacy posture: `hasExample` boolean + `exampleSrcLength` integer only — the URL string itself NEVER in attributes. Same posture as T-390 / T-392 / T-394.
  - Determinism: pure transformation; no `Math.random` / `Date.now` / `performance.now` / fetch.

  **Closes out `family: 'ai-generative'` structurally and Phase 13 γ-live coverage closes at five family pairs**: shader · three-scene · voice · ai-chat · live-data · web-embed · ai-generative. Future asset-generation families ship under Phase 14 / ADR-006.

- bbcbd38: T-251 — Add deck-level `Document.masters: SlideMaster[]` + `Document.layouts: SlideLayout[]`, per-slide `Slide.layoutId`, and per-element `ElementBase.inheritsFrom: { templateId, placeholderIdx }`. New pure helper `applyInheritance(doc): Document` materializes per-element placeholder references at compile/read time. All additions are optional with `[]` / `undefined` defaults — existing persisted documents parse unchanged.
- 3112c98: T-265: add `BlenderClip` element to the canonical schema.

  `BlenderClip` is the bake-tier element type. It carries:
  - `scene: { template, params }` — references a built-in Blender scene
    template + a parameter bag.
  - `duration: { durationMs, fps }` — render extent.
  - `inputsHash` — pinned SHA-256 cache key into
    `bakes/{inputsHash}/frame-{N}.png`.

  Existing fixtures parse unchanged; the discriminated union now has 12
  branches. Hash verification + bake submission live in
  `@stageflip/runtimes-blender`.

- e422e50: Add preset schema primitive (T-304): loader + validator + frontmatter parser
  for the SKILL.md tree at `skills/stageflip/presets/`. New public surface
  `@stageflip/schema/presets` exports `presetFrontmatterSchema`,
  `clusterSkillFrontmatterSchema`, `loadPreset`, `loadCluster`, `loadAllPresets`,
  `PresetRegistry`, and the three preset error classes. Additive — no breaking
  changes. License vocabulary is deliberately permissive (T-307 owns the
  canonical enum per ADR-004 §D3).
- 7c0165c: T-305: interactive-clip contract — `staticFallback` + `liveMount` schema +
  export-matrix hooks per ADR-003 §D2/§D3/§D4 and ADR-005 §D1.
  - New `packages/schema/src/clips/` subdirectory:
    - `interactive.ts` — `interactiveClipSchema`, `permissionSchema`,
      `componentRefSchema`, `liveMountSchema`, `INTERACTIVE_CLIP_FAMILIES`
      (the seven frontier families per ADR-005 §D1). The
      `staticFallback.min(1)` refine enforces ADR-003 §D2's invariant at
      the type level (bare-`liveMount` clips are rejected).
    - `export-targets.ts` — `exportTargetSchema` (8 closed targets),
      `EXPORT_MATRIX`, and `resolveClipPath(target, clip)` per ADR-003 §D3.
    - `index.ts` — public surface re-exports.
  - `packages/schema/src/elements/index.ts` adds `interactive-clip` to the
    discriminated `Element` union (additive; existing branches unchanged).
  - Browser-safe surface: pure Zod, no fs/path/child_process imports.
  - Mechanical exhaustiveness updates in `@stageflip/rir` and
    `@stageflip/export-pptx` to cover the new union branch (no behavior
    change for existing element types). Per-target exporter integration is
    follow-up work.

  T-305 is the schema/contract layer the runtime (T-306) and per-family
  frontier clips (T-383–T-396) consume.

- 732f6c7: Add font-license registry (T-307) per ADR-004 §D3. New surface:
  - **Browser-safe** (`@stageflip/schema`): `FONT_LICENSE_ATOMS` 12-element
    enum, `fontLicenseAtomSchema`, `parseFontLicenseExpression` for free-form
    composite license strings (`'apache-2.0 + ofl'`, `'apache-2.0 / ofl /
commercial-byo'`).
  - **Node-only** (`@stageflip/schema/presets/node`): `FontLicenseRegistry` —
    builds a deduplicated index of every `(family, license)` pair across the
    loaded `PresetRegistry`, with `validateAgainstWhitelist` + audit-flag
    surfaces for downstream gates.

  `scripts/check-licenses.ts` is extended with a font-license validation block;
  unknown atoms now fail the gate. Additive — no breaking changes to T-304's
  loader/registry surface.

- 36d0c5d: T-227: make the Phase-10 publish targets shippable via Changesets.
  - Renames the CLI's workspace name from `@stageflip/app-cli` →
    `@stageflip/cli` (the plan's publishable name).
  - Drops `"private": true` from the 11 packages in the publishable
    closure: the three primary targets (`@stageflip/{cli,plugin,mcp-server}`)
    plus their transitive deps (`@stageflip/{engine,llm-abstraction,schema,
skills-core,skills-sync,validation,rir,runtimes-contract}`).
  - Adds `"publishConfig": { "access": "public" }`, `"license":
"BUSL-1.1"`, `"repository"`, and `"homepage"` metadata to each
    publishable package. Primary targets also get a `"description"`
    visible on npmjs.com.
  - Copies the root `LICENSE` into each publishable package dir so
    tarballs carry the license even outside the monorepo.
  - Flips `.changeset/config.json`'s `access` from `"restricted"` to
    `"public"`.
  - Adds `.github/workflows/release.yml` — Changesets-driven: opens a
    "Version Packages" PR when changesets land on main; `pnpm publish`
    fires on merge of that PR iff `NPM_TOKEN` is configured.

  Actual publishing is opt-in via the NPM_TOKEN secret; this PR does
  NOT run `changeset publish`.

- 38e4017: T-386: variant-generation primitive — message × locale matrix over RIR.

  `@stageflip/variant-gen` (new package):
  - `generateVariants(source, spec, options?) → Iterable<VariantOutput>` —
    synchronous, bounded, browser-safe. Two axes (messages + locales) ship in
    v1; size axis deferred to T-386a (TS `size?: never` placeholder + Zod
    `strict()` runtime reject).
  - `VariantMatrixCapExceededError` — synchronous throw on cap-exceeded
    (default `maxVariants: 100`). No partial output.
  - `LocaleProvider` interface + `InMemoryLocaleProvider` +
    `StaticBundleLocaleProvider`. Network-fetching providers deferred to
    T-415.
  - `deriveCacheKey(sourceDocId, coordinate)` — content-addressed sha256 hex.
    Pure-JS sync FIPS 180-4 implementation, no Node-only imports.
  - `replaceElementInDocument` / `setNestedProperty` — structural-sharing
    helpers; pinned by AC #21 ref-equality on a 100-element source.

  `@stageflip/schema`:
  - New `@stageflip/schema/variants` surface — `variantMatrixSpecSchema`,
    `messageVariantAxisEntrySchema`, `localeAxisEntrySchema`,
    `variantSlotDefSchema`, `variantSlotsSchema`. Re-exported from the schema
    barrel.
  - `Document.variantSlots?: Record<string, VariantSlotDef>` — optional root
    field. Existing documents without the field round-trip unchanged.
  - BCP-47 light regex on `locales[].tag`; `messages[].id` uniqueness
    enforced via superRefine.

  `@stageflip/engine`:
  - New 17th canonical bundle `arrange-variants` exposing one tool —
    `arrange_variants({ matrixSpec })`. Returns
    `{ ok: true, variants: [{ coordinate, documentId, cacheKey }] }`; full
    Document payloads are persisted via the
    `VariantPersistenceContext.persistVariant` seam and never inlined into
    the agent context.
  - Cap-exceeded responses are typed
    `{ ok: false, reason: 'matrix_cap_exceeded' }` — synchronous, no patches
    emitted.

### Patch Changes

- a4bb803: T-249: narrow `componentDefinitionSchema.body` from `z.unknown()` to a
  typed `{ slots: SlotDefinition[]; layout: LayoutDescriptor }` shape, with
  `slotDefinitionSchema` and `layoutDescriptorSchema` exported from a new
  `./components.js` entry. The narrowing is additive — existing documents
  with empty `components: {}` continue to parse. T-249's design-system
  pipeline is the first emitter of populated components.
- d393eff: T-253-rider sibling — adds `compareToPlaceholder(slideEl, placeholderEl)` to `@stageflip/schema/src/inheritance.ts` as the inverse of `applyInheritance`. Returns the set of top-level `Element` keys whose slide-side value matches the placeholder default (and may therefore be suppressed by an exporter). Shares `applyInheritance`'s shallow-on-top-level semantics: `transform` is whole-or-nothing, `animations: []` is never suppressed, `id` / `type` / `inheritsFrom` always preserved. Additive — no breaking changes.
