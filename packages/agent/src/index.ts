// packages/agent/src/index.ts
// Public barrel — Planner (T-151). Executor (T-152) + Validator (T-153)
// populate further exports.

export type {
  BundleSummary,
  Plan,
  Planner,
  PlannerCallOptions,
  PlannerRequest,
  PlanStep,
} from './planner/types.js';
export {
  bundleSummarySchema,
  planSchema,
  planStepSchema,
} from './planner/types.js';

export { BUNDLE_NAMES, listBundles } from './planner/bundles.js';

export {
  EMIT_PLAN_TOOL,
  EMIT_PLAN_TOOL_NAME,
  buildSystemPrompt,
  buildUserMessages,
} from './planner/prompt.js';

export {
  type CreatePlannerOptions,
  createPlanner,
  PlannerError,
} from './planner/planner.js';
