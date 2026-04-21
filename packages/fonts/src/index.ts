// packages/fonts/src/index.ts
// @stageflip/fonts — FontManager runtime layer (T-072).
//
// Aggregation utilities collect FontRequirement[] from arbitrary sources
// (clip runtimes, RIR compile output, ad-hoc composition authoring);
// `useFontLoad` is the editor / preview hook that blocks render on font
// readiness. The CDP export path (Phase 4, T-084a) owns base64 embedding
// and `document.fonts.check` verification and lives elsewhere.

export {
  aggregateFontRequirements,
  formatFontShorthand,
} from './aggregate.js';

export {
  useFontLoad,
  type FontLoadResult,
  type FontLoadStatus,
  type UseFontLoadOptions,
} from './use-font-load.js';
