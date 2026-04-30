---
"@stageflip/runtimes-interactive": minor
"@stageflip/schema": minor
---

T-389: `AiChatClip` `liveMount` — second γ-live family.

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
