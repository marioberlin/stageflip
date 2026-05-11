// packages/music-acestep/src/index.ts
// Public surface of `@stageflip/music-acestep`. T-432 — seventh
// reference adapter (Phase 14 β; first `music-gen` modality).
//
// The `descriptor` named export is what `scripts/check-asset-licenses.ts`
// (T-422) discovers via dynamic import. `aceStepDescriptor` is the same
// object under its canonical name — host shells (e.g.
// `scripts/sync-skills.ts`) import the canonical name when they
// `registry.register(aceStepDescriptor)`.
//
// Importing this module has NO side effects — adapters-core uses an
// instance-based, per-tenant `AdapterRegistry` (not a global
// singleton), so the host shell owns registration timing.

export {
  ACE_STEP_GENRES,
  ACE_STEP_MAX_DURATION_S,
  ACE_STEP_SAMPLE_RATE_HZ,
  aceStepDescriptor,
  aceStepMusicGenCapability,
} from './descriptor.js';

// Aliased export for the T-422 discovery walker.
export { aceStepDescriptor as descriptor } from './descriptor.js';

export {
  AceStepMusicProvider,
  NotYetImplementedError,
} from './provider.js';
export type { AceStepMusicProviderOptions, AceStepProviderMode } from './provider.js';

export { generateSilentWavDataUri } from './stub-audio.js';
