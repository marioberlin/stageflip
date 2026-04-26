// packages/export-pptx/src/index.ts
// Public surface of @stageflip/export-pptx. T-253-base ships the foundational
// writer; T-253-rider extends with `<p:sldLayout>` / `<p:sldMaster>` and
// per-element `<p:ph>` references. See docs/tasks/T-253-base.md for scope.

export { exportPptx } from './exportPptx.js';
export type { AssetReader } from './assets/types.js';
export type {
  ExportPptxLossFlagCode,
  ExportPptxOptions,
  ExportPptxResult,
} from './types.js';
