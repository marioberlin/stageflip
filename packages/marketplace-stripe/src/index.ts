// packages/marketplace-stripe/src/index.ts
// T-537 — Public surface of `@stageflip/marketplace-stripe`. The
// package is a Stripe-integration LIBRARY consumed by the marketplace
// registry (T-536) + the tier-system writer (T-543); production
// deployment wires the real `stripe` SDK into the `StripeClient`
// interface at T-550 via dependency injection.
//
// Determinism perimeter: outside (server-side).

export type {
  CheckoutSession,
  CreateCheckoutSessionOpts,
  StripeClient,
  StripeSubscription,
  StripeSubscriptionStatus,
} from './client/stripe-client.js';
export {
  InMemoryStripeClient,
  type InMemorySubscriptionSeed,
} from './client/in-memory.js';

export {
  FIRST_PARTY_SKU_MAP,
  type SkuMap,
  type SkuMapping,
  type SkuTier,
  createSkuMap,
} from './pricing/sku-map.js';

export {
  type EntitlementStatus,
  type TransitionIntent,
  assertTransition,
  nextStatus,
} from './entitlements/transitions.js';

export {
  type EntitlementMutation,
  type WebhookEvent,
  handleWebhookEvent,
} from './webhooks/handlers.js';

export { verifyStripeSignature } from './webhooks/signature.js';

export {
  type IdempotencyStore,
  InMemoryIdempotencyStore,
} from './webhooks/idempotency.js';

export {
  type StripeWebhookDeps,
  type WebhookHandler,
  type WebhookRequest,
  type WebhookResult,
  composeWebhookHandler,
} from './handler.js';
