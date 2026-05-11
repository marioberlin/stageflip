---
title: Usage telemetry — per-modality adapter metrics + query tool
id: skills/stageflip/concepts/usage-telemetry
tier: concept
status: substantive
last_updated: 2026-05-11
owner_task: T-445
related:
  - skills/stageflip/concepts/adapter-sandbox/SKILL.md
  - skills/stageflip/concepts/cost-budget/SKILL.md
  - skills/stageflip/concepts/provider-seam/SKILL.md
  - skills/stageflip/tools/asset-generation/SKILL.md
---

# Usage telemetry

Every adapter invocation emits TWO events:

- **Audit event** (`AdapterAuditEvent`, T-444) — security-class signal
  consumed by the T-446 security-audit pipeline. Start, complete,
  failed, killed-for-resource-limit.
- **Usage event** (`AdapterUsageEvent`, T-445) — metrics-class signal
  consumed by per-tenant rollups. Tenant, adapter, modality, selected
  reason, latency, cost, outcome, timestamp.

The two events share provenance (every adapter call emits both) but
travel on separate transports. Joining is on
`(tenantId, adapterId, timestamp)` if a consumer wants to correlate.

T-445 is **Phase 14 δ first task; Lock-in**. It gates **T-446**
(security audit consumer of both event classes) and is one of
**T-447**'s GA-readiness criteria ("telemetry on for all 9 adapters").

## Event shape

```ts
interface AdapterUsageEvent {
  tenantId: string;
  adapterId: string;        // kebab-case
  modality: string;
  selectedReason: 'capability-router' | 'explicit';
  latencyMs: number;        // wall-clock invoke → result
  costAmount: number;       // descriptor.costPerCall.usd ?? 0
  costCurrency: string;     // ISO-4217 alpha-3 — 'USD' in v1
  outcome: 'success' | 'failed' | 'killed';
  timestamp: string;        // ISO-8601, captured at END of invocation
}
```

`selectedReason` distinguishes ranked-by-router selections from
caller-explicit picks. The capability-router (T-425) supplies
`'capability-router'` when it wires the `SandboxInvocation`;
agent-driven explicit calls supply `'explicit'`.

`outcome: 'killed'` mirrors T-444's `killed-for-resource-limit` audit
event (sidecar runner only). `outcome: 'failed'` covers every other
non-success terminal state.

`costCurrency: 'USD'` is hardcoded in v1; the field is reserved for
multi-currency hosts post-Phase 14.

## Pluggable emitter

```
                    ┌──────────────────────────┐
                    │   SandboxRunner.run      │
                    │   (per invocation)       │
                    │                          │
                    │   ① emit AuditEvent      │
                    │   (start)                │
                    │                          │
                    │   ② invoke adapter       │
                    │                          │
                    │   ③ emit AuditEvent      │
                    │   (complete/failed/      │
                    │    killed)               │
                    │                          │
                    │   ④ emit UsageEvent      │
                    │   (success/failed/       │
                    │    killed)               │
                    └──────────────────────────┘
```

`UsageTelemetryEmitter`:

```ts
interface UsageTelemetryEmitter {
  emit(event: AdapterUsageEvent): void;
}
```

Default impl `InMemoryUsageTelemetryEmitter` — bounded ring buffer
(capacity 1000; drops oldest on overflow). Mirrors
`InMemoryAuditEmitter` shape exactly.

`UsageTelemetryReader` is the dual:

```ts
interface UsageTelemetryReader {
  eventsForTenant(tenantId: string): readonly AdapterUsageEvent[];
}
```

The in-memory class implements BOTH interfaces; a single instance
satisfies both seams on `AssetGenerationContext`. Production
transports (Cloud Logging / Prometheus / OTLP) implement these two
interfaces separately — the writer pushes to the backing store; the
reader issues a query.

## Wiring into `SandboxRunner`

`SandboxInvocation` gains three OPTIONAL fields (T-445):

```ts
interface SandboxInvocation {
  // …existing T-444 fields…
  usageEmitter?: UsageTelemetryEmitterLike;
  clock?: () => number;
  selectedReason?: 'capability-router' | 'explicit';
}
```

When all three are present, every adapter invocation in each of the
three runners (`InProcessSandboxRunner`, `SidecarSandboxRunner`,
`RemoteServiceSandboxRunner`) emits an `AdapterUsageEvent` post-
terminal-audit-event. When any of the three is absent, usage emission
is a no-op — existing wiring continues to emit only audit events.

The clock seam lives on the invocation (not on the runner) so one
runner instance can serve multiple tenants without sharing state.
Tests inject a deterministic counter; production wires `Date.now`.

## Aggregation

```ts
function aggregateUsage(
  events: readonly AdapterUsageEvent[],
  filter: { tenantId: string; adapterId?: string;
            sinceTimestamp?: string; untilTimestamp?: string },
): readonly UsageRollup[];
```

Buckets by `(tenantId, adapterId, modality)`. Each rollup reports
count + per-outcome counts + p50 + p95 latency (nearest-rank
percentile on the sorted ascending latency array) + total cost. The
window is inclusive-start, exclusive-end.

Mixed currencies inside a bucket throw `UsageAggregationError` — a
guard against future drift. Tenants are single-currency in v1
(`aiBudget.currency` is one ISO-4217 code per tenant).

## Query tool

`query_usage_telemetry` (bundle #25 asset-generation; tool count 5).
Read-only — no patch ops. Input:

```ts
{
  adapterId?: string;       // kebab-case filter
  modality?: AdapterModalityKind; // sealed enum filter
  sinceTimestamp?: string;  // ISO-8601 — defaults to 7 days back
  untilTimestamp?: string;  // ISO-8601 — defaults to host clock
}
```

Output:

```ts
{ ok: true, rollups: UsageRollup[],
  sinceTimestamp: string, untilTimestamp: string }
| { ok: false, reason: 'usage_telemetry_unavailable' }
```

Soft-seam: requires `usageTelemetryReader` + `tenantId` on
`AssetGenerationContext`. Unwired returns the typed error (back-compat:
dev hosts continue to function without telemetry).

## Engine inline aggregation

The engine handler aggregates inline rather than importing from
`@stageflip/usage-telemetry`. This keeps `@stageflip/engine` free of
the telemetry runtime dep. The algorithm + shape match
`aggregateUsage()` exactly; any drift is caught by
`pnpm check-skill-drift` against this concept SKILL.

## Production transports (deferred)

The seam is documented but v1 ships only the in-memory default. T-447
GA hardening MAY add:

- `CloudLoggingUsageTelemetryEmitter` — emits to GCP Cloud Logging.
- `PrometheusUsageTelemetryEmitter` — exposes a `/metrics` endpoint.
- `OtlpUsageTelemetryEmitter` — forwards to an OpenTelemetry
  collector.

Each production reader queries its backing store; the
`InMemoryUsageTelemetryEmitter`'s dual-role pattern (writer + reader
on one class) is a v1 convenience that production deployments split.

## §13 statement

T-445 is **NOT** a structural extension. The new event class is
emitted alongside (not inside) `AdapterAuditEvent` and never reaches
`AdapterDescriptor`, `RIRElement`, `RIRDocument`, `ClipKindBinding`,
or any document-tree node. The new tool is added to an EXISTING
bundle; bundle count stays at 25. Render verification N/A; the
`parityFixture-non-blank` CI gate is N/A for the same reason.
