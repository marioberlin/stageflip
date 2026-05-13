---
title: Marketplace conversion + churn recovery
id: skills/stageflip/concepts/marketplace-conversion
tier: concept
status: substantive
last_updated: 2026-05-14
owner_task: T-544
related:
  - skills/stageflip/concepts/marketplace-stripe/SKILL.md
  - skills/stageflip/concepts/marketplace-tier/SKILL.md
  - skills/stageflip/concepts/marketplace-telemetry-dashboard/SKILL.md
  - skills/stageflip/concepts/licensing/SKILL.md
---

# Marketplace conversion + churn recovery

`@stageflip/marketplace-conversion` is the trial-to-paid and
churn-recovery orchestration library. It sits one step above the
Stripe state-machine (T-537) and one step below the deployment
wiring (T-550): given an observed conversion-trigger event + the
tenant's current entitlement status, it returns the recommended
Stripe-API action shape and the entitlement status the deployment
layer should expect after execution.

The package is a pure library. It does NOT call Stripe, does NOT
read the entitlement store, does NOT consult wall-clock time.
Callers resolve their async lookups upstream and feed projected
inputs into `planConversion`. Determinism perimeter: **outside**
— server-side only.

## The three conversion triggers

| Event kind | Source | Meaning |
|---|---|---|
| `trial-to-paid` | Marketplace UI ("Upgrade now" in a live trial) | Tenant opts in BEFORE the trial expires |
| `trial-expired` | T-505 `evaluateTrialPolicy` (status='trial' + nowMs ≥ expiresAt) | Trial entitlement is past its `expiresAt` |
| `lapsed-recovered` | T-537 Stripe webhook (`subscription-renewed` intent on a `'lapsed'` entitlement) | A previously-lapsed paid entitlement returned to active |

The events are emitted from different layers; the planner is the
single decision point that turns them into Stripe actions.

## The decision table

`planConversion(input, strategy?)` returns:

```ts
type ConversionAction =
  | { kind: 'create-checkout-session'; priceId; customerId; metadata }
  | { kind: 'noop'; reason: string }
  | { kind: 'churn-recovery-retry'; backoffMs: number };
```

Truth table (per ADR-013 §D4):

| Event | Status | Action | Expected terminal |
|---|---|---|---|
| `trial-to-paid` | `trial` / `lapsed` / `revoked` / `null` | create-checkout-session | active |
| `trial-to-paid` | `active` | noop (`already-active`) | active |
| `trial-to-paid` | `pending` | noop (`pending-stripe`) | pending |
| `trial-expired` | `trial` / `lapsed` / `revoked` / `null` | create-checkout-session | active |
| `trial-expired` | `active` | noop (`already-converted`) | active |
| `trial-expired` | `pending` | noop (`pending-stripe`) | pending |
| `lapsed-recovered` | `active` | noop (`already-active`) | active |
| `lapsed-recovered` | `lapsed` (attempt < cap) | churn-recovery-retry | active |
| `lapsed-recovered` | `lapsed` (attempt ≥ cap) | noop (`churn-final`) | lapsed |
| `lapsed-recovered` | `revoked` (attempt < cap) | churn-recovery-retry | active |
| `lapsed-recovered` | `revoked` (attempt ≥ cap) | noop (`churn-final`) | revoked |
| `lapsed-recovered` | `pending` | noop (`pending-stripe`) | pending |
| `lapsed-recovered` | `trial` | noop (`trial-sibling`) | active |
| `lapsed-recovered` | `null` | noop (`no-entitlement`) | revoked |

`expectedTerminalStatus` is the contract: the deployment layer
(T-550) executes the action then compares the observed-after status
against this; drift goes to the T-541 telemetry dashboard as a
funnel-anomaly alert.

## Churn-recovery strategy

```ts
DEFAULT_CHURN_STRATEGY = {
  maxRetries: 3,
  baseBackoffMs: 3_600_000,    // 1h
  maxBackoffMs: 86_400_000,    // 24h
  nextBackoff: (n) => min(base * 2^n, max),
};
```

Three retries with exponential backoff (1h, 2h, 4h) gives the
customer ~7 hours total to resolve a payment-method failure before
the planner emits a `churn-final` noop. The 24h ceiling matters
only for deployments that inject a higher `maxRetries`; the default
schedule never hits it.

The `retryCount` argument is opaque to the strategy — callers pass
the zero-indexed attempt number from their own retry harness state.

## Why pure?

The conversion flow touches four async systems (Stripe API,
entitlement store, telemetry, retry harness). Composing them in a
single I/O-heavy module would make testing brittle and would
duplicate Stripe-state logic that already lives in T-537.

Keeping the planner pure lets us:

- Unit-test the full decision table in O(μs) (≥30 tests).
- Share one decision policy between the synchronous UI upgrade
  path and the asynchronous webhook recovery path.
- Mock the Stripe + store layers at the deployment boundary —
  the planner has no I/O to mock.

## Metrics

`ConversionMetricsTracker` is a four-counter aggregator the
deployment layer feeds at the end of each plan-execute cycle:

```ts
const tracker = new ConversionMetricsTracker();
tracker.recordEvent(event, outcome); // 'converted' | 'expired' | 'recovered' | 'churned'
const summary = tracker.summary();
// → { trialToPaid, trialExpiredNoConversion, lapsedRecovered, lapsedChurned, conversionRate }
```

`conversionRate = trialToPaid / (trialToPaid +
trialExpiredNoConversion)`. The tracker is in-memory; the T-541
dashboard owns retention. Snapshot at window boundary, ship to the
dashboard, discard.

Non-matching `(event, outcome)` combinations (e.g.
`trial-to-paid` + `expired`) are silently ignored — callers may
emit them for audit purposes without polluting the funnel.

## Wiring (T-550, downstream)

The deployment layer is responsible for:

1. Observing the trigger source (UI click / trial-policy evaluator /
   Stripe webhook) and constructing a `ConversionEvent`.
2. Reading the tenant's current entitlement status from the store
   (T-496) and resolving the Stripe customer + price identifiers.
3. Calling `planConversion(input)`.
4. Executing the returned action:
   - `create-checkout-session` → Stripe SDK `checkout.sessions.create`
   - `churn-recovery-retry` → enqueue a delayed retry job at `now +
     backoffMs`, incrementing the persisted `retryCount`.
   - `noop` → log the reason; no further action.
5. After execution, comparing the observed entitlement status
   against `expectedTerminalStatus` and feeding `(event, outcome)`
   into `ConversionMetricsTracker`.

T-544 ships steps 3 + the metrics tracker. Steps 1, 2, 4, 5 live
in T-550.
