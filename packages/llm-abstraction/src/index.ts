// packages/llm-abstraction/src/index.ts
// Public barrel — provider-neutral LLM interface + three concrete providers.

export type {
  LLMContentBlock,
  LLMMessage,
  LLMProvider,
  LLMProviderName,
  LLMRequest,
  LLMResponse,
  LLMRole,
  LLMStopReason,
  LLMStreamEvent,
  LLMStreamOptions,
  LLMToolDefinition,
  LLMUsage,
} from './types.js';
export { collectStream } from './types.js';

export { LLMError, classifyError } from './errors.js';
export type { LLMErrorKind, LLMErrorOptions } from './errors.js';

export {
  type AnthropicLike,
  type AnthropicProviderOptions,
  createAnthropicProvider,
} from './providers/anthropic.js';
export {
  type GeminiClientLike,
  type GeminiModelLike,
  type GoogleProviderOptions,
  createGoogleProvider,
} from './providers/google.js';
export {
  type OpenAILike,
  type OpenAIChatLike,
  type OpenAIProviderOptions,
  createOpenAIProvider,
} from './providers/openai.js';

import { type AnthropicProviderOptions, createAnthropicProvider } from './providers/anthropic.js';
import { type GoogleProviderOptions, createGoogleProvider } from './providers/google.js';
import { type OpenAIProviderOptions, createOpenAIProvider } from './providers/openai.js';
import type { LLMProvider, LLMProviderName } from './types.js';

export type CreateProviderSpec =
  | ({ provider: 'anthropic' } & AnthropicProviderOptions)
  | ({ provider: 'google' } & GoogleProviderOptions)
  | ({ provider: 'openai' } & OpenAIProviderOptions);

/**
 * Factory routing by provider name. Consumers that need to swap providers at
 * runtime (e.g. via an env var) can pass `{ provider: 'anthropic', apiKey }`
 * rather than importing each concrete factory.
 */
export function createProvider(spec: CreateProviderSpec): LLMProvider {
  switch (spec.provider) {
    case 'anthropic': {
      const { provider: _p, ...options } = spec;
      return createAnthropicProvider(options);
    }
    case 'google': {
      const { provider: _p, ...options } = spec;
      return createGoogleProvider(options);
    }
    case 'openai': {
      const { provider: _p, ...options } = spec;
      return createOpenAIProvider(options);
    }
  }
}

export const PROVIDER_NAMES: readonly LLMProviderName[] = [
  'anthropic',
  'google',
  'openai',
] as const;
