// packages/runtimes/interactive/src/clips/ai-chat/factory.test.ts
// T-389 ACs #6–#21 — aiChatClipFactory unit tests. Uses the
// `InMemoryLLMChatProvider` to drive scripted token sequences and pin
// abort discipline + telemetry privacy.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ClipFactory, type MountContext, PERMISSIVE_TENANT_POLICY } from '../../contract.js';
import { InteractiveClipRegistry } from '../../registry.js';
import {
  AiChatClipFactoryBuilder,
  type AiChatClipFactoryOptions,
  type AiChatClipMountHandleWithTestSeam,
} from './factory.js';
import {
  InMemoryLLMChatProvider,
  type LLMChatProvider,
  type LLMChatStreamArgs,
  __resetTurnIdCounterForTests,
} from './llm-chat-provider.js';
import { MultiTurnDisabledError, type TurnEvent } from './types.js';

interface MakeContextArgs {
  emit?: MountContext['emitTelemetry'];
  signal?: AbortSignal;
  frameSource?: undefined;
  props?: Partial<{
    systemPrompt: string;
    provider: string;
    model: string;
    maxTokens: number;
    temperature: number;
    multiTurn: boolean;
    posterFrame: number;
  }>;
  badProps?: Record<string, unknown>;
}

function makeContext(args: MakeContextArgs = {}): MountContext {
  const root = document.createElement('div');
  const props =
    args.badProps ??
    ({
      systemPrompt: args.props?.systemPrompt ?? 'You are a helpful assistant.',
      provider: args.props?.provider ?? 'anthropic',
      model: args.props?.model ?? 'claude-3-5-sonnet-latest',
      maxTokens: args.props?.maxTokens ?? 256,
      temperature: args.props?.temperature ?? 0.7,
      multiTurn: args.props?.multiTurn ?? true,
      posterFrame: args.props?.posterFrame ?? 0,
    } satisfies Record<string, unknown>);
  return {
    clip: {
      id: 'test-ai-chat-clip',
      type: 'interactive-clip',
      family: 'ai-chat',
      transform: { x: 0, y: 0, width: 320, height: 200 },
      visible: true,
      locked: false,
      animations: [],
      staticFallback: [
        {
          id: 'sf',
          type: 'text',
          transform: { x: 0, y: 0, width: 320, height: 200 },
          visible: true,
          locked: false,
          animations: [],
          text: 'fallback',
          fontSize: 16,
        },
      ],
      liveMount: {
        component: {
          module: '@stageflip/runtimes-interactive/clips/ai-chat#AiChatClip',
        },
        props,
        permissions: ['network'],
      },
    } as never,
    root,
    permissions: ['network'],
    tenantPolicy: PERMISSIVE_TENANT_POLICY,
    emitTelemetry: args.emit ?? (() => undefined),
    signal: args.signal ?? new AbortController().signal,
  };
}

async function castChat(
  factory: ClipFactory,
  ctx: MountContext,
): Promise<AiChatClipMountHandleWithTestSeam> {
  const handle = await factory(ctx);
  return handle as AiChatClipMountHandleWithTestSeam;
}

function buildFactory(options: AiChatClipFactoryOptions = {}): ClipFactory {
  return AiChatClipFactoryBuilder.build(options);
}

describe('aiChatClipFactory (T-389)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetTurnIdCounterForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // ----- Schema (AC #5 covered by check-preset-integrity.test.ts) -----

  it('AC #6 — registry resolves the factory after register', () => {
    const registry = new InteractiveClipRegistry();
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    registry.register('ai-chat', factory);
    expect(registry.resolve('ai-chat')).toBe(factory);
  });

  it('AC #7 — re-registering throws InteractiveClipFamilyAlreadyRegisteredError', () => {
    const registry = new InteractiveClipRegistry();
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    registry.register('ai-chat', factory);
    expect(() => registry.register('ai-chat', factory)).toThrow(/already registered/);
  });

  it('AC #8 — mount with frameSource: undefined succeeds (no MissingFrameSourceError)', async () => {
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext({ frameSource: undefined });
    const handle = await factory(ctx);
    expect(handle).toBeDefined();
    handle.dispose();
  });

  it('AC #9 — mount renders the React tree (output + textarea + button)', async () => {
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    expect(ctx.root.querySelector('[data-stageflip-ai-chat-clip]')).not.toBeNull();
    expect(ctx.root.querySelector('output[data-role="message-stream"]')).not.toBeNull();
    expect(ctx.root.querySelector('textarea[data-role="user-input"]')).not.toBeNull();
    expect(ctx.root.querySelector('button[data-action="send"]')).not.toBeNull();
    handle.dispose();
  });

  // ----- Turn lifecycle (AC #10–#14) -----

  it('AC #10 — send forwards system prompt + history + user message to the provider', async () => {
    const captured: LLMChatStreamArgs[] = [];
    const provider: LLMChatProvider = {
      streamTurn: async (args) => {
        captured.push(args);
        return { finalText: 'ok', turnId: 'turn-x' };
      },
    };
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext({ props: { systemPrompt: 'be terse' } });
    const handle = await castChat(factory, ctx);
    await handle.send('first');
    await handle.send('second');
    expect(captured).toHaveLength(2);
    expect(captured[0]?.systemPrompt).toBe('be terse');
    expect(captured[0]?.history).toEqual([]);
    expect(captured[0]?.userMessage).toBe('first');
    expect(captured[1]?.history).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'ok' },
    ]);
    expect(captured[1]?.userMessage).toBe('second');
    handle.dispose();
  });

  it('AC #11 — multiple onTurn subscribers receive ordered token events; final event carries full text', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [
        { delayMs: 5, token: 'hel' },
        { delayMs: 10, token: 'lo' },
      ],
    });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    const a: TurnEvent[] = [];
    const b: TurnEvent[] = [];
    handle.onTurn((e) => a.push(e));
    handle.onTurn((e) => b.push(e));
    const sendPromise = handle.send('hi');
    await vi.advanceTimersByTimeAsync(20);
    await sendPromise;

    // Each subscriber sees: user, assistant-token('hel'), assistant-token('lo'), assistant-final('hello')
    const kindsA = a.map((e) => e.kind);
    const kindsB = b.map((e) => e.kind);
    expect(kindsA).toEqual(['user', 'assistant-token', 'assistant-token', 'assistant-final']);
    expect(kindsB).toEqual(['user', 'assistant-token', 'assistant-token', 'assistant-final']);
    const finalA = a.find((e) => e.kind === 'assistant-final');
    if (finalA?.kind === 'assistant-final') expect(finalA.text).toBe('hello');
    handle.dispose();
  });

  it('AC #12 — provider error surfaces an `error` TurnEvent and rejects send', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [{ delayMs: 5, token: 'partial' }],
      rejectWith: new Error('upstream blew up'),
    });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    const events: TurnEvent[] = [];
    handle.onTurn((e) => events.push(e));
    const sendPromise = handle.send('hi');
    // Attach rejection handler synchronously so the unhandled-rejection
    // observer does not see a transient unhandled state between the
    // microtask the inner provider rejects on and the await below.
    const settled = sendPromise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10);
    const result = await settled;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(/upstream/);
    const err = events.find((e) => e.kind === 'error');
    expect(err).toBeDefined();
    if (err?.kind === 'error') expect(err.message).toMatch(/upstream/);
    handle.dispose();
  });

  it('AC #13 — multiTurn:false rejects a second send with MultiTurnDisabledError', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [{ delayMs: 5, token: 'ok' }],
    });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext({ props: { multiTurn: false } });
    const handle = await castChat(factory, ctx);
    const first = handle.send('first');
    await vi.advanceTimersByTimeAsync(10);
    await first;
    await expect(handle.send('second')).rejects.toBeInstanceOf(MultiTurnDisabledError);
    handle.dispose();
  });

  it('AC #14 — reset() drops history; subsequent send sends no prior messages', async () => {
    const captured: LLMChatStreamArgs[] = [];
    const provider: LLMChatProvider = {
      streamTurn: async (args) => {
        captured.push(args);
        return { finalText: 'ok', turnId: 'turn-x' };
      },
    };
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    await handle.send('first');
    await handle.send('second');
    expect(captured[1]?.history).toHaveLength(2);
    handle.reset();
    await handle.send('after-reset');
    expect(captured[2]?.history).toEqual([]);
    handle.dispose();
  });

  it('Reviewer Minor #1 — reset() during in-flight turn aborts the controller and discards the post-await history append', async () => {
    let observedSignal: AbortSignal | undefined;
    let aborted = false;
    let resolveTurn!: (value: { finalText: string; turnId: string }) => void;
    const provider: LLMChatProvider = {
      streamTurn: (args) =>
        new Promise((resolve) => {
          observedSignal = args.signal;
          args.signal.addEventListener('abort', () => {
            aborted = true;
            // Provider semantics: on abort, resolve with whatever's
            // accumulated. The post-await guard in the factory must catch
            // this and refuse to write back into the cleared history.
            resolve({ finalText: 'late assistant reply', turnId: 'turn-late' });
          });
          resolveTurn = resolve;
        }),
    };
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    // Start a turn but don't resolve it.
    const sendPromise = handle.send('user-msg-during-flight');
    // Reset while the turn is in-flight.
    handle.reset();
    expect(aborted).toBe(true);
    expect(observedSignal?.aborted).toBe(true);
    // Allow the now-aborted turn's resolution promise to settle.
    await sendPromise.catch(() => {
      /* aborted; resolves cleanly because the provider resolves on abort */
    });
    // History MUST be empty — no post-await write-back from the in-flight turn.
    expect(handle.__test__.historySize()).toBe(0);
    handle.dispose();
  });

  // ----- Resource cleanup (AC #15–#19) -----

  it('AC #15 — dispose() aborts the in-flight streamTurn (spy on AbortController)', async () => {
    let observedSignal: AbortSignal | undefined;
    let abortSeenByProvider = false;
    const provider: LLMChatProvider = {
      streamTurn: (args) =>
        new Promise((_resolve, reject) => {
          observedSignal = args.signal;
          args.signal.addEventListener('abort', () => {
            abortSeenByProvider = true;
            const err = new Error('AbortError');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    };
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    const sendPromise = handle.send('hi');
    const settled = sendPromise.catch((e: unknown) => e);
    // Yield so streamTurn started + activeAbort is set.
    await Promise.resolve();
    await Promise.resolve();
    expect(handle.__test__.isAbortAttached()).toBe(true);
    handle.dispose();
    const result = await settled;
    expect((result as Error).name).toBe('AbortError');
    expect(observedSignal?.aborted).toBe(true);
    expect(abortSeenByProvider).toBe(true);
  });

  it('AC #16 — dispose() drops history (verified via test seam)', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [{ delayMs: 5, token: 'ok' }],
    });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    const sendPromise = handle.send('hi');
    await vi.advanceTimersByTimeAsync(10);
    await sendPromise;
    expect(handle.__test__.historySize()).toBe(2);
    handle.dispose();
    expect(handle.__test__.historySize()).toBe(0);
  });

  it('AC #17 — dispose() unsubscribes all onTurn handlers', async () => {
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    handle.onTurn(() => {});
    handle.onTurn(() => {});
    expect(handle.__test__.handlerCount()).toBe(2);
    handle.dispose();
    expect(handle.__test__.handlerCount()).toBe(0);
  });

  it('AC #18 — dispose() is idempotent', async () => {
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    const handle = await castChat(factory, ctx);
    handle.dispose();
    handle.dispose();
    handle.dispose();
    const disposeEvents = events.filter(([e]) => e === 'ai-chat-clip.dispose');
    expect(disposeEvents).toHaveLength(1);
  });

  it('AC #19 — signal.abort triggers the same teardown path', async () => {
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    const events: Array<[string, Record<string, unknown>]> = [];
    const controller = new AbortController();
    const ctx = makeContext({
      emit: (e, a) => events.push([e, a]),
      signal: controller.signal,
    });
    const handle = await castChat(factory, ctx);
    handle.onTurn(() => {});
    expect(handle.__test__.handlerCount()).toBe(1);
    controller.abort();
    expect(handle.__test__.handlerCount()).toBe(0);
    expect(events.some(([e]) => e === 'ai-chat-clip.dispose')).toBe(true);
  });

  // ----- Telemetry privacy (AC #20) -----

  it('AC #20 — telemetry emits documented events with integer-only attributes; no message bodies', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [
        { delayMs: 5, token: 'hel' },
        { delayMs: 10, token: 'lo' },
      ],
    });
    const factory = buildFactory({ chatProvider: provider });
    const events: Array<[string, Record<string, unknown>]> = [];
    const userBody = 'this user message is private and must not appear in telemetry';
    const ctx = makeContext({
      emit: (e, a) => events.push([e, a]),
      props: { systemPrompt: 'system prompt body that is also private' },
    });
    const handle = await castChat(factory, ctx);
    const sendPromise = handle.send(userBody);
    await vi.advanceTimersByTimeAsync(20);
    await sendPromise;
    handle.dispose();

    const names = events.map((e) => e[0]);
    expect(names).toContain('ai-chat-clip.mount.start');
    expect(names).toContain('ai-chat-clip.mount.success');
    expect(names).toContain('ai-chat-clip.turn.started');
    expect(names).toContain('ai-chat-clip.turn.finished');
    expect(names).toContain('ai-chat-clip.dispose');

    // turn.started: userMessageLength integer, NOT body.
    const started = events.find(([e]) => e === 'ai-chat-clip.turn.started');
    expect(started?.[1]).toMatchObject({
      userMessageLength: userBody.length,
    });
    expect((started?.[1] as Record<string, unknown>).text).toBeUndefined();
    expect((started?.[1] as Record<string, unknown>).userMessage).toBeUndefined();

    // turn.finished: durationMs + tokenCount integers, NOT assistant body.
    const finished = events.find(([e]) => e === 'ai-chat-clip.turn.finished');
    const finishedAttrs = finished?.[1] as Record<string, unknown>;
    expect(typeof finishedAttrs.durationMs).toBe('number');
    expect(typeof finishedAttrs.tokenCount).toBe('number');
    expect(finishedAttrs.assistant).toBeUndefined();
    expect(finishedAttrs.completion).toBeUndefined();
    expect(finishedAttrs.text).toBeUndefined();

    // Grep-driven privacy assertion: neither body appears anywhere.
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain(userBody);
    expect(serialized).not.toContain('system prompt body that is also private');
    // Assistant body also does not appear.
    expect(serialized).not.toContain('hello');
  });

  it('AC #20 — turn.error emits with errorKind, no message body of user/assistant', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [],
      rejectWith: Object.assign(new Error('rate limited'), {
        name: 'LLMError',
        kind: 'rate_limited',
      }),
    });
    const factory = buildFactory({ chatProvider: provider });
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx = makeContext({
      emit: (e, a) => events.push([e, a]),
    });
    const handle = await castChat(factory, ctx);
    const sendPromise = handle.send('private user content');
    const settled = sendPromise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2);
    const result = await settled;
    expect((result as Error).message).toMatch(/rate limited/);
    const err = events.find(([e]) => e === 'ai-chat-clip.turn.error');
    const attrs = err?.[1] as Record<string, unknown>;
    expect(attrs.errorKind).toBe('rate_limited');
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain('private user content');
    handle.dispose();
  });

  it('mount.failure invalid-props on bad props', async () => {
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx = makeContext({
      emit: (e, a) => events.push([e, a]),
      badProps: { systemPrompt: '', provider: 'openai', model: 'gpt' },
    });
    await expect(factory(ctx)).rejects.toThrow();
    const failure = events.find(([e]) => e === 'ai-chat-clip.mount.failure');
    expect(failure?.[1]).toMatchObject({ reason: 'invalid-props' });
  });

  it('mount.failure provider-unavailable when no chatProvider supplied', async () => {
    const factory = buildFactory(); // no provider
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    await expect(factory(ctx)).rejects.toThrow();
    const failure = events.find(([e]) => e === 'ai-chat-clip.mount.failure');
    expect(failure?.[1]).toMatchObject({ reason: 'provider-unavailable' });
  });

  // ----- Permission posture (AC #21) -----

  it('AC #21 — mount with permissions: ["network"] succeeds with permissive shim, no dialog', async () => {
    // The factory does not consult getUserMedia for network permission;
    // we just assert that mount succeeds + emits no failure.
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    const handle = await castChat(factory, ctx);
    expect(events.find(([e]) => e === 'ai-chat-clip.mount.failure')).toBeUndefined();
    expect(events.find(([e]) => e === 'ai-chat-clip.mount.success')).toBeDefined();
    handle.dispose();
  });

  // ----- Misc behaviour pins -----

  it('onTurn handlers can unsubscribe; subsequent events do not surface', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [{ delayMs: 5, token: 'a' }],
    });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    const events: TurnEvent[] = [];
    const unsub = handle.onTurn((e) => events.push(e));
    unsub();
    const promise = handle.send('hi');
    await vi.advanceTimersByTimeAsync(10);
    await promise;
    expect(events).toHaveLength(0);
    handle.dispose();
  });

  it('handler throw does not break sibling handlers', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [{ delayMs: 5, token: 'a' }],
    });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    const events: TurnEvent[] = [];
    handle.onTurn(() => {
      throw new Error('bad handler');
    });
    handle.onTurn((e) => events.push(e));
    const promise = handle.send('hi');
    await vi.advanceTimersByTimeAsync(10);
    await promise;
    // user + token + final
    expect(events.length).toBeGreaterThanOrEqual(2);
    handle.dispose();
  });

  it('updateProps is a no-op (mount-time configuration only)', async () => {
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    expect(() => handle.updateProps({ temperature: 0.1 })).not.toThrow();
    handle.dispose();
  });

  it('send while disposed early-returns', async () => {
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    handle.dispose();
    await expect(handle.send('hi')).resolves.toBeUndefined();
  });

  it('reset while disposed is a no-op', async () => {
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    handle.dispose();
    expect(() => handle.reset()).not.toThrow();
  });

  it('finalText falls back to accumulated tokens when provider returns empty finalText', async () => {
    const provider: LLMChatProvider = {
      streamTurn: async (args) => {
        args.onToken('hel', 'turn-x');
        args.onToken('lo', 'turn-x');
        return { finalText: '', turnId: 'turn-x' };
      },
    };
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    const events: TurnEvent[] = [];
    handle.onTurn((e) => events.push(e));
    await handle.send('hi');
    const final = events.find((e) => e.kind === 'assistant-final');
    if (final?.kind === 'assistant-final') expect(final.text).toBe('hello');
    handle.dispose();
  });

  it('emits turn.started when provider streams zero tokens but resolves with finalText', async () => {
    const provider: LLMChatProvider = {
      streamTurn: async () => ({ finalText: 'pre-baked', turnId: 'turn-x' }),
    };
    const factory = buildFactory({ chatProvider: provider });
    const events: Array<[string, Record<string, unknown>]> = [];
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    const handle = await castChat(factory, ctx);
    await handle.send('hi');
    expect(events.find(([e]) => e === 'ai-chat-clip.turn.started')).toBeDefined();
    expect(events.find(([e]) => e === 'ai-chat-clip.turn.finished')).toBeDefined();
    handle.dispose();
  });

  it('disposing while a turn is in flight suppresses the assistant-final event', async () => {
    let releaseResolve: ((v: { finalText: string; turnId: string }) => void) | undefined;
    const provider: LLMChatProvider = {
      streamTurn: () =>
        new Promise((resolve) => {
          releaseResolve = resolve;
        }),
    };
    vi.useRealTimers();
    const factory = buildFactory({ chatProvider: provider });
    const ctx = makeContext();
    const handle = await castChat(factory, ctx);
    const events: TurnEvent[] = [];
    handle.onTurn((e) => events.push(e));
    const sendPromise = handle.send('hi');
    await Promise.resolve();
    handle.dispose();
    releaseResolve?.({ finalText: 'late', turnId: 'turn-late' });
    await sendPromise.catch(() => {});
    expect(events.find((e) => e.kind === 'assistant-final')).toBeUndefined();
  });
});
