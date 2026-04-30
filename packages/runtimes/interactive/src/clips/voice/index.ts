// packages/runtimes/interactive/src/clips/voice/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/voice`.
// Importing this module has TWO SIDE EFFECTS (T-387 D-T387-10 +
// T-388a D-T388a-2):
//
//   1. registers `voiceClipFactory` with `interactiveClipRegistry` for
//      `family: 'voice'`;
//   2. registers the default-poster `StaticFallbackGenerator` (wrapping
//      `defaultVoiceStaticFallback`) with `staticFallbackGeneratorRegistry`
//      for `family: 'voice'`. The generator emits the
//      `voice-clip.static-fallback.rendered` event with the same shape
//      T-388 pinned (AC #14 privacy: `posterTextLength` only).
//
// `componentRefSchema.module` references resolve here at deploy time:
//
//   `@stageflip/runtimes-interactive/clips/voice#VoiceClip`
//
// Re-importing throws `InteractiveClipFamilyAlreadyRegisteredError` (or
// the static-fallback equivalent) per the registry contracts. Tests that
// need a fresh registration call the matching `unregister`/`clear`
// first.
//
// CONVERGENCE — T-387 D-T387-6: voice has no rendered output to converge
// on. There is no `convergence.test.tsx` in this directory; the absent
// test is the documented out-of-scope (read against shader / three-scene
// where convergence is enforced).

import { interactiveClipRegistry } from '../../registry.js';
import { staticFallbackGeneratorRegistry } from '../../static-fallback-registry.js';
import { voiceClipFactory } from './factory.js';
import { voiceStaticFallbackGenerator } from './static-fallback.js';

// Side-effect 1: register the factory.
interactiveClipRegistry.register('voice', voiceClipFactory);

// Side-effect 2: register the default-poster generator. Telemetry shape
// is identical to the T-388 pre-refactor harness emission so existing
// consumers (renderer-cdp / observability pipeline) continue to key on
// the same field names.
staticFallbackGeneratorRegistry.register('voice', voiceStaticFallbackGenerator);

// Re-exports — typed surface for direct programmatic use.
export {
  VoiceClipFactoryBuilder,
  voiceClipFactory,
  type VoiceClipFactoryBrowserApi,
  type VoiceClipFactoryOptions,
} from './factory.js';
export {
  defaultMediaGraphBrowserApi,
  MediaGraph,
  type MediaGraphBrowserApi,
  type MediaGraphOptions,
} from './media-graph.js';
export {
  defaultVoiceStaticFallback,
  type DefaultVoiceStaticFallbackArgs,
  voiceStaticFallbackGenerator,
} from './static-fallback.js';
export {
  InMemoryTranscriptionProvider,
  type InMemoryTranscriptionProviderOptions,
  type ScriptedTranscriptStep,
  type TranscriptionProvider,
  type TranscriptionStartArgs,
  WebSpeechApiTranscriptionProvider,
  type WebSpeechApiTranscriptionProviderOptions,
  WebSpeechApiUnavailableError,
} from './transcription-provider.js';
export type {
  TranscriptEvent,
  TranscriptHandler,
  VoiceClipMountHandle,
  VoiceMountFailureReason,
} from './types.js';
