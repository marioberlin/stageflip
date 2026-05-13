// packages/marketplace-conversion/src/index.ts
// T-544 — Public surface of `@stageflip/marketplace-conversion`.
// The package is a conversion-flow LIBRARY consumed by the
// marketplace UI (mid-trial upsell), the trial-policy evaluator
// (T-505 — trial-expired triggers), the Stripe webhook layer
// (T-537 — lapsed-recovered triggers), and the deployment-wiring
// task (T-550). It performs no I/O; callers resolve their
// entitlement + Stripe lookups upstream and feed projected inputs
// into `planConversion`.
//
// Determinism perimeter: outside (server-side).

export type {
  ConversionEvent,
  ConversionEventKind,
} from './events/conversion-event.js';
export { isConversionEventKind } from './events/conversion-event.js';

export type { ChurnRecoveryStrategy } from './churn/strategy.js';
export {
  DEFAULT_BASE_BACKOFF_MS,
  DEFAULT_CHURN_STRATEGY,
  DEFAULT_MAX_BACKOFF_MS,
  DEFAULT_MAX_RETRIES,
} from './churn/strategy.js';

export type {
  ConversionAction,
  ConversionEntitlementStatus,
  ConversionPlannerInput,
  ConversionPlannerOutput,
} from './planner/conversion-planner.js';
export { planConversion } from './planner/conversion-planner.js';

export type {
  ConversionMetricsSummary,
  ConversionOutcome,
} from './metrics/tracker.js';
export { ConversionMetricsTracker } from './metrics/tracker.js';
