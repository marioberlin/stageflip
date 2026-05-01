// packages/runtimes/interactive/src/clips/ai-generative/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/ai-generative`.
// Importing this module has TWO SIDE EFFECTS (T-395 D-T395-9 +
// T-396 D-T396-5):
//
//   1. registers `aiGenerativeClipFactory` with
//      `interactiveClipRegistry` for `family: 'ai-generative'`;
//   2. registers the curated-example `StaticFallbackGenerator`
//      (wrapping `defaultAiGenerativeStaticFallback`) with
//      `staticFallbackGeneratorRegistry` for `family: 'ai-generative'`.
//      The generator emits the
//      `ai-generative-clip.static-fallback.rendered` event with
//      integer-length attributes only (D-T396-4 privacy posture;
//      hasExample boolean + exampleSrcLength integer, never the
//      URL string).
//
// `componentRefSchema.module` references resolve here at deploy time:
//
//   `@stageflip/runtimes-interactive/clips/ai-generative#AiGenerativeClip`
//
// Re-importing throws `InteractiveClipFamilyAlreadyRegisteredError`
// per the registry contract. Tests that need a fresh registration
// call the matching `unregister`/`clear` first.
//
// CONVERGENCE — T-395 (γ-live, second pattern): ai-generative has
// no rendered output to converge on. There is no
// `convergence.test.tsx` in this directory; the absent test is
// documented as out-of-scope per D-T395-6.

import { interactiveClipRegistry } from '../../registry.js';
import { staticFallbackGeneratorRegistry } from '../../static-fallback-registry.js';
import { aiGenerativeClipFactory } from './factory.js';
import { aiGenerativeStaticFallbackGenerator } from './static-fallback.js';

// Side-effect 1: register the factory (T-395).
interactiveClipRegistry.register('ai-generative', aiGenerativeClipFactory);

// Side-effect 2: register the curated-example generator (T-396).
staticFallbackGeneratorRegistry.register('ai-generative', aiGenerativeStaticFallbackGenerator);

// Re-exports — typed surface for direct programmatic use.
export {
  AiGenerativeClipFactoryBuilder,
  aiGenerativeClipFactory,
  type AiGenerativeClipFactoryOptions,
} from './factory.js';
export {
  type AiGenerativeArgs,
  type AiGenerativeProvider,
  type AiGenerativeResult,
  type Generator,
  HostInjectedAiGenerativeProvider,
  type HostInjectedAiGenerativeProviderOptions,
  InMemoryAiGenerativeProvider,
  type InMemoryAiGenerativeProviderOptions,
  type ScriptedAiGenerativeResult,
} from './ai-generative-provider.js';
export {
  defaultAiGenerativeStaticFallback,
  type DefaultAiGenerativeStaticFallbackArgs,
  aiGenerativeStaticFallbackGenerator,
} from './static-fallback.js';
export type {
  AiGenerativeClipMountHandle,
  AiGenerativeMountFailureReason,
  ErrorEvent,
  ErrorHandler,
  ResultEvent,
  ResultHandler,
} from './types.js';
