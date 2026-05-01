// packages/runtimes/interactive/src/clips/ai-generative/types.ts
// Public types for the `family: 'ai-generative'` factory (T-395
// D-T395-4 + D-T395-5). Browser-safe — no DOM imports beyond the
// standard ambient types.
//
// `ResultEvent` and `ErrorEvent` are the two emission shapes the
// factory dispatches to subscribers. `AiGenerativeClipMountHandle`
// extends the base `MountHandle` with generative-specific lifecycle
// controls (`regenerate`, `getResult`, `onResult`, `onError`).

import type { MountHandle } from '../../contract.js';

/**
 * Resolved-result event. Fires once per successful generation — at
 * mount-time AND on every successful `regenerate()` call.
 */
export interface ResultEvent {
  kind: 'resolved';
  /** Generated artifact. The clip OWNS the blob (do not retain past dispose). */
  blob: Blob;
  /** MIME type as reported by the provider; may not be `image/*`. */
  contentType: string;
  /** Wall-clock duration of the generation in milliseconds. */
  durationMs: number;
}

/**
 * Error event. Fires once per failed generation. Two subkinds:
 *
 * - `generate-error` — the provider rejected (transport / quota /
 *   safety). The message is the underlying error's message.
 * - `aborted` — the per-generation `AbortController.abort()` fired
 *   before resolution. Either dispose-driven or signal-driven.
 */
export interface ErrorEvent {
  kind: 'generate-error' | 'aborted';
  /** Human-readable message. NEVER includes the prompt body. */
  message: string;
}

/** Subscriber callback for resolved results. */
export type ResultHandler = (event: ResultEvent) => void;

/** Subscriber callback for errors. */
export type ErrorHandler = (event: ErrorEvent) => void;

/**
 * Mount handle returned by `aiGenerativeClipFactory`. Extends the
 * base `MountHandle` with generative lifecycle controls.
 *
 * Lifecycle: instances are created idle and immediately fire one
 * background generation at mount time. `regenerate()` re-runs with
 * the current props (aborts any in-flight call first). `dispose` is
 * the terminal step and is idempotent.
 */
export interface AiGenerativeClipMountHandle extends MountHandle {
  /**
   * Re-run generation with the current props. Aborts any in-flight
   * generation first. Resolves when the new generation settles.
   */
  regenerate(): Promise<void>;
  /**
   * Latest resolved result. `undefined` until the first generation
   * resolves successfully. The `blob` is owned by the clip — hosts
   * that want to outlive the clip MUST clone the Blob.
   */
  getResult(): { blob: Blob; contentType: string } | undefined;
  /** Subscribe to result events. Returns unsubscribe. */
  onResult(handler: ResultHandler): () => void;
  /** Subscribe to error events. Returns unsubscribe. */
  onError(handler: ErrorHandler): () => void;
}

/**
 * Failure reasons emitted via `ai-generative-clip.mount.failure`
 * telemetry (D-T395-8). Pinned strings — the security-review
 * pipeline keys on them.
 */
export type AiGenerativeMountFailureReason =
  | 'invalid-props'
  | 'generator-unavailable'
  | 'permission-denied';
