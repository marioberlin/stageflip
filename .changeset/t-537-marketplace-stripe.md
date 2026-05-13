---
'@stageflip/marketplace-stripe': minor
---

T-537 — Marketplace Stripe payment integration (P16 δ second task).
Lands `@stageflip/marketplace-stripe` — a server-side library the
marketplace registry (T-536) and tier-system writer (T-543) call
when a tenant purchases a paid-per-tenant pack per ADR-013. Ships:
the `StripeClient` interface + `InMemoryStripeClient` shim;
`FIRST_PARTY_SKU_MAP` with the six 1-year subscription SKUs
(news-pro-1y, sports-networks-1y, creator-style-1y, finance-1y,
wedding-events-1y, frontier-fx-1y); the four webhook handlers
(checkout.session.completed, customer.subscription.updated,
customer.subscription.deleted, invoice.payment_failed) mapped onto
the ADR-013 §D4 pending → active → lapsed → revoked state machine;
HMAC-SHA256 signature verification per Stripe's webhook protocol;
an `IdempotencyStore` interface with an in-memory implementation
that dedups duplicate event deliveries; and a single
`composeWebhookHandler(deps)` factory that glues signature +
idempotency + translation into one entry-point. No deployment —
production wires the real `stripe` SDK at T-550 via DI. No external
npm deps; node:crypto only. Concept skill
`skills/stageflip/concepts/marketplace-stripe/SKILL.md` documents
the surface + the deferred-deployment posture.
