// packages/audience-vevox/src/index.ts
// Public surface of `@stageflip/audience-vevox` (T-479). First of five
// vendor `AudienceBackendProvider` adapters per ADR-009 §D8.
//
// `descriptor` is the alias the T-422 check-asset-licenses walker
// discovers.

export {
  AUDIENCE_VEVOX_BASE_URL_ENV_VAR,
  AUDIENCE_VEVOX_SUPPORTED_CLIP_KINDS,
  audienceVevoxCapability,
  audienceVevoxDescriptor,
} from './descriptor.js';

// Aliased export for the T-422 check-asset-licenses discovery walker.
export { audienceVevoxDescriptor as descriptor } from './descriptor.js';

export { NotYetImplementedError, createVevoxAudienceProvider } from './provider.js';
export type { VevoxAudienceProviderOptions, VevoxProviderMode } from './provider.js';
