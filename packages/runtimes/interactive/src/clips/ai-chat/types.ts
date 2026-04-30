// packages/runtimes/interactive/src/clips/ai-chat/types.ts
// Public types for the `family: 'ai-chat'` factory (T-389 D-T389-4 +
// D-T389-5). Browser-safe — no DOM imports beyond the standard ambient
// types.
//
// `TurnEvent` is the single emission shape every LLM-chat provider seam
// produces; the seam (`LLMChatProvider`, see `./llm-chat-provider.ts`)
// hides whether the underlying source is `@stageflip/llm-abstraction`'s
// real provider, an `InMemoryLLMChatProvider` for tests, or a future
// tenant-supplied custom endpoint.

import type { MountHandle } from '../../contract.js';

/**
 * A single turn-stream event. Four variants:
 *
 * - `user` — surfaced when the host calls `send(userMessage)`. Contains
 *   the user's text body. Subscribers MAY render this for an authoring
 *   UI; the package itself emits no DOM mirror beyond the bare textarea.
 * - `assistant-token` — streaming token from the active turn. Multiple
 *   `assistant-token` events fire per turn; concatenating their `text`
 *   fields yields the running assistant body.
 * - `assistant-final` — terminal event for a turn. `text` is the FULL
 *   assistant message (not the last token).
 * - `error` — provider rejection during the turn. The active turn is
 *   considered terminal; the parent `send` Promise rejects with the
 *   same underlying error wrapped.
 */
export type TurnEvent =
  | { kind: 'user'; text: string; timestampMs: number }
  | { kind: 'assistant-token'; text: string; turnId: string; timestampMs: number }
  | { kind: 'assistant-final'; text: string; turnId: string; timestampMs: number }
  | { kind: 'error'; message: string; turnId: string };

/**
 * Subscriber callback handed to `AiChatClipMountHandle.onTurn`.
 */
export type TurnHandler = (event: TurnEvent) => void;

/**
 * Mount handle returned by `aiChatClipFactory`. Extends the base
 * `MountHandle` with chat-specific lifecycle controls.
 *
 * Lifecycle: instances are created idle. `send(userMessage)` runs one
 * turn end-to-end and resolves when the assistant turn is fully consumed
 * (last `assistant-final` event has fired). `reset()` drops the
 * accumulated message history; the system prompt is NOT dropped (it is
 * baked into the schema). `dispose` is the terminal step and is
 * idempotent.
 */
export interface AiChatClipMountHandle extends MountHandle {
  /**
   * Send a user message. Resolves when the assistant turn fully
   * resolves; rejects if the provider errors. With `multiTurn: false`,
   * a second `send` rejects with `MultiTurnDisabledError`.
   */
  send(userMessage: string): Promise<void>;
  /**
   * Subscribe to turn events. Returns an unsubscribe function. Multiple
   * subscribers are supported; events are dispatched in subscriber-
   * registration order.
   */
  onTurn(handler: TurnHandler): () => void;
  /**
   * Drop accumulated message history. Subsequent `send` calls send no
   * prior messages to the provider; the system prompt persists.
   */
  reset(): void;
}

/**
 * Failure reasons emitted via `ai-chat-clip.mount.failure` telemetry
 * (D-T389-8). Pinned strings — the security-review pipeline keys on
 * them.
 */
export type AiChatMountFailureReason =
  | 'invalid-props'
  | 'provider-unavailable'
  | 'permission-denied';

/**
 * Thrown by `send` on a clip configured `multiTurn: false` when called
 * a second time. The first `send` is allowed; subsequent calls reject
 * with this error (NOT a silent no-op — D-T389-4 + AC #13).
 */
export class MultiTurnDisabledError extends Error {
  constructor() {
    super(
      'AiChatClip is configured with `multiTurn: false`; only one `send` call is permitted. Call `reset()` then `dispose()` and remount for a fresh single-turn session.',
    );
    this.name = 'MultiTurnDisabledError';
  }
}
