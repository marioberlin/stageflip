// packages/audience-polleverywhere/src/index.ts
// Public surface of `@stageflip/audience-polleverywhere` (T-479). First of five
// vendor `AudienceBackendProvider` adapters per ADR-009 §D8.
//
// `descriptor` is the alias the T-422 check-asset-licenses walker
// discovers.

export {
  AUDIENCE_POLLEVERYWHERE_BASE_URL_ENV_VAR,
  AUDIENCE_POLLEVERYWHERE_SUPPORTED_CLIP_KINDS,
  audiencePollEverywhereCapability,
  audiencePollEverywhereDescriptor,
} from './descriptor.js';

// Aliased export for the T-422 check-asset-licenses discovery walker.
export { audiencePollEverywhereDescriptor as descriptor } from './descriptor.js';

export { NotYetImplementedError, createPollEverywhereAudienceProvider } from './provider.js';
export type {
  PollEverywhereAudienceProviderOptions,
  PollEverywhereProviderMode,
} from './provider.js';
