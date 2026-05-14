// packages/on-device-player-ops/src/index.ts
// @stageflip/on-device-player-ops — ops + telemetry pipeline for the
// on-device display player (T-401). Closes the Track A on-device-player
// triple: T-399 ships the runtime shim, T-400 ships the binary
// packaging scaffold, T-401 ships the ops-side glue:
//
//   TelemetryEvent  →  MetricsAggregator
//          │
//          ├──► HealthProbeReport via `buildHealthHandler` (`/health`)
//          ├──► OpsEventSink → downstream ingestion
//          └──► FleetRollup (cross-device, cross-tenant)
//
// Pure design surface: real HTTP server + real-network sink are wired
// by the binary at the next layer. See
// `skills/stageflip/concepts/on-device-player/SKILL.md` "Ops +
// telemetry (T-401)".

export {
  createMetricsAggregator,
  type MetricsAggregator,
  type PlayerMetrics,
} from './metrics.js';

export {
  createTelemetryRecorder,
  type OnDeviceTelemetryRecorder,
} from './recorder.js';

export {
  buildHealthHandler,
  type HealthRequest,
  type HealthResponse,
} from './health-endpoint.js';

export {
  buildFleetRollup,
  type FleetRollup,
  type FleetRollupRow,
} from './fleet-rollup.js';

export {
  InMemoryOpsEventSink,
  type OpsEventContext,
  type OpsEventSink,
  type RecordedOpsEvent,
} from './ops-event-sink.js';
