// packages/marketplace-telemetry-dashboard/src/index.ts
// T-541 — Public surface of `@stageflip/marketplace-telemetry-dashboard`:
// event receiver, in-memory time-series store, aggregations,
// first-party scope, and dashboard shaper. NOT a running service —
// library + handler bundle the production HTTP adapter (T-550) wires
// into its host.
//
// Determinism perimeter: outside (server-side).

export {
  createTelemetryReceiver,
  type ReceiverRequest,
  type ReceiverResponse,
  type TelemetryReceiverDeps,
  type TelemetryReceiverLogger,
} from './events/receiver.js';

export { InMemoryTimeSeriesStore } from './storage/in-memory.js';

export type {
  TimeSeriesEvent,
  TimeSeriesEventKind,
  TimeSeriesQuery,
  TimeSeriesStore,
} from './storage/timeseries.js';

export {
  installCountByDay,
  installCountByWeek,
  type InstallCountByDayPoint,
  type InstallCountByWeekPoint,
} from './aggregations/install-count.js';

export {
  activationRate,
  type ActivationRateResult,
} from './aggregations/activation-rate.js';

export { averageClipMountCount } from './aggregations/usage-stats.js';

export { retentionCurve, type RetentionPoint } from './aggregations/retention.js';

export {
  FIRST_PARTY_PACK_IDS,
  type FirstPartyPackId,
  computeFirstPartyHashes,
  isFirstPartyHash,
} from './first-party/scope.js';

export {
  buildDashboardData,
  type BuildDashboardDataOptions,
  type DashboardData,
} from './dashboard/shape.js';
