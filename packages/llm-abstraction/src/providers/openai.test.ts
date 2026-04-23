// packages/llm-abstraction/src/providers/openai.test.ts

import { describe, expect, it, vi } from 'vitest';
import { LLMError } from '../errors.js';
import type { LLMRequest } from '../types.js';
import { type OpenAILike, createOpenAIProvider } from './openai.js';

const baseRequest: LLMRequest = {
  model: 'gpt-4o',
  max_tokens: 1024,
  system: 'You are helpful.',
  messages: [{ role: 'user', content: 'hi' }],
};

function fakeClient(
  impl: (
    params: Record<string, unknown>,
    requestOptions?: { signal?: AbortSignal },
  ) => Promise<unknown>,
): { client: OpenAILike; spy: ReturnType<typeof vi.fn> } {
  const spy = vi.fn(impl);
  return { client: { chat: { completions: { create: spy } } }, spy };
}

describe('createOpenAIProvider.complete', () => {
  it('translates a text + tool_calls response into neutral blocks', async () => {
    const { client } = fakeClient(async () => ({
      id: 'chatcmpl-1',
      model: 'gpt-4o',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'planning',
            tool_calls: [
              {
                id: 'call_a',
                type: 'function',
                function: { name: 'add_slide', arguments: '{"n":1}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 8, completion_tokens: 4 },
    }));

    const provider = createOpenAIProvider({ client });
    const response = await provider.complete(baseRequest);

    expect(response.content).toEqual([
      { type: 'text', text: 'planning' },
      {
        type: 'tool_use',
        id: 'call_a',
        name: 'add_slide',
        input: { n: 1 },
      },
    ]);
    expect(response.stop_reason).toBe('tool_use');
    expect(response.usage).toEqual({ input_tokens: 8, output_tokens: 4 });
  });

  it('prepends a system message and flattens tools into OpenAI shape', async () => {
    const { client, spy } = fakeClient(async () => ({
      id: 'c',
      model: 'gpt-4o',
      choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
    }));

    const provider = createOpenAIProvider({ client });
    await provider.complete({
      ...baseRequest,
      temperature: 0.2,
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
      model: 'gpt-4o',
      max_tokens: 1024,
      temperature: 0.2,
      stop: ['END'],
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'hi' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'add_slide',
            description: 'add a slide',
            parameters: { type: 'object' },
          },
        },
      ],
      stream: false,
    });
  });

  it('emits role:tool messages with tool_call_id for tool_result blocks', async () => {
    const { client, spy } = fakeClient(async () => ({
      id: 'c',
      model: 'gpt-4o',
      choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
    }));

    const provider = createOpenAIProvider({ client });
    await provider.complete({
      model: 'gpt-4o',
      max_tokens: 100,
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'call_a', name: 'x', input: { a: 1 } }],
        },
        {
          role: 'tool',
          content: [{ type: 'tool_result', tool_use_id: 'call_a', content: 'ok' }],
        },
      ],
    });

    const [params] = spy.mock.calls[0] ?? [];
    expect((params as { messages: unknown }).messages).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_a',
            type: 'function',
            function: { name: 'x', arguments: '{"a":1}' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_a',
        content: 'ok',
      },
    ]);
  });

  it('preserves unparseable tool arguments under _raw', async () => {
    const { client } = fakeClient(async () => ({
      id: 'c',
      model: 'gpt-4o',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_x',
                type: 'function',
                function: { name: 'x', arguments: '{"a":1' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    }));

    const provider = createOpenAIProvider({ client });
    const response = await provider.complete(baseRequest);
    expect(response.content[0]).toEqual({
      type: 'tool_use',
      id: 'call_x',
      name: 'x',
      input: { _raw: '{"a":1' },
    });
  });

  it('wraps SDK errors as LLMError', async () => {
    const { client } = fakeClient(async () => {
      throw Object.assign(new Error('rate limit'), {
        status: 429,
        headers: { 'retry-after': '10' },
      });
    });

    const provider = createOpenAIProvider({ client });
    const caught = await provider.complete(baseRequest).catch((e) => e);
    expect(caught).toBeInstanceOf(LLMError);
    expect(caught.kind).toBe('rate_limited');
    expect(caught.retryAfterMs).toBe(10_000);
    expect(caught.provider).toBe('openai');
  });

  it('passes AbortSignal through to the SDK', async () => {
    const { client, spy } = fakeClient(async () => ({
      id: 'c',
      model: 'gpt-4o',
      choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
    }));
    const controller = new AbortController();

    const provider = createOpenAIProvider({ client });
    await provider.complete(baseRequest, { signal: controller.signal });
    expect(spy.mock.calls[0]?.[1]).toEqual({ signal: controller.signal });
  });
});

describe('createOpenAIProvider.stream', () => {
  it('translates chat.completions streaming chunks into neutral events', async () => {
    async function* chunks() {
      yield {
        id: 'chatcmpl-s',
        model: 'gpt-4o',
        choices: [{ delta: { content: 'hi' } }],
      };
      yield {
        id: 'chatcmpl-s',
        model: 'gpt-4o',
        choices: [{ delta: { content: ' there' }, finish_reason: 'stop' }],
        usage: { completion_tokens: 2 },
      };
    }
    const { client } = fakeClient(async () => chunks());
    const provider = createOpenAIProvider({ client });

    const events = [];
    for await (const event of provider.stream(baseRequest)) events.push(event);

    expect(events[0]).toEqual({
      type: 'message_start',
      id: 'chatcmpl-s',
      model: 'gpt-4o',
    });
    const deltas = events.filter((e) => e.type === 'content_block_delta');
    expect(deltas).toHaveLength(2);
    expect(events.at(-1)).toEqual({ type: 'message_stop' });
    const messageDelta = events.find((e) => e.type === 'message_delta');
    expect(messageDelta).toMatchObject({
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 2 },
    });
  });

  it('stitches streaming tool_call fragments across chunks', async () => {
    async function* chunks() {
      yield {
        id: 'c',
        model: 'gpt-4o',
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_a',
                  function: { name: 'add_slide', arguments: '{"i":' },
                },
              ],
            },
          },
        ],
      };
      yield {
        id: 'c',
        model: 'gpt-4o',
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: { arguments: '0}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };
    }
    const { client } = fakeClient(async () => chunks());
    const provider = createOpenAIProvider({ client });

    const events = [];
    for await (const event of provider.stream(baseRequest)) events.push(event);

    const starts = events.filter((e) => e.type === 'content_block_start');
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({
      block: { type: 'tool_use', id: 'call_a', name: 'add_slide' },
    });

    const jsonDeltas = events
      .filter(
        (e): e is Extract<typeof e, { type: 'content_block_delta' }> =>
          e.type === 'content_block_delta',
      )
      .map((e) => (e.delta.type === 'input_json_delta' ? e.delta.partial_json : ''));
    expect(jsonDeltas.join('')).toBe('{"i":0}');

    const messageDelta = events.find((e) => e.type === 'message_delta');
    expect(messageDelta).toMatchObject({ delta: { stop_reason: 'tool_use' } });
  });

  it('closes an open text block before opening a tool_use block', async () => {
    async function* chunks() {
      yield {
        id: 'c',
        model: 'gpt-4o',
        choices: [{ delta: { content: 'plan:' } }],
      };
      yield {
        id: 'c',
        model: 'gpt-4o',
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_b',
                  function: { name: 'add_slide', arguments: '{}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };
    }
    const { client } = fakeClient(async () => chunks());
    const provider = createOpenAIProvider({ client });

    const events = [];
    for await (const event of provider.stream(baseRequest)) events.push(event);

    const blockEvents = events.filter(
      (e) =>
        e.type === 'content_block_start' ||
        e.type === 'content_block_stop' ||
        e.type === 'content_block_delta',
    );
    expect(blockEvents.map((e) => e.type)).toEqual([
      'content_block_start',
      'content_block_delta',
      'content_block_stop',
      'content_block_start',
      'content_block_delta',
      'content_block_stop',
    ]);
  });

  it('wraps iterator errors as LLMError', async () => {
    async function* chunks() {
      yield {
        id: 'c',
        model: 'gpt-4o',
        choices: [{ delta: { content: 'a' } }],
      };
      throw Object.assign(new Error('oops'), { status: 500 });
    }
    const { client } = fakeClient(async () => chunks());
    const provider = createOpenAIProvider({ client });

    const run = async () => {
      for await (const _ of provider.stream(baseRequest)) {
        // iterate
      }
    };
    const err = await run().catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.kind).toBe('server_error');
  });
});
