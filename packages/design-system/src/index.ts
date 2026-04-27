// packages/design-system/src/index.ts
// @stageflip/design-system — public surface for the 8-step theme learning
// pipeline (T-249). Consumers wire `learnTheme` after `applyInheritance`
// + `resolveAssets` on a parsed Document.

export { learnTheme } from './learnTheme.js';
export { CODE_DEFAULTS, emitLossFlag } from './loss-flags.js';
export type { EmitLossFlagInput } from './loss-flags.js';
export {
  buildCssUrl,
  parseGoogleFontsCss,
  resolveGoogleFontUrls,
} from './fonts/google-fonts-client.js';
export type {
  GoogleFontFaceUrl,
  GoogleFontsClientOptions,
} from './fonts/google-fonts-client.js';
export { StubFontFetcher } from './fonts/stub-fetcher.js';
export type { StubFontFetcherOptions } from './fonts/stub-fetcher.js';
export type {
  AssetStorage,
  ComponentLibrary,
  DesignSystemLossFlagCode,
  FontFetchResult,
  FontFetcher,
  LearnThemeOptions,
  LearnThemeResult,
  LearnedTheme,
  StepDiagnostic,
  TypographyToken,
} from './types.js';
