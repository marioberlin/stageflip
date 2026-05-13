// packages/marketplace-refunds/src/refunds/request.test.ts
// T-545 — `processRefund` decision-table tests.

import { describe, expect, it } from 'vitest';
import { DEFAULT_REFUND_POLICY, type RefundPolicy } from '../policy/refund-policy.js';
import { type RefundRequest, processRefund } from './request.js';

const CHARGE_AT = '2026-01-01T00:00:00.000Z';

function requestAt(opts: {
  daysAfterCharge: number;
  reason?: RefundRequest['reason'];
  amountCents?: number;
}): RefundRequest {
  const requestedMs = Date.parse(CHARGE_AT) + opts.daysAfterCharge * 86_400_000;
  return {
    tenantId: 'tenant-1',
    sku: 'sku.news.pro',
    chargeId: 'ch_test_1',
    amountCents: opts.amountCents ?? 1000,
    reason: opts.reason ?? 'tenant-cancellation',
    requestedAt: new Date(requestedMs).toISOString(),
  };
}

describe('processRefund', () => {
  it('full refund within fullRefundWindowDays → approved-full + revoke', () => {
    const decision = processRefund(
      requestAt({ daysAfterCharge: 3 }),
      DEFAULT_REFUND_POLICY,
      CHARGE_AT,
    );
    expect(decision).toEqual({
      kind: 'approved-full',
      refundAmountCents: 1000,
      entitlementAction: 'revoke',
    });
  });

  it('exactly at fullRefundWindowDays boundary → approved-full', () => {
    const decision = processRefund(
      requestAt({ daysAfterCharge: 7 }),
      DEFAULT_REFUND_POLICY,
      CHARGE_AT,
    );
    expect(decision.kind).toBe('approved-full');
  });

  it('after full window, inside pro-rata window → approved-partial + preserve', () => {
    // 14 days after charge: pro-rata fraction = 1 - 14/30 = 0.5333…
    const decision = processRefund(
      requestAt({ daysAfterCharge: 14 }),
      DEFAULT_REFUND_POLICY,
      CHARGE_AT,
    );
    expect(decision.kind).toBe('approved-partial');
    if (decision.kind !== 'approved-partial') return;
    // Math.round(1000 * 0.5333…) = 533.
    expect(decision.refundAmountCents).toBe(533);
    expect(decision.entitlementAction).toBe('preserve');
  });

  it('preserveEntitlementForPartial=false → approved-partial + revoke', () => {
    const policy: RefundPolicy = { ...DEFAULT_REFUND_POLICY, preserveEntitlementForPartial: false };
    const decision = processRefund(requestAt({ daysAfterCharge: 14 }), policy, CHARGE_AT);
    expect(decision.kind).toBe('approved-partial');
    if (decision.kind !== 'approved-partial') return;
    expect(decision.entitlementAction).toBe('revoke');
  });

  it('past pro-rata window but inside cutoff → denied (outside-refund-window)', () => {
    // 45 days: > 30-day pro-rata window, ≤ 60-day cutoff → denied.
    const decision = processRefund(
      requestAt({ daysAfterCharge: 45 }),
      DEFAULT_REFUND_POLICY,
      CHARGE_AT,
    );
    expect(decision).toEqual({ kind: 'denied', reason: 'outside-refund-window' });
  });

  it('past noRefundAfterDays cutoff → denied (outside-refund-window)', () => {
    const decision = processRefund(
      requestAt({ daysAfterCharge: 90 }),
      DEFAULT_REFUND_POLICY,
      CHARGE_AT,
    );
    expect(decision).toEqual({ kind: 'denied', reason: 'outside-refund-window' });
  });

  it('admin-override always approved-full + preserve regardless of window', () => {
    const decision = processRefund(
      requestAt({ daysAfterCharge: 365, reason: 'admin-override' }),
      DEFAULT_REFUND_POLICY,
      CHARGE_AT,
    );
    expect(decision).toEqual({
      kind: 'approved-full',
      refundAmountCents: 1000,
      entitlementAction: 'preserve',
    });
  });

  it('support-resolution respects policy windows (not a bypass)', () => {
    const decision = processRefund(
      requestAt({ daysAfterCharge: 90, reason: 'support-resolution' }),
      DEFAULT_REFUND_POLICY,
      CHARGE_AT,
    );
    expect(decision.kind).toBe('denied');
  });

  it('non-positive amount → denied (non-positive-amount)', () => {
    const decision = processRefund(
      requestAt({ daysAfterCharge: 1, amountCents: 0 }),
      DEFAULT_REFUND_POLICY,
      CHARGE_AT,
    );
    expect(decision).toEqual({ kind: 'denied', reason: 'non-positive-amount' });
  });

  it('negative amount → denied (non-positive-amount)', () => {
    const decision = processRefund(
      requestAt({ daysAfterCharge: 1, amountCents: -100 }),
      DEFAULT_REFUND_POLICY,
      CHARGE_AT,
    );
    expect(decision).toEqual({ kind: 'denied', reason: 'non-positive-amount' });
  });

  it('request before charge → denied (request-before-charge)', () => {
    const decision = processRefund(
      requestAt({ daysAfterCharge: -2 }),
      DEFAULT_REFUND_POLICY,
      CHARGE_AT,
    );
    expect(decision).toEqual({ kind: 'denied', reason: 'request-before-charge' });
  });

  it('malformed requestedAt → denied (malformed-timestamp)', () => {
    const request: RefundRequest = {
      tenantId: 'tenant-1',
      sku: 'sku.news.pro',
      chargeId: 'ch_x',
      amountCents: 1000,
      reason: 'tenant-cancellation',
      requestedAt: 'not-a-date',
    };
    const decision = processRefund(request, DEFAULT_REFUND_POLICY, CHARGE_AT);
    expect(decision).toEqual({ kind: 'denied', reason: 'malformed-timestamp' });
  });

  it('malformed chargeAt → denied (malformed-timestamp)', () => {
    const decision = processRefund(
      requestAt({ daysAfterCharge: 1 }),
      DEFAULT_REFUND_POLICY,
      'not-a-date',
    );
    expect(decision).toEqual({ kind: 'denied', reason: 'malformed-timestamp' });
  });

  it('custom policy with shorter full window applies correctly', () => {
    const policy: RefundPolicy = { ...DEFAULT_REFUND_POLICY, fullRefundWindowDays: 1 };
    // 3 days after charge: outside 1-day full window → partial.
    const decision = processRefund(requestAt({ daysAfterCharge: 3 }), policy, CHARGE_AT);
    expect(decision.kind).toBe('approved-partial');
  });

  it('pro-rata exactly at boundary returns ~zero refund and denies', () => {
    // 30 days exactly: fraction = 1 - 30/30 = 0; round(1000*0) = 0
    // → pro-rata-zero denial.
    const decision = processRefund(
      requestAt({ daysAfterCharge: 30 }),
      DEFAULT_REFUND_POLICY,
      CHARGE_AT,
    );
    expect(decision).toEqual({ kind: 'denied', reason: 'pro-rata-zero' });
  });
});
