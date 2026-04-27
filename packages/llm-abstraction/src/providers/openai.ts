// packages/llm-abstraction/src/providers/openai.ts
// OpenAI Chat Completions provider — translates the neutral LLM interface
// onto the `openai` package. Tool_result blocks become role:'tool' messages
// with `tool_call_id`, and tool_use blocks become assistant `tool_calls`.

import OpenAI from 'openai';
import { LLMError, classifyError } from '../errors.js';
import type {
  LLMContentBlock,
  LLMMessage,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStopReason,
  LLMStreamEvent,
  LLMStreamOptions,
  LLMToolDefinition,
} from '../types.js';

export interface OpenAIChatLike {
  completions: {
    create(
      params: Record<string, unknown>,
      requestOptions?: { signal?: AbortSignal },
    ): Promise<unknown>;
  };
}

export interface OpenAILike {
  chat: OpenAIChatLike;
}

export interface OpenAIProviderOptions {
  client?: OpenAILike;
  apiKey?: string;
  baseURL?: string;
}

export function createOpenAIProvider(options: OpenAIProviderOptions = {}): LLMProvider {
  const client: OpenAILike =
    options.client ??
    (new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    }) as unknown as OpenAILike);

  return {
    name: 'openai',
    async complete(request, callOptions) {
      const params = { ...translateRequest(request), stream: false };
      try {
        const raw = await client.chat.completions.create(
          params,
          callOptions?.signal ? { signal: callOptions.signal } : {},
        );
        return translateResponse(raw as OpenAIChatCompletion);
      } catch (error) {
        throw classifyError('openai', error);
      }
    },
    stream(request, callOptions) {
      const params = { ...translateRequest(request), stream: true };
      return streamEvents(client, params, callOptions);
    },
  };
}

async function* streamEvents(
  client: OpenAILike,
  params: Record<string, unknown>,
  callOptions: LLMStreamOptions | undefined,
): AsyncIterable<LLMStreamEvent> {
  let source: AsyncIterable<OpenAIChatCompletionChunk>;
  try {
    source = (await client.chat.completions.create(
      params,
      callOptions?.signal ? { signal: callOptions.signal } : {},
    )) as AsyncIterable<OpenAIChatCompletionChunk>;
  } catch (error) {
    throw classifyError('openai', error);
  }

  let messageId = '';
  let model = '';
  let textIndex: number | null = null;
  const toolIndexByOpenAIIndex = new Map<number, number>();
  const toolCallOpened = new Set<number>();
  let nextBlockIndex = 0;
  let finishReason: string | null = null;
  let outputTokens = 0;
  let started = false;

  try {
    for await (const chunk of source) {
      if (!started) {
        messageId = chunk.id ?? '';
        model = chunk.model ?? '';
        yield { type: 'message_start', id: messageId, model };
        started = true;
      }
      if (chunk.usage?.completion_tokens !== undefined) {
        outputTokens = chunk.usage.completion_tokens;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;

      const delta = choice.delta ?? {};
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        if (textIndex === null) {
          textIndex = nextBlockIndex++;
          yield {
            type: 'content_block_start',
            index: textIndex,
            block: { type: 'text' },
          };
        }
        yield {
          type: 'content_block_delta',
          index: textIndex,
          delta: { type: 'text_delta', text: delta.content },
        };
      }

      for (const toolDelta of delta.tool_calls ?? []) {
        const openAIIndex = toolDelta.index;
        let neutralIndex = toolIndexByOpenAIIndex.get(openAIIndex);
        if (neutralIndex === undefined) {
          if (textIndex !== null) {
            yield { type: 'content_block_stop', index: textIndex };
            textIndex = null;
          }
          neutralIndex = nextBlockIndex++;
          toolIndexByOpenAIIndex.set(openAIIndex, neutralIndex);
        }

        const id = toolDelta.id;
        const name = toolDelta.function?.name;
        if (id !== undefined && name !== undefined && !toolCallOpened.has(neutralIndex)) {
          yield {
            type: 'content_block_start',
            index: neutralIndex,
            block: { type: 'tool_use', id, name },
          };
          toolCallOpened.add(neutralIndex);
        }
        const args = toolDelta.function?.arguments;
        if (typeof args === 'string' && args.length > 0) {
          yield {
            type: 'content_block_delta',
            index: neutralIndex,
            delta: { type: 'input_json_delta', partial_json: args },
          };
        }
      }
    }
  } catch (error) {
    throw classifyError('openai', error);
  }

  if (textIndex !== null) {
    yield { type: 'content_block_stop', index: textIndex };
  }
  for (const neutralIndex of toolIndexByOpenAIIndex.values()) {
    yield { type: 'content_block_stop', index: neutralIndex };
  }

  yield {
    type: 'message_delta',
    delta: { stop_reason: normaliseFinishReason(finishReason) },
    usage: { output_tokens: outputTokens },
  };
  yield { type: 'message_stop' };
}

// --- translation -----------------------------------------------------------

function translateRequest(request: LLMRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    max_tokens: request.max_tokens,
    messages: flattenMessages(request),
  };
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.stop_sequences !== undefined) body.stop = request.stop_sequences;
  if (request.tools !== undefined && request.tools.length > 0) {
    body.tools = request.tools.map(translateTool);
  }
  return body;
}

function flattenMessages(request: LLMRequest): OpenAIMessage[] {
  const out: OpenAIMessage[] = [];
  if (request.system !== undefined) {
    out.push({ role: 'system', content: request.system });
  }
  for (const message of request.messages) {
    out.push(...translateMessage(message));
  }
  return out;
}

function translateMessage(message: LLMMessage): OpenAIMessage[] {
  if (typeof message.content === 'string') {
    return [{ role: mapRole(message.role), content: message.content }];
  }

  // T-246 spec §1: image-block binding for GPT-4o Vision is a follow-on
  // task. For now, throw `unsupported` so callers get a clear signal rather
  // than a malformed OpenAI request.
  for (const block of message.content) {
    if (block.type === 'image') {
      throw new LLMError('OpenAI provider does not yet support image content blocks', {
        kind: 'unsupported',
        provider: 'openai',
      });
    }
  }

  const out: OpenAIMessage[] = [];

  // Tool results (role='tool') each become their own message per OpenAI spec.
  for (const block of message.content) {
    if (block.type === 'tool_result') {
      out.push({
        role: 'tool',
        tool_call_id: block.tool_use_id,
        content: block.content,
      });
    }
  }

  const textParts = message.content
    .filter((b): b is Extract<LLMContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const toolCalls = message.content
    .filter((b): b is Extract<LLMContentBlock, { type: 'tool_use' }> => b.type === 'tool_use')
    .map((b) => ({
      id: b.id,
      type: 'function' as const,
      function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
    }));

  if (textParts.length > 0 || toolCalls.length > 0) {
    const primary: OpenAIMessage = {
      role: mapRole(message.role),
      content: textParts.length > 0 ? textParts : null,
    };
    if (toolCalls.length > 0) primary.tool_calls = toolCalls;
    out.unshift(primary);
  }

  return out;
}

function mapRole(role: LLMMessage['role']): OpenAIMessage['role'] {
  switch (role) {
    case 'system':
      return 'system';
    case 'assistant':
      return 'assistant';
    case 'tool':
      return 'tool';
    default:
      return 'user';
  }
}

function translateTool(tool: LLMToolDefinition): unknown {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  };
}

function translateResponse(raw: OpenAIChatCompletion): LLMResponse {
  const choice = raw.choices?.[0];
  const content: LLMContentBlock[] = [];
  const message = choice?.message;

  if (message?.content && message.content.length > 0) {
    content.push({ type: 'text', text: message.content });
  }
  for (const call of message?.tool_calls ?? []) {
    let input: unknown = {};
    const args = call.function.arguments;
    if (typeof args === 'string' && args.length > 0) {
      try {
        input = JSON.parse(args);
      } catch {
        input = { _raw: args };
      }
    }
    content.push({
      type: 'tool_use',
      id: call.id,
      name: call.function.name,
      input,
    });
  }

  return {
    id: raw.id,
    model: raw.model,
    role: 'assistant',
    content,
    stop_reason: normaliseFinishReason(choice?.finish_reason ?? null),
    usage: {
      input_tokens: raw.usage?.prompt_tokens ?? 0,
      output_tokens: raw.usage?.completion_tokens ?? 0,
    },
  };
}

function normaliseFinishReason(reason: string | null): LLMStopReason {
  switch (reason) {
    case 'stop':
      return 'end_turn';
    case 'length':
      return 'max_tokens';
    case 'tool_calls':
    case 'function_call':
      return 'tool_use';
    default:
      return 'end_turn';
  }
}

// --- structural OpenAI shapes (subset) -------------------------------------

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

interface OpenAIChatCompletion {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface OpenAIChatCompletionChunk {
  id?: string;
  model?: string;
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { completion_tokens?: number };
}
