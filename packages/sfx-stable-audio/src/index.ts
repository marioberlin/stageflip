// packages/sfx-stable-audio/src/index.ts
// Public surface of `@stageflip/sfx-stable-audio`. T-434 — ninth and
// FINAL reference adapter (Phase 14 β; first + only `sfx` modality).
//
// The `descriptor` named export is what `scripts/check-asset-licenses.ts`
// (T-422) discovers via dynamic import. `stableAudioDescriptor` is the
// same object under its canonical name — host shells (e.g.
// `scripts/sync-skills.ts`) import the canonical name when they
// `registry.register(stableAudioDescriptor)`.
//
// Importing this module has NO side effects — adapters-core uses an
// instance-based, per-tenant `AdapterRegistry` (not a global
// singleton), so the host shell owns registration timing.

export {
  STABLE_AUDIO_MAX_DURATION_S,
  STABLE_AUDIO_SAMPLE_RATE_HZ,
  stableAudioDescriptor,
  stableAudioSfxCapability,
} from './descriptor.js';

// Aliased export for the T-422 discovery walker.
export { stableAudioDescriptor as descriptor } from './descriptor.js';

export {
  NotYetImplementedError,
  StableAudioSfxProvider,
} from './provider.js';
export type {
  StableAudioProviderMode,
  StableAudioSfxProviderOptions,
} from './provider.js';

export { generateSilentWavDataUri } from './stub-audio.js';
