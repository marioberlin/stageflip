// packages/marketplace-registry/src/index.ts
// T-536 — Public surface of `@stageflip/marketplace-registry` per
// ADR-014. Exposes the storage / publisher / token interfaces plus
// in-memory implementations, the per-route handlers, and the
// composed top-level `composeHandler` + `createInMemoryRegistry`
// convenience constructor.

export {
  type StorageAdapter,
  STORAGE_KEYS,
} from './storage/storage.js';
export { InMemoryStorageAdapter } from './storage/in-memory.js';

export {
  type PublisherKeyRegistry,
  type TofuResult,
  InMemoryPublisherKeyRegistry,
} from './publishers/registry.js';

export {
  type TokenStore,
  type TokenValidation,
  InMemoryTokenStore,
} from './auth/tokens.js';

export type {
  RouteRequest,
  RouteResponse,
  RouteHandler,
  RegistryDeps,
  ErrorBody,
} from './routes/types.js';

export { createPublishHandler } from './routes/publish.js';
export { createListHandler } from './routes/list.js';
export { createDownloadHandler, SIGNED_URL_TTL_SECONDS } from './routes/download.js';

export { composeHandler, createInMemoryRegistry } from './handler.js';
