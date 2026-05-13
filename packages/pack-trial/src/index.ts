// packages/pack-trial/src/index.ts
// T-505 — Public surface of `@stageflip/pack-trial`. Trial-mode policy
// library: state machine + watermark request shape + loss-flag
// helpers. The visual watermark rendering itself is a downstream
// renderer-core integration (deferred).
//
// Determinism: this package lives OUTSIDE the determinism perimeter
// per CLAUDE.md §3 (perimeter is `packages/runtimes/**`,
// `packages/frame-runtime/**`, `packages/renderer-core/src/clips/**`).
// `Date.parse` is permitted here; the renderer-core integration that
// consumes `WatermarkRequest` does so deterministically.

export { type TrialEvaluationInput, type TrialPolicyState, evaluateTrialPolicy } from './state.js';

export {
  WATERMARK_TEXT,
  type WatermarkPosition,
  type WatermarkRequest,
  defaultWatermarkRequest,
} from './watermark.js';

export { type TrialLossFlag, trialActiveLossFlag, trialExpiredLossFlag } from './loss-flags.js';
