// packages/music-yue/src/index.ts
// Public surface of `@stageflip/music-yue`. T-433 — eighth reference
// adapter (Phase 14 β; second `music-gen` modality; first Apache-2.0
// music adapter; first adapter to exercise the `attribution-required`
// output-license disposition).
//
// The `descriptor` named export is what `scripts/check-asset-licenses.ts`
// (T-422) discovers via dynamic import. `yueDescriptor` is the same
// object under its canonical name — host shells (e.g.
// `scripts/sync-skills.ts`) import the canonical name when they
// `registry.register(yueDescriptor)`.
//
// Importing this module has NO side effects — adapters-core uses an
// instance-based, per-tenant `AdapterRegistry` (not a global
// singleton), so the host shell owns registration timing.

export {
  YUE_ATTRIBUTION,
  YUE_GENRES,
  YUE_MAX_DURATION_S,
  YUE_SAMPLE_RATE_HZ,
  yueDescriptor,
  yueMusicGenCapability,
} from './descriptor.js';

// Aliased export for the T-422 discovery walker.
export { yueDescriptor as descriptor } from './descriptor.js';

export {
  NotYetImplementedError,
  YueMusicProvider,
} from './provider.js';
export type { YueMusicProviderOptions, YueProviderMode } from './provider.js';

export { generateSilentWavDataUri } from './stub-audio.js';
