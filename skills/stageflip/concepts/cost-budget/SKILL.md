---
title: Cost budget — per-tenant AI-generation cost tracking + tool-result surfacing
id: skills/stageflip/concepts/cost-budget
tier: concept
status: substantive
last_updated: 2026-05-11
owner_task: T-443
related:
  - skills/stageflip/concepts/tenant-settings/SKILL.md
  - skills/stageflip/concepts/provider-seam/SKILL.md
  - skills/stageflip/concepts/agent-executor/SKILL.md
  - skills/stageflip/concepts/storage-contract/SKILL.md
---

# Cost budget

Provider adapters cost money. Some (apache-2.0 TTS / music / SFX) are
free at the model level; some (Tripo, Meshy, Seedance, Runway) charge
per-call. Without a budget surface, the agent has no way to choose a
cheaper provider when running low, and the tenant has no visibility
into accumulated cost until the bill arrives.

T-443 closes the loop:

- **`TenantSettings.aiBudget?`** — optional per-tenant budget posture
  with `monthlyAmount`, ISO-4217 `currency`, and `periodEnd`.
- **`TenantCostTrackerStore`** — storage facet that accumulates per-call
  cost records (`tenantId`, `adapterId`, `amount`, `currency`,
  `recordedAt`).
- **`generate_asset.costBudget` envelope** — every successful
  `generate_asset` invocation reports the cost it just incurred AND
  the remaining tenant budget for the period.
- **`query_cost_budget` tool** — a read-only tool the agent can call
  to inspect budget posture WITHOUT triggering an adapter call.

The agent uses the surfaced `budgetExhausted` / `budgetRemaining`
signal to switch the planner's `rankingPreference` to `'cheapest'`
(T-425) when budget runs low — or to defer the generation altogether.

## Data model

### `AiBudget`

```ts
{
  monthlyAmount: number;   // ≥ 0; finite
  currency: string;        // ISO-4217 alpha-3 (regex /^[A-Z]{3}$/)
  periodEnd: string;       // ISO-8601 datetime
}
```

Lives at `TenantSettings.aiBudget?`. Optional — absent means the
tenant has no enforced budget; tool results omit the `costBudget`
envelope entirely.

Single-currency per tenant. The in-memory `TenantCostTrackerStore`
does NOT cross-convert; if a tenant changes currency, callers must
reset the cost-tracker or budget math will mix units silently.

### `CostRecord`

```ts
{
  tenantId: string;
  adapterId: string;
  amount: number;
  currency: string;
  recordedAt: string;  // ISO-8601 datetime
}
```

One record per adapter call. Free adapters (`costPerCall.usd = 0`)
still record a zero-amount line item — useful for the audit trail and
keeps invariants tidy.

### `CostBudgetEnvelope` on `generate_asset` result

```ts
{
  costIncurred: {
    adapterId: string;
    amount: number;
    currency: string;
  };
  budgetRemaining?: {        // omitted when no aiBudget configured
    amount: number;          // monthlyAmount - period total (may be < 0)
    currency: string;
    periodEndAt: string;
  };
  budgetExhausted: boolean;  // true iff budgetRemaining.amount ≤ 0
}
```

## Soft seams on `AssetGenerationContext`

| Seam | When wired | When unwired |
|---|---|---|
| `costTrackerStore?` | records cost on success | no cost recorded; `costBudget` omitted |
| `tenantSettingsStore?` | reads `aiBudget` | `budgetRemaining` omitted; `budgetExhausted: false` |
| `tenantId?` | scopes reads/writes | `costBudget` omitted entirely |

Back-compat: when ALL three are absent, `generate_asset` returns the
original T-423 shape verbatim. Existing tests that don't wire the
seams see no change.

## Half-open period semantics

`TenantCostTrackerStore.getPeriodTotal(tenantId, periodStart, periodEnd)`
sums records whose `recordedAt ∈ [periodStart, periodEnd)`:

- **Inclusive** at `periodStart` — a record AT periodStart is the
  FIRST record of the new period.
- **Exclusive** at `periodEnd` — a record AT periodEnd is the
  FIRST record of the NEXT period (so the boundary cleanly
  partitions month boundaries).

ISO-8601 datetime strings compare lexicographically equivalent to
chronological — the in-memory implementation uses `>=` / `<` on
strings directly, no parsing required.

## Recording cost — adapter success ONLY

Cost is recorded ONLY after a successful adapter call returns
`{ ok: true }`. When the entire fallback chain exhausts
(`all_adapters_failed`), NO record is created — the tenant should not
be charged for failed attempts. This matches industry convention
(Stripe charges on success, not attempt).

Cache-hit short-circuits (T-435/T-436/T-437) do NOT call an adapter,
so no cost record. The hit's `costIncurred` field is omitted (the
cache-hit branch ships in T-436's PR; see that spec for the exact
field gating).

## Surfacing pattern — the agent loop

```
1. agent reads transcript → realizes budget might be tight
2. agent invokes query_cost_budget (pure read, no patch ops)
3. handler returns { ok: true, budget: { remaining: 1.20, exhausted: false } }
4. agent decides: 1.20 USD remaining → switch to cheaper-rank
5. agent invokes generate_asset(modality, prompt, params: { rankingPreference: 'cheapest' })
6. capability-router (T-425) ranks adapters by costPerCall.usd ascending
7. fallback executor tries cheapest first
8. on success, handler records cost, returns costBudget envelope
9. agent sees updated remaining; decides next step
```

The `rankingPreference` plumbing already exists (T-425); T-443 does
not modify the router. The new surface is purely the *signal* the
agent reads to make ranking decisions.

## §13 — structural extension; option 3 deferral

`TenantSettings.aiBudget?` + `TenantCostTrackerStore` are new degrees
of freedom in the storage model, so T-443 IS a structural extension
per CLAUDE.md §13. Cost-budget data is METADATA — never threads into
the renderer, never produces visible output, never alters parity
goldens. Pixel-level verification is N/A; unit-test roundtrip plus
integration tests for the handler envelope are the evidence.

## Out of scope (v1)

- Postgres / Firebase `TenantCostTrackerStore` adapters (in-memory
  only in v1; production wire-up downstream).
- Multi-currency conversion (single-currency per tenant; mixed
  records would corrupt the math silently).
- Automatic period rollover (callers supply `periodEnd`; no
  scheduled rollover job).
- Planner-side budget-aware adapter selection (a future task can
  read `costBudget` directly into Planner inputs).
- Per-modality sub-budgets.

## See also

- [Tenant settings](../tenant-settings/SKILL.md) — base
  `TenantSettings` shape (extended here with `aiBudget?`).
- [Provider seam](../provider-seam/SKILL.md) — `AdapterDescriptor.costPerCall`
  hint the router consumes.
- [Storage contract](../storage-contract/SKILL.md) — the facet pattern
  `TenantCostTrackerStore` mirrors.
