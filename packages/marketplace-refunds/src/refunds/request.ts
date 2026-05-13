// packages/marketplace-refunds/src/refunds/request.ts
// T-545 — `processRefund` is the pure decision function for
// tenant-initiated refund requests. Given a `RefundRequest`, the
// configured `RefundPolicy`, and the original charge timestamp, it
// returns a `RefundDecision` the deployment layer (T-550) executes
// against Stripe + the entitlement store.
//
// The processor knows nothing about Stripe or async I/O. Callers
// resolve the original-charge timestamp upstream (typically from
// the entitlement-history record that booked the charge) and feed
// it in as `chargeAt`.
//
// Determinism perimeter: outside (server-side).

import type { RefundPolicy } from '../policy/refund-policy.js';

/**
 * Reason a refund was requested. Drives the policy override path —
 * `'admin-override'` always approves a full refund regardless of
 * window; the other two consult the policy windows.
 *
 * - `'tenant-cancellation'`: the tenant cancelled their subscription
 *   or removed the pack and asked for a refund.
 * - `'support-resolution'`: support agent resolved a defect/quality
 *   issue and authorised the refund. Still consults the policy
 *   window — agents needing to override go through `'admin-override'`.
 * - `'admin-override'`: an authorised admin forced a full refund.
 *   Bypasses all window checks. Used for legal/regulatory escalations.
 */
export type RefundReason = 'tenant-cancellation' | 'support-resolution' | 'admin-override';

/**
 * A single refund request. ISO 8601 timestamps are passed as
 * strings to keep the public surface dep-free; the processor parses
 * via `Date.parse` and rejects malformed inputs as `denied`.
 */
export interface RefundRequest {
  readonly tenantId: string;
  readonly sku: string;
  readonly chargeId: string;
  readonly amountCents: number;
  readonly reason: RefundReason;
  readonly requestedAt: string; // ISO 8601
}

/**
 * The processor's verdict.
 *
 * - `'approved-full'`: refund the entire `amountCents`. The
 *   `entitlementAction` is `'revoke'` for tenant-cancellation /
 *   support-resolution (the tenant got their money back, they lose
 *   access) and `'preserve'` for `'admin-override'` (admin-driven
 *   refunds are usually goodwill credits that don't revoke access).
 * - `'approved-partial'`: refund a pro-rated `refundAmountCents`
 *   (≤ `amountCents`). The `entitlementAction` is determined by
 *   `policy.preserveEntitlementForPartial`.
 * - `'denied'`: no refund. The `reason` field carries the
 *   policy-level reason ("outside-refund-window", "non-positive-
 *   amount", etc).
 */
export type RefundDecision =
  | {
      readonly kind: 'approved-full';
      readonly refundAmountCents: number;
      readonly entitlementAction: 'revoke' | 'preserve';
    }
  | {
      readonly kind: 'approved-partial';
      readonly refundAmountCents: number;
      readonly entitlementAction: 'revoke' | 'preserve';
    }
  | { readonly kind: 'denied'; readonly reason: string };

const MS_PER_DAY = 86_400_000;

/**
 * Compute the refund decision.
 *
 * Decision table:
 *
 *   amountCents ≤ 0                       → denied ("non-positive-amount")
 *   reason='admin-override'               → approved-full + preserve
 *   reason in {'tenant-cancellation',
 *              'support-resolution'}:
 *     elapsedDays < 0                     → denied ("request-before-charge")
 *     elapsedDays ≤ fullWindow            → approved-full + revoke
 *     elapsedDays ≤ proRataWindow         → approved-partial (pro-rata) + (preserve | revoke)
 *     elapsedDays ≤ noRefundAfter         → approved-partial (residual) + (preserve | revoke)*
 *     elapsedDays > noRefundAfter         → denied ("outside-refund-window")
 *
 * (*) After the pro-rata window but before the cutoff, the pro-rata
 * fraction has already decayed to zero — the request lands as a
 * denial via the cutoff branch.
 */
export function processRefund(
  request: RefundRequest,
  policy: RefundPolicy,
  chargeAt: string,
): RefundDecision {
  if (!Number.isFinite(request.amountCents) || request.amountCents <= 0) {
    return { kind: 'denied', reason: 'non-positive-amount' };
  }

  if (request.reason === 'admin-override') {
    return {
      kind: 'approved-full',
      refundAmountCents: request.amountCents,
      entitlementAction: 'preserve',
    };
  }

  const requestedMs = Date.parse(request.requestedAt);
  const chargeMs = Date.parse(chargeAt);
  if (!Number.isFinite(requestedMs) || !Number.isFinite(chargeMs)) {
    return { kind: 'denied', reason: 'malformed-timestamp' };
  }

  const elapsedDays = (requestedMs - chargeMs) / MS_PER_DAY;

  if (elapsedDays < 0) {
    return { kind: 'denied', reason: 'request-before-charge' };
  }

  if (elapsedDays <= policy.fullRefundWindowDays) {
    return {
      kind: 'approved-full',
      refundAmountCents: request.amountCents,
      entitlementAction: 'revoke',
    };
  }

  if (elapsedDays > policy.noRefundAfterDays) {
    return { kind: 'denied', reason: 'outside-refund-window' };
  }

  if (elapsedDays > policy.proRataRefundWindowDays) {
    return { kind: 'denied', reason: 'outside-refund-window' };
  }

  // Pro-rata fraction = 1 - (elapsedDays / proRataRefundWindowDays).
  // Clamped to [0, 1]; rounded to nearest cent.
  const fraction = Math.max(0, Math.min(1, 1 - elapsedDays / policy.proRataRefundWindowDays));
  const refundAmountCents = Math.round(request.amountCents * fraction);

  if (refundAmountCents <= 0) {
    return { kind: 'denied', reason: 'pro-rata-zero' };
  }

  return {
    kind: 'approved-partial',
    refundAmountCents,
    entitlementAction: policy.preserveEntitlementForPartial ? 'preserve' : 'revoke',
  };
}
