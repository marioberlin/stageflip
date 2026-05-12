// packages/audience-wooclap/src/index.ts
// Public surface of `@stageflip/audience-wooclap` (T-479). First of five
// vendor `AudienceBackendProvider` adapters per ADR-009 §D8.
//
// `descriptor` is the alias the T-422 check-asset-licenses walker
// discovers.

export {
  AUDIENCE_WOOCLAP_BASE_URL_ENV_VAR,
  AUDIENCE_WOOCLAP_SUPPORTED_CLIP_KINDS,
  audienceWooclapCapability,
  audienceWooclapDescriptor,
} from './descriptor.js';

// Aliased export for the T-422 check-asset-licenses discovery walker.
export { audienceWooclapDescriptor as descriptor } from './descriptor.js';

export { NotYetImplementedError, createWooclapAudienceProvider } from './provider.js';
export type { WooclapAudienceProviderOptions, WooclapProviderMode } from './provider.js';
