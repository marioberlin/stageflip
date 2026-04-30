// packages/runtimes/interactive/src/clips/ai-chat/llm-chat-provider.ts
// `LLMChatProvider` interface + two implementations for T-389
// (D-T389-5):
//
//   1. `RealLLMChatProvider` — wraps a `LLMProvider` from
//      `@stageflip/llm-abstraction`. The factory is constructed with
//      either a pre-built `LLMProvider` (test seam) or a `CreateProviderSpec`
//      (production path; the seam calls `createProvider(spec)` once at
//      construction time).
//   2. `InMemoryLLMChatProvider` — emits a scripted token sequence over
//      time. Used by the factory tests and by host integration tests
//      that don't want to stub a network LLM globally.
//
// A custom-provider seam (e.g., a tenant's self-hosted endpoint) is a
// future asset-gen task — Phase 14 ADR-006 covers the pattern. T-389
// ships the seam shape; tenant-specific adapters do not land here.
//
// BROWSER-SAFE — no Node-only imports. The wrapped `@stageflip/llm-abstraction`
// providers are themselves browser-callable when the host supplies an
// `AnthropicLike` / `OpenAILike` / `GeminiClientLike` client, but the
// network round-trip itself is the consumer's responsibility (the
// network-permission gate vetted egress upstream).

import {
  type CreateProviderSpec,
  type LLMProvider,
  type LLMStreamEvent,
  classifyError,
  createProvider,
} from '@stageflip/llm-abstraction';

/**
 * Arguments to `LLMChatProvider.streamTurn`. The provider OWNS the
 * transport from `streamTurn` resolution through to the returned
 * `{ finalText, turnId }` tuple — the factory waits for this resolution
 * before resolving the parent `send` promise.
 *
 * `signal` is the per-turn AbortSignal: a `dispose()` while a turn is
 * in flight aborts the underlying provider call (D-T389-7 + AC #15).
 */
export interface LLMChatStreamArgs {
  /** Per-slide system prompt (baked into the schema). */
  systemPrompt: string;
  /** Accumulated history excluding the current turn's user message. */
  history: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
  /** The new user message for this turn. */
  userMessage: string;
  /** Model identifier (e.g., `'gpt-4o-mini'`, `'claude-3-5-sonnet-latest'`). */
  model: string;
  /** Token cap forwarded to the provider's request. */
  maxTokens: number;
  /** Sampling temperature forwarded to the provider's request. */
  temperature: number;
  /**
   * Token-arrival callback. Invoked once per assistant token chunk. The
   * provider MAY emit zero-length chunks; the factory filters those.
   * `turnId` is opaque to the provider — the factory generates it.
   */
  onToken: (token: string, turnId: string) => void;
  /** Cancellation signal. Aborts the in-flight provider call. */
  signal: AbortSignal;
}

/**
 * The chat seam. Two implementations ship with T-389; future tenant
 * adapters or cloud-only providers add a third.
 */
export interface LLMChatProvider {
  /**
   * Stream a single turn end-to-end. Resolves when the assistant turn
   * has been fully consumed; the resolution carries the FULL final
   * assistant text and the same opaque `turnId` carried in `onToken`
   * callbacks.
   *
   * Rejections from `streamTurn` route via the factory's
   * `ai-chat-clip.turn.error` telemetry. The factory does NOT classify
   * the rejection itself — the seam is responsible for surfacing a
   * meaningful Error.
   */
  streamTurn(args: LLMChatStreamArgs): Promise<{ finalText: string; turnId: string }>;
}

// ---------- Real provider — wraps @stageflip/llm-abstraction ----------

/**
 * Construction options for {@link RealLLMChatProvider}. EXACTLY ONE of
 * `provider` or `spec` must be supplied.
 */
export interface RealLLMChatProviderOptions {
  /** Pre-built `LLMProvider` instance (test seam; preferred when available). */
  provider?: LLMProvider;
  /** Provider-creation spec — calls `createProvider(spec)` once at construction. */
  spec?: CreateProviderSpec;
}

/**
 * `LLMChatProvider` backed by `@stageflip/llm-abstraction`. The
 * implementation feeds `onToken` for every `text_delta` event in the
 * underlying neutral stream and aggregates the final text by
 * concatenation (matching `collectStream`'s text-block accumulation).
 *
 * The seam intentionally does NOT consume tool-use streams; tool-use
 * extension is out-of-scope at T-389 per the task spec. A future task
 * surfaces tool-use through the clip's prop schema.
 */
export class RealLLMChatProvider implements LLMChatProvider {
  private readonly provider: LLMProvider;

  constructor(options: RealLLMChatProviderOptions) {
    if (options.provider !== undefined) {
      this.provider = options.provider;
    } else if (options.spec !== undefined) {
      this.provider = createProvider(options.spec);
    } else {
      throw new Error(
        'RealLLMChatProvider requires exactly one of `provider` or `spec` in its constructor options.',
      );
    }
  }

  async streamTurn(args: LLMChatStreamArgs): Promise<{ finalText: string; turnId: string }> {
    const turnId = makeTurnId();
    const messages = [
      ...args.history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: args.userMessage },
    ];

    let finalText = '';

    try {
      const stream = this.provider.stream(
        {
          model: args.model,
          messages,
          system: args.systemPrompt,
          max_tokens: args.maxTokens,
          temperature: args.temperature,
        },
        { signal: args.signal },
      );
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const token: string = event.delta.text;
          if (token.length === 0) continue;
          finalText += token;
          args.onToken(token, turnId);
        }
      }
    } catch (err) {
      // Normalize any thrown shape to an LLMError with a meaningful kind.
      // The factory rethrows; classifyError preserves the cause chain so
      // host telemetry / error UIs can branch on `error.kind`.
      throw classifyError(this.provider.name, err);
    }

    return { finalText, turnId };
  }
}

// Local helper — the turnId is a non-cryptographic monotonic counter
// derived from a closure-captured value (no `Math.random` / `Date.now`
// here, even though the interactive tier is exempt — keeping the seam
// deterministic across tests is convenient and free).
let __turnCounter = 0;
function makeTurnId(): string {
  __turnCounter += 1;
  return `turn-${__turnCounter}`;
}

/**
 * Test-only helper to reset the turn-id counter. Production code never
 * calls this.
 */
export function __resetTurnIdCounterForTests(): void {
  __turnCounter = 0;
}

// ---------- In-memory provider (tests) ----------

/**
 * One scripted entry: a token paired with its delivery delay (in ms,
 * relative to `streamTurn` invocation).
 */
export interface ScriptedTokenStep {
  /** Delay in ms after `streamTurn` invocation. */
  delayMs: number;
  /** Token text. The in-memory provider does NOT filter empty tokens. */
  token: string;
}

export interface InMemoryLLMChatProviderOptions {
  /**
   * Scripted token sequence per `streamTurn` call. The same sequence
   * is replayed on every turn — tests that need a per-turn varying
   * sequence can rebuild the provider between turns or supply a
   * function-based variant in a follow-up.
   */
  scripted: ReadonlyArray<ScriptedTokenStep>;
  /**
   * Optional fixed final text. Defaults to the concatenation of
   * scripted tokens.
   */
  finalText?: string;
  /**
   * Optional pre-canned error. When set, `streamTurn` rejects with
   * this error after the scripted tokens have been emitted (or
   * immediately if `scripted` is empty). Lets tests pin AC #12.
   */
  rejectWith?: Error;
  /**
   * Override the timer host. Defaults to global `setTimeout` /
   * `clearTimeout`. Tests inject a fake timer to drive deterministic
   * emission.
   */
  timers?: {
    setTimeout: (cb: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
  };
}

/**
 * `LLMChatProvider` that emits a hard-coded sequence of tokens. Used by
 * the factory tests; production code never instantiates this.
 *
 * Implementation note: signal aborts halt token emission. The provider
 * rejects with an `AbortError` when the signal aborts mid-stream, so
 * the factory's abort-discipline path surfaces.
 */
export class InMemoryLLMChatProvider implements LLMChatProvider {
  private readonly scripted: ReadonlyArray<ScriptedTokenStep>;
  private readonly finalTextOverride: string | undefined;
  private readonly rejectWith: Error | undefined;
  private readonly timerSet: (cb: () => void, ms: number) => unknown;
  private readonly timerClear: (handle: unknown) => void;

  constructor(options: InMemoryLLMChatProviderOptions) {
    this.scripted = options.scripted;
    this.finalTextOverride = options.finalText;
    this.rejectWith = options.rejectWith;
    if (options.timers !== undefined) {
      this.timerSet = options.timers.setTimeout;
      this.timerClear = options.timers.clearTimeout;
    } else {
      this.timerSet = (cb, ms) => setTimeout(cb, ms);
      this.timerClear = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>);
    }
  }

  streamTurn(args: LLMChatStreamArgs): Promise<{ finalText: string; turnId: string }> {
    const turnId = makeTurnId();
    return new Promise((resolve, reject) => {
      const handles: unknown[] = [];
      let aborted = false;
      let emitted = 0;

      const finishOk = (): void => {
        if (aborted) return;
        const finalText = this.finalTextOverride ?? this.scripted.map((s) => s.token).join('');
        resolve({ finalText, turnId });
      };

      const finishErr = (err: Error): void => {
        if (aborted) return;
        reject(err);
      };

      const onAbort = (): void => {
        if (aborted) return;
        aborted = true;
        for (const h of handles) this.timerClear(h);
        const err = new Error('AbortError');
        err.name = 'AbortError';
        reject(err);
      };

      if (args.signal.aborted) {
        onAbort();
        return;
      }
      args.signal.addEventListener('abort', onAbort, { once: true });

      // Schedule the scripted tokens.
      for (const step of this.scripted) {
        const handle = this.timerSet(() => {
          if (aborted) return;
          args.onToken(step.token, turnId);
          emitted += 1;
          if (emitted === this.scripted.length) {
            // Last scheduled token — schedule the resolve / reject on the next tick.
            const tail = this.timerSet(() => {
              if (this.rejectWith !== undefined) finishErr(this.rejectWith);
              else finishOk();
            }, 0);
            handles.push(tail);
          }
        }, step.delayMs);
        handles.push(handle);
      }

      // No scripted tokens at all → settle immediately.
      if (this.scripted.length === 0) {
        const tail = this.timerSet(() => {
          if (this.rejectWith !== undefined) finishErr(this.rejectWith);
          else finishOk();
        }, 0);
        handles.push(tail);
      }
    });
  }
}

// Re-export `LLMStreamEvent` so consumers building bespoke providers
// against the seam don't have to reach into `@stageflip/llm-abstraction`
// directly.
export type { LLMStreamEvent };
