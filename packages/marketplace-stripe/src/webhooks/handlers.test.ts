// packages/marketplace-stripe/src/webhooks/handlers.test.ts
// T-537 — Event-to-mutation translation for the four Stripe events
// the marketplace cares about.

import { describe, expect, it } from 'vitest';

import { FIRST_PARTY_SKU_MAP, createSkuMap } from '../pricing/sku-map.js';
import type { WebhookEvent } from './handlers.js';
import { handleWebhookEvent } from './handlers.js';

const SKU_MAP = createSkuMap([
  { sku: 'news-pro-1y', priceId: 'price_news_pro_1y', tier: 'paid-per-tenant' },
  { sku: 'finance-1y', priceId: 'price_finance_1y', tier: 'paid-per-tenant' },
]);

function ev(type: string, object: unknown, id = 'evt_test_1'): WebhookEvent {
  return { id, type, data: { object } };
}

describe('handleWebhookEvent — checkout.session.completed', () => {
  it('returns active mutation with sku + tenantId from metadata', () => {
    const e = ev('checkout.session.completed', {
      mode: 'subscription',
      subscription: 'sub_abc',
      customer: 'cus_abc',
      metadata: { tenantId: 'tenant-1', sku: 'news-pro-1y' },
    });
    const m = handleWebhookEvent(e, SKU_MAP);
    expect(m).not.toBeNull();
    expect(m?.sku).toBe('news-pro-1y');
    expect(m?.tenantId).toBe('tenant-1');
    expect(m?.newStatus).toBe('active');
  });

  it('returns null when metadata.tenantId is missing', () => {
    const e = ev('checkout.session.completed', {
      metadata: { sku: 'news-pro-1y' },
    });
    expect(handleWebhookEvent(e, SKU_MAP)).toBeNull();
  });

  it('returns null when metadata is absent entirely', () => {
    const e = ev('checkout.session.completed', { mode: 'subscription' });
    expect(handleWebhookEvent(e, SKU_MAP)).toBeNull();
  });
});

describe('handleWebhookEvent — customer.subscription.updated', () => {
  it('past_due → lapsed', () => {
    const e = ev('customer.subscription.updated', {
      id: 'sub_abc',
      status: 'past_due',
      metadata: { tenantId: 'tenant-1', sku: 'news-pro-1y' },
      items: { data: [{ price: { id: 'price_news_pro_1y' } }] },
    });
    const m = handleWebhookEvent(e, SKU_MAP);
    expect(m?.newStatus).toBe('lapsed');
    expect(m?.sku).toBe('news-pro-1y');
    expect(m?.tenantId).toBe('tenant-1');
  });

  it('active → active mutation with expiresAt from current_period_end', () => {
    const e = ev('customer.subscription.updated', {
      id: 'sub_abc',
      status: 'active',
      metadata: { tenantId: 'tenant-1', sku: 'news-pro-1y' },
      current_period_end: 1_800_000_000,
      items: { data: [{ price: { id: 'price_news_pro_1y' } }] },
    });
    const m = handleWebhookEvent(e, SKU_MAP);
    expect(m?.newStatus).toBe('active');
    expect(m?.expiresAt).toBe(new Date(1_800_000_000 * 1000).toISOString());
  });

  it('canceled → revoked', () => {
    const e = ev('customer.subscription.updated', {
      id: 'sub_abc',
      status: 'canceled',
      metadata: { tenantId: 'tenant-1', sku: 'finance-1y' },
    });
    const m = handleWebhookEvent(e, SKU_MAP);
    expect(m?.newStatus).toBe('revoked');
    expect(m?.sku).toBe('finance-1y');
  });

  it('incomplete returns null (pending stays pending)', () => {
    const e = ev('customer.subscription.updated', {
      id: 'sub_abc',
      status: 'incomplete',
      metadata: { tenantId: 'tenant-1', sku: 'finance-1y' },
    });
    expect(handleWebhookEvent(e, SKU_MAP)).toBeNull();
  });

  it('falls back to priceId reverse-lookup when metadata.sku is absent', () => {
    const e = ev('customer.subscription.updated', {
      id: 'sub_abc',
      status: 'past_due',
      metadata: { tenantId: 'tenant-1' },
      items: { data: [{ price: { id: 'price_news_pro_1y' } }] },
    });
    const m = handleWebhookEvent(e, SKU_MAP);
    expect(m?.sku).toBe('news-pro-1y');
    expect(m?.newStatus).toBe('lapsed');
  });
});

describe('handleWebhookEvent — customer.subscription.deleted', () => {
  it('emits revoked mutation', () => {
    const e = ev('customer.subscription.deleted', {
      id: 'sub_abc',
      status: 'canceled',
      metadata: { tenantId: 'tenant-1', sku: 'news-pro-1y' },
    });
    const m = handleWebhookEvent(e, SKU_MAP);
    expect(m?.newStatus).toBe('revoked');
    expect(m?.sku).toBe('news-pro-1y');
  });

  it('returns null when tenantId is missing', () => {
    const e = ev('customer.subscription.deleted', {
      id: 'sub_abc',
      metadata: { sku: 'news-pro-1y' },
    });
    expect(handleWebhookEvent(e, SKU_MAP)).toBeNull();
  });
});

describe('handleWebhookEvent — invoice.payment_failed', () => {
  it('lapsed on FINAL failure (no next_payment_attempt)', () => {
    const e = ev('invoice.payment_failed', {
      metadata: { tenantId: 'tenant-1', sku: 'news-pro-1y' },
      attempt_count: 4,
      next_payment_attempt: null,
    });
    const m = handleWebhookEvent(e, SKU_MAP);
    expect(m?.newStatus).toBe('lapsed');
    expect(m?.sku).toBe('news-pro-1y');
  });

  it('returns null mid-dunning (next_payment_attempt present)', () => {
    const e = ev('invoice.payment_failed', {
      metadata: { tenantId: 'tenant-1', sku: 'news-pro-1y' },
      attempt_count: 1,
      next_payment_attempt: 1_800_000_000,
    });
    expect(handleWebhookEvent(e, SKU_MAP)).toBeNull();
  });
});

describe('handleWebhookEvent — unknown / malformed', () => {
  it('returns null for unknown event type', () => {
    const e = ev('customer.created', { id: 'cus_abc' });
    expect(handleWebhookEvent(e, SKU_MAP)).toBeNull();
  });

  it('returns null for malformed event (missing data.object)', () => {
    const malformed = {
      id: 'evt_x',
      type: 'checkout.session.completed',
    } as unknown as WebhookEvent;
    expect(handleWebhookEvent(malformed, SKU_MAP)).toBeNull();
  });

  it('returns null for malformed event (missing id)', () => {
    const malformed = {
      type: 'checkout.session.completed',
      data: { object: {} },
    } as unknown as WebhookEvent;
    expect(handleWebhookEvent(malformed, SKU_MAP)).toBeNull();
  });
});

describe('handleWebhookEvent — FIRST_PARTY_SKU_MAP integration', () => {
  it('resolves every first-party sku end-to-end', () => {
    const m = createSkuMap(FIRST_PARTY_SKU_MAP);
    for (const entry of FIRST_PARTY_SKU_MAP) {
      const e = ev('checkout.session.completed', {
        metadata: { tenantId: 'tenant-x', sku: entry.sku },
      });
      const out = handleWebhookEvent(e, m);
      expect(out?.sku).toBe(entry.sku);
      expect(out?.newStatus).toBe('active');
    }
  });
});
