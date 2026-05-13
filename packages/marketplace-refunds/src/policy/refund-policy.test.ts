// packages/marketplace-refunds/src/policy/refund-policy.test.ts
// T-545 — `RefundPolicy` + `DEFAULT_REFUND_POLICY` tests.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FULL_REFUND_WINDOW_DAYS,
  DEFAULT_NO_REFUND_AFTER_DAYS,
  DEFAULT_PRO_RATA_REFUND_WINDOW_DAYS,
  DEFAULT_REFUND_POLICY,
} from './refund-policy.js';

describe('DEFAULT_REFUND_POLICY', () => {
  it('exposes the four policy fields with the documented defaults', () => {
    expect(DEFAULT_REFUND_POLICY).toEqual({
      fullRefundWindowDays: 7,
      proRataRefundWindowDays: 30,
      noRefundAfterDays: 60,
      preserveEntitlementForPartial: true,
    });
  });

  it('window constants match the policy defaults', () => {
    expect(DEFAULT_FULL_REFUND_WINDOW_DAYS).toBe(7);
    expect(DEFAULT_PRO_RATA_REFUND_WINDOW_DAYS).toBe(30);
    expect(DEFAULT_NO_REFUND_AFTER_DAYS).toBe(60);
    expect(DEFAULT_REFUND_POLICY.fullRefundWindowDays).toBe(DEFAULT_FULL_REFUND_WINDOW_DAYS);
    expect(DEFAULT_REFUND_POLICY.proRataRefundWindowDays).toBe(DEFAULT_PRO_RATA_REFUND_WINDOW_DAYS);
    expect(DEFAULT_REFUND_POLICY.noRefundAfterDays).toBe(DEFAULT_NO_REFUND_AFTER_DAYS);
  });

  it('window ordering is monotonically increasing (full < pro-rata < cutoff)', () => {
    expect(DEFAULT_REFUND_POLICY.fullRefundWindowDays).toBeLessThan(
      DEFAULT_REFUND_POLICY.proRataRefundWindowDays,
    );
    expect(DEFAULT_REFUND_POLICY.proRataRefundWindowDays).toBeLessThanOrEqual(
      DEFAULT_REFUND_POLICY.noRefundAfterDays,
    );
  });

  it('preserveEntitlementForPartial defaults to true (partial = goodwill credit)', () => {
    expect(DEFAULT_REFUND_POLICY.preserveEntitlementForPartial).toBe(true);
  });
});
