// packages/engine/src/index.ts
// Public barrel — BundleRegistry + BundleLoader (T-151a) + ToolRouter
// (T-154). Handler bundles (T-155–T-168) register handlers onto the
// router + `mergeTools` onto the registry from their own packages.

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

export type {
  AnyToolHandler,
  DocumentContext,
  DocumentSelection,
  JsonPatchOp,
  MutationContext,
  PatchSink,
  ToolContext,
  ToolHandler,
} from './router/types.js';
export {
  type ToolCallEvent,
  ToolRouter,
  ToolRouterError,
  type ToolRouterErrorContext,
  type ToolRouterErrorKind,
  type ToolRouterOptions,
} from './router/router.js';

// Handler bundles — T-155 shipped `read`, T-156 shipped `create-mutate`;
// T-157–T-168 populate the rest.
export {
  READ_BUNDLE_NAME,
  READ_HANDLERS,
  READ_TOOL_DEFINITIONS,
  registerReadBundle,
} from './handlers/read/register.js';
export {
  CREATE_MUTATE_BUNDLE_NAME,
  CREATE_MUTATE_HANDLERS,
  CREATE_MUTATE_TOOL_DEFINITIONS,
  registerCreateMutateBundle,
} from './handlers/create-mutate/register.js';
export {
  TIMING_BUNDLE_NAME,
  TIMING_HANDLERS,
  TIMING_TOOL_DEFINITIONS,
  registerTimingBundle,
} from './handlers/timing/register.js';
