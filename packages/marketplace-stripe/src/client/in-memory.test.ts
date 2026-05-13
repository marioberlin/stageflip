// packages/marketplace-stripe/src/client/in-memory.test.ts
// T-537 — InMemoryStripeClient round-trip + invariants.

import { describe, expect, it } from 'vitest';

import { InMemoryStripeClient } from './in-memory.js';

describe('InMemoryStripeClient', () => {
  it('createCheckoutSession returns a session with monotonic id', async () => {
    const c = new InMemoryStripeClient();
    const s1 = await c.createCheckoutSession({
      priceId: 'price_news_pro_1y',
      customerId: 'cus_abc',
      metadata: { tenantId: 't1', sku: 'news-pro-1y' },
      successUrl: 'https://app.stageflip.dev/marketplace/success',
      cancelUrl: 'https://app.stageflip.dev/marketplace/cancel',
    });
    const s2 = await c.createCheckoutSession({
      priceId: 'price_frontier_fx_1y',
      customerId: 'cus_abc',
      metadata: { tenantId: 't1', sku: 'frontier-fx-1y' },
      successUrl: 'https://app.stageflip.dev/marketplace/success',
      cancelUrl: 'https://app.stageflip.dev/marketplace/cancel',
    });
    expect(s1.id).toBe('cs_test_1');
    expect(s2.id).toBe('cs_test_2');
    expect(s1.url).toBe('inmem://stripe/checkout/cs_test_1');
  });

  it('createCheckoutSession threads metadata + priceId + customerId', async () => {
    const c = new InMemoryStripeClient();
    const s = await c.createCheckoutSession({
      priceId: 'price_xyz',
      customerId: 'cus_xyz',
      metadata: { foo: 'bar', baz: 'quux' },
      successUrl: 'https://example.com/ok',
      cancelUrl: 'https://example.com/no',
    });
    expect(s.priceId).toBe('price_xyz');
    expect(s.customerId).toBe('cus_xyz');
    expect(s.metadata).toEqual({ foo: 'bar', baz: 'quux' });
  });

  it('createCheckoutSession rejects non-https successUrl', async () => {
    const c = new InMemoryStripeClient();
    await expect(
      c.createCheckoutSession({
        priceId: 'p',
        customerId: 'c',
        metadata: {},
        successUrl: 'http://insecure.example.com/ok',
        cancelUrl: 'https://example.com/no',
      }),
    ).rejects.toThrow(/successUrl/);
  });

  it('createCheckoutSession rejects non-https cancelUrl', async () => {
    const c = new InMemoryStripeClient();
    await expect(
      c.createCheckoutSession({
        priceId: 'p',
        customerId: 'c',
        metadata: {},
        successUrl: 'https://example.com/ok',
        cancelUrl: 'ftp://example.com/no',
      }),
    ).rejects.toThrow(/cancelUrl/);
  });

  it('retrieveSubscription returns null for unknown id', async () => {
    const c = new InMemoryStripeClient();
    const r = await c.retrieveSubscription('sub_never_seen');
    expect(r).toBeNull();
  });

  it('retrieveSubscription returns seeded subscription', async () => {
    const c = new InMemoryStripeClient({
      subscriptions: [
        {
          id: 'sub_abc',
          status: 'active',
          currentPeriodEnd: 1_800_000_000,
          customerId: 'cus_abc',
          priceId: 'price_news_pro_1y',
        },
      ],
    });
    const r = await c.retrieveSubscription('sub_abc');
    expect(r).not.toBeNull();
    expect(r?.status).toBe('active');
    expect(r?.currentPeriodEnd).toBe(1_800_000_000);
    expect(r?.items).toEqual([{ priceId: 'price_news_pro_1y' }]);
  });

  it('_setSubscriptionForTestOnly mutates state visible via retrieveSubscription', async () => {
    const c = new InMemoryStripeClient();
    c._setSubscriptionForTestOnly({
      id: 'sub_xyz',
      status: 'past_due',
      currentPeriodEnd: 0,
      customerId: 'cus_xyz',
      items: [{ priceId: 'price_xyz' }],
    });
    const r = await c.retrieveSubscription('sub_xyz');
    expect(r?.status).toBe('past_due');
  });

  it('_allSessionsForTestOnly lists every created session in order', async () => {
    const c = new InMemoryStripeClient();
    await c.createCheckoutSession({
      priceId: 'p1',
      customerId: 'c1',
      metadata: {},
      successUrl: 'https://example.com/ok',
      cancelUrl: 'https://example.com/no',
    });
    await c.createCheckoutSession({
      priceId: 'p2',
      customerId: 'c1',
      metadata: {},
      successUrl: 'https://example.com/ok',
      cancelUrl: 'https://example.com/no',
    });
    const all = c._allSessionsForTestOnly();
    expect(all.length).toBe(2);
    expect(all[0]?.id).toBe('cs_test_1');
    expect(all[1]?.id).toBe('cs_test_2');
  });
});
