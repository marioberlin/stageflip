// packages/runtimes/interactive/src/clips/ai-chat/factory.ts
// `aiChatClipFactory` — produces the `ClipFactory` for `family: 'ai-chat'`
// (T-389 D-T389-1, D-T389-4). Standalone interactive-tier clip — no §3
// runtime to wrap, no `frameSource` dependency (D-T389-6), no convergence
// test. Mounts a small React tree (output stream + textarea + send button),
// wraps an `LLMChatProvider` to expose a scoped chat with a per-slide
// system prompt baked into the schema.
//
// CRITICAL — D-T389-7: `dispose()` MUST tear down every resource. A
// leaked LLM call wastes tokens; the abort discipline is the architectural
// floor. AC #15-#19.
//
// CRITICAL — D-T389-8 + AC #20: telemetry NEVER carries user-message
// body or assistant-completion body. Only integer attributes
// (`userMessageLength`, `tokenCount`, `durationMs`) plus typed enums.
//
// Browser-safe: React 19 + DOM. No Node imports.

import { type AiChatClipProps, aiChatClipPropsSchema } from '@stageflip/schema';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';

import type { ClipFactory, MountContext } from '../../contract.js';
import type { LLMChatProvider } from './llm-chat-provider.js';
import {
  type AiChatClipMountHandle,
  type AiChatMountFailureReason,
  MultiTurnDisabledError,
  type TurnEvent,
  type TurnHandler,
} from './types.js';

/**
 * Caller-injected hooks. Tests inject an `InMemoryLLMChatProvider`; in
 * production, host code constructs a `RealLLMChatProvider` once at app
 * boot and passes it here.
 */
export interface AiChatClipFactoryOptions {
  /**
   * `LLMChatProvider` implementation. Required at the factory layer —
   * the package ships no production default because the production
   * provider needs a network-bound client (api key + base URL) the host
   * supplies. Tests inject `InMemoryLLMChatProvider`.
   */
  chatProvider?: LLMChatProvider;
}

interface AiChatMountState {
  reactRoot: Root;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  handlers: Set<TurnHandler>;
  /**
   * Per-turn AbortController for the in-flight `streamTurn` call.
   * Replaced at each `send` invocation; at `dispose`, the active one
   * is aborted then cleared.
   */
  activeAbort: AbortController | undefined;
  /**
   * `multiTurn: false` first-call latch. After one `send` resolves /
   * rejects, subsequent calls fail with `MultiTurnDisabledError`.
   */
  singleTurnConsumed: boolean;
  disposed: boolean;
}

/**
 * Test-only seam: a private accessor that the unit tests use to
 * inspect internal state (history, active abort) without monkey-
 * patching. Production code does NOT consume this; AC #16 pins
 * the dispose-clears-history invariant via this seam.
 */
export interface AiChatClipMountHandleWithTestSeam extends AiChatClipMountHandle {
  /** @internal — test-only state inspector. */
  readonly __test__: {
    historySize: () => number;
    handlerCount: () => number;
    isAbortAttached: () => boolean;
  };
}

/**
 * Convenience namespace for the factory builder. Mirrors the shape
 * of `VoiceClipFactoryBuilder` (T-387) for consistency across γ-live
 * factories.
 */
export const AiChatClipFactoryBuilder = {
  build(options: AiChatClipFactoryOptions = {}): ClipFactory {
    return (ctx: MountContext) => mountAiChatClip(ctx, options);
  },
};

/**
 * Mount routine. Top-level function — ai-chat lives outside the shader
 * sub-rule scope. The structural shape is for consistency, not for
 * sub-rule compliance.
 */
async function mountAiChatClip(
  ctx: MountContext,
  options: AiChatClipFactoryOptions,
): Promise<AiChatClipMountHandle> {
  const family = ctx.clip.family;

  // 1. Parse + narrow `liveMount.props`.
  const propsResult = aiChatClipPropsSchema.safeParse(ctx.clip.liveMount.props);
  if (!propsResult.success) {
    ctx.emitTelemetry('ai-chat-clip.mount.failure', {
      family,
      reason: 'invalid-props' satisfies AiChatMountFailureReason,
      issues: propsResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    throw new Error(
      `aiChatClipFactory: liveMount.props failed aiChatClipPropsSchema — ${propsResult.error.message}`,
    );
  }
  const props: AiChatClipProps = propsResult.data;

  // 2. Resolve chat provider. The factory rejects if none is supplied —
  //    a missing provider is a configuration bug at app boot, not a
  //    permission denial.
  const chatProvider = options.chatProvider;
  if (chatProvider === undefined) {
    ctx.emitTelemetry('ai-chat-clip.mount.failure', {
      family,
      reason: 'provider-unavailable' satisfies AiChatMountFailureReason,
    });
    throw new Error(
      'aiChatClipFactory: no LLMChatProvider supplied. Pass `chatProvider` to AiChatClipFactoryBuilder.build({}) at app boot.',
    );
  }

  // 3. Telemetry — mount.start. Per D-T389-8 the `provider` and `model`
  //    strings ARE included; they are configuration, not user content.
  ctx.emitTelemetry('ai-chat-clip.mount.start', {
    family,
    provider: props.provider,
    model: props.model,
  });

  // 4. Build React root + initial render.
  const state: AiChatMountState = {
    reactRoot: createRoot(ctx.root),
    history: [],
    handlers: new Set(),
    activeAbort: undefined,
    singleTurnConsumed: false,
    disposed: false,
  };
  flushSync(() => {
    state.reactRoot.render(createElement(AiChatClipMount, {}));
  });

  // Telemetry — mount.success.
  ctx.emitTelemetry('ai-chat-clip.mount.success', { family });

  // ----- private helpers -----

  /** Dispatch one turn event to every subscriber. */
  const dispatchTurn = (event: TurnEvent): void => {
    for (const handler of state.handlers) {
      try {
        handler(event);
      } catch {
        /* swallow — one handler's throw must not break siblings */
      }
    }
  };

  /** Wall-clock helper. The interactive tier exempts the broad rule. */
  const nowMs = (): number => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  };

  const send = async (userMessage: string): Promise<void> => {
    if (state.disposed) {
      // No-op on disposed clips. The host should not be calling `send`
      // post-dispose; we choose silent return over throw because the
      // dispose-then-send race is observable in test harnesses.
      return;
    }

    if (!props.multiTurn && state.singleTurnConsumed) {
      throw new MultiTurnDisabledError();
    }
    state.singleTurnConsumed = true;

    // Per-turn AbortController. Replaces any prior one (a fresh `send`
    // after a completed turn always starts with a new controller).
    const abort = new AbortController();
    state.activeAbort = abort;

    // Snapshot history BEFORE we push the user message — the provider
    // takes (history, userMessage) as separate args.
    const historySnapshot = state.history.map((m) => ({ role: m.role, content: m.content }));

    // Emit the `user` event upfront so subscribers can render the user
    // bubble before tokens stream.
    const userTs = nowMs();
    dispatchTurn({ kind: 'user', text: userMessage, timestampMs: userTs });

    // Telemetry — turn.started. NEVER includes the message body
    // (D-T389-8 + AC #20). userMessageLength is the integer length.
    let turnIdForTelemetry: string | undefined;
    const startedAt = userTs;

    // Accumulator — each onToken append, plus a fallback to finalText
    // if the provider emits the full text only at the end.
    let accumulated = '';

    try {
      const result = await chatProvider.streamTurn({
        systemPrompt: props.systemPrompt,
        history: historySnapshot,
        userMessage,
        model: props.model,
        maxTokens: props.maxTokens,
        temperature: props.temperature,
        signal: abort.signal,
        onToken: (token, turnId) => {
          if (state.disposed || abort.signal.aborted) return;
          if (turnIdForTelemetry === undefined) {
            turnIdForTelemetry = turnId;
            // Emit turn.started exactly once, when the first token
            // arrives or — if no tokens arrive — after streamTurn
            // resolves. Doing it here ensures we have the turnId.
            ctx.emitTelemetry('ai-chat-clip.turn.started', {
              family,
              turnId,
              userMessageLength: userMessage.length,
            });
          }
          accumulated += token;
          dispatchTurn({
            kind: 'assistant-token',
            text: token,
            turnId,
            timestampMs: nowMs(),
          });
        },
      });

      if (state.disposed || abort.signal.aborted) {
        // Disposed mid-flight; `dispose` cleared history already and
        // the active subscriber set is gone. Quiet return (no
        // assistant-final event after dispose).
        return;
      }

      // If the provider streamed nothing but resolved with finalText,
      // emit turn.started now so the lifecycle pair stays balanced.
      if (turnIdForTelemetry === undefined) {
        turnIdForTelemetry = result.turnId;
        ctx.emitTelemetry('ai-chat-clip.turn.started', {
          family,
          turnId: result.turnId,
          userMessageLength: userMessage.length,
        });
      }

      const finalText = result.finalText.length > 0 ? result.finalText : accumulated;

      // Update history AFTER the turn completes (matches the provider's
      // view: the user message + assistant reply are committed together).
      state.history.push({ role: 'user', content: userMessage });
      state.history.push({ role: 'assistant', content: finalText });

      const finishedAt = nowMs();
      dispatchTurn({
        kind: 'assistant-final',
        text: finalText,
        turnId: result.turnId,
        timestampMs: finishedAt,
      });

      ctx.emitTelemetry('ai-chat-clip.turn.finished', {
        family,
        turnId: result.turnId,
        durationMs: Math.max(0, finishedAt - startedAt),
        tokenCount: finalText.length,
      });
    } catch (err) {
      // The provider rejected (or `signal.abort()` propagated through).
      // We surface the error event AND emit turn.error telemetry.
      const turnId = turnIdForTelemetry ?? 'turn-unknown';
      const message = err instanceof Error ? err.message : String(err);
      const errorKind =
        err instanceof Error
          ? // RealLLMChatProvider wraps via classifyError → LLMError with `kind`.
            // Read it duck-typed to keep the import surface tiny.
            ((err as { kind?: string }).kind ?? err.name)
          : 'unknown';

      // Suppress the error event on dispose-driven aborts — the host
      // already tore down; surfacing `error` would just be noise.
      if (!state.disposed && !abort.signal.aborted) {
        dispatchTurn({ kind: 'error', message, turnId });
      }

      ctx.emitTelemetry('ai-chat-clip.turn.error', {
        family,
        turnId,
        errorKind,
      });

      throw err;
    } finally {
      // Clear the per-turn controller if it's still ours (a dispose
      // mid-flight may have replaced or cleared it already).
      if (state.activeAbort === abort) {
        state.activeAbort = undefined;
      }
    }
  };

  const reset = (): void => {
    if (state.disposed) return;
    state.history.length = 0;
    state.singleTurnConsumed = false;
  };

  const dispose = (): void => {
    if (state.disposed) return;
    state.disposed = true;
    // 1. Abort any in-flight call (D-T389-7 + AC #15).
    if (state.activeAbort !== undefined) {
      try {
        state.activeAbort.abort();
      } catch {
        /* defensive */
      }
      state.activeAbort = undefined;
    }
    // 2. Drop accumulated history (AC #16).
    state.history.length = 0;
    // 3. Unsubscribe all handlers (AC #17).
    state.handlers.clear();
    // 4. Unmount the React root.
    state.reactRoot.unmount();
    // 5. Final telemetry.
    ctx.emitTelemetry('ai-chat-clip.dispose', { family });
  };

  // Wire signal.abort → dispose at the factory layer (the harness wraps
  // again, but a factory-level wire keeps the contract honest for direct-
  // factory consumers).
  if (ctx.signal.aborted) {
    dispose();
  } else {
    ctx.signal.addEventListener(
      'abort',
      () => {
        dispose();
      },
      { once: true },
    );
  }

  // Build the test-seam shim. Production callers see only the public
  // `AiChatClipMountHandle` shape; tests cast to the seam variant.
  const handle: AiChatClipMountHandleWithTestSeam = {
    updateProps: () => {
      // ai-chat props are mount-time configuration; runtime updates
      // are out-of-scope for T-389. No-op.
    },
    dispose,
    send,
    onTurn: (handler: TurnHandler) => {
      state.handlers.add(handler);
      return () => {
        state.handlers.delete(handler);
      };
    },
    reset,
    __test__: {
      historySize: () => state.history.length,
      handlerCount: () => state.handlers.size,
      isAbortAttached: () => state.activeAbort !== undefined,
    },
  };

  return handle;
}

/**
 * Minimal React tree for the ai-chat clip's visual surface. Per
 * CLAUDE.md §10, no English UI strings ship in the package — host apps
 * style and label via the data attributes the surface exposes.
 *
 * The component is intentionally stateless: chat state lives on the
 * `AiChatClipMountHandle`, not in the visual tree. Hosts that want a
 * data-streaming attribute mirror subscribe to `onTurn` and update
 * their own DOM.
 */
function AiChatClipMount(): ReturnType<typeof createElement> {
  return createElement(
    'div',
    { 'data-stageflip-ai-chat-clip': 'true' },
    createElement('output', { 'data-role': 'message-stream' }),
    createElement('textarea', { 'data-role': 'user-input' }),
    createElement('button', {
      type: 'button',
      'data-action': 'send',
    }),
  );
}

/**
 * The default factory instance — no options. Production mounts MUST
 * pass a `chatProvider` via `AiChatClipFactoryBuilder.build({...})`;
 * the no-options export exists so the registry has a concrete factory
 * to register at side-effect import time. Mounting the no-options
 * factory will fail with `mount.failure` reason `'provider-unavailable'`,
 * which is the correct behaviour for an under-configured deployment.
 */
export const aiChatClipFactory: ClipFactory = AiChatClipFactoryBuilder.build();
