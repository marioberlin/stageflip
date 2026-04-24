// packages/export-html5-zip/src/validate/index.ts
// T-208 barrel — re-exports the validator surface.

export type {
  ValidationContext,
  ValidationFinding,
  ValidationReport,
  ValidationRule,
  ValidationSeverity,
  ZipEntry,
} from './types.js';

export {
  ALL_VALIDATION_RULES,
  IAB_INITIAL_LOAD_BYTES,
  bannerDeclaresClickTag,
  bannerFileSizeWithinIabCap,
  bannerHasFallbackPng,
  bannerHasIndexHtml,
  bannerNoDynamicCode,
  bannerNoExternalResources,
  bannerNoPathTraversal,
  bannerNoXhrOrFetch,
} from './rules.js';

export {
  type ValidateBannerZipOptions,
  runValidationRules,
  validateBannerZip,
} from './validate.js';
