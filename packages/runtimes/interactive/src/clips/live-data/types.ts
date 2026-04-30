// packages/runtimes/interactive/src/clips/live-data/types.ts
// Public types for the `family: 'live-data'` factory (T-391 D-T391-4 +
// D-T391-5). Browser-safe — no DOM imports beyond the standard ambient
// types.
//
// `DataEvent` and `ErrorEvent` are the two emission shapes the factory
// dispatches to subscribers. `LiveDataClipMountHandle` extends the base
// `MountHandle` with live-data-specific lifecycle controls (`refresh`,
// `getData`, `getStatus`, `onData`, `onError`).

import type { MountHandle } from '../../contract.js';

/**
 * Resolved-data event. Fires once per successful fetch — at mount-time
 * for `refreshTrigger: 'mount-only'`, plus once per `refresh()` call for
 * `refreshTrigger: 'manual'`.
 */
export interface DataEvent {
  kind: 'resolved';
  /** HTTP status code from the response. */
  status: number;
  /** Parsed body per the clip's `parseMode`. */
  data: unknown;
  /** Wall-clock duration of the fetch in milliseconds. */
  durationMs: number;
}

/**
 * Error event. Fires once per failed fetch path. Three subkinds:
 *
 * - `fetch-error` — the host-injected `Fetcher` (or its underlying
 *   transport) rejected. The message is the underlying error's message.
 * - `parse-error` — the response body could not be parsed per
 *   `parseMode`. JSON-mode parse errors are the typical case.
 * - `aborted` — the per-fetch `AbortController.abort()` fired before
 *   resolution. Either dispose-driven or signal-driven.
 */
export interface ErrorEvent {
  kind: 'fetch-error' | 'parse-error' | 'aborted';
  /** Human-readable message. NEVER includes the response body. */
  message: string;
}

/** Subscriber callback for resolved data. */
export type DataHandler = (event: DataEvent) => void;

/** Subscriber callback for errors. */
export type ErrorHandler = (event: ErrorEvent) => void;

/**
 * Mount handle returned by `liveDataClipFactory`. Extends the base
 * `MountHandle` with live-data lifecycle controls.
 *
 * Lifecycle: instances are created idle and immediately fire one
 * background fetch (per `refreshTrigger: 'mount-only'`) at mount time.
 * `refresh()` re-fetches when `refreshTrigger: 'manual'` and rejects
 * with `RefreshTriggerError` otherwise. `dispose` is the terminal step
 * and is idempotent.
 */
export interface LiveDataClipMountHandle extends MountHandle {
  /**
   * Re-fetch using the current endpoint/method/body/headers config.
   * Resolves when the new fetch settles. Rejects with
   * `RefreshTriggerError` if the clip was configured with
   * `refreshTrigger: 'mount-only'`.
   */
  refresh(): Promise<void>;
  /**
   * Latest resolved data (parsed per `parseMode`). `undefined` until
   * the first fetch resolves successfully.
   */
  getData(): unknown | undefined;
  /**
   * Latest resolved status code. `undefined` until the first fetch
   * resolves successfully.
   */
  getStatus(): number | undefined;
  /** Subscribe to data resolution events. Returns unsubscribe. */
  onData(handler: DataHandler): () => void;
  /** Subscribe to error events. Returns unsubscribe. */
  onError(handler: ErrorHandler): () => void;
}

/**
 * Failure reasons emitted via `live-data-clip.mount.failure` telemetry
 * (D-T391-8). Pinned strings — the security-review pipeline keys on
 * them.
 */
export type LiveDataMountFailureReason =
  | 'invalid-props'
  | 'fetcher-unavailable'
  | 'permission-denied';

/**
 * Thrown by `refresh()` when the clip was configured with
 * `refreshTrigger: 'mount-only'`. The first mount-time fetch is
 * permitted; subsequent `refresh()` calls reject with this error
 * (D-T391-4 + AC #14). Typed throw, NOT a silent no-op.
 */
export class RefreshTriggerError extends Error {
  constructor() {
    super(
      "LiveDataClip is configured with `refreshTrigger: 'mount-only'`; only the mount-time fetch is permitted. Configure `refreshTrigger: 'manual'` to permit `refresh()` calls.",
    );
    this.name = 'RefreshTriggerError';
  }
}
