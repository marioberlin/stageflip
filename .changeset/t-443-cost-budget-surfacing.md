---
'@stageflip/storage': minor
'@stageflip/engine': minor
---

T-443 — cost-budget surfacing in tool results.

`generate_asset` now returns an optional `costBudget` envelope
(`{ costIncurred, budgetRemaining?, budgetExhausted }`) when the host
wires the new `costTrackerStore` + `tenantSettingsStore` + `tenantId`
soft seams AND the tenant has an `aiBudget` configured. The agent
reads `budgetExhausted` / `budgetRemaining` and decides whether to
retry with `rankingPreference: 'cheapest'` (T-425) or defer the call.

New public surfaces:

- `@stageflip/storage`:
  - `TenantSettings.aiBudget?` field (optional;
    `{ monthlyAmount, currency, periodEnd }`).
  - `AiBudget` + `aiBudgetSchema` exports.
  - `TenantCostTrackerStore` interface +
    `InMemoryTenantCostTrackerStore` implementation.
  - `CostRecord` shape.
- `@stageflip/engine`:
  - `AssetGenerationContext` gained `costTrackerStore?`,
    `tenantSettingsStore?`, `tenantId?` soft seams (structural typing
    so the engine doesn't depend on `@stageflip/storage` at runtime).
  - `CostTrackerStoreLike`, `TenantSettingsStoreLike`,
    `CostBudgetEnvelope` exports.
  - New tool `query_cost_budget` registered in canonical bundle 25
    (asset-generation). Tool count now 4.

§13 structural extension (`TenantSettings.aiBudget?` +
`TenantCostTrackerStore` are new degrees of freedom in the storage
model). Option 3 deferral — cost-budget data is metadata, never
rendered, never threads into parity goldens. Pixel-level verification
N/A; unit-test roundtrip + integration tests are the evidence.

Adapter descriptors are NOT modified — `AdapterDescriptor.costPerCall`
already exists and all 9 reference adapters already populate it.
T-435 adapter-regression snapshots are NOT regenerated (descriptor
SHA-256 stable).
