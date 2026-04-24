// packages/export-html5-zip/src/index.ts
// @stageflip/export-html5-zip — IAB / GDN-compliant HTML5 banner export.
// T-203a ships the types + deterministic-ZIP utility + clickTag injector.
// T-203b wires the orchestrator that drives an `HtmlBundler`, embeds the
// fallback asset, and enforces `DisplayBudget` caps.
// T-205 adds the pre-pack optimisation passes (unused-CSS strip, JS
// minify via terser, pluggable `ImageOptimizer`).

export type {
  BannerAsset,
  BannerExportInput,
  BannerExportResult,
  BannerSize,
  ExportFinding,
  FallbackProvider,
  HtmlBundle,
  HtmlBundler,
  MultiSizeExportResult,
} from './types.js';

export {
  DETERMINISTIC_ZIP_MTIME,
  type PackZipOptions,
  type ZipFile,
  assertValidZipPath,
  packDeterministicZip,
  stringToZipBytes,
} from './zip.js';

export {
  DEFAULT_CLICK_TAG_PLACEHOLDER,
  clickTagScript,
  escapeClickTagForScript,
  injectClickTagScript,
} from './click-tag.js';

export { type AssetResolver, InMemoryAssetResolver } from './asset-resolver.js';
export { mapWithConcurrency } from './concurrency.js';
export {
  type ExportOrchestratorOptions,
  exportHtml5Zip,
  exportHtml5ZipForSize,
} from './orchestrator.js';

export {
  DEFAULT_MINIFY_OPTIONS,
  extractHtmlReferences,
  type ImageOptimizer,
  minifyInlineJsInHtml,
  type OptimizeOptions,
  optimizeHtmlBundle,
  stripUnusedCss,
  stripUnusedCssFromHtml,
} from './optimize/index.js';

export {
  type CreateFallbackGeneratorInput,
  type EncodeGifOptions,
  type FallbackGeneratorOptions,
  type FrameRenderer,
  type RgbaFrame,
  type SolidColorRendererOptions,
  createFallbackGenerator,
  createSolidColorFrameRenderer,
  encodeGif,
  encodePng,
  gifFrameIndices,
  midpointFrameIndex,
} from './fallback/index.js';

export {
  ALL_VALIDATION_RULES,
  IAB_INITIAL_LOAD_BYTES,
  type ValidateBannerZipOptions,
  type ValidationContext,
  type ValidationFinding,
  type ValidationReport,
  type ValidationRule,
  type ValidationSeverity,
  type ZipEntry,
  bannerDeclaresClickTag,
  bannerFileSizeWithinIabCap,
  bannerHasFallbackPng,
  bannerHasIndexHtml,
  bannerNoDynamicCode,
  bannerNoExternalResources,
  bannerNoPathTraversal,
  bannerNoXhrOrFetch,
  runValidationRules,
  validateBannerZip,
} from './validate/index.js';
