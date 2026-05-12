// packages/audience-native/src/index.ts
// Public surface of `@stageflip/audience-native` (T-478). First concrete
// `AudienceBackendProvider` implementation — audience-modality analog of
// the 9 P14 reference adapters (T-426..T-434).
//
// The `descriptor` named export is what `scripts/check-asset-licenses.ts`
// (T-422) discovers via dynamic import. `audienceNativeDescriptor` is the
// same object under its canonical name — host shells import the
// canonical name when registering into their `AdapterRegistry`.
//
// Importing this module has NO side effects — adapters-core uses an
// instance-based, per-tenant `AdapterRegistry` (not a global singleton),
// so the host shell owns registration timing.

export { audienceNativeCapability, audienceNativeDescriptor } from './descriptor.js';

// Aliased export for the T-422 check-asset-licenses discovery walker.
export { audienceNativeDescriptor as descriptor } from './descriptor.js';

export { createAudienceNativeProvider } from './provider.js';
export type { AudienceNativeProviderOptions } from './provider.js';
