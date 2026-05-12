// packages/audience-slido/src/index.ts
// Public surface of `@stageflip/audience-slido` (T-479). First of five
// vendor `AudienceBackendProvider` adapters per ADR-009 §D8.
//
// `descriptor` is the alias the T-422 check-asset-licenses walker
// discovers.

export {
  AUDIENCE_SLIDO_BASE_URL_ENV_VAR,
  AUDIENCE_SLIDO_SUPPORTED_CLIP_KINDS,
  audienceSlidoCapability,
  audienceSlidoDescriptor,
} from './descriptor.js';

// Aliased export for the T-422 check-asset-licenses discovery walker.
export { audienceSlidoDescriptor as descriptor } from './descriptor.js';

export { NotYetImplementedError, createSlidoAudienceProvider } from './provider.js';
export type { SlidoAudienceProviderOptions, SlidoProviderMode } from './provider.js';
