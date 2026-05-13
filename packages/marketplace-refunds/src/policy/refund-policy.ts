// packages/marketplace-refunds/src/policy/refund-policy.ts
// T-545 — `RefundPolicy` declares the configurable refund-window
// rules consulted by the refund processor + dispute handler. Pure
// data; the processor in `../refunds/request.ts` interprets the
// policy fields against an event timestamp and returns a
// `RefundDecision`. Production deployments may inject a custom
// policy (e.g. tighter windows for partner skus, longer windows for
// enterprise) via the public surface; tests use the default.
//
// Determinism perimeter: outside (server-side).

/**
 * Refund policy knobs. All windows are measured in days from the
 * original charge timestamp; the processor compares the request
 * timestamp against the charge timestamp to bucket a request into
 * `full` / `pro-rata` / `denied`.
 *
 * Fields:
 * - `fullRefundWindowDays`: requests inside this window get a full
 *   refund + entitlement revoke.
 * - `proRataRefundWindowDays`: requests after `fullRefundWindowDays`
 *   but inside this window get a pro-rated partial refund. The
 *   pro-rata fraction is `1 - (elapsedDays / proRataRefundWindowDays)`
 *   clamped to [0, 1].
 * - `noRefundAfterDays`: requests after this many days are denied.
 *   Must be ≥ `proRataRefundWindowDays`.
 * - `preserveEntitlementForPartial`: if `true`, partial refunds
 *   leave the entitlement at `'active'`. If `false`, partial refunds
 *   revoke. Default `true` — partial refund is a goodwill credit;
 *   the tenant keeps access for the remaining covered period.
 */
export interface RefundPolicy {
  readonly fullRefundWindowDays: number;
  readonly proRataRefundWindowDays: number;
  readonly noRefundAfterDays: number;
  readonly preserveEntitlementForPartial: boolean;
}

/** Seven days — default full-refund window per ADR-013 §D11. */
export const DEFAULT_FULL_REFUND_WINDOW_DAYS = 7;

/** Thirty days — default pro-rata refund window per ADR-013 §D11. */
export const DEFAULT_PRO_RATA_REFUND_WINDOW_DAYS = 30;

/** Sixty days — default hard cutoff per ADR-013 §D11. */
export const DEFAULT_NO_REFUND_AFTER_DAYS = 60;

/**
 * Platform-default refund policy. Deployments inject a custom
 * config via the processor opts; tests use this constant directly.
 *
 * The defaults encode a "1 week → full, then 1 month → pro-rata,
 * then 2 months → cutoff" schedule that matches our published
 * marketplace terms.
 */
export const DEFAULT_REFUND_POLICY: RefundPolicy = {
  fullRefundWindowDays: DEFAULT_FULL_REFUND_WINDOW_DAYS,
  proRataRefundWindowDays: DEFAULT_PRO_RATA_REFUND_WINDOW_DAYS,
  noRefundAfterDays: DEFAULT_NO_REFUND_AFTER_DAYS,
  preserveEntitlementForPartial: true,
};
