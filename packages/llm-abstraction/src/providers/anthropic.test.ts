// packages/llm-abstraction/src/providers/anthropic.test.ts

import { describe, expect, it, vi } from 'vitest';
import { LLMError } from '../errors.js';
import type { LLMRequest } from '../types.js';
import { type AnthropicLike, createAnthropicProvider } from './anthropic.js';

const baseRequest: LLMRequest = {
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  system: 'You are helpful.',
  messages: [{ role: 'user', content: 'hi' }],
};

function fakeClient(
  impl: (
    params: Record<string, unknown>,
    requestOptions?: { signal?: AbortSignal },
  ) => Promise<unknown>,
): AnthropicLike {
  return { messages: { create: vi.fn(impl) } };
}

describe('createAnthropicProvider.complete', () => {
  it('translates the response into the neutral shape', async () => {
    const client = fakeClient(async () => ({
      id: 'msg_1',
      model: 'claude-opus-4-7',
      content: [{ type: 'text', text: 'hello' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 2 },
    }));

    const provider = createAnthropicProvider({ client });
    const response = await provider.complete(baseRequest);

    expect(response).toEqual({
      id: 'msg_1',
      model: 'claude-opus-4-7',
      role: 'assistant',
      content: [{ type: 'text', text: 'hello' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 2 },
    });
  });

  it('forwards system, tools, temperature, stop_sequences, and messages', async () => {
    const spy = vi.fn(async () => ({
      id: 'msg_2',
      model: 'claude-opus-4-7',
      content: [],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 0 },
    }));

    const provider = createAnthropicProvider({ client: { messages: { create: spy } } });
    await provider.complete({
      ...baseRequest,
      temperature: 0.5,
      stop_sequences: ['END'],
      tools: [
        {
          name: 'add_slide',
          description: 'add a slide',
          input_schema: { type: 'object' },
        },
      ],
    });

    const [params] = spy.mock.calls[0] ?? [];
    expect(params).toMatchObject({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: 'You are helpful.',
      temperature: 0.5,
      stop_sequences: ['END'],
      tools: [
        {
          name: 'add_slide',
          description: 'add a slide',
          input_schema: { type: 'object' },
        },
      ],
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    });
  });

  it('forwards structured content blocks including tool_result', async () => {
    const spy = vi.fn(async () => ({
      id: 'msg_x',
      model: 'claude-opus-4-7',
      content: [],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 0 },
    }));

    const provider = createAnthropicProvider({ client: { messages: { create: spy } } });
    await provider.complete({
      model: 'claude-opus-4-7',
      max_tokens: 100,
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'toolu_1', name: 'x', input: { a: 1 } }],
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_1',
              content: 'ok',
              is_error: false,
            },
          ],
        },
      ],
    });

    const [params] = spy.mock.calls[0] ?? [];
    expect((params as { messages: unknown }).messages).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu_1', name: 'x', input: { a: 1 } }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_1',
            content: 'ok',
            is_error: false,
          },
        ],
      },
    ]);
  });

  it('wraps SDK errors as LLMError with classified kind', async () => {
    const source = Object.assign(new Error('too many requests'), {
      status: 429,
      headers: { 'retry-after': '5' },
    });
    const client = fakeClient(async () => {
      throw source;
    });

    const provider = createAnthropicProvider({ client });
    const caught = await provider.complete(baseRequest).catch((e) => e);

    expect(caught).toBeInstanceOf(LLMError);
    expect(caught.kind).toBe('rate_limited');
    expect(caught.retryAfterMs).toBe(5_000);
    expect(caught.provider).toBe('anthropic');
  });

  it('passes AbortSignal through to the SDK', async () => {
    const spy = vi.fn(async () => ({
      id: 'msg_3',
      model: 'claude-opus-4-7',
      content: [],
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 },
    }));

    const controller = new AbortController();
    const provider = createAnthropicProvider({ client: { messages: { create: spy } } });
    await provider.complete(baseRequest, { signal: controller.signal });

    expect(spy.mock.calls[0]?.[1]).toEqual({ signal: controller.signal });
  });

  it('AC #4: throws LLMError(unsupported) when given an image content block', async () => {
    const client = fakeClient(async () => ({
      id: 'msg_x',
      model: 'claude-opus-4-7',
      content: [],
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 },
    }));
    const provider = createAnthropicProvider({ client });
    const caught = await provider
      .complete({
        model: 'claude-opus-4-7',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [{ type: 'image', mediaType: 'image/png', data: 'X' }],
          },
        ],
      })
      .catch((e) => e);
    expect(caught).toBeInstanceOf(LLMError);
    expect(caught.kind).toBe('unsupported');
    expect(caught.provider).toBe('anthropic');
  });

  it('normalises unknown stop_reason values to end_turn', async () => {
    const client = fakeClient(async () => ({
      id: 'msg_4',
      model: 'claude-opus-4-7',
      content: [],
      stop_reason: 'wat',
      usage: { input_tokens: 0, output_tokens: 0 },
    }));
    const provider = createAnthropicProvider({ client });
    const response = await provider.complete(baseRequest);
    expect(response.stop_reason).toBe('end_turn');
  });
});

describe('createAnthropicProvider.stream', () => {
  async function* events() {
    yield {
      type: 'message_start',
      message: { id: 'msg_s', model: 'claude-opus-4-7' },
    };
    yield {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    };
    yield {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'hi' },
    };
    yield { type: 'content_block_stop', index: 0 };
    yield {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 1 },
    };
    yield { type: 'message_stop' };
  }

  it('translates Anthropic stream events into neutral events', async () => {
    const client = fakeClient(async () => events());
    const provider = createAnthropicProvider({ client });
    const out = [];
    for await (const event of provider.stream(baseRequest)) out.push(event);

    expect(out[0]).toEqual({
      type: 'message_start',
      id: 'msg_s',
      model: 'claude-opus-4-7',
    });
    expect(out.at(-1)).toEqual({ type: 'message_stop' });
    const deltas = out.filter((e) => e.type === 'content_block_delta');
    expect(deltas).toHaveLength(1);
  });

  it('emits input_json_delta events for tool_use arg streaming', async () => {
    async function* toolEvents() {
      yield {
        type: 'message_start',
        message: { id: 'msg_t', model: 'claude-opus-4-7' },
      };
      yield {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'tool_use',
          id: 'toolu_a',
          name: 'add_slide',
          input: {},
        },
      };
      yield {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"a":1}' },
      };
      yield { type: 'content_block_stop', index: 0 };
      yield { type: 'message_delta', delta: { stop_reason: 'tool_use' } };
      yield { type: 'message_stop' };
    }

    const client = fakeClient(async () => toolEvents());
    const provider = createAnthropicProvider({ client });
    const out = [];
    for await (const event of provider.stream(baseRequest)) out.push(event);

    expect(out).toContainEqual({
      type: 'content_block_start',
      index: 0,
      block: { type: 'tool_use', id: 'toolu_a', name: 'add_slide' },
    });
    expect(out).toContainEqual({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'input_json_delta', partial_json: '{"a":1}' },
    });
  });

  it('wraps iterator errors as LLMError', async () => {
    async function* boom() {
      yield {
        type: 'message_start',
        message: { id: 'msg_e', model: 'claude-opus-4-7' },
      };
      throw Object.assign(new Error('mid-stream explode'), { status: 500 });
    }
    const client = fakeClient(async () => boom());
    const provider = createAnthropicProvider({ client });

    const run = async () => {
      for await (const _ of provider.stream(baseRequest)) {
        // iterate
      }
    };
    const err = await run().catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.kind).toBe('server_error');
  });

  it('silently drops unknown event types', async () => {
    async function* mixed() {
      yield {
        type: 'message_start',
        message: { id: 'msg_u', model: 'claude-opus-4-7' },
      };
      yield { type: 'ping' };
      yield { type: 'message_stop' };
    }
    const client = fakeClient(async () => mixed());
    const provider = createAnthropicProvider({ client });
    const out = [];
    for await (const event of provider.stream(baseRequest)) out.push(event);
    expect(out.map((e) => e.type)).toEqual(['message_start', 'message_stop']);
  });
});
