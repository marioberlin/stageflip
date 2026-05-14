# @stageflip/on-device-player-ops ⚠ DEPRECATED 2026-05-15

> **Deployment target dropped per PO 2026-05-15.** On-device player removed from the StageFlip product roadmap; binary will NOT be built; no consumer is planned. This package remains in-tree as a deprecated scaffold. See `ADR-005 §D4` (amended) + `skills/stageflip/concepts/on-device-player/SKILL.md`. **Do NOT add new work here without first reverting the deprecation.**

---

Ops + telemetry pipeline for the on-device display player. Implements
T-401 of the Phase 13 / γ-deploy block; closes the Track A on-device-
player triple alongside T-399 (`@stageflip/runtime-on-device-player`,
the runtime shim) and T-400 (`@stageflip/on-device-player-packaging`,
the binary scaffold).

Per ADR-005 §D4 + L141 the on-device player is a separate binary with
its own supply chain and security blast-radius. This package supplies
the ops-side glue the binary wires together — but ships only the
**pure design surface**. The real HTTP server, the real-network event
sink, and the real Prometheus / Grafana / Datadog exporter all live
downstream of this workspace.

## Surfaces

| Module | Purpose |
|---|---|
| `metrics.ts` | `MetricsAggregator` — window-bucketed counters (success rate, refusals-by-reason, errors-by-family, uptime, currently-mounted). |
| `recorder.ts` | `OnDeviceTelemetryRecorder` — developer-facing in-memory recorder for tests. |
| `health-endpoint.ts` | `buildHealthHandler` — pure HTTP-shape handler. Routes `GET /health` → 200, `POST /health` → 405, other → 404. |
| `fleet-rollup.ts` | `FleetRollupRow` + `buildFleetRollup` — cross-device, cross-tenant rollup builder. |
| `ops-event-sink.ts` | `OpsEventSink` interface + `InMemoryOpsEventSink` for tests + dev-loop. |

## Pipeline

```
TelemetryEvent (from @stageflip/runtime-on-device-player)
       │
       ├──► MetricsAggregator.ingest()
       │        │
       │        └──► MetricsAggregator.snapshot()  ─┐
       │                                            │
       ├──► OpsEventSink.send() ──► (downstream)    │
       │                                            ▼
       └──► HealthProbeReport (from packaging) ──► buildHealthHandler ──► HTTP /health
                                                    │
                                                    ▼
                                                  FleetRollupRow ──► buildFleetRollup
```

## Window semantics

`MetricsAggregator.snapshot(clock, windowDurationSec = 600)` returns
counters covering events whose timestamp falls inside
`[now - windowDurationSec, now]`. Events outside the window are
excluded from every counter. `ingest` records each event's timestamp
via the caller-supplied `clock: () => number`; the aggregator never
calls a real clock itself (keeps the source-level determinism scan
clean).

## Uptime simplification

`uptimePctSinceBoot` is a rough ratio derived from boot/shutdown
counts within the snapshot window:

- 1.0 when `bootCount > 0` and `shutdownCount === 0` (continuously up).
- 0.0 when `bootCount === 0`.
- `bootCount / (bootCount + shutdownCount)` otherwise.

The fleet-rollup binary computes the real wall-clock ratio against
boot-to-shutdown pairs; the lightweight surface here is good enough
for fleet-rollup smoke checks.

## See also

- `docs/decisions/ADR-005-frontier-clip-catalogue.md` §D4 + L141
- `docs/implementation-plan.md` T-399 / T-400 / T-401
- `skills/stageflip/concepts/on-device-player/SKILL.md`
- `packages/runtime-on-device-player/` (T-399)
- `packages/on-device-player-packaging/` (T-400)
