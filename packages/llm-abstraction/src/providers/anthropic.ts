// packages/llm-abstraction/src/providers/anthropic.ts
// Anthropic Claude provider — wraps @anthropic-ai/sdk. Claude is the primary
// provider; streaming + tool-use shapes here define the neutral event model
// the other providers translate into.

import Anthropic from '@anthropic-ai/sdk';
import { classifyError } from '../errors.js';
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

/**
 * Subset of the Anthropic SDK surface the provider consumes. Declared
 * structurally so tests can inject a fake without constructing a real client.
 */
export interface AnthropicLike {
  messages: {
    create(
      params: Record<string, unknown>,
      requestOptions?: { signal?: AbortSignal },
    ): Promise<unknown>;
  };
}

export interface AnthropicProviderOptions {
  /** Pre-built client (takes precedence over apiKey). */
  client?: AnthropicLike;
  /** Consumed when `client` is not provided. */
  apiKey?: string;
  baseURL?: string;
}

export function createAnthropicProvider(options: AnthropicProviderOptions = {}): LLMProvider {
  const client: AnthropicLike =
    options.client ??
    (new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    }) as unknown as AnthropicLike);

  return {
    name: 'anthropic',
    async complete(request, callOptions) {
      const params = { ...translateRequest(request), stream: false };
      try {
        const raw = await client.messages.create(
          params,
          callOptions?.signal ? { signal: callOptions.signal } : {},
        );
        return translateResponse(raw as AnthropicMessage);
      } catch (error) {
        throw classifyError('anthropic', error);
      }
    },
    stream(request, callOptions) {
      const params = { ...translateRequest(request), stream: true };
      return streamEvents(client, params, callOptions);
    },
  };
}

async function* streamEvents(
  client: AnthropicLike,
  params: Record<string, unknown>,
  callOptions: LLMStreamOptions | undefined,
): AsyncIterable<LLMStreamEvent> {
  let source: AsyncIterable<AnthropicStreamEvent>;
  try {
    source = (await client.messages.create(
      params,
      callOptions?.signal ? { signal: callOptions.signal } : {},
    )) as AsyncIterable<AnthropicStreamEvent>;
  } catch (error) {
    throw classifyError('anthropic', error);
  }

  try {
    for await (const event of source) {
      const translated = translateStreamEvent(event);
      if (translated !== null) yield translated;
    }
  } catch (error) {
    throw classifyError('anthropic', error);
  }
}

// --- translation -----------------------------------------------------------

function translateRequest(request: LLMRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    max_tokens: request.max_tokens,
    messages: request.messages.map(translateMessage),
  };
  if (request.system !== undefined) body.system = request.system;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.stop_sequences !== undefined) {
    body.stop_sequences = request.stop_sequences;
  }
  if (request.tools !== undefined) body.tools = request.tools.map(translateTool);
  return body;
}

function translateMessage(message: LLMMessage): { role: 'user' | 'assistant'; content: unknown } {
  const role = message.role === 'assistant' ? 'assistant' : 'user';
  if (typeof message.content === 'string') {
    return { role, content: message.content };
  }
  return { role, content: message.content.map(translateContentBlock) };
}

function translateContentBlock(block: LLMContentBlock): unknown {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'tool_use':
      return {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input,
      };
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: block.tool_use_id,
        content: block.content,
        ...(block.is_error !== undefined ? { is_error: block.is_error } : {}),
      };
  }
}

function translateTool(tool: LLMToolDefinition): unknown {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  };
}

function translateResponse(message: AnthropicMessage): LLMResponse {
  return {
    id: message.id,
    model: message.model,
    role: 'assistant',
    content: message.content.map(translateResponseBlock),
    stop_reason: normaliseStopReason(message.stop_reason),
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    },
  };
}

function translateResponseBlock(block: AnthropicResponseBlock): LLMContentBlock {
  if (block.type === 'text') return { type: 'text', text: block.text };
  return {
    type: 'tool_use',
    id: block.id,
    name: block.name,
    input: block.input,
  };
}

function normaliseStopReason(reason: AnthropicMessage['stop_reason']): LLMStopReason {
  switch (reason) {
    case 'end_turn':
    case 'tool_use':
    case 'max_tokens':
    case 'stop_sequence':
      return reason;
    default:
      return 'end_turn';
  }
}

function translateStreamEvent(event: AnthropicStreamEvent): LLMStreamEvent | null {
  switch (event.type) {
    case 'message_start':
      return {
        type: 'message_start',
        id: event.message.id,
        model: event.message.model,
      };
    case 'content_block_start':
      if (event.content_block.type === 'text') {
        return {
          type: 'content_block_start',
          index: event.index,
          block: { type: 'text' },
        };
      }
      return {
        type: 'content_block_start',
        index: event.index,
        block: {
          type: 'tool_use',
          id: event.content_block.id,
          name: event.content_block.name,
        },
      };
    case 'content_block_delta':
      if (event.delta.type === 'text_delta') {
        return {
          type: 'content_block_delta',
          index: event.index,
          delta: { type: 'text_delta', text: event.delta.text },
        };
      }
      if (event.delta.type === 'input_json_delta') {
        return {
          type: 'content_block_delta',
          index: event.index,
          delta: {
            type: 'input_json_delta',
            partial_json: event.delta.partial_json,
          },
        };
      }
      return null;
    case 'content_block_stop':
      return { type: 'content_block_stop', index: event.index };
    case 'message_delta': {
      const out: Extract<LLMStreamEvent, { type: 'message_delta' }> = {
        type: 'message_delta',
        delta: {},
      };
      if (event.delta.stop_reason) {
        out.delta.stop_reason = normaliseStopReason(event.delta.stop_reason);
      }
      if (event.usage) {
        out.usage = { output_tokens: event.usage.output_tokens };
      }
      return out;
    }
    case 'message_stop':
      return { type: 'message_stop' };
    default:
      return null;
  }
}

// --- Structural SDK shapes (subset) ---------------------------------------

interface AnthropicMessage {
  id: string;
  model: string;
  content: AnthropicResponseBlock[];
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

type AnthropicResponseBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown };

type AnthropicStreamEvent =
  | { type: 'message_start'; message: { id: string; model: string } }
  | {
      type: 'content_block_start';
      index: number;
      content_block:
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: unknown };
    }
  | {
      type: 'content_block_delta';
      index: number;
      delta:
        | { type: 'text_delta'; text: string }
        | { type: 'input_json_delta'; partial_json: string };
    }
  | { type: 'content_block_stop'; index: number }
  | {
      type: 'message_delta';
      delta: { stop_reason?: string | null };
      usage?: { output_tokens: number };
    }
  | { type: 'message_stop' }
  | { type: 'ping' };
