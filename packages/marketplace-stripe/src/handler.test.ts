// packages/marketplace-stripe/src/handler.test.ts
// T-537 — composeWebhookHandler end-to-end (signature + idempotency +
// translation glued together).

import { describe, expect, it } from 'vitest';

import { composeWebhookHandler } from './handler.js';
import { createSkuMap } from './pricing/sku-map.js';
import { InMemoryIdempotencyStore } from './webhooks/idempotency.js';
import { _computeSignatureForTestOnly } from './webhooks/signature.js';

const SECRET = 'whsec_handler_test';
const SKU_MAP = createSkuMap([
  { sku: 'news-pro-1y', priceId: 'price_news_pro_1y', tier: 'paid-per-tenant' },
]);

function build() {
  const idempotency = new InMemoryIdempotencyStore();
  const handler = composeWebhookHandler({
    skuMap: SKU_MAP,
    idempotency,
    webhookSecret: SECRET,
  });
  return { idempotency, handler };
}

function signed(body: string, ts = '1700000000') {
  return _computeSignatureForTestOnly(body, ts, SECRET);
}

describe('composeWebhookHandler', () => {
  it('full happy path: valid sig + checkout.session.completed → 200 + mutation', async () => {
    const { handler } = build();
    const body = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { metadata: { tenantId: 'tenant-1', sku: 'news-pro-1y' } } },
    });
    const r = await handler({
      body,
      headers: { 'stripe-signature': signed(body) },
    });
    expect(r.status).toBe(200);
    expect(r.mutation?.newStatus).toBe('active');
    expect(r.mutation?.sku).toBe('news-pro-1y');
    expect(r.mutation?.tenantId).toBe('tenant-1');
  });

  it('duplicate event id short-circuits with 200 + no mutation', async () => {
    const { handler } = build();
    const body = JSON.stringify({
      id: 'evt_dup',
      type: 'checkout.session.completed',
      data: { object: { metadata: { tenantId: 'tenant-1', sku: 'news-pro-1y' } } },
    });
    const headers = { 'stripe-signature': signed(body) };
    const first = await handler({ body, headers });
    expect(first.status).toBe(200);
    expect(first.mutation).toBeDefined();
    const second = await handler({ body, headers });
    expect(second.status).toBe(200);
    expect(second.mutation).toBeUndefined();
  });

  it('invalid signature returns 400', async () => {
    const { handler } = build();
    const body = JSON.stringify({
      id: 'evt_bad_sig',
      type: 'checkout.session.completed',
      data: { object: {} },
    });
    const r = await handler({
      body,
      headers: { 'stripe-signature': 't=1700000000,v1=deadbeef' },
    });
    expect(r.status).toBe(400);
    expect(r.reason).toMatch(/signature/);
  });

  it('missing signature header returns 400', async () => {
    const { handler } = build();
    const body = '{}';
    const r = await handler({ body, headers: {} });
    expect(r.status).toBe(400);
    expect(r.reason).toMatch(/missing-stripe-signature/);
  });

  it('non-JSON body returns 400', async () => {
    const { handler } = build();
    const body = 'not-json-at-all';
    const r = await handler({
      body,
      headers: { 'stripe-signature': signed(body) },
    });
    expect(r.status).toBe(400);
    expect(r.reason).toBe('body-not-json');
  });

  it('valid JSON missing id/type fields returns 400', async () => {
    const { handler } = build();
    const body = JSON.stringify({ foo: 'bar' });
    const r = await handler({
      body,
      headers: { 'stripe-signature': signed(body) },
    });
    expect(r.status).toBe(400);
    expect(r.reason).toBe('body-missing-fields');
  });

  it('unknown event type returns 200 with no mutation (Stripe ack)', async () => {
    const { handler } = build();
    const body = JSON.stringify({
      id: 'evt_unknown',
      type: 'customer.created',
      data: { object: {} },
    });
    const r = await handler({
      body,
      headers: { 'stripe-signature': signed(body) },
    });
    expect(r.status).toBe(200);
    expect(r.mutation).toBeUndefined();
  });

  it('case-insensitive Stripe-Signature header (capitalized) accepted', async () => {
    const { handler } = build();
    const body = JSON.stringify({
      id: 'evt_caps',
      type: 'checkout.session.completed',
      data: { object: { metadata: { tenantId: 't', sku: 'news-pro-1y' } } },
    });
    const r = await handler({
      body,
      headers: { 'Stripe-Signature': signed(body) },
    });
    expect(r.status).toBe(200);
    expect(r.mutation?.tenantId).toBe('t');
  });

  it('subscription.deleted webhook → 200 + revoked mutation', async () => {
    const { handler } = build();
    const body = JSON.stringify({
      id: 'evt_del',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_abc',
          metadata: { tenantId: 'tenant-99', sku: 'news-pro-1y' },
        },
      },
    });
    const r = await handler({
      body,
      headers: { 'stripe-signature': signed(body) },
    });
    expect(r.status).toBe(200);
    expect(r.mutation?.newStatus).toBe('revoked');
  });

  it('two distinct event ids each yield their own mutation (no cross-talk)', async () => {
    const { handler } = build();
    const body1 = JSON.stringify({
      id: 'evt_a',
      type: 'checkout.session.completed',
      data: { object: { metadata: { tenantId: 't-A', sku: 'news-pro-1y' } } },
    });
    const body2 = JSON.stringify({
      id: 'evt_b',
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_b', metadata: { tenantId: 't-B', sku: 'news-pro-1y' } },
      },
    });
    const r1 = await handler({ body: body1, headers: { 'stripe-signature': signed(body1) } });
    const r2 = await handler({ body: body2, headers: { 'stripe-signature': signed(body2) } });
    expect(r1.mutation?.tenantId).toBe('t-A');
    expect(r1.mutation?.newStatus).toBe('active');
    expect(r2.mutation?.tenantId).toBe('t-B');
    expect(r2.mutation?.newStatus).toBe('revoked');
  });
});
