// packages/app-agent/src/index.ts
// @stageflip/app-agent — shared orchestration layer for the StageFlip
// editor apps (slide + video + display). Lifted in T-187b from
// apps/stageflip-slide's Phase-7 implementation (T-170) so every Next.js
// app points at the same Planner/Executor/Validator wiring.

export {
  DEFAULT_EXECUTOR_MODEL,
  DEFAULT_PLANNER_MODEL,
  DEFAULT_VALIDATOR_MODEL,
  OrchestratorNotConfigured,
  buildProviderFromEnv,
  createOrchestrator,
  runAgent,
} from './orchestrator.js';

export type {
  OrchestratorDeps,
  RunAgentRequest,
  RunAgentResult,
} from './orchestrator.js';
