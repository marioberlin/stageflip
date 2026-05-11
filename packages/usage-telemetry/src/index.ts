// packages/usage-telemetry/src/index.ts
// Public surface of `@stageflip/usage-telemetry` (T-445 — Phase 14 δ
// first task; Lock-in). Per-modality usage telemetry: `AdapterUsageEvent`
// emitted alongside (not inside) T-444's `AdapterAuditEvent`. Pluggable
// emitter + reader interfaces + an in-memory default + a pure
// `aggregateUsage` helper.
//
// Determinism posture: pure types + sync emitter + pure aggregator. No
// `Date.now` / `Math.random` / `fetch` at module load OR at runtime.

export {
  type AdapterUsageEvent,
  type UsageOutcome,
  type UsageSelectedReason,
  type UsageTelemetryEmitter,
  type UsageTelemetryReader,
  USAGE_OUTCOMES,
  USAGE_SELECTED_REASONS,
  adapterUsageEventSchema,
} from './types.js';

export { InMemoryUsageTelemetryEmitter } from './in-memory-emitter.js';

export {
  aggregateUsage,
  UsageAggregationError,
  type UsageAggregationFilter,
  type UsageRollup,
} from './aggregate.js';
