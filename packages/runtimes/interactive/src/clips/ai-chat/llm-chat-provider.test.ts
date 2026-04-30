// packages/runtimes/interactive/src/clips/ai-chat/llm-chat-provider.test.ts
// T-389 — LLMChatProvider implementations: RealLLMChatProvider (wraps
// @stageflip/llm-abstraction) + InMemoryLLMChatProvider (test seam).

import type {
  LLMProvider,
  LLMRequest,
  LLMStreamEvent,
  LLMStreamOptions,
} from '@stageflip/llm-abstraction';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InMemoryLLMChatProvider,
  RealLLMChatProvider,
  __resetTurnIdCounterForTests,
} from './llm-chat-provider.js';

function makeFakeProvider(events: LLMStreamEvent[]): LLMProvider {
  return {
    name: 'anthropic',
    complete: async () => ({
      id: 'fake',
      model: 'fake',
      role: 'assistant',
      content: [],
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 },
    }),
    stream: (_req: LLMRequest, _options?: LLMStreamOptions) =>
      (async function* () {
        for (const e of events) yield e;
      })(),
  };
}

describe('RealLLMChatProvider', () => {
  beforeEach(() => {
    __resetTurnIdCounterForTests();
  });

  it('streams text-delta tokens through onToken and resolves with finalText = concatenation', async () => {
    const provider = makeFakeProvider([
      { type: 'message_start', id: 'm1', model: 'fake' },
      { type: 'content_block_start', index: 0, block: { type: 'text' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hello' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_stop' },
    ]);
    const real = new RealLLMChatProvider({ provider });
    const tokens: string[] = [];
    const result = await real.streamTurn({
      systemPrompt: 'sp',
      history: [],
      userMessage: 'hi',
      model: 'fake',
      maxTokens: 64,
      temperature: 0.5,
      signal: new AbortController().signal,
      onToken: (t) => tokens.push(t),
    });
    expect(tokens).toEqual(['hello', ' world']);
    expect(result.finalText).toBe('hello world');
    expect(result.turnId).toMatch(/^turn-\d+$/);
  });

  it('skips empty text-delta tokens', async () => {
    const provider = makeFakeProvider([
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'x' } },
    ]);
    const real = new RealLLMChatProvider({ provider });
    const tokens: string[] = [];
    const result = await real.streamTurn({
      systemPrompt: 'sp',
      history: [],
      userMessage: 'hi',
      model: 'fake',
      maxTokens: 64,
      temperature: 0.5,
      signal: new AbortController().signal,
      onToken: (t) => tokens.push(t),
    });
    expect(tokens).toEqual(['x']);
    expect(result.finalText).toBe('x');
  });

  it('forwards history + system prompt + max_tokens + temperature to the provider request', async () => {
    let captured: LLMRequest | undefined;
    const provider: LLMProvider = {
      name: 'openai',
      complete: async () => ({
        id: 'fake',
        model: 'fake',
        role: 'assistant',
        content: [],
        stop_reason: 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
      stream: (req: LLMRequest, _options?: LLMStreamOptions) => {
        captured = req;
        return (async function* () {
          yield {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'ok' },
          } as const;
        })();
      },
    };
    const real = new RealLLMChatProvider({ provider });
    await real.streamTurn({
      systemPrompt: 'be terse',
      history: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ],
      userMessage: 'how are you',
      model: 'gpt-mini',
      maxTokens: 128,
      temperature: 0.3,
      signal: new AbortController().signal,
      onToken: () => {},
    });
    expect(captured).toBeDefined();
    expect(captured?.system).toBe('be terse');
    expect(captured?.model).toBe('gpt-mini');
    expect(captured?.max_tokens).toBe(128);
    expect(captured?.temperature).toBe(0.3);
    expect(captured?.messages).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'how are you' },
    ]);
  });

  it('classifies thrown provider errors via classifyError (LLMError surfaces with kind)', async () => {
    const provider: LLMProvider = {
      name: 'anthropic',
      complete: async () => ({
        id: 'fake',
        model: 'fake',
        role: 'assistant',
        content: [],
        stop_reason: 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
      stream: () =>
        (async function* () {
          const err = new Error('http 429') as Error & { status: number };
          err.status = 429;
          throw err;
          // biome-ignore lint/correctness/noUnreachable: defensive yield to keep type
          yield {} as LLMStreamEvent;
        })(),
    };
    const real = new RealLLMChatProvider({ provider });
    await expect(
      real.streamTurn({
        systemPrompt: 'sp',
        history: [],
        userMessage: 'hi',
        model: 'fake',
        maxTokens: 64,
        temperature: 0.5,
        signal: new AbortController().signal,
        onToken: () => {},
      }),
    ).rejects.toMatchObject({ name: 'LLMError', kind: 'rate_limited' });
  });

  it('rejects construction with neither provider nor spec', () => {
    expect(() => new RealLLMChatProvider({})).toThrow(/exactly one/);
  });
});

describe('InMemoryLLMChatProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetTurnIdCounterForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits scripted tokens in order and resolves with concatenated finalText', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [
        { delayMs: 5, token: 'hi' },
        { delayMs: 10, token: ' there' },
      ],
    });
    const tokens: string[] = [];
    const promise = provider.streamTurn({
      systemPrompt: 'sp',
      history: [],
      userMessage: 'u',
      model: 'fake',
      maxTokens: 64,
      temperature: 0.5,
      signal: new AbortController().signal,
      onToken: (t) => tokens.push(t),
    });
    await vi.advanceTimersByTimeAsync(20);
    const result = await promise;
    expect(tokens).toEqual(['hi', ' there']);
    expect(result.finalText).toBe('hi there');
  });

  it('honours finalText override', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [{ delayMs: 5, token: 'a' }],
      finalText: 'OVERRIDE',
    });
    const promise = provider.streamTurn({
      systemPrompt: 'sp',
      history: [],
      userMessage: 'u',
      model: 'fake',
      maxTokens: 64,
      temperature: 0.5,
      signal: new AbortController().signal,
      onToken: () => {},
    });
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;
    expect(result.finalText).toBe('OVERRIDE');
  });

  it('rejects with rejectWith error after scripted tokens emit', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [{ delayMs: 5, token: 'a' }],
      rejectWith: new Error('upstream blew up'),
    });
    const promise = provider.streamTurn({
      systemPrompt: 'sp',
      history: [],
      userMessage: 'u',
      model: 'fake',
      maxTokens: 64,
      temperature: 0.5,
      signal: new AbortController().signal,
      onToken: () => {},
    });
    // Pre-attach to suppress unhandled-rejection between the timer
    // resolution and the explicit await below.
    const settled = promise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10);
    const result = await settled;
    expect((result as Error).message).toMatch(/upstream/);
  });

  it('aborts when signal fires mid-stream', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [
        { delayMs: 5, token: 'a' },
        { delayMs: 50, token: 'b' },
      ],
    });
    const ctrl = new AbortController();
    const tokens: string[] = [];
    const promise = provider.streamTurn({
      systemPrompt: 'sp',
      history: [],
      userMessage: 'u',
      model: 'fake',
      maxTokens: 64,
      temperature: 0.5,
      signal: ctrl.signal,
      onToken: (t) => tokens.push(t),
    });
    const settled = promise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10);
    expect(tokens).toEqual(['a']);
    ctrl.abort();
    const result = await settled;
    expect((result as Error).name).toBe('AbortError');
  });

  it('rejects immediately with AbortError when signal is pre-aborted', async () => {
    const provider = new InMemoryLLMChatProvider({
      scripted: [{ delayMs: 5, token: 'a' }],
    });
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      provider.streamTurn({
        systemPrompt: 'sp',
        history: [],
        userMessage: 'u',
        model: 'fake',
        maxTokens: 64,
        temperature: 0.5,
        signal: ctrl.signal,
        onToken: () => {},
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('handles zero scripted tokens (settles on next tick)', async () => {
    const provider = new InMemoryLLMChatProvider({ scripted: [] });
    const promise = provider.streamTurn({
      systemPrompt: 'sp',
      history: [],
      userMessage: 'u',
      model: 'fake',
      maxTokens: 64,
      temperature: 0.5,
      signal: new AbortController().signal,
      onToken: () => {},
    });
    await vi.advanceTimersByTimeAsync(1);
    const result = await promise;
    expect(result.finalText).toBe('');
  });
});
