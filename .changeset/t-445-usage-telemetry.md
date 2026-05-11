---
'@stageflip/usage-telemetry': minor
'@stageflip/adapter-sandbox': minor
'@stageflip/engine': minor
---

T-445 — per-modality usage telemetry (Phase 14 δ first task; Lock-in).

Every adapter invocation now emits a per-tenant `AdapterUsageEvent`
alongside (not inside) T-444's `AdapterAuditEvent`. Audit is the
security-class signal; usage is the metrics-class signal. Both fire
from the same `SandboxRunner.run` invocation; downstream consumers
join on `(tenantId, adapterId, timestamp)` if they need correlation.

New package: **`@stageflip/usage-telemetry`** —

- `AdapterUsageEvent` strict Zod schema — `tenantId`, `adapterId`,
  `modality`, `selectedReason` (`'capability-router'` | `'explicit'`),
  `latencyMs`, `costAmount`, `costCurrency`, `outcome`
  (`'success'` | `'failed'` | `'killed'`), `timestamp` (ISO-8601).
- `UsageTelemetryEmitter` / `UsageTelemetryReader` pluggable
  interfaces. Default in-memory impl
  `InMemoryUsageTelemetryEmitter` — bounded ring buffer (capacity
  1000, drops oldest) that implements BOTH interfaces.
- `aggregateUsage(events, filter)` — pure rollup helper. Buckets by
  `(tenantId, adapterId, modality)`; reports count + per-outcome
  counts + p50/p95 latency (nearest-rank percentile) + total cost.
  Inclusive-start, exclusive-end time-window filter. Mixed
  currencies throw `UsageAggregationError`.

New public surfaces on `@stageflip/adapter-sandbox`:

- `SandboxInvocation` extended with three optional fields:
  `usageEmitter?` (structural `UsageTelemetryEmitterLike`),
  `clock?: () => number`, and
  `selectedReason?: 'capability-router' | 'explicit'`. When all three
  are wired, every adapter invocation in
  `InProcessSandboxRunner`, `SidecarSandboxRunner`, and
  `RemoteServiceSandboxRunner` emits `AdapterUsageEventLike` post-
  terminal-audit-event. When any is absent, usage emission is a
  no-op (back-compat — existing wiring continues to emit only audit
  events).
- Structural type exports: `AdapterUsageEventLike` +
  `UsageTelemetryEmitterLike` — declared inline so the sandbox
  package does NOT take a runtime dep on `@stageflip/usage-telemetry`.

New public surface on `@stageflip/engine`:

- Asset-generation bundle (#25) grew from 4 → 5 tools. The new tool
  `query_usage_telemetry` returns per-tenant rollups (count /
  outcome breakdown / p50+p95 latency / total cost) WITHOUT making
  an adapter call. Optional `adapterId` / `modality` filters; default
  time window is trailing 7 days from the host clock. Soft seam:
  requires `usageTelemetryReader` + `tenantId` on
  `AssetGenerationContext`; unwired returns
  `{ ok: false, reason: 'usage_telemetry_unavailable' }`.

§13 statement — **NOT a structural extension**. The new event class
is emitted alongside (not inside) `AdapterAuditEvent` and never reaches
the document-tree (`AdapterDescriptor`, `RIRElement`, `RIRDocument`,
`ClipKindBinding`). The new tool is added to an EXISTING bundle;
bundle count stays at 25. Render verification N/A.

Unblocks **T-446** (security audit consumer of both event classes) →
**T-447** (GA readiness; one criterion is "telemetry on for all 9
adapters").
