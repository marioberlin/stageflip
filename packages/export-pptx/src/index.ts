// packages/export-pptx/src/index.ts
// Public surface of @stageflip/export-pptx. T-253-base ships the foundational
// writer; T-253-rider extends with `<p:sldLayout>` / `<p:sldMaster>` and
// per-element `<p:ph>` references. See docs/tasks/T-253-base.md for scope.
// T-441 adds the provenance-aware `<p:extLst>` AI-content extension.

export { exportPptx } from './exportPptx.js';
export { AI_CONTENT_EXT_URI, emitAiContentExtension } from './ai-content-ext.js';
export {
  classifyAiKind,
  extractAiPptxManifest,
} from './provenance-walk.js';
export type {
  AiPptxElementInput,
  AiPptxManifest,
  AiPptxManifestElement,
} from './provenance-walk.js';
export type { AssetReader } from './assets/types.js';
export type {
  ExportPptxLossFlagCode,
  ExportPptxOptions,
  ExportPptxResult,
} from './types.js';
