// packages/export-html5-zip/src/index.ts
// @stageflip/export-html5-zip — IAB / GDN-compliant HTML5 banner export.
// T-203a ships the types + deterministic-ZIP utility + clickTag injector.
// T-203b will wire the orchestrator that drives an `HtmlBundler`, embeds
// the fallback asset, and enforces `DisplayBudget` caps.

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
