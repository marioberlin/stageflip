---
'@stageflip/marketplace-telemetry-dashboard': minor
---

T-541 — New package `@stageflip/marketplace-telemetry-dashboard`:
server-side telemetry receiver, abstract `TimeSeriesStore` with
in-memory shim, pure aggregations (install count by day/week,
activation rate, average clip-mount count, retention curve), and a
dashboard data shaper scoped to the six first-party launch packs.
NOT a running service — library + handler bundle that T-550 wires
into production. Third-party telemetry handling is deferred.
