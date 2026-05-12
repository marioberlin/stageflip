// packages/audience-mentimeter/src/index.ts
// Public surface of `@stageflip/audience-mentimeter` (T-479). First of five
// vendor `AudienceBackendProvider` adapters per ADR-009 §D8.
//
// `descriptor` is the alias the T-422 check-asset-licenses walker
// discovers.

export {
  AUDIENCE_MENTIMETER_BASE_URL_ENV_VAR,
  AUDIENCE_MENTIMETER_SUPPORTED_CLIP_KINDS,
  audienceMentimeterCapability,
  audienceMentimeterDescriptor,
} from './descriptor.js';

// Aliased export for the T-422 check-asset-licenses discovery walker.
export { audienceMentimeterDescriptor as descriptor } from './descriptor.js';

export { NotYetImplementedError, createMentimeterAudienceProvider } from './provider.js';
export type { MentimeterAudienceProviderOptions, MentimeterProviderMode } from './provider.js';
