// packages/marketplace-refunds/src/disputes/handler.test.ts
// T-545 — `handleDispute` decision-table tests.

import { describe, expect, it } from 'vitest';
import { DEFAULT_REFUND_POLICY } from '../policy/refund-policy.js';
import {
  type DisputeEvent,
  type DisputeReason,
  type DisputeStatus,
  handleDispute,
} from './handler.js';

function eventOf(status: DisputeStatus, reason: DisputeReason = 'general'): DisputeEvent {
  return {
    id: 'dp_test_1',
    chargeId: 'ch_test_1',
    tenantId: 'tenant-1',
    sku: 'sku.news.pro',
    amountCents: 5000,
    status,
    reason,
    createdAt: '2026-05-14T09:00:00.000Z',
  };
}

describe('handleDispute', () => {
  it('needs_response → submit-evidence + preserve', () => {
    const action = handleDispute(eventOf('needs_response', 'fraudulent'), DEFAULT_REFUND_POLICY);
    expect(action.kind).toBe('submit-evidence');
    expect(action.entitlementAction).toBe('preserve');
    expect(action.reason).toBe('dispute-fraudulent');
  });

  it('needs_response with subscription_canceled reason → submit-evidence', () => {
    const action = handleDispute(
      eventOf('needs_response', 'subscription_canceled'),
      DEFAULT_REFUND_POLICY,
    );
    expect(action.kind).toBe('submit-evidence');
    expect(action.reason).toBe('dispute-subscription_canceled');
  });

  it('under_review → wait + preserve', () => {
    const action = handleDispute(eventOf('under_review'), DEFAULT_REFUND_POLICY);
    expect(action.kind).toBe('wait');
    expect(action.entitlementAction).toBe('preserve');
    expect(action.reason).toBe('awaiting-stripe-review');
  });

  it('won → wait + preserve (no action needed)', () => {
    const action = handleDispute(eventOf('won'), DEFAULT_REFUND_POLICY);
    expect(action.kind).toBe('wait');
    expect(action.entitlementAction).toBe('preserve');
    expect(action.reason).toBe('dispute-won');
  });

  it('lost → accept-loss + revoke', () => {
    const action = handleDispute(eventOf('lost', 'product_not_received'), DEFAULT_REFUND_POLICY);
    expect(action.kind).toBe('accept-loss');
    expect(action.entitlementAction).toBe('revoke');
    expect(action.reason).toBe('dispute-lost-product_not_received');
  });

  it('lost with general reason emits dispute-lost-general', () => {
    const action = handleDispute(eventOf('lost', 'general'), DEFAULT_REFUND_POLICY);
    expect(action.kind).toBe('accept-loss');
    expect(action.reason).toBe('dispute-lost-general');
  });

  it('preserves entitlement across all non-terminal statuses', () => {
    for (const status of ['needs_response', 'under_review', 'won'] as const) {
      const action = handleDispute(eventOf(status), DEFAULT_REFUND_POLICY);
      expect(action.entitlementAction).toBe('preserve');
    }
  });

  it('reason taxonomy is surfaced in the action reason for needs_response', () => {
    const reasons: DisputeReason[] = [
      'fraudulent',
      'duplicate',
      'subscription_canceled',
      'product_not_received',
      'product_unacceptable',
      'unrecognized',
      'credit_not_processed',
      'general',
    ];
    for (const r of reasons) {
      const action = handleDispute(eventOf('needs_response', r), DEFAULT_REFUND_POLICY);
      expect(action.reason).toBe(`dispute-${r}`);
    }
  });

  it('policy argument does not currently affect output (forward-compat shim)', () => {
    const action1 = handleDispute(eventOf('needs_response'), DEFAULT_REFUND_POLICY);
    const action2 = handleDispute(eventOf('needs_response'), {
      ...DEFAULT_REFUND_POLICY,
      preserveEntitlementForPartial: false,
    });
    expect(action1).toEqual(action2);
  });
});
