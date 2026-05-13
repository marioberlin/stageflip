---
'@stageflip/marketplace-conversion': minor
---

T-544 — Trial-to-paid conversion + churn-recovery library
(`@stageflip/marketplace-conversion`) per ADR-013 §D4 / §D10. Pure
server-side library that orchestrates the three conversion
triggers: `'trial-to-paid'` (mid-trial opt-in), `'trial-expired'`
(post-trial conversion path), and `'lapsed-recovered'` (post-
payment-failure recovery via Stripe's `subscription-renewed`
intent). Exports `planConversion` (decision-table from event +
current entitlement status → `create-checkout-session` /
`noop` / `churn-recovery-retry`), `DEFAULT_CHURN_STRATEGY`
(exponential dunning policy: 3 retries, 1h base, 24h ceiling),
`ConversionMetricsTracker` (in-memory funnel counters with
`conversionRate = trialToPaid / (trialToPaid +
trialExpiredNoConversion)` for the T-541 telemetry dashboard), and
the `ConversionEvent` discriminated-union type. The library is
dep-free; consumers resolve async entitlement reads upstream and
execute the planner's `create-checkout-session` action via Stripe
SDK in the deployment-wiring layer (T-550). Determinism
perimeter: outside. New skill at
`skills/stageflip/concepts/marketplace-conversion/SKILL.md`.
