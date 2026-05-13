// packages/marketplace-stripe/src/pricing/sku-map.test.ts
// T-537 — SKU-map lookup + first-party constant integrity.

import { describe, expect, it } from 'vitest';

import { FIRST_PARTY_SKU_MAP, createSkuMap } from './sku-map.js';

describe('createSkuMap', () => {
  it('lookup returns the binding for a known sku', () => {
    const m = createSkuMap([
      { sku: 'news-pro-1y', priceId: 'price_news_pro_1y', tier: 'paid-per-tenant' },
    ]);
    const r = m.lookup('news-pro-1y');
    expect(r).not.toBeNull();
    expect(r?.priceId).toBe('price_news_pro_1y');
    expect(r?.tier).toBe('paid-per-tenant');
  });

  it('lookup returns null for an unknown sku', () => {
    const m = createSkuMap([
      { sku: 'news-pro-1y', priceId: 'price_news_pro_1y', tier: 'paid-per-tenant' },
    ]);
    expect(m.lookup('never-shipped')).toBeNull();
  });

  it('lookupByPriceId reverses the binding', () => {
    const m = createSkuMap([
      { sku: 'finance-1y', priceId: 'price_finance_1y', tier: 'paid-per-tenant' },
    ]);
    const r = m.lookupByPriceId('price_finance_1y');
    expect(r?.sku).toBe('finance-1y');
    expect(m.lookupByPriceId('price_unknown')).toBeNull();
  });

  it('rejects duplicate sku at construction', () => {
    expect(() =>
      createSkuMap([
        { sku: 'x', priceId: 'p1', tier: 'paid-per-tenant' },
        { sku: 'x', priceId: 'p2', tier: 'paid-per-tenant' },
      ]),
    ).toThrow(/duplicate sku/);
  });

  it('rejects duplicate priceId at construction', () => {
    expect(() =>
      createSkuMap([
        { sku: 'a', priceId: 'p', tier: 'paid-per-tenant' },
        { sku: 'b', priceId: 'p', tier: 'paid-per-tenant' },
      ]),
    ).toThrow(/duplicate priceId/);
  });

  it('rejects empty sku and empty priceId', () => {
    expect(() => createSkuMap([{ sku: '', priceId: 'p', tier: 'paid-per-tenant' }])).toThrow(
      /empty sku/,
    );
    expect(() => createSkuMap([{ sku: 's', priceId: '', tier: 'paid-per-tenant' }])).toThrow(
      /empty priceId/,
    );
  });

  it('all() preserves insertion order', () => {
    const input = [
      { sku: 'a', priceId: 'p1', tier: 'paid-per-tenant' as const },
      { sku: 'b', priceId: 'p2', tier: 'paid-per-tenant' as const },
      { sku: 'c', priceId: 'p3', tier: 'paid-per-tenant' as const },
    ];
    const m = createSkuMap(input);
    expect(m.all().map((x) => x.sku)).toEqual(['a', 'b', 'c']);
  });
});

describe('FIRST_PARTY_SKU_MAP', () => {
  it('has exactly six first-party packs', () => {
    expect(FIRST_PARTY_SKU_MAP.length).toBe(6);
  });

  it('every sku is 1y-suffixed (1-year subscription)', () => {
    for (const m of FIRST_PARTY_SKU_MAP) {
      expect(m.sku).toMatch(/-1y$/);
    }
  });

  it('every entry is paid-per-tenant tier', () => {
    for (const m of FIRST_PARTY_SKU_MAP) {
      expect(m.tier).toBe('paid-per-tenant');
    }
  });

  it('contains the six launch packs from ADR-013 §D2', () => {
    const skus = FIRST_PARTY_SKU_MAP.map((m) => m.sku).sort();
    expect(skus).toEqual(
      [
        'creator-style-1y',
        'finance-1y',
        'frontier-fx-1y',
        'news-pro-1y',
        'sports-networks-1y',
        'wedding-events-1y',
      ].sort(),
    );
  });

  it('loads into createSkuMap without duplicates', () => {
    const m = createSkuMap(FIRST_PARTY_SKU_MAP);
    expect(m.all().length).toBe(6);
    expect(m.lookup('news-pro-1y')?.tier).toBe('paid-per-tenant');
  });
});
