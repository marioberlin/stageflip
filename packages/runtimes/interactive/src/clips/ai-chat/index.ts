// packages/runtimes/interactive/src/clips/ai-chat/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/ai-chat`.
// Importing this module has TWO SIDE EFFECTS (T-389 D-T389-9 +
// T-390 D-T390-5):
//
//   1. registers `aiChatClipFactory` with `interactiveClipRegistry` for
//      `family: 'ai-chat'`;
//   2. registers the default-transcript `StaticFallbackGenerator`
//      (wrapping `defaultAiChatStaticFallback`) with
//      `staticFallbackGeneratorRegistry` for `family: 'ai-chat'`. The
//      generator emits the `ai-chat-clip.static-fallback.rendered`
//      event with integer-length attributes only (D-T390-4 privacy
//      posture; transcriptTurnCount / systemPromptLength, never the
//      bodies).
//
// `componentRefSchema.module` references resolve here at deploy time:
//
//   `@stageflip/runtimes-interactive/clips/ai-chat#AiChatClip`
//
// Re-importing throws `InteractiveClipFamilyAlreadyRegisteredError` (or
// the static-fallback equivalent) per the registry contracts. Tests
// that need a fresh registration call the matching `unregister`/`clear`
// first.
//
// CONVERGENCE — T-389 (γ-live, second pattern): ai-chat has no rendered
// output to converge on. There is no `convergence.test.tsx` in this
// directory; the absent test is documented as out-of-scope.

import { interactiveClipRegistry } from '../../registry.js';
import { staticFallbackGeneratorRegistry } from '../../static-fallback-registry.js';
import { aiChatClipFactory } from './factory.js';
import { aiChatStaticFallbackGenerator } from './static-fallback.js';

// Side-effect 1: register the factory (T-389).
interactiveClipRegistry.register('ai-chat', aiChatClipFactory);

// Side-effect 2: register the default-transcript generator (T-390).
staticFallbackGeneratorRegistry.register('ai-chat', aiChatStaticFallbackGenerator);

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
  aiChatStaticFallbackGenerator,
  defaultAiChatStaticFallback,
  type DefaultAiChatStaticFallbackArgs,
} from './static-fallback.js';
export {
  type AiChatClipMountHandle,
  type AiChatMountFailureReason,
  MultiTurnDisabledError,
  type TurnEvent,
  type TurnHandler,
} from './types.js';
