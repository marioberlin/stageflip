// packages/variant-gen/src/index.ts
// @stageflip/variant-gen — public surface. Variant-generation primitive
// (T-386). Turns one canonical Document into a matrix of variants per a
// `VariantMatrixSpec`. Consumed by the export-matrix routing layer (T-408)
// and the `arrange_variants` agent tool in @stageflip/engine.

export { deriveCacheKey, sha256Hex } from './cache-key.js';
export { VariantMatrixCapExceededError } from './errors.js';
export {
  DEFAULT_MAX_VARIANTS,
  type GenerateVariantsOptions,
  type VariantMatrixSpec,
  type VariantOutput,
  generateVariants,
} from './generate.js';
export {
  InMemoryLocaleProvider,
  type LocaleBundle,
  type LocaleProvider,
  StaticBundleLocaleProvider,
} from './locale-provider.js';
export {
  replaceElementInDocument,
  setNestedProperty,
} from './structural-sharing.js';
