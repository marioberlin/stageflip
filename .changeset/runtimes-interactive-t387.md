---
"@stageflip/runtimes-interactive": minor
"@stageflip/schema": minor
---

T-387: `VoiceClip` `liveMount` — first γ-live family.

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
