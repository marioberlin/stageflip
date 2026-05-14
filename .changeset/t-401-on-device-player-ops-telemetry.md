---
'@stageflip/on-device-player-ops': minor
---

New package: on-device player ops + telemetry pipeline (T-401). Closes the Track A on-device-player triple (T-399 shim, T-400 packaging, T-401 ops). Provides MetricsAggregator (window-bucketed: success rate, refusals-by-reason histogram, errors-by-family, uptime), HTTP-shape health-endpoint handler, FleetRollup builder, OpsEventSink contract + in-memory impl, OnDeviceTelemetryRecorder for tests. Pure design surface; binary wires the real HTTP server and the real-network OpsEventSink.
