---
'@stageflip/marketplace-refunds': minor
---

T-545 — Refund + dispute handling library
(`@stageflip/marketplace-refunds`) per ADR-013 §D11. Pure
server-side library that orchestrates two related flows:
tenant-initiated **refunds** (via `processRefund` — full / pro-rata /
denied based on a configurable window policy) and Stripe-initiated
**disputes** / chargebacks (via `handleDispute` — submit-evidence /
wait / accept-loss). Exports `DEFAULT_REFUND_POLICY` (7-day full,
30-day pro-rata, 60-day cutoff; partial-refund entitlement
preservation on by default), `RefundPolicy` config type,
`buildDisputeEvidence` (Stripe-shaped evidence envelope from event
+ entitlement history + usage metrics), and `InMemoryRefundLedger`
(append-only audit trail; `totalRefundedCents` excludes
dispute-lost rows since those are Stripe-pulled, not refunds we
issued). The library is dep-free; consumers execute the planner's
Stripe-API calls in the deployment-wiring layer (T-550) and persist
ledger snapshots via the dashboard / finance pipeline. Determinism
perimeter: outside. New skill at
`skills/stageflip/concepts/marketplace-refunds/SKILL.md`.
