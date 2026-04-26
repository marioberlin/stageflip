// packages/loss-flags/src/index.ts
// @stageflip/loss-flags — public surface. Canonical LossFlag shape + generic
// deterministic-id emitter shared across every importer and consumer.
// Importers (e.g. @stageflip/import-pptx) wrap `emitLossFlag` with their
// per-code severity/category defaults; consumers (e.g. editor-shell, T-248
// reporter UI) import the types directly without depending on any importer.

export type {
  LossFlag,
  LossFlagCategory,
  LossFlagSeverity,
  LossFlagSource,
} from './types.js';
export { emitLossFlag } from './emit.js';
export type { EmitLossFlagInput } from './emit.js';
