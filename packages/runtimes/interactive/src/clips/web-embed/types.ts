// packages/runtimes/interactive/src/clips/web-embed/types.ts
// Public types for the `family: 'web-embed'` factory (T-393 D-T393-4).
// Browser-safe — no DOM imports beyond the standard ambient types.
//
// Unlike voice / ai-chat / live-data, web-embed has NO provider seam:
// the browser's `<iframe>` element IS the runtime; the factory just
// creates and disposes the DOM. The MountHandle exposes
// reload / postMessage / onMessage with origin filtering.

import type { MountHandle } from '../../contract.js';

/**
 * Inbound postMessage event — the filtered shape `onMessage`
 * subscribers receive. Events are filtered to require BOTH
 * `event.source === iframe.contentWindow` AND
 * `event.origin ∈ props.allowedOrigins` (D-T393-4 + AC #13).
 */
export interface WebEmbedMessageEvent {
  /** Origin of the message (always one of `allowedOrigins`). */
  origin: string;
  /** Message data. The clip does NOT validate; subscribers may. */
  data: unknown;
}

/** Subscriber callback for inbound messages. */
export type WebEmbedMessageHandler = (event: WebEmbedMessageEvent) => void;

/**
 * Mount handle returned by `webEmbedClipFactory`. Extends the base
 * `MountHandle` with iframe-specific lifecycle controls.
 */
export interface WebEmbedClipMountHandle extends MountHandle {
  /**
   * Reload the iframe (host-driven; equivalent to re-assigning
   * `iframe.src` to the configured URL). Useful for "Refresh"
   * affordances in the host UI.
   */
  reload(): void;
  /**
   * Send a postMessage to the iframe's contentWindow. The factory
   * forwards `targetOrigin = origin(props.url)` — NOT `'*'`. The host
   * knows which page they embedded; reflexive `'*'` would defeat the
   * scoping.
   */
  postMessage(message: unknown): void;
  /**
   * Subscribe to inbound postMessage events from the iframe, filtered
   * by `allowedOrigins`. Returns an unsubscribe function. Multiple
   * subscribers are supported; events are dispatched in subscriber-
   * registration order.
   */
  onMessage(handler: WebEmbedMessageHandler): () => void;
}

/**
 * Failure reasons emitted via `web-embed-clip.mount.failure` telemetry
 * (D-T393-8). Pinned strings — the security-review pipeline keys on
 * them.
 */
export type WebEmbedMountFailureReason = 'invalid-props' | 'permission-denied';

/**
 * Drop reasons emitted via `web-embed-clip.message.dropped` telemetry
 * (D-T393-8). Pinned strings — security observability keys on them
 * (a rogue page sending postMessage from a nested iframe must produce
 * distinguishable telemetry from a wrong-origin attempt).
 */
export type WebEmbedMessageDropReason =
  | 'origin-not-allowed'
  | 'source-mismatch'
  | 'pre-mount'
  | 'post-dispose';
