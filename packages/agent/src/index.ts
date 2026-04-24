// packages/agent/src/index.ts
// Public barrel — Planner (T-151) + Executor (T-152) + Validator (T-153).
// The three-agent triad now ships; downstream tasks (T-155–T-168 handler
// bundles, T-170 copilot wiring) layer on top.

export type {
  BundleSummary,
  Plan,
  Planner,
  PlannerCallOptions,
  PlannerRequest,
  PlanStep,
} from './planner/types.js';
export { bundleSummarySchema, planSchema, planStepSchema } from './planner/types.js';

// Bundle registry + loader live in @stageflip/engine (T-151a). Re-export
// the surfaces the Planner uses so consumers can stay on one import root.
export {
  BundleLoadError,
  type BundleLoadErrorKind,
  BundleLoader,
  type BundleLoaderOptions,
  BundleRegistry,
  CANONICAL_BUNDLE_NAMES,
  CANONICAL_BUNDLES,
  createCanonicalRegistry,
  DEFAULT_TOOL_LIMIT,
  type ToolBundle,
} from '@stageflip/engine';

export {
  EMIT_PLAN_TOOL,
  EMIT_PLAN_TOOL_NAME,
  buildSystemPrompt,
  buildUserMessages,
} from './planner/prompt.js';

export { type CreatePlannerOptions, createPlanner, PlannerError } from './planner/planner.js';

// Executor (T-152)
export type {
  ExecutorContext,
  ExecutorEvent,
  JsonPatchOp,
  PatchSink,
  StepStatus,
} from './executor/types.js';
export { createPatchSink } from './executor/patch-sink.js';
export {
  type CreateExecutorOptions,
  DEFAULT_EXECUTOR_MAX_TOKENS,
  DEFAULT_MAX_ITERATIONS_PER_STEP,
  type Executor,
  type ExecutorCallOptions,
  type ExecutorRequest,
  createExecutor,
} from './executor/executor.js';

// Validator (T-153)
export type {
  ProgrammaticCheck,
  ProgrammaticCheckResult,
  QualitativeCheckName,
  QualitativeCheckResult,
  ValidationResult,
  ValidationTier,
  Validator,
  ValidatorCallOptions,
  ValidatorRequest,
} from './validator/types.js';
export {
  programmaticCheckResultSchema,
  qualitativeCheckResultSchema,
  validationResultSchema,
} from './validator/types.js';
export {
  DEFAULT_PROGRAMMATIC_CHECKS,
  runProgrammaticChecks,
  schemaRoundTripCheck,
} from './validator/programmatic.js';
export {
  EMIT_QUALITATIVE_VERDICT_TOOL,
  EMIT_QUALITATIVE_VERDICT_TOOL_NAME,
  QUALITATIVE_CHECKS,
  QualitativeCheckError,
  qualitativeToolInputSchema,
  runQualitativeCheck,
} from './validator/qualitative.js';
export {
  type CreateValidatorOptions,
  DEFAULT_VALIDATOR_MAX_TOKENS,
  createValidator,
} from './validator/validator.js';
