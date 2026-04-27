// packages/llm-abstraction/src/types.ts
// Provider-neutral LLM interface — shared by Anthropic, Google, OpenAI providers.

export type LLMProviderName = 'anthropic' | 'google' | 'openai';

export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Supported image media types for the multimodal `image` content block.
 * Constrained to the formats Gemini, Claude, and GPT-4o all accept.
 */
export type LLMImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp';

export type LLMContentBlock =
  | { type: 'text'; text: string }
  | {
      /**
       * Multimodal image input. Request-side only — not yielded by stream
       * events (image inputs are never streamed back). `data` is base64-encoded
       * raw image bytes (no `data:` URL prefix). T-246 added this for the
       * Gemini multimodal AI-QC convergence loop; Anthropic and OpenAI
       * providers throw `LLMError({kind: 'unsupported'})` until follow-on
       * tasks bind their image-input shapes.
       */
      type: 'image';
      mediaType: LLMImageMediaType;
      data: string;
    }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export interface LLMMessage {
  role: LLMRole;
  content: string | LLMContentBlock[];
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type LLMStopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  system?: string;
  tools?: LLMToolDefinition[];
  max_tokens: number;
  temperature?: number;
  stop_sequences?: string[];
}

export interface LLMResponse {
  id: string;
  model: string;
  role: 'assistant';
  content: LLMContentBlock[];
  stop_reason: LLMStopReason;
  usage: LLMUsage;
}

export type LLMStreamEvent =
  | { type: 'message_start'; id: string; model: string }
  | {
      type: 'content_block_start';
      index: number;
      block: { type: 'text' } | { type: 'tool_use'; id: string; name: string };
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
      delta: { stop_reason?: LLMStopReason };
      usage?: { output_tokens: number };
    }
  | { type: 'message_stop' };

export interface LLMStreamOptions {
  signal?: AbortSignal;
}

export interface LLMProvider {
  readonly name: LLMProviderName;
  complete(request: LLMRequest, options?: LLMStreamOptions): Promise<LLMResponse>;
  stream(request: LLMRequest, options?: LLMStreamOptions): AsyncIterable<LLMStreamEvent>;
}

/**
 * Reassemble an {@link LLMResponse} from a stream of {@link LLMStreamEvent}s.
 * Public helper so consumers can iterate a stream for UI delta rendering and
 * still obtain the final content + stop_reason + usage without calling the
 * provider twice.
 */
export async function collectStream(stream: AsyncIterable<LLMStreamEvent>): Promise<LLMResponse> {
  let id = '';
  let model = '';
  let stop_reason: LLMStopReason = 'end_turn';
  const usage: LLMUsage = { input_tokens: 0, output_tokens: 0 };

  const blocks: LLMContentBlock[] = [];
  const partialJsonByIndex = new Map<number, string>();

  for await (const event of stream) {
    switch (event.type) {
      case 'message_start': {
        id = event.id;
        model = event.model;
        break;
      }
      case 'content_block_start': {
        if (event.block.type === 'text') {
          blocks[event.index] = { type: 'text', text: '' };
        } else {
          blocks[event.index] = {
            type: 'tool_use',
            id: event.block.id,
            name: event.block.name,
            input: {},
          };
          partialJsonByIndex.set(event.index, '');
        }
        break;
      }
      case 'content_block_delta': {
        const block = blocks[event.index];
        if (!block) break;
        if (event.delta.type === 'text_delta' && block.type === 'text') {
          block.text += event.delta.text;
        } else if (event.delta.type === 'input_json_delta' && block.type === 'tool_use') {
          partialJsonByIndex.set(
            event.index,
            (partialJsonByIndex.get(event.index) ?? '') + event.delta.partial_json,
          );
        }
        break;
      }
      case 'content_block_stop': {
        const block = blocks[event.index];
        if (block?.type === 'tool_use') {
          const json = partialJsonByIndex.get(event.index) ?? '';
          block.input = json.length > 0 ? JSON.parse(json) : {};
        }
        break;
      }
      case 'message_delta': {
        if (event.delta.stop_reason !== undefined) {
          stop_reason = event.delta.stop_reason;
        }
        if (event.usage !== undefined) {
          usage.output_tokens = event.usage.output_tokens;
        }
        break;
      }
      case 'message_stop':
        break;
    }
  }

  return {
    id,
    model,
    role: 'assistant',
    content: blocks.filter((b): b is LLMContentBlock => Boolean(b)),
    stop_reason,
    usage,
  };
}
