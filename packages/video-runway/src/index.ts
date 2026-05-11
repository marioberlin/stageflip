// packages/video-runway/src/index.ts
// Public surface of `@stageflip/video-runway`. T-431 — sixth reference
// adapter (Phase 14 β; second video-gen adapter after T-430 Seedance;
// fourth proprietary-byo adapter).
//
// The `descriptor` named export is what `scripts/check-asset-licenses.ts`
// (T-422) discovers via dynamic import. `runwayDescriptor` is the same
// object under its canonical name — host shells (e.g.
// `scripts/sync-skills.ts`) import the canonical name when they
// `registry.register(runwayDescriptor)`.
//
// Importing this module has NO side effects — adapters-core uses an
// instance-based, per-tenant `AdapterRegistry` (not a global
// singleton), so the host shell owns registration timing.

export {
  RUNWAY_BASE_URL_ENV_VAR,
  RUNWAY_FRAME_RATE,
  RUNWAY_MAX_DURATION_S,
  runwayDescriptor,
  runwayVideoGenCapability,
} from './descriptor.js';

// Aliased export for the T-422 discovery walker.
export { runwayDescriptor as descriptor } from './descriptor.js';

export { NotYetImplementedError, RunwayVideoProvider } from './provider.js';
export type { RunwayProviderMode, RunwayVideoProviderOptions } from './provider.js';

export { generateStubMp4DataUri } from './stub-video.js';
