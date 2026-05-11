// packages/3d-meshy/src/index.ts
// Public surface of `@stageflip/3d-meshy`. T-429 — fourth reference
// adapter (Phase 14 β; second 3D adapter; second proprietary-byo adapter).
//
// The `descriptor` named export is what `scripts/check-asset-licenses.ts`
// (T-422) discovers via dynamic import. `meshyDescriptor` is the same
// object under its canonical name — host shells (e.g.
// `scripts/sync-skills.ts`) import the canonical name when they
// `registry.register(meshyDescriptor)`.
//
// Importing this module has NO side effects — adapters-core uses an
// instance-based, per-tenant `AdapterRegistry` (not a global
// singleton), so the host shell owns registration timing.

export {
  MESHY_BASE_URL_ENV_VAR,
  MESHY_MAX_VERTICES,
  meshyDescriptor,
  meshyThreeDCapability,
} from './descriptor.js';

// Aliased export for the T-422 discovery walker.
export { meshyDescriptor as descriptor } from './descriptor.js';

export { MeshyThreeDProvider, NotYetImplementedError } from './provider.js';
export type { MeshyProviderMode, MeshyThreeDProviderOptions } from './provider.js';

export { generateStubGlbDataUri } from './stub-glb.js';
