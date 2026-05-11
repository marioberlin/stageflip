// packages/capability-router/src/index.ts
// Public surface of `@stageflip/capability-router`. T-425 ships:
//
//   - `routeCapability(input) => RoutingDecision` — pure filter+rank
//     decision function over `AdapterDescriptor[]`.
//   - `buildFilterPipeline(opts)` — 3-stage filter pipeline closure
//     exposed for callers that want filtering without ranking (e.g., a
//     debug UI inspecting per-stage drop-off).
//   - Ranking comparator factories: `rankCheapest`, `rankFastest`,
//     `rankHighestQuality`, `rankBalanced`.
//   - Discriminated-union output type `RoutingDecision`, input type
//     `RoutingInput`, the frozen `RANKING_PREFERENCES` /
//     `REJECTION_REASONS` arrays, and `RejectionReason` /
//     `RankingPreference` literal unions.
//
// Pure decision layer over `@stageflip/adapters-core`. No I/O; no
// orchestration; no adapter instantiation (T-423 / T-426..T-434 own that).
//
// BROWSER-SAFE.

export { routeCapability } from './router.js';

export { buildFilterPipeline } from './filter.js';
export type { FilterPipelineOptions, FilterPipelineResult } from './filter.js';

export {
  comparatorFor,
  rankBalanced,
  rankCheapest,
  rankFastest,
  rankHighestQuality,
} from './ranking.js';
export type { Comparator } from './ranking.js';

export { RANKING_PREFERENCES, REJECTION_REASONS } from './types.js';
export type {
  CapabilityPredicate,
  FilteredByReason,
  QualityScorer,
  RankingPreference,
  RejectionReason,
  RoutingDecision,
  RoutingInput,
} from './types.js';
