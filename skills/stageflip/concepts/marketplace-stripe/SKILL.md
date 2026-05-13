---
title: Marketplace Stripe integration
id: skills/stageflip/concepts/marketplace-stripe
tier: concept
status: substantive
last_updated: 2026-05-13
owner_task: T-537
related:
  - skills/stageflip/concepts/marketplace-registry/SKILL.md
  - skills/stageflip/concepts/licensing/SKILL.md
  - skills/stageflip/concepts/bundles/SKILL.md
---

# Marketplace Stripe integration

`@stageflip/marketplace-stripe` is the server-side payment library
that the marketplace registry (T-536) + the tier-system writer
(T-543) call when a tenant purchases a paid-per-tenant pack per
ADR-013. It is NOT a running service — it is a library of pure
translation + verification helpers. The production deployment
(T-550) wires the real `stripe` Node SDK into the abstract
`StripeClient` interface at boot time via dependency injection.

## Surface

The package exposes:

- **`StripeClient`** — abstract two-method surface (`createCheckoutSession`,
  `retrieveSubscription`). Production wraps the real SDK; tests use
  `InMemoryStripeClient` which assigns monotonic session ids
  (`cs_test_1`, …) for deterministic assertions.
- **`createSkuMap` + `FIRST_PARTY_SKU_MAP`** — pack-SKU → Stripe-priceId
  registry per ADR-013 §D2. The six first-party launch packs ship
  with `-1y` SKUs: `news-pro-1y`, `sports-networks-1y`,
  `creator-style-1y`, `finance-1y`, `wedding-events-1y`,
  `frontier-fx-1y`. Stripe priceIds are placeholders until T-550.
- **`handleWebhookEvent`** — pure translator from a parsed Stripe
  `WebhookEvent` into the corresponding `EntitlementMutation`, or
  `null` when the event is irrelevant / malformed. Never throws.
- **`verifyStripeSignature`** — Stripe's `t=…,v1=…` HMAC-SHA256
  signature verifier. Constant-time compare via `timingSafeEqual`.
- **`InMemoryIdempotencyStore`** — `seen` / `markSeen` over event ids
  so duplicate webhook deliveries short-circuit at the handler.
- **`composeWebhookHandler(deps)`** — single `WebhookHandler` glueing
  signature verification + JSON parse + idempotency + translation.

## Webhook event → entitlement transition

| Stripe event | Status path | Notes |
|---|---|---|
| `checkout.session.completed` | `pending → active` | `metadata.tenantId` + `metadata.sku` MUST be set at checkout-session creation |
| `customer.subscription.updated` (status=`active`) | `active → active` | Carries `expiresAt` from `current_period_end` |
| `customer.subscription.updated` (status=`past_due`) | `active → lapsed` | Grace window upstream; ADR-013 §D10 |
| `customer.subscription.updated` (status=`canceled`) | `→ revoked` | Terminal |
| `customer.subscription.deleted` | `→ revoked` | Terminal |
| `invoice.payment_failed` (no `next_payment_attempt`) | `active → lapsed` | Final dunning failure |

The `EntitlementMutation` is RETURNED, not applied — the marketplace
registry caller applies it to `TenantEntitlementsStore` (T-496) inside
the same transaction that records the audit-log entry. T-537 only
computes WHAT to write.

## Idempotency

Stripe is "at-least-once" — the same `evt_…` id can be delivered
multiple times. `composeWebhookHandler`:

1. Verifies signature against the configured `webhookSecret`.
2. Parses the JSON body.
3. Asks `idempotency.seen(event.id)`. If `true`, short-circuits with
   a 200 response (no mutation, no double-apply).
4. Else marks the event seen + translates + returns.

Exceptions DURING translation surface as 500. The event id is already
marked seen at that point — Stripe's retry will short-circuit. This
is a deliberate tradeoff: we prefer not double-applying a partial
mutation over not retrying. T-550 may add a compensating "unmark on
failure" if it bites.

## Signature verification

`stripe-signature: t=<unix-ts>,v1=<hex-hmac-sha256>[,v1=<rotated>]`.

The library accepts multiple `v1=` candidates (Stripe emits the old
+ new value during secret rotation). HMAC computed over
`<ts>.<payload>`; compare with `timingSafeEqual`. No timestamp
tolerance is enforced here — that policy decision lives at the
deployment layer (T-550 may add).

## What's NOT in T-537

- **No deployment.** The real `stripe` SDK is NOT a dependency;
  production wraps it at T-550 wiring time.
- **No entitlement persistence.** Mutations are RETURNED, not
  applied. T-543 (tier-system writer) writes through to
  `TenantEntitlementsStore` (T-496).
- **No checkout-UX.** Tenants don't talk to this library directly;
  they redirect to Stripe's hosted checkout. The library only handles
  the post-payment webhook + later subscription-state changes.
- **No replay-window enforcement.** Stripe's tolerance check belongs
  at the deployment layer.
- **No real Stripe priceIds.** `FIRST_PARTY_SKU_MAP` carries
  placeholder priceIds (`price_<sku>_placeholder`); T-550 replaces
  with the live values.

## Determinism perimeter

`packages/marketplace-stripe/**` lives OUTSIDE the determinism
perimeter per CLAUDE.md §3. The library is host-side / server-side;
no clip / runtime code lives here.

## SKU naming alignment with ADR-013

ADR-013 §D2 names the inaugural packs `news-pro`, `sports-networks`,
`creator-style`, `earnings-investor`, `wedding-events`,
`frontier-effects`. T-537 ships the billing-SKU form used at
checkout time: `news-pro-1y`, `sports-networks-1y`, `creator-style-1y`,
`finance-1y` (rebrand of `earnings-investor` per P16 marketing
direction), `wedding-events-1y`, `frontier-fx-1y` (short form of
`frontier-effects`). The `LicenseClaim.sku` declared in each pack's
manifest matches the billing-SKU form so the runtime gate's
entitlement lookup is a direct equality match against
`TenantEntitlement.sku`.
