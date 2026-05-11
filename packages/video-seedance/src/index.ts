// packages/video-seedance/src/index.ts
// Public surface of `@stageflip/video-seedance`. T-430 — fifth reference
// adapter (Phase 14 β; first video-gen adapter; third proprietary-byo
// adapter).
//
// The `descriptor` named export is what `scripts/check-asset-licenses.ts`
// (T-422) discovers via dynamic import. `seedanceDescriptor` is the same
// object under its canonical name — host shells (e.g.
// `scripts/sync-skills.ts`) import the canonical name when they
// `registry.register(seedanceDescriptor)`.
//
// Importing this module has NO side effects — adapters-core uses an
// instance-based, per-tenant `AdapterRegistry` (not a global
// singleton), so the host shell owns registration timing.

export {
  SEEDANCE_BASE_URL_ENV_VAR,
  SEEDANCE_FRAME_RATE,
  SEEDANCE_MAX_DURATION_S,
  seedanceDescriptor,
  seedanceVideoGenCapability,
} from './descriptor.js';

// Aliased export for the T-422 discovery walker.
export { seedanceDescriptor as descriptor } from './descriptor.js';

export { NotYetImplementedError, SeedanceVideoProvider } from './provider.js';
export type { SeedanceProviderMode, SeedanceVideoProviderOptions } from './provider.js';

export { generateStubMp4DataUri } from './stub-video.js';
