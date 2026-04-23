// packages/llm-abstraction/src/providers/google.ts
// Google Gemini provider — translates the neutral LLM interface onto
// @google/generative-ai. Gemini does not stream tool-call argument tokens
// incrementally (it emits a complete functionCall per part), so args are
// surfaced as a single input_json_delta sandwich per tool_use block.

import { GoogleGenerativeAI } from '@google/generative-ai';
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

export interface GeminiModelLike {
  generateContent(
    request: GeminiRequest,
    options?: { signal?: AbortSignal },
  ): Promise<{ response: GeminiResponse }>;
  generateContentStream(
    request: GeminiRequest,
    options?: { signal?: AbortSignal },
  ): Promise<{
    stream: AsyncIterable<GeminiResponse>;
    response: Promise<GeminiResponse>;
  }>;
}

export interface GeminiClientLike {
  getGenerativeModel(params: {
    model: string;
    systemInstruction?: string;
    tools?: unknown[];
  }): GeminiModelLike;
}

export interface GoogleProviderOptions {
  client?: GeminiClientLike;
  apiKey?: string;
}

export function createGoogleProvider(options: GoogleProviderOptions = {}): LLMProvider {
  const client: GeminiClientLike =
    options.client ?? (new GoogleGenerativeAI(options.apiKey ?? '') as GeminiClientLike);

  return {
    name: 'google',
    async complete(request, callOptions) {
      try {
        const model = client.getGenerativeModel(buildModelConfig(request));
        const { response } = await model.generateContent(
          {
            contents: translateMessages(request.messages),
            generationConfig: buildGenerationConfig(request),
          },
          callOptions?.signal ? { signal: callOptions.signal } : {},
        );
        return translateResponse(request.model, response);
      } catch (error) {
        throw classifyError('google', error);
      }
    },
    stream(request, callOptions) {
      return streamEvents(client, request, callOptions);
    },
  };
}

async function* streamEvents(
  client: GeminiClientLike,
  request: LLMRequest,
  callOptions: LLMStreamOptions | undefined,
): AsyncIterable<LLMStreamEvent> {
  const model = client.getGenerativeModel(buildModelConfig(request));

  let stream: AsyncIterable<GeminiResponse>;
  try {
    const result = await model.generateContentStream(
      {
        contents: translateMessages(request.messages),
        generationConfig: buildGenerationConfig(request),
      },
      callOptions?.signal ? { signal: callOptions.signal } : {},
    );
    stream = result.stream;
  } catch (error) {
    throw classifyError('google', error);
  }

  const messageId = `gemini-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  yield { type: 'message_start', id: messageId, model: request.model };

  let nextIndex = 0;
  let openTextIndex: number | null = null;
  let finishReason: GeminiFinishReason | null = null;
  let totalOutputTokens = 0;

  try {
    for await (const chunk of stream) {
      const candidate = chunk.candidates?.[0];
      if (candidate?.finishReason) finishReason = candidate.finishReason;
      if (chunk.usageMetadata?.candidatesTokenCount !== undefined) {
        totalOutputTokens = chunk.usageMetadata.candidatesTokenCount;
      }

      for (const part of candidate?.content?.parts ?? []) {
        if (typeof part.text === 'string' && part.text.length > 0) {
          if (openTextIndex === null) {
            openTextIndex = nextIndex++;
            yield {
              type: 'content_block_start',
              index: openTextIndex,
              block: { type: 'text' },
            };
          }
          yield {
            type: 'content_block_delta',
            index: openTextIndex,
            delta: { type: 'text_delta', text: part.text },
          };
        } else if (part.functionCall) {
          if (openTextIndex !== null) {
            yield { type: 'content_block_stop', index: openTextIndex };
            openTextIndex = null;
          }
          const toolIndex = nextIndex++;
          const toolId = `call_${toolIndex}`;
          yield {
            type: 'content_block_start',
            index: toolIndex,
            block: {
              type: 'tool_use',
              id: toolId,
              name: part.functionCall.name,
            },
          };
          yield {
            type: 'content_block_delta',
            index: toolIndex,
            delta: {
              type: 'input_json_delta',
              partial_json: JSON.stringify(part.functionCall.args ?? {}),
            },
          };
          yield { type: 'content_block_stop', index: toolIndex };
        }
      }
    }
  } catch (error) {
    throw classifyError('google', error);
  }

  if (openTextIndex !== null) {
    yield { type: 'content_block_stop', index: openTextIndex };
  }

  yield {
    type: 'message_delta',
    delta: { stop_reason: normaliseFinishReason(finishReason) },
    usage: { output_tokens: totalOutputTokens },
  };
  yield { type: 'message_stop' };
}

// --- translation -----------------------------------------------------------

function buildModelConfig(request: LLMRequest): {
  model: string;
  systemInstruction?: string;
  tools?: unknown[];
} {
  const config: { model: string; systemInstruction?: string; tools?: unknown[] } = {
    model: request.model,
  };
  if (request.system !== undefined) config.systemInstruction = request.system;
  if (request.tools !== undefined && request.tools.length > 0) {
    config.tools = [{ functionDeclarations: request.tools.map(translateTool) }];
  }
  return config;
}

function buildGenerationConfig(request: LLMRequest): Record<string, unknown> {
  const config: Record<string, unknown> = { maxOutputTokens: request.max_tokens };
  if (request.temperature !== undefined) config.temperature = request.temperature;
  if (request.stop_sequences !== undefined) {
    config.stopSequences = request.stop_sequences;
  }
  return config;
}

/**
 * Walk messages in order so tool_result blocks can resolve their matching
 * tool name from an earlier tool_use block in the same request. Gemini's
 * `functionResponse.name` must equal the original `functionCall.name` (the
 * tool name, not an id) — the neutral interface carries `tool_use_id` only,
 * so we track id -> name locally.
 */
function translateMessages(messages: LLMMessage[]): GeminiContent[] {
  const toolNameById = new Map<string, string>();
  for (const message of messages) {
    if (typeof message.content === 'string') continue;
    for (const block of message.content) {
      if (block.type === 'tool_use') toolNameById.set(block.id, block.name);
    }
  }
  return messages.map((message) => translateMessage(message, toolNameById));
}

function translateMessage(message: LLMMessage, toolNameById: Map<string, string>): GeminiContent {
  const role = message.role === 'assistant' ? 'model' : 'user';
  if (typeof message.content === 'string') {
    return { role, parts: [{ text: message.content }] };
  }
  return {
    role,
    parts: message.content.map((block) => translateContentBlock(block, toolNameById)),
  };
}

function translateContentBlock(
  block: LLMContentBlock,
  toolNameById: Map<string, string>,
): GeminiPart {
  switch (block.type) {
    case 'text':
      return { text: block.text };
    case 'tool_use':
      return {
        functionCall: {
          name: block.name,
          args: (block.input ?? {}) as Record<string, unknown>,
        },
      };
    case 'tool_result':
      return {
        functionResponse: {
          name: toolNameById.get(block.tool_use_id) ?? block.tool_use_id,
          response: { content: block.content, is_error: block.is_error ?? false },
        },
      };
  }
}

function translateTool(tool: LLMToolDefinition): unknown {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  };
}

function translateResponse(model: string, response: GeminiResponse): LLMResponse {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const content: LLMContentBlock[] = [];
  let toolIndex = 0;

  for (const part of parts) {
    if (typeof part.text === 'string' && part.text.length > 0) {
      const last = content[content.length - 1];
      if (last?.type === 'text') {
        last.text += part.text;
      } else {
        content.push({ type: 'text', text: part.text });
      }
    } else if (part.functionCall) {
      content.push({
        type: 'tool_use',
        id: `call_${toolIndex++}`,
        name: part.functionCall.name,
        input: part.functionCall.args ?? {},
      });
    }
  }

  return {
    id: response.responseId ?? `gemini-${Date.now().toString(36)}`,
    model,
    role: 'assistant',
    content,
    stop_reason: normaliseFinishReason(candidate?.finishReason ?? null),
    usage: {
      input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

function normaliseFinishReason(reason: GeminiFinishReason | null): LLMStopReason {
  switch (reason) {
    case 'STOP':
      return 'end_turn';
    case 'MAX_TOKENS':
      return 'max_tokens';
    case 'TOOL_CODE':
    case 'FUNCTION_CALL':
      return 'tool_use';
    default:
      return 'end_turn';
  }
}

// --- structural Gemini shapes (subset) -------------------------------------

type GeminiFinishReason =
  | 'STOP'
  | 'MAX_TOKENS'
  | 'SAFETY'
  | 'RECITATION'
  | 'OTHER'
  | 'TOOL_CODE'
  | 'FUNCTION_CALL';

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | {
      functionCall: { name: string; args?: Record<string, unknown> };
    }
  | {
      functionResponse: {
        name: string;
        response: Record<string, unknown>;
      };
    };

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: Record<string, unknown>;
}

interface GeminiResponse {
  responseId?: string;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        functionCall?: { name: string; args?: Record<string, unknown> };
      }>;
    };
    finishReason?: GeminiFinishReason;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}
