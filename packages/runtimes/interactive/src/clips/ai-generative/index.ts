// packages/runtimes/interactive/src/clips/ai-generative/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/ai-generative`.
// Importing this module has ONE SIDE EFFECT (T-395 D-T395-9):
//
//   1. registers `aiGenerativeClipFactory` with
//      `interactiveClipRegistry` for `family: 'ai-generative'`.
//
// T-396 will add a second side-effect (registering the
// `aiGenerativeStaticFallbackGenerator` with
// `staticFallbackGeneratorRegistry`) when the curated-example
// fallback ships.
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
import { aiGenerativeClipFactory } from './factory.js';

// Side-effect 1: register the factory (T-395).
interactiveClipRegistry.register('ai-generative', aiGenerativeClipFactory);

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
export type {
  AiGenerativeClipMountHandle,
  AiGenerativeMountFailureReason,
  ErrorEvent,
  ErrorHandler,
  ResultEvent,
  ResultHandler,
} from './types.js';
