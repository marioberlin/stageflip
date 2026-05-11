// packages/tts-fish-speech/src/index.ts
// Public surface of `@stageflip/tts-fish-speech`. T-427 — second
// reference adapter (Phase 14 β; first voice-clone adapter).
//
// The `descriptor` named export is what
// `scripts/check-asset-licenses.ts` (T-422) discovers via dynamic
// import. `fishSpeechDescriptor` is the same object under its
// canonical name — host shells (e.g. `scripts/sync-skills.ts`) import
// the canonical name when they `registry.register(fishSpeechDescriptor)`.
//
// Importing this module has NO side effects — adapters-core uses an
// instance-based, per-tenant `AdapterRegistry` (not a global
// singleton), so the host shell owns registration timing.

export {
  FISH_SPEECH_LIBRARY_VOICES,
  FISH_SPEECH_MAX_DURATION_S,
  FISH_SPEECH_SAMPLE_RATE_HZ,
  FISH_SPEECH_SUPPORTED_LANGUAGES,
  fishSpeechDescriptor,
  fishSpeechTtsCapability,
} from './descriptor.js';

// Aliased export for the T-422 discovery walker.
export { fishSpeechDescriptor as descriptor } from './descriptor.js';

export { FishSpeechTtsProvider, NotYetImplementedError } from './provider.js';
export type { FishSpeechProviderMode, FishSpeechTtsProviderOptions } from './provider.js';

export {
  VoiceConsentRequiredError,
  assertVoiceConsentIfNeeded,
} from './voice-consent.js';
export type { AssertVoiceConsentIfNeededInput } from './voice-consent.js';

export { generateSilentWavDataUri } from './stub-audio.js';
