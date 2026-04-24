// packages/engine/src/index.ts
// Public barrel — BundleRegistry + BundleLoader (T-151a). Tool router
// (T-154) + handler bundles (T-155–T-168) populate further exports.

export type { BundleSummary, ToolBundle } from './bundles/types.js';
export { summarise } from './bundles/types.js';

export { CANONICAL_BUNDLES, CANONICAL_BUNDLE_NAMES } from './bundles/catalog.js';

export { BundleRegistry, createCanonicalRegistry } from './bundles/registry.js';

export {
  BundleLoadError,
  type BundleLoadErrorKind,
  BundleLoader,
  type BundleLoaderOptions,
  DEFAULT_TOOL_LIMIT,
} from './bundles/loader.js';
