// packages/runtimes/interactive/src/clips/voice/types.ts
// Public types for the `family: 'voice'` factory (T-387 D-T387-4 + D-T387-5).
// Browser-safe — no DOM imports beyond the standard `MediaStream` /
// `MediaRecorder` Web Audio surface (lib.dom.d.ts ambient types).
//
// `TranscriptEvent` is the single emission shape every transcription provider
// produces; the provider seam (D-T387-5) hides whether the underlying source
// is `Web Speech API`, an `InMemoryTranscriptionProvider` for tests, or a
// future cloud adapter (deferred to Phase 14 ADR-006).

import type { MountHandle } from '../../contract.js';

/**
 * A single transcript-stream event. Three variants:
 *
 * - `partial` — interim text emitted while the user is still speaking.
 *   Suppressed at the factory layer when `partialTranscripts: false`.
 * - `final` — finalized text the recogniser has committed to. Always
 *   surfaces regardless of the `partialTranscripts` setting.
 * - `error` — transcription pipeline failure. The provider's `start()`
 *   rejection surfaces separately (mount.failure); `error` events are
 *   recoverable in-stream (e.g., transient network blip on a future
 *   cloud provider).
 */
export type TranscriptEvent =
  | { kind: 'partial'; text: string; timestampMs: number }
  | { kind: 'final'; text: string; timestampMs: number }
  | { kind: 'error'; message: string };

/**
 * Subscriber callback handed to `VoiceClipMountHandle.onTranscript`.
 */
export type TranscriptHandler = (event: TranscriptEvent) => void;

/**
 * Mount handle returned by `voiceClipFactory`. Extends the base
 * `MountHandle` with voice-specific lifecycle controls.
 *
 * Lifecycle: instances are created in the IDLE state. `startRecording`
 * acquires the microphone stream and begins capture; `stopRecording`
 * tears down the active recorder + transcription. `dispose` is the
 * terminal step and is idempotent.
 */
export interface VoiceClipMountHandle extends MountHandle {
  /** Begin microphone capture + transcription. */
  startRecording(): Promise<void>;
  /** Stop the active recording. No-op if not recording. */
  stopRecording(): Promise<void>;
  /**
   * Subscribe to transcript events. Returns an unsubscribe function.
   * Multiple subscribers are supported; events are dispatched in the
   * order subscribers registered.
   */
  onTranscript(handler: TranscriptHandler): () => void;
}

/**
 * Failure reasons emitted via `voice-clip.mount.failure` telemetry.
 * Pinned strings (D-T387-9); the security-review pipeline keys on them.
 */
export type VoiceMountFailureReason =
  | 'permission-denied'
  | 'web-audio-unavailable'
  | 'web-speech-unavailable'
  | 'transcription-failed'
  | 'media-recorder-unsupported-mime'
  | 'invalid-props';
