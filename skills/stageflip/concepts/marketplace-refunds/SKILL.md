---
title: Marketplace refund + dispute handling
id: skills/stageflip/concepts/marketplace-refunds
tier: concept
status: substantive
last_updated: 2026-05-14
owner_task: T-545
related:
  - skills/stageflip/concepts/marketplace-stripe/SKILL.md
  - skills/stageflip/concepts/marketplace-tier/SKILL.md
  - skills/stageflip/concepts/marketplace-conversion/SKILL.md
  - skills/stageflip/concepts/licensing/SKILL.md
---

# Marketplace refund + dispute handling

`@stageflip/marketplace-refunds` is the refund + chargeback
orchestration library. It sits one step above the Stripe state-
machine (T-537) and one step below the deployment wiring (T-550):
given an observed refund request OR a Stripe dispute event, it
returns the recommended action + entitlement-protection decision
the deployment layer executes against Stripe.

The package is a pure library. It does NOT call Stripe, does NOT
read the entitlement store, does NOT consult wall-clock time.
Callers resolve their async lookups upstream and feed projected
inputs in. Determinism perimeter: **outside** — server-side only.

## Two related but distinct flows

| Flow | Initiator | Decision function |
|---|---|---|
| **Refund** | Tenant ("I want my money back") | `processRefund(request, policy, chargeAt)` |
| **Dispute** | Stripe webhook (cardholder chargeback) | `handleDispute(event, policy)` |

Refunds are voluntary on our side; we choose the verdict per the
policy. Disputes are involuntary; Stripe owns the verdict and we
react. The two flows share the `RefundPolicy` so a single
configuration tunes both.

## RefundPolicy

```ts
DEFAULT_REFUND_POLICY = {
  fullRefundWindowDays: 7,        // full refund inside this window
  proRataRefundWindowDays: 30,    // pro-rata fraction after the full window
  noRefundAfterDays: 60,          // hard cutoff
  preserveEntitlementForPartial: true, // partial = goodwill credit, keep access
};
```

The pro-rata fraction is `1 - elapsedDays / proRataRefundWindowDays`
clamped to `[0, 1]` and rounded to the nearest cent. At the exact
boundary (`elapsedDays === proRataRefundWindowDays`) the fraction is
zero and the request denies with `pro-rata-zero`.

## processRefund decision table

| Reason | Elapsed days | Decision | Entitlement |
|---|---|---|---|
| `admin-override` | any | `approved-full` | `preserve` |
| `tenant-cancellation` / `support-resolution` | < 0 | `denied: request-before-charge` | — |
| (same) | ≤ `fullRefundWindowDays` | `approved-full` | `revoke` |
| (same) | ≤ `proRataRefundWindowDays` | `approved-partial` (pro-rata) | per policy flag |
| (same) | > `proRataRefundWindowDays`, ≤ `noRefundAfterDays` | `denied: outside-refund-window` | — |
| (same) | > `noRefundAfterDays` | `denied: outside-refund-window` | — |
| (any) | amount ≤ 0 | `denied: non-positive-amount` | — |
| (any) | malformed ISO timestamp | `denied: malformed-timestamp` | — |

`admin-override` is the policy escape hatch: full refund + preserve
entitlement, regardless of window. Used for legal/regulatory escalations
where the tenant must keep access while we settle the books.

## handleDispute decision table

| Stripe status | Action | Entitlement |
|---|---|---|
| `needs_response` | `submit-evidence` | `preserve` |
| `under_review` | `wait` | `preserve` |
| `won` | `wait` | `preserve` |
| `lost` | `accept-loss` | `revoke` |

**Why preserve while the dispute is active?** Revoking before
Stripe rules punishes a tenant who might still win the case. We
revoke only on `lost` — when Stripe has already pulled the funds
and the chargeback is final.

The `reason` field on the action carries the dispute-reason
taxonomy (`fraudulent`, `subscription_canceled`, `product_not_received`,
etc.) so the deployment layer can route to specialised evidence
builders (e.g. billing-history for `subscription_canceled`,
activation telemetry for `product_not_received`).

## buildDisputeEvidence

Composes the Stripe-shaped evidence envelope from the dispute event
+ tenant-side context:

```ts
buildDisputeEvidence({
  event,                  // the DisputeEvent
  entitlementHistory,     // readonly string[] — audit lines, oldest-first
  usageMetrics,           // { installCount, activationCount, clipMountCount }
  customerInfo?,          // optional { name, email, address, communication }
})
// → DisputeEvidence { serviceDate, serviceDocumentation, receipt, ... }
```

Field mapping:

- `serviceDate` ← `event.createdAt`
- `serviceDocumentation` ← entitlement-history joined + usage summary + sku/tenant headers
- `receipt` ← `charge=… amount=$xx.xx sku=…`
- Customer fields ← `customerInfo` (or `null` when absent — Stripe accepts null)

## InMemoryRefundLedger

Append-only audit trail. Every refund / dispute decision the
deployment layer applies gets recorded with the outcome:

```ts
type LedgerOutcome =
  | 'refunded-full'
  | 'refunded-partial'
  | 'denied'
  | 'dispute-won'
  | 'dispute-lost';
```

`totalRefundedCents` counts only `refunded-full` + `refunded-partial`.
`dispute-lost` rows land in the ledger for audit but do NOT count —
those funds were pulled by Stripe, not refunded by us. Denials are
booked for audit (the `amountCents` field carries the requested,
not refunded, amount).

The ledger is in-memory; the deployment layer snapshots it on a
cadence and ships rows to the durable refund-history store
(dashboard / finance reconciliation pipeline owns retention).

## Wiring (T-550, downstream)

The deployment layer is responsible for:

1. Observing the trigger source (UI refund button → `RefundRequest`;
   Stripe `charge.dispute.*` webhook → `DisputeEvent`).
2. Resolving the original-charge timestamp + sku + tenant from the
   entitlement-history store.
3. Calling `processRefund(req, policy, chargeAt)` /
   `handleDispute(event, policy)`.
4. Executing the returned action:
   - `processRefund` `approved-full` / `approved-partial` →
     Stripe SDK `refunds.create({ charge, amount })` + entitlement
     mutation per `entitlementAction`.
   - `handleDispute` `submit-evidence` → call `buildDisputeEvidence`
     with usage telemetry + entitlement history, POST to Stripe's
     `disputes.update` endpoint, preserve entitlement.
   - `handleDispute` `accept-loss` → revoke entitlement, record a
     `dispute-lost` ledger row.
   - `wait` / `noop` → log, no further action.
5. Recording the outcome in `InMemoryRefundLedger`.

T-545 ships steps 3, 4 (the decision functions + evidence builder),
and 5 (the ledger). Steps 1, 2, and the Stripe SDK calls in step 4
live in T-550.

## Why pure?

Refund + dispute flows touch four async systems (Stripe API,
entitlement store, telemetry, support tooling). Composing them in
a single I/O-heavy module would make testing brittle and duplicate
Stripe-state logic that already lives in T-537.

Keeping the processor + handler pure lets us:

- Unit-test the full decision table in O(μs) (≥30 tests).
- Share one policy across the synchronous refund path (UI) and the
  asynchronous dispute path (webhook).
- Mock the Stripe + store layers at the deployment boundary — the
  library has no I/O to mock.
