// packages/3d-tripo/src/index.ts
// Public surface of `@stageflip/3d-tripo`. T-428 — third reference
// adapter (Phase 14 β; first 3D adapter; first proprietary-byo adapter).
//
// The `descriptor` named export is what `scripts/check-asset-licenses.ts`
// (T-422) discovers via dynamic import. `tripoDescriptor` is the same
// object under its canonical name — host shells (e.g.
// `scripts/sync-skills.ts`) import the canonical name when they
// `registry.register(tripoDescriptor)`.
//
// Importing this module has NO side effects — adapters-core uses an
// instance-based, per-tenant `AdapterRegistry` (not a global
// singleton), so the host shell owns registration timing.

export {
  TRIPO_BASE_URL_ENV_VAR,
  TRIPO_MAX_VERTICES,
  tripoDescriptor,
  tripoThreeDCapability,
} from './descriptor.js';

// Aliased export for the T-422 discovery walker.
export { tripoDescriptor as descriptor } from './descriptor.js';

export { NotYetImplementedError, TripoThreeDProvider } from './provider.js';
export type { TripoProviderMode, TripoThreeDProviderOptions } from './provider.js';

export { generateStubGlbDataUri } from './stub-glb.js';
