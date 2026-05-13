// packages/marketplace-stripe/src/entitlements/transitions.ts
// T-537 — `TenantEntitlement` state-machine helpers per ADR-013 §D4.
// Lifecycle:
//   pending → active → lapsed → revoked
//   lapsed → active (resubscribe)
// The webhook layer asks "given current status X, what does Stripe
// event E imply?" — `nextStatus` answers; `assertTransition` enforces
// the allowed-edges set.
//
// Determinism perimeter: outside (server-side).

/**
 * Entitlement-status union mirrored from
 * `@stageflip/pack-loader` / ADR-013 §D4. Duplicated here to keep
 * the package dep-free; both definitions are kept in sync.
 */
export type EntitlementStatus = 'pending' | 'active' | 'lapsed' | 'revoked';

/** Stripe-event-derived intent the webhook layer dispatches into transitions. */
export type TransitionIntent =
  | 'checkout-completed' // → active
  | 'subscription-renewed' // → active (lapsed → active resubscribe path)
  | 'subscription-past-due' // → lapsed (grace window starts upstream; we mark lapsed at expiry)
  | 'subscription-canceled' // → revoked
  | 'payment-failed-final'; // → lapsed

/**
 * Compute the next status for `current` given `intent`. Returns
 * `null` when the transition is not allowed (caller should keep
 * `current` and surface an audit log entry).
 *
 * Allowed edges (per ADR-013 §D4 + §D10):
 *   pending  --checkout-completed-->        active
 *   active   --subscription-past-due-->     lapsed
 *   active   --payment-failed-final-->      lapsed
 *   active   --subscription-canceled-->     revoked
 *   lapsed   --subscription-renewed-->      active
 *   lapsed   --subscription-canceled-->     revoked
 *   <any>    --subscription-canceled-->     revoked (terminal)
 *
 * `revoked` is terminal — no transitions out.
 */
export function nextStatus(
  current: EntitlementStatus,
  intent: TransitionIntent,
): EntitlementStatus | null {
  if (current === 'revoked') {
    // Terminal — no further transitions.
    return null;
  }
  switch (intent) {
    case 'checkout-completed':
      // Only `pending` legitimately upgrades to active via a fresh
      // checkout. Re-checkouts against an already-active entitlement
      // are dedup'd by the webhook idempotency layer, not here.
      if (current === 'pending') {
        return 'active';
      }
      return null;
    case 'subscription-renewed':
      // Resubscribe path: a lapsed entitlement returns to active when
      // the customer renews. Idempotent for already-active.
      if (current === 'lapsed') {
        return 'active';
      }
      if (current === 'active') {
        return 'active';
      }
      return null;
    case 'subscription-past-due':
    case 'payment-failed-final':
      if (current === 'active') {
        return 'lapsed';
      }
      return null;
    case 'subscription-canceled':
      // Cancellation is allowed from any non-terminal state.
      return 'revoked';
  }
}

/**
 * Hard-asserting wrapper around {@link nextStatus} — throws when the
 * transition is illegal. Use in code paths that already validated the
 * intent upstream.
 */
export function assertTransition(
  current: EntitlementStatus,
  intent: TransitionIntent,
): EntitlementStatus {
  const next = nextStatus(current, intent);
  if (next === null) {
    throw new Error(`illegal entitlement transition: ${current} -- ${intent} -->`);
  }
  return next;
}
