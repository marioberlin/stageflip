---
title: Voice Runtime
id: skills/stageflip/runtimes/voice
tier: runtime
status: substantive
last_updated: 2026-04-29
owner_task: T-388
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
  - skills/stageflip/runtimes/shader/SKILL.md
  - skills/stageflip/runtimes/three/SKILL.md
---

# Voice Runtime

`@stageflip/runtimes-interactive/clips/voice` ships the first **γ-live**
family. Standalone interactive-tier clip — no §3 runtime to reuse, no
frame-source dependency, no convergence test. Captures microphone audio
via `MediaRecorder`, streams an audio level signal via Web Audio
`AnalyserNode`, and emits a transcript stream via the Web Speech API
(or any injected `TranscriptionProvider`).

`liveMount` lands here (T-387). `staticFallback` (waveform poster) is
T-388 — both halves of `family: 'voice'` are now structurally complete.

## When to reach for it

- Interactive captures: dictation, voice notes, narration.
- Live transcription overlays — the host app subscribes to
  `onTranscript` and renders interim / final text.
- Microphone-driven art (level-meter visualisations).

## When NOT

- Pre-recorded audio playback. That's a different feature; voice clip
  is for **live** capture only.
- Voice cloning / TTS. Phase 14 ADR-006 covers asset-gen voice; this
  skill is recognition-only.
- Server-side transcription pipelines. The seam is in place
  (`TranscriptionProvider`); cloud adapters land in T-426a (Phase 14).

## Architecture

The factory is event-driven; nothing here ticks on a frame. The
mount-harness security model still applies:

```
harness.mount(voiceClip, root, signal):
  1. permissionShim.mount(clip)         # 'mic' → getUserMedia({audio:true})
       → denied: render staticFallback (T-388 waveform poster)
  2. registry.resolve('voice')           # registered at subpath import time
  3. factory(MountContext)               # builds React tree + handle
  4. signal.abort → handle.dispose()     # idempotent teardown
```

The factory returns a `VoiceClipMountHandle`:

```ts
interface VoiceClipMountHandle extends MountHandle {
  startRecording(): Promise<void>;
  stopRecording(): Promise<void>;
  onTranscript(handler: (e: TranscriptEvent) => void): () => void;
}
```

`startRecording` re-acquires its own `MediaStream` via
`getUserMedia({audio:true})` — the permission shim already vetted, but
the shim's probe stream is stopped immediately after grant, so the
factory must request its own. `stopRecording` tears down the recorder +
transcription. `dispose` is the terminal step (idempotent).

### Visual surface

A minimal React tree with no English strings (CLAUDE.md §10):

```tsx
<div data-stageflip-voice-clip="true">
  <button data-action="record" data-recording="false" />
  <canvas data-role="level-meter" />
  <output data-role="transcript-live" />
</div>
```

Host applications style + label via the data attributes; the package
ships no copy.

### Schema (`voiceClipPropsSchema`)

```ts
voiceClipPropsSchema = z.object({
  mimeType: z.string().default('audio/webm'),
  maxDurationMs: z.number().int().positive().default(60_000),
  partialTranscripts: z.boolean().default(true),
  language: z.string().min(1).default('en-US'),
  posterFrame: z.number().int().nonnegative().default(0),
  posterText: z.string().min(1).optional(),
}).strict();
```

`mimeType` feature-detects via `MediaRecorder.isTypeSupported`;
unsupported MIME → `mount.failure` reason
`'media-recorder-unsupported-mime'`. `posterFrame` reuses the
shader / three-scene convention for `staticFallback` poster sampling.
`posterText` (T-388 D-T388-1) is the optional overlay-copy slot for the
default waveform poster — host-supplied; the package ships no English
defaults.

### Permissions (`['mic']`)

The clip declares `permissions: ['mic']`. T-385's permission flow
unblocks user-facing pre-prompt UX:

```ts
import { usePermissionFlow, PermissionPrePromptModal } from
  '@stageflip/runtimes-interactive/permission-flow';
```

The skill **recommends** `permissionPrePrompt: true` for voice — the
mic dialog benefits from in-app context — but does not enforce it.
Host applications with their own pre-flow may opt out.

### `componentRef.module` resolution

```
@stageflip/runtimes-interactive/clips/voice#VoiceClip
```

The subpath export points at
`packages/runtimes/interactive/src/clips/voice/index.ts`, whose import
side-effect registers `voiceClipFactory` against
`interactiveClipRegistry`.

## TranscriptionProvider seam

```ts
interface TranscriptionProvider {
  start(args: {
    stream: MediaStream;
    language: string;
    partial: boolean;
    onTranscript: (event: TranscriptEvent) => void;
  }): Promise<{ stop: () => void }>;
}
```

T-387 ships two implementations:

1. **`WebSpeechApiTranscriptionProvider`** — feature-detects
   `window.SpeechRecognition` / `webkitSpeechRecognition`. Throws
   `WebSpeechApiUnavailableError` from `start()` when neither is
   present; the factory routes that to `mount.failure` with reason
   `'web-speech-unavailable'`. **Default**.
2. **`InMemoryTranscriptionProvider({ scripted })`** — emits a
   pre-scripted `TranscriptEvent` sequence for tests. Sequence and
   timing are deterministic in fake-timer environments.

A cloud provider (Whisper / AssemblyAI / Deepgram) is **deferred to
Phase 14** ADR-006 (T-426a, sister to T-426 TTS adapter). The seam is
in place; cloud adapters do not land at T-387.

## Static fallback (T-388 + T-388a)

The mount-harness routes to `staticFallback` whenever permission is
denied (mic gate refused, tenant policy refused, pre-prompt cancelled).
T-388 ships a deterministic default poster for `family: 'voice'`: a
stylised SVG waveform silhouette plus an optional centred overlay
caption. T-388a wires the dispatch through a per-family
`StaticFallbackGeneratorRegistry` (see
`concepts/runtimes/SKILL.md` §"Dual-registry pattern") — voice was
the family-hardcoded `if`-branch; the registry generalises it.

### Default-poster generator

```ts
import { defaultVoiceStaticFallback } from
  '@stageflip/runtimes-interactive/clips/voice';

defaultVoiceStaticFallback({
  width: 640,
  height: 360,
  posterText: 'Tap to speak',  // optional
  silhouetteSeed: 0,            // optional, default 0
}): Element[];
```

Returns an `Element[]`:

1. An `ImageElement` whose `src` is a `data:image/svg+xml,…` URL —
   32 evenly-spaced bars of pseudo-random heights centred vertically
   on a light-grey background. The transform fills the supplied
   `(width, height)`.
2. A centred `TextElement` rendering `posterText` when present;
   omitted when `posterText` is `undefined`.

### Determinism contract (AC #4 / #15)

The generator is **byte-for-byte deterministic** across calls. Same
`(width, height, posterText, silhouetteSeed)` → same `Element[]`. No
`Math.random`, no `Date.now`. Bar-height variation comes from the
seeded PRNG primitive at `packages/runtimes/interactive/src/prng.ts`
(extracted from `clips/three-scene/prng.ts` per D-T388-3 — the third
application earned the move; legacy import path preserved via
re-export shim, AC #11).

The generator's path lives at `clips/voice/**`, OUT of the shader
sub-rule's scope (`clips/{shader,three-scene}/**` only). The broad
§3 interactive-tier exemption applies, but the generator chooses to
comply anyway because byte-for-byte equality is the architectural
floor.

### Routing (D-T388-4 + T-388a D-T388a-2/3)

`clips/voice/index.ts` registers the wrapper
`voiceStaticFallbackGenerator` against
`staticFallbackGeneratorRegistry` at module-load time, parallel to the
existing `interactiveClipRegistry.register('voice', voiceClipFactory)`
side effect. The harness's static-path routine then dispatches via
`staticFallbackGeneratorRegistry.resolve(clip.family)`:

```
clip.family === 'voice':
  resolve('voice') → voiceStaticFallbackGenerator (registered at import)

  clip.staticFallback.length === 0
    → call generator(clip, reason, emitTelemetry)
    → renders the generator's Element[] via renderStaticFallback
    → emits voice-clip.static-fallback.rendered with `reason`

  clip.staticFallback.length  > 0
    → call generator(clip, 'authored', emitTelemetry)  # telemetry only
    → generator's RETURN value is IGNORED on this path
    → renders the AUTHORED Element[] verbatim
    → emits voice-clip.static-fallback.rendered with reason='authored'
```

Per D-T388a-3, the generator is still invoked on the authored path so
per-family telemetry fires; only its return value is discarded.

### Telemetry — `voice-clip.static-fallback.rendered`

Emitted by the harness on every static-fallback render for
`family: 'voice'`:

| Attribute | Value |
|---|---|
| `family` | `'voice'` |
| `reason` | `'permission-denied' \| 'tenant-denied' \| 'pre-prompt-cancelled' \| 'authored'` |
| `width` | `clip.transform.width` |
| `height` | `clip.transform.height` |
| `posterTextLength` | integer length of `posterText` (or 0). **Privacy: never the body.** |

### Cluster-author override

A cluster author can ship their own `staticFallback` Element[] via the
clip schema's authored field. The default generator runs ONLY when the
authored array is empty; authored content ALWAYS wins (AC #13). Future
work covers tooling for authors to generate a poster from a recorded
sample (out of scope at T-388 — schema + reference fixture only).

## Resource cleanup contract (D-T387-8)

`MountHandle.dispose()` MUST tear down — in this order:

1. The auto-stop timer (if armed).
2. The `TranscriptionProvider`'s returned `stop()`.
3. The `MediaRecorder` (`stop()` if state === `'recording'`).
4. Every track on the captured `MediaStream` (`track.stop()` per track).
5. The `AnalyserNode` (`.disconnect()`).
6. The owning `AudioContext` (`.close()` — promise discarded).
7. Subscriber set (cleared).
8. The React root (`.unmount()`).

`signal.abort` triggers the SAME path. `dispose` is idempotent —
calling twice (or N times) is a no-op.

A leak here is **user-visible** — the browser shows a recording
indicator that does not go away. This is the highest-attention area
for review and testing.

## Telemetry (privacy posture — D-T387-9)

The factory emits via `MountContext.emitTelemetry`:

| Event | Attributes |
|---|---|
| `voice-clip.mount.start` | `family`, `language`, `partialTranscripts` |
| `voice-clip.mount.success` | `family` |
| `voice-clip.mount.failure` | `family`, `reason: 'permission-denied' \| 'web-audio-unavailable' \| 'web-speech-unavailable' \| 'media-recorder-unsupported-mime' \| 'invalid-props'` |
| `voice-clip.recording.started` | `family`, `mimeType` |
| `voice-clip.recording.stopped` | `family`, `durationMs` |
| `voice-clip.transcript.partial` | `family`, `textLength` |
| `voice-clip.transcript.final` | `family`, `textLength` |
| `voice-clip.dispose` | `family` |

**Transcript text body NEVER appears in telemetry.** The privacy
posture is a per-event invariant: the only text-derived attribute is
`textLength` (integer). Cloud adapters added in Phase 14 must preserve
this invariant.

## Determinism contract (D-T387-1)

Voice is **event-driven**, not frame-driven. There is no convergence
test (D-T387-6) and no `frameSource` dependency (D-T387-7). The
interactive tier's broad `check-determinism` exemption (ADR-003 §D5)
applies; the shader sub-rule does NOT (path-matched at
`clips/{shader,three-scene}/**` only).

The factory uses `Date.now()` / `performance.now()` for transcript
timestamps and recording duration measurements. These are wall-clock
by definition and ship without `// determinism-safe` comments — the
broad exemption suffices.

## Bundle + size

The package adds:

- A small (~3 KB min+gz) factory + media-graph + transcription module.
- No new runtime dependencies beyond `@stageflip/schema` and
  `react` / `react-dom` (peers).

Web Speech API + MediaRecorder + Web Audio are browser-native — zero
shipping cost for the recogniser itself.

## Implementation map

| File | Purpose |
|---|---|
| `packages/runtimes/interactive/src/clips/voice/types.ts` | `TranscriptEvent`, `VoiceClipMountHandle`, `VoiceMountFailureReason` |
| `packages/runtimes/interactive/src/clips/voice/factory.ts` | `voiceClipFactory` + `VoiceClipFactoryBuilder` + React mount tree |
| `packages/runtimes/interactive/src/clips/voice/transcription-provider.ts` | `TranscriptionProvider` interface + `WebSpeechApiTranscriptionProvider` + `InMemoryTranscriptionProvider` |
| `packages/runtimes/interactive/src/clips/voice/media-graph.ts` | `MediaGraph` — `MediaRecorder` + `AnalyserNode` setup + teardown |
| `packages/runtimes/interactive/src/clips/voice/index.ts` | Subpath module + side-effect registry registration |
| `packages/runtimes/interactive/src/clips/voice/static-fallback.ts` | `defaultVoiceStaticFallback` — deterministic SVG silhouette + posterText overlay (T-388) |
| `packages/runtimes/interactive/src/prng.ts` | Seeded PRNG primitive (extracted from `clips/three-scene/prng.ts` per T-388 D-T388-3) |
| `packages/schema/src/clips/interactive/voice-props.ts` | `voiceClipPropsSchema` (incl. `posterText?` per T-388 D-T388-1) |

## Pattern-evaluation outcome (T-387 D-T387-11)

T-383 (shader) and T-384 (three-scene) **wrap §3 runtimes**. T-387
does not — voice has no §3 runtime to reuse. The shared parts between
T-383 / T-384 / T-387 are:

1. Schema discriminator file at
   `packages/schema/src/clips/interactive/<family>-props.ts` — a
   5-line shape, not duplicated logic.
2. Subpath export in `package.json` — a 4-line block, convention.
3. Side-effect registration `interactiveClipRegistry.register(...)` —
   a single line.
4. Telemetry event-name shape `<family>-clip.<lifecycle>` —
   convention; no shared code.

None of these is "three similar lines of meaningful logic". Per
CLAUDE.md "three similar lines beat a premature abstraction":
**T-387 extracts no shared abstraction.** Future Implementers (T-389
ai-chat, T-391 live-data, T-393 web-embed, T-395 ai-generative) inherit
this precedent. If genuine logic duplication appears at T-389+, that
is when extraction earns its place.

## Related

- Contract types + registry: `runtimes/contract/SKILL.md`
- Permission flow UX (T-385): `concepts/auth/SKILL.md`
- Frontier-tier ShaderClip (T-383): `runtimes/shader/SKILL.md`
- Frontier-tier ThreeSceneClip (T-384): `runtimes/three/SKILL.md`
- Owning tasks: T-387 (`liveMount`) + T-388 (`staticFallback` waveform
  poster). Both halves of `family: 'voice'` are now live.
