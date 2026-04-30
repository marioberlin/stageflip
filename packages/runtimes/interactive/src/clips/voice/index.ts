// packages/runtimes/interactive/src/clips/voice/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/voice`.
// Importing this module has the SIDE EFFECT of registering
// `voiceClipFactory` with `interactiveClipRegistry` for `family: 'voice'`
// (T-387 D-T387-10). `componentRefSchema.module` references resolve here
// at deploy time:
//
//   `@stageflip/runtimes-interactive/clips/voice#VoiceClip`
//
// Re-importing throws `InteractiveClipFamilyAlreadyRegisteredError` per
// the registry contract (AC #6). Tests that need a fresh registration
// call `interactiveClipRegistry.unregister('voice')` first.
//
// CONVERGENCE — T-387 D-T387-6: voice has no rendered output to converge
// on. There is no `convergence.test.tsx` in this directory; the absent
// test is the documented out-of-scope (read against shader / three-scene
// where convergence is enforced).

import { interactiveClipRegistry } from '../../registry.js';
import { voiceClipFactory } from './factory.js';

// Side-effect: register on import. Production consumers (renderer-cdp,
// browser live-preview) import this module to make the family resolvable.
interactiveClipRegistry.register('voice', voiceClipFactory);

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
