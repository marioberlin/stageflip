// packages/runtimes/interactive/src/clips/ai-chat/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/ai-chat`.
// Importing this module has ONE SIDE EFFECT (T-389 D-T389-9):
//
//   1. registers `aiChatClipFactory` with `interactiveClipRegistry` for
//      `family: 'ai-chat'`.
//
// T-389 ships `liveMount` only — there is NO `staticFallback` generator
// registered here. T-390 (separate task) lands the
// `aiChatStaticFallbackGenerator` and adds the second
// `staticFallbackGeneratorRegistry.register('ai-chat', ...)` line.
// Until T-390 ships, the harness's static path falls through to the
// authored `staticFallback` array verbatim (or the empty array, which
// the schema's non-empty refine prevents in practice).
//
// `componentRefSchema.module` references resolve here at deploy time:
//
//   `@stageflip/runtimes-interactive/clips/ai-chat#AiChatClip`
//
// Re-importing throws `InteractiveClipFamilyAlreadyRegisteredError`.
// Tests that need a fresh registration call the matching
// `unregister` first.
//
// CONVERGENCE — T-389 (γ-live, second pattern): ai-chat has no rendered
// output to converge on. There is no `convergence.test.tsx` in this
// directory; the absent test is documented as out-of-scope.

import { interactiveClipRegistry } from '../../registry.js';
import { aiChatClipFactory } from './factory.js';

// Side effect: register the factory.
interactiveClipRegistry.register('ai-chat', aiChatClipFactory);

// Re-exports — typed surface for direct programmatic use.
export {
  AiChatClipFactoryBuilder,
  aiChatClipFactory,
  type AiChatClipFactoryOptions,
  type AiChatClipMountHandleWithTestSeam,
} from './factory.js';
export {
  InMemoryLLMChatProvider,
  type InMemoryLLMChatProviderOptions,
  type LLMChatProvider,
  type LLMChatStreamArgs,
  RealLLMChatProvider,
  type RealLLMChatProviderOptions,
  type ScriptedTokenStep,
  __resetTurnIdCounterForTests,
} from './llm-chat-provider.js';
export {
  type AiChatClipMountHandle,
  type AiChatMountFailureReason,
  MultiTurnDisabledError,
  type TurnEvent,
  type TurnHandler,
} from './types.js';
