// packages/marketplace-refunds/src/disputes/handler.ts
// T-545 — `handleDispute` is the pure decision function for
// Stripe-initiated dispute (chargeback) events. The handler maps a
// `DisputeEvent.status` + `reason` onto the recommended `DisputeAction`
// the deployment layer (T-550) executes: submit evidence to Stripe,
// accept the loss (and revoke entitlement), or wait for Stripe to
// progress the case.
//
// The handler is pure. It consumes the configured `RefundPolicy` so
// callers can switch entitlement-protection behaviour across
// deployments, but does NOT touch Stripe or the entitlement store.
//
// Determinism perimeter: outside (server-side).

import type { RefundPolicy } from '../policy/refund-policy.js';

/**
 * Mirrors Stripe's dispute-status union (with our slim subset). The
 * deployment layer's webhook adapter maps the raw Stripe enum onto
 * this; we keep the union closed so the handler's switch is
 * exhaustive.
 */
export type DisputeStatus = 'needs_response' | 'under_review' | 'won' | 'lost';

/** Stripe's dispute-reason enum, slim subset per ADR-013 §D11. */
export type DisputeReason =
  | 'fraudulent'
  | 'duplicate'
  | 'subscription_canceled'
  | 'product_not_received'
  | 'product_unacceptable'
  | 'unrecognized'
  | 'credit_not_processed'
  | 'general';

/**
 * A single Stripe-initiated dispute event. The deployment layer
 * constructs this from a Stripe webhook payload before invoking the
 * handler.
 */
export interface DisputeEvent {
  readonly id: string;
  readonly chargeId: string;
  readonly tenantId: string;
  readonly sku: string;
  readonly amountCents: number;
  readonly status: DisputeStatus;
  readonly reason: DisputeReason;
  readonly createdAt: string;
}

/**
 * Recommended response to a dispute event.
 *
 * - `'submit-evidence'`: assemble the evidence package via
 *   `buildDisputeEvidence` and POST to Stripe. The entitlement is
 *   preserved while the case is active — revoking before a verdict
 *   would punish a tenant who might still win.
 * - `'accept-loss'`: Stripe ruled against us. The deployment layer
 *   revokes the entitlement and books the refund through the
 *   `RefundLedger`.
 * - `'wait'`: Stripe still owns the next move (`under_review` /
 *   `won`). The entitlement is left alone.
 */
export interface DisputeAction {
  readonly kind: 'submit-evidence' | 'accept-loss' | 'wait';
  readonly entitlementAction?: 'preserve' | 'pause' | 'revoke';
  readonly reason: string;
}

/**
 * Decision table:
 *
 *   status=needs_response  → submit-evidence + preserve
 *   status=under_review    → wait + preserve
 *   status=won             → wait + preserve  (Stripe found in our favour)
 *   status=lost            → accept-loss + revoke
 *
 * The `reason` field surfaces the dispute-reason taxonomy so the
 * deployment layer can route to specialised evidence builders (e.g.
 * `subscription_canceled` may want billing-history docs while
 * `product_not_received` may want activation telemetry).
 *
 * The current implementation ignores `policy` — the field is
 * accepted so future tuning (e.g. "pause entitlement on
 * needs_response for high-risk skus") can ship without a public-
 * surface change.
 */
export function handleDispute(event: DisputeEvent, _policy: RefundPolicy): DisputeAction {
  switch (event.status) {
    case 'needs_response':
      return {
        kind: 'submit-evidence',
        entitlementAction: 'preserve',
        reason: `dispute-${event.reason}`,
      };
    case 'under_review':
      return {
        kind: 'wait',
        entitlementAction: 'preserve',
        reason: 'awaiting-stripe-review',
      };
    case 'won':
      return {
        kind: 'wait',
        entitlementAction: 'preserve',
        reason: 'dispute-won',
      };
    case 'lost':
      return {
        kind: 'accept-loss',
        entitlementAction: 'revoke',
        reason: `dispute-lost-${event.reason}`,
      };
  }
}
