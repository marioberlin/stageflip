---
title: Marketplace telemetry dashboard
id: skills/stageflip/concepts/marketplace-telemetry-dashboard
tier: concept
status: substantive
last_updated: 2026-05-14
owner_task: T-541
related:
  - skills/stageflip/concepts/observability/SKILL.md
  - skills/stageflip/concepts/marketplace-registry/SKILL.md
  - skills/stageflip/concepts/pack-discovery/SKILL.md
---

# Marketplace telemetry dashboard

`@stageflip/marketplace-telemetry-dashboard` is the server-side
library that consumes events from `@stageflip/pack-telemetry`
(T-503) and produces dashboards for the six first-party launch
packs. Like `@stageflip/marketplace-registry`, this is NOT a running
service — it is the route-handler bundle + aggregation library that
T-550 (marketplace GA) wires into a Cloud-Run-deployable host.

T-541 ships the library + in-memory shim sufficient for unit
testing the contract today. Third-party pack telemetry lives in a
separate dashboard (deferred).

## Scope

The dashboard hard-codes the six first-party launch packs and
filters every other pack hash at receiver time. The launch packs
(all under publisher `stageflip`):

| pack id | task |
|---|---|
| `creator-style` | T-516 launch pack |
| `finance` | T-526 launch pack |
| `frontier-fx` | T-538 launch pack |
| `news-pro` | T-510 launch pack |
| `sports-networks` | T-515 launch pack |
| `wedding-events` | T-540 launch pack |

`FIRST_PARTY_PACK_IDS` is the canonical list. `computeFirstPartyHashes()`
yields the `Set<string>` of SHA-256 hashes (via `hashPackId` from
`@stageflip/pack-telemetry`) the receiver matches against.

## Surface

- **`createTelemetryReceiver(deps)`** — builds the
  `POST /api/v1/telemetry/events` handler. Accepts a JSON array of
  `PackTelemetryEvent`; validates shape; filters by first-party
  scope; normalises into `TimeSeriesEvent`; writes via the supplied
  `TimeSeriesStore`. Returns `{ status, accepted, rejected, reason? }`.
- **`TimeSeriesStore`** — abstract `{ write, query }` interface. The
  in-memory implementation (`InMemoryTimeSeriesStore`) is for tests
  + local dev. A Cloud Bigtable adapter slots in at T-550.
- **Aggregations** — pure functions over `readonly TimeSeriesEvent[]`:
  - `installCountByDay`, `installCountByWeek`
  - `activationRate` → `{ installs, activations, rate }`
  - `averageClipMountCount`
  - `retentionCurve` → cohort `activeFraction` per `daysSinceInstall`
- **`buildDashboardData(packIdHash, store, { fromIso, toIso })`** —
  pulls install / activation / usage events for one pack from the
  store and runs every aggregation. Returns the `DashboardData`
  blob the frontend (deferred) consumes.

## Privacy posture

ADR-001 mandates opt-in only telemetry with no PII. The receiver
operates exclusively on anonymous `packIdHash` strings; no plaintext
publisher / pack names ever cross the wire. The producer side
(`@stageflip/pack-telemetry`) hashes via `hashPackId` before the
event leaves the host process; the receiver hashes the first-party
scope identically and matches.

## Determinism

The package lives OUTSIDE the determinism perimeter (server-side
telemetry). The aggregations are nonetheless pure functions over
input arrays; the in-memory store has no implicit clock dependency.

## Out of scope (deferred)

- Real bearer-token validation (a future task wires the token store
  used by `marketplace-registry` into the receiver).
- Rate limiting + back-pressure.
- Batch deduplication / idempotency-key handling.
- Cloud Bigtable adapter (slots in via `TimeSeriesStore` at T-550).
- Frontend UI — consumes `buildDashboardData` output via T-538-line
  marketplace UI work, deferred.
- Third-party pack telemetry dashboard.

## Files

```
packages/marketplace-telemetry-dashboard/src/
  events/receiver.ts            # POST /api/v1/telemetry/events
  storage/timeseries.ts         # TimeSeriesStore interface
  storage/in-memory.ts          # In-memory shim
  aggregations/install-count.ts
  aggregations/activation-rate.ts
  aggregations/usage-stats.ts
  aggregations/retention.ts
  first-party/scope.ts          # FIRST_PARTY_PACK_IDS + hashes
  dashboard/shape.ts            # buildDashboardData
  index.ts
```
