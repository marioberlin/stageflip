// packages/llm-abstraction/src/providers/google.test.ts

import { describe, expect, it, vi } from 'vitest';
import { LLMError } from '../errors.js';
import type { LLMRequest } from '../types.js';
import { type GeminiClientLike, type GeminiModelLike, createGoogleProvider } from './google.js';

const baseRequest: LLMRequest = {
  model: 'gemini-1.5-pro',
  max_tokens: 1024,
  system: 'You are helpful.',
  messages: [{ role: 'user', content: 'hi' }],
};

function fakeClient(model: Partial<GeminiModelLike>): {
  client: GeminiClientLike;
  getModel: ReturnType<typeof vi.fn>;
} {
  const defaulted: GeminiModelLike = {
    generateContent: model.generateContent ?? (async () => ({ response: { candidates: [] } })),
    generateContentStream:
      model.generateContentStream ??
      (async () => ({
        stream: (async function* () {})(),
        response: Promise.resolve({ candidates: [] }),
      })),
  };
  const getModel = vi.fn(() => defaulted);
  return { client: { getGenerativeModel: getModel }, getModel };
}

describe('createGoogleProvider.complete', () => {
  it('translates Gemini response parts into neutral content blocks', async () => {
    const { client } = fakeClient({
      generateContent: async () => ({
        response: {
          responseId: 'resp_1',
          candidates: [
            {
              content: {
                parts: [
                  { text: 'hello ' },
                  { text: 'world' },
                  { functionCall: { name: 'add_slide', args: { n: 1 } } },
                ],
              },
              finishReason: 'FUNCTION_CALL',
            },
          ],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
        },
      }),
    });

    const provider = createGoogleProvider({ client });
    const response = await provider.complete(baseRequest);

    expect(response.content).toEqual([
      { type: 'text', text: 'hello world' },
      {
        type: 'tool_use',
        id: 'call_0',
        name: 'add_slide',
        input: { n: 1 },
      },
    ]);
    expect(response.stop_reason).toBe('tool_use');
    expect(response.usage).toEqual({ input_tokens: 5, output_tokens: 3 });
    expect(response.id).toBe('resp_1');
  });

  it('passes model config (system + tools) and generation config', async () => {
    const generate = vi.fn(async () => ({
      response: {
        candidates: [{ finishReason: 'STOP', content: { parts: [] } }],
      },
    }));
    const { client, getModel } = fakeClient({ generateContent: generate });

    const provider = createGoogleProvider({ client });
    await provider.complete({
      ...baseRequest,
      temperature: 0.3,
      stop_sequences: ['END'],
      tools: [
        {
          name: 'add_slide',
          description: 'add a slide',
          input_schema: { type: 'object' },
        },
      ],
    });

    expect(getModel).toHaveBeenCalledWith({
      model: 'gemini-1.5-pro',
      systemInstruction: 'You are helpful.',
      tools: [
        {
          functionDeclarations: [
            {
              name: 'add_slide',
              description: 'add a slide',
              parameters: { type: 'object' },
            },
          ],
        },
      ],
    });

    const [sent] = generate.mock.calls[0] ?? [];
    expect(sent).toMatchObject({
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.3,
        stopSequences: ['END'],
      },
    });
  });

  it('translates assistant tool_use and tool_result blocks into Gemini parts', async () => {
    const generate = vi.fn(async () => ({
      response: {
        candidates: [{ finishReason: 'STOP', content: { parts: [] } }],
      },
    }));
    const { client } = fakeClient({ generateContent: generate });

    const provider = createGoogleProvider({ client });
    await provider.complete({
      model: 'gemini-1.5-pro',
      max_tokens: 100,
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'toolu_1', name: 'x', input: { a: 1 } }],
        },
        {
          role: 'tool',
          content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }],
        },
      ],
    });

    const [sent] = generate.mock.calls[0] ?? [];
    expect((sent as { contents: unknown }).contents).toEqual([
      {
        role: 'model',
        parts: [{ functionCall: { name: 'x', args: { a: 1 } } }],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: 'x',
              response: { content: 'ok', is_error: false },
            },
          },
        ],
      },
    ]);
  });

  it('wraps SDK errors as LLMError', async () => {
    const { client } = fakeClient({
      generateContent: async () => {
        throw Object.assign(new Error('unauthenticated'), { status: 401 });
      },
    });

    const provider = createGoogleProvider({ client });
    const caught = await provider.complete(baseRequest).catch((e) => e);
    expect(caught).toBeInstanceOf(LLMError);
    expect(caught.kind).toBe('authentication');
    expect(caught.provider).toBe('google');
  });

  it('passes AbortSignal through to generateContent', async () => {
    const generate = vi.fn(async () => ({
      response: { candidates: [{ finishReason: 'STOP', content: { parts: [] } }] },
    }));
    const { client } = fakeClient({ generateContent: generate });
    const controller = new AbortController();
    const provider = createGoogleProvider({ client });
    await provider.complete(baseRequest, { signal: controller.signal });
    expect(generate.mock.calls[0]?.[1]).toEqual({ signal: controller.signal });
  });
});

describe('createGoogleProvider.stream', () => {
  it('synthesises message_start + block_start/delta/stop + message_stop around text chunks', async () => {
    const { client } = fakeClient({
      generateContentStream: async () => ({
        stream: (async function* () {
          yield {
            candidates: [{ content: { parts: [{ text: 'hel' }] } }],
          };
          yield {
            candidates: [{ content: { parts: [{ text: 'lo' }] }, finishReason: 'STOP' }],
            usageMetadata: { candidatesTokenCount: 1 },
          };
        })(),
        response: Promise.resolve({ candidates: [] }),
      }),
    });

    const provider = createGoogleProvider({ client });
    const events = [];
    for await (const event of provider.stream(baseRequest)) events.push(event);

    const types = events.map((e) => e.type);
    expect(types[0]).toBe('message_start');
    expect(types).toContain('content_block_start');
    expect(types).toContain('content_block_delta');
    expect(types).toContain('content_block_stop');
    expect(types.at(-1)).toBe('message_stop');

    const deltas = events.filter(
      (e): e is Extract<typeof e, { type: 'content_block_delta' }> =>
        e.type === 'content_block_delta',
    );
    expect(deltas.map((d) => (d.delta.type === 'text_delta' ? d.delta.text : ''))).toEqual([
      'hel',
      'lo',
    ]);

    const messageDelta = events.find((e) => e.type === 'message_delta');
    expect(messageDelta).toMatchObject({
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 1 },
    });
  });

  it('closes an open text block before opening a tool_use block', async () => {
    const { client } = fakeClient({
      generateContentStream: async () => ({
        stream: (async function* () {
          yield {
            candidates: [{ content: { parts: [{ text: 'plan:' }] } }],
          };
          yield {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: { name: 'add_slide', args: { i: 0 } },
                    },
                  ],
                },
                finishReason: 'FUNCTION_CALL',
              },
            ],
          };
        })(),
        response: Promise.resolve({ candidates: [] }),
      }),
    });

    const provider = createGoogleProvider({ client });
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

    const toolStart = blockEvents[3];
    expect(toolStart).toMatchObject({
      type: 'content_block_start',
      block: { type: 'tool_use', name: 'add_slide' },
    });

    const toolDelta = blockEvents[4];
    expect(toolDelta).toMatchObject({
      type: 'content_block_delta',
      delta: { type: 'input_json_delta', partial_json: '{"i":0}' },
    });
  });

  it('wraps stream iterator errors as LLMError', async () => {
    const { client } = fakeClient({
      generateContentStream: async () => ({
        stream: (async function* () {
          yield {
            candidates: [{ content: { parts: [{ text: 'a' }] } }],
          };
          throw Object.assign(new Error('oops'), { status: 500 });
        })(),
        response: Promise.resolve({ candidates: [] }),
      }),
    });

    const provider = createGoogleProvider({ client });
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
