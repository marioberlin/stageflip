// packages/import-google-slides/src/index.ts
// @stageflip/import-google-slides — public surface. T-244 ships:
//   - `parseGoogleSlides(opts) => Promise<CanonicalSlideTree>`
//   - GoogleAuthProvider / CvCandidateProvider interfaces
//   - StubCvProvider (test) + HttpCvProvider (production)
//   - GSlidesLossFlagCode union + emitLossFlag wrapper
//   - gslidesUrlFetcher shim for resolveAssets composition
//
// `resolveAssets` and the canonical asset-storage interfaces are re-exported
// from `@stageflip/import-pptx`; callers chain the two functions to upload
// image bytes and rewrite ParsedAssetRef.unresolved entries.

export { parseGoogleSlides } from './parseGoogleSlides.js';
export type { ParseGoogleSlidesOptions } from './parseGoogleSlides.js';

export type { GoogleAuthProvider, ThumbnailSize, ApiClientOptions } from './api/client.js';
export { fetchPresentation, fetchSlideThumbnail } from './api/client.js';

export type {
  CvCandidateProvider,
  CvCandidates,
  CvDetectOptions,
  CvTextLine,
  CvContour,
  CvMask,
} from './cv/types.js';
export { cvCandidatesSchema } from './cv/types.js';
export { StubCvProvider } from './cv/stub.js';
export { HttpCvProvider } from './cv/http.js';
export type { HttpCvProviderOptions } from './cv/http.js';

export { emitLossFlag, CODE_DEFAULTS } from './loss-flags.js';
export type { EmitLossFlagInput } from './loss-flags.js';

export {
  GoogleApiError,
  CvProviderError,
} from './types.js';
export type {
  CanonicalSlideTree,
  GSlidesLossFlagCode,
  GoogleApiErrorCode,
  CvProviderErrorCode,
  PendingMatchResolution,
  // Re-exports of the canonical parser-side types from @stageflip/import-pptx.
  ParsedAssetRef,
  ParsedElement,
  ParsedGroupElement,
  ParsedImageElement,
  ParsedSlide,
  LossFlag,
  LossFlagCategory,
  LossFlagSeverity,
  LossFlagSource,
} from './types.js';

// Convenience re-exports — the asset-resolution path is one-call from the
// caller's perspective. resolveAssets accepts `gslidesUrlFetcher` to fetch
// short-lived image contentUrls.
export { resolveAssets } from '@stageflip/import-pptx';
export type { AssetStorage } from '@stageflip/import-pptx';

export { gslidesUrlFetcher } from './assets/fetcher.js';
