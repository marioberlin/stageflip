// packages/marketplace-stripe/src/client/in-memory.ts
// T-537 — In-memory `StripeClient` shim for unit tests + local dev.
// All state lives inside the instance; there is NO global state. The
// production wiring (T-550) replaces this with a real Stripe SDK
// adapter via DI.
//
// Determinism perimeter: outside (server-side).

import type {
  CheckoutSession,
  CreateCheckoutSessionOpts,
  StripeClient,
  StripeSubscription,
  StripeSubscriptionStatus,
} from './stripe-client.js';

/**
 * Seed shape for pre-populating the in-memory client with known
 * subscriptions — used by tests that exercise webhook flows referencing
 * a `subscriptionId` without going through a checkout first.
 */
export interface InMemorySubscriptionSeed {
  readonly id: string;
  readonly status: StripeSubscriptionStatus;
  readonly currentPeriodEnd: number;
  readonly customerId: string;
  readonly priceId: string;
}

/**
 * In-memory implementation of {@link StripeClient}. Checkout sessions
 * are assigned monotonically-numbered ids (`cs_test_1`, `cs_test_2`, …)
 * so test assertions are deterministic without timestamps. The
 * generated `url` is a pseudo-URL of the form
 * `inmem://stripe/checkout/<sessionId>`.
 */
export class InMemoryStripeClient implements StripeClient {
  private readonly sessions = new Map<string, CheckoutSession>();
  private readonly subscriptions = new Map<string, StripeSubscription>();
  private sessionCounter = 0;

  constructor(seeds: { readonly subscriptions?: readonly InMemorySubscriptionSeed[] } = {}) {
    for (const s of seeds.subscriptions ?? []) {
      this.subscriptions.set(s.id, {
        id: s.id,
        status: s.status,
        currentPeriodEnd: s.currentPeriodEnd,
        customerId: s.customerId,
        items: [{ priceId: s.priceId }],
      });
    }
  }

  readonly createCheckoutSession = async (
    opts: CreateCheckoutSessionOpts,
  ): Promise<CheckoutSession> => {
    if (!opts.successUrl.startsWith('https://')) {
      throw new Error(`successUrl must be absolute https URL: ${opts.successUrl}`);
    }
    if (!opts.cancelUrl.startsWith('https://')) {
      throw new Error(`cancelUrl must be absolute https URL: ${opts.cancelUrl}`);
    }
    this.sessionCounter += 1;
    const id = `cs_test_${this.sessionCounter}`;
    const session: CheckoutSession = {
      id,
      url: `inmem://stripe/checkout/${id}`,
      customerId: opts.customerId,
      priceId: opts.priceId,
      metadata: { ...opts.metadata },
    };
    this.sessions.set(id, session);
    return session;
  };

  readonly retrieveSubscription = async (
    subscriptionId: string,
  ): Promise<StripeSubscription | null> => {
    const v = this.subscriptions.get(subscriptionId);
    return v ?? null;
  };

  /**
   * Test-only helper — set or update a subscription's status without
   * routing through Stripe events. Used by webhook tests to simulate
   * upstream state changes.
   */
  readonly _setSubscriptionForTestOnly = (sub: StripeSubscription): void => {
    this.subscriptions.set(sub.id, sub);
  };

  /** Test-only helper — list every session ever created. */
  readonly _allSessionsForTestOnly = (): readonly CheckoutSession[] => {
    return [...this.sessions.values()];
  };
}
