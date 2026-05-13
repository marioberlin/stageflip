// packages/marketplace-stripe/src/client/stripe-client.ts
// T-537 — Abstract Stripe client surface the marketplace registry
// consumes when purchasing a paid-per-tenant pack. Production wraps
// the real `stripe` Node SDK via dependency injection (T-550); tests
// use the in-memory shim sibling.
//
// Determinism perimeter: outside (server-side).

/**
 * Subscription status mirrored from Stripe per
 * https://stripe.com/docs/api/subscriptions/object#subscription_object-status.
 * The full union is reproduced verbatim — the library does not narrow
 * upstream values so future-Stripe additions surface as `unknown` at
 * the call-site, not silently swallowed.
 */
export type StripeSubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'unpaid';

/** A Stripe checkout session — minimal projection. */
export interface CheckoutSession {
  readonly id: string;
  readonly url: string;
  readonly customerId: string;
  readonly priceId: string;
  readonly metadata: Record<string, string>;
}

/** A Stripe subscription — minimal projection. */
export interface StripeSubscription {
  readonly id: string;
  readonly status: StripeSubscriptionStatus;
  /** Unix seconds — the moment the current period ends. */
  readonly currentPeriodEnd: number;
  readonly customerId: string;
  readonly items: readonly { readonly priceId: string }[];
}

/**
 * Options accepted by {@link StripeClient.createCheckoutSession}. The
 * `successUrl` + `cancelUrl` MUST be absolute https URLs — Stripe
 * rejects anything else; the in-memory shim mirrors the constraint.
 */
export interface CreateCheckoutSessionOpts {
  readonly priceId: string;
  readonly customerId: string;
  readonly metadata: Record<string, string>;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

/**
 * Abstract Stripe client. Production deployment supplies a thin
 * adapter around the real `stripe` Node SDK; tests use
 * `InMemoryStripeClient`.
 */
export interface StripeClient {
  /**
   * Create a hosted checkout session for `priceId` against the
   * `customerId` (creates the Stripe customer if absent — handled by
   * the concrete implementation). Returns the session id + url the
   * tenant is redirected to.
   */
  readonly createCheckoutSession: (opts: CreateCheckoutSessionOpts) => Promise<CheckoutSession>;

  /**
   * Look up a subscription by id. Returns `null` when the
   * subscription does not exist (e.g. mid-test cleanup).
   */
  readonly retrieveSubscription: (subscriptionId: string) => Promise<StripeSubscription | null>;
}
