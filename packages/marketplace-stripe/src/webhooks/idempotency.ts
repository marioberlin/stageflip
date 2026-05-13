// packages/marketplace-stripe/src/webhooks/idempotency.ts
// T-537 — Idempotency store for Stripe webhook deduplication. Stripe
// can deliver the same event multiple times (
// https://stripe.com/docs/webhooks#handle-duplicate-events ); the
// handler short-circuits on `seen(eventId) === true` and returns a
// no-mutation 200 so Stripe stops retrying.
//
// Determinism perimeter: outside (server-side).

/**
 * Idempotency store interface. Production uses Redis or Firestore;
 * tests use {@link InMemoryIdempotencyStore}.
 *
 * The contract is: `markSeen(id)` MUST persist the binding atomically;
 * subsequent `seen(id)` calls MUST return `true`. The store is keyed
 * by Stripe event id (`evt_…`) — unique per event-delivery instance.
 */
export interface IdempotencyStore {
  /** Has this event id already been processed? */
  readonly seen: (eventId: string) => Promise<boolean>;
  /** Mark this event id as processed. Idempotent. */
  readonly markSeen: (eventId: string) => Promise<void>;
}

/** Bounded in-memory implementation suitable for tests + dev. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly seenIds = new Set<string>();

  readonly seen = async (eventId: string): Promise<boolean> => {
    if (typeof eventId !== 'string' || eventId.length === 0) {
      return false;
    }
    return this.seenIds.has(eventId);
  };

  readonly markSeen = async (eventId: string): Promise<void> => {
    if (typeof eventId !== 'string' || eventId.length === 0) {
      return;
    }
    this.seenIds.add(eventId);
  };

  /** Test-only — number of distinct event ids recorded. */
  readonly _sizeForTestOnly = (): number => {
    return this.seenIds.size;
  };
}
