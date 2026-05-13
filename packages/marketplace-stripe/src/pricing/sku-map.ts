// packages/marketplace-stripe/src/pricing/sku-map.ts
// T-537 — Pack-SKU → Stripe-priceId registry per ADR-013. Each first-
// party pack has a 1-year subscription SKU (suffix `-1y`); the
// marketplace consults this map when issuing checkout sessions.
// Production replaces the placeholder `price_<sku>_placeholder` values
// with real Stripe Price ids at T-550 wiring time via the same
// `createSkuMap` constructor.
//
// Determinism perimeter: outside (server-side).

/** Commercial tier per ADR-013 §D1. */
export type SkuTier = 'paid-per-tenant' | 'enterprise';

/** One SKU → Stripe priceId binding. */
export interface SkuMapping {
  readonly sku: string;
  readonly priceId: string;
  readonly tier: SkuTier;
}

/** Result of {@link createSkuMap}. */
export interface SkuMap {
  /** Lookup by SKU; returns `null` for unknown SKUs. */
  readonly lookup: (sku: string) => SkuMapping | null;
  /** Reverse lookup by Stripe priceId; returns `null` if no binding matches. */
  readonly lookupByPriceId: (priceId: string) => SkuMapping | null;
  /** All mappings, in stable insertion order. */
  readonly all: () => readonly SkuMapping[];
}

/**
 * Build a `SkuMap` from a list of `SkuMapping`s. Duplicate SKUs in
 * the input throw — every SKU is unique by construction (ADR-013 §D2).
 * Empty `sku` or `priceId` entries also throw.
 */
export function createSkuMap(mappings: readonly SkuMapping[]): SkuMap {
  const bySku = new Map<string, SkuMapping>();
  const byPriceId = new Map<string, SkuMapping>();
  for (const m of mappings) {
    if (m.sku.length === 0) {
      throw new Error('createSkuMap: empty sku');
    }
    if (m.priceId.length === 0) {
      throw new Error(`createSkuMap: empty priceId for sku ${m.sku}`);
    }
    if (bySku.has(m.sku)) {
      throw new Error(`createSkuMap: duplicate sku ${m.sku}`);
    }
    if (byPriceId.has(m.priceId)) {
      throw new Error(`createSkuMap: duplicate priceId ${m.priceId}`);
    }
    bySku.set(m.sku, m);
    byPriceId.set(m.priceId, m);
  }
  const ordered = [...mappings];
  return {
    lookup: (sku) => bySku.get(sku) ?? null,
    lookupByPriceId: (priceId) => byPriceId.get(priceId) ?? null,
    all: () => ordered,
  };
}

/**
 * The six first-party launch packs per ADR-013 §D2 with their
 * 1-year-subscription SKUs. Stripe priceIds are placeholders here;
 * production wiring (T-550) supplies the live values via a parallel
 * `createSkuMap` call. The list is frozen — third-party packs do
 * NOT appear (they author + bill independently per ADR-014 §D4).
 */
export const FIRST_PARTY_SKU_MAP: readonly SkuMapping[] = Object.freeze([
  { sku: 'news-pro-1y', priceId: 'price_news_pro_1y_placeholder', tier: 'paid-per-tenant' },
  {
    sku: 'sports-networks-1y',
    priceId: 'price_sports_networks_1y_placeholder',
    tier: 'paid-per-tenant',
  },
  {
    sku: 'creator-style-1y',
    priceId: 'price_creator_style_1y_placeholder',
    tier: 'paid-per-tenant',
  },
  { sku: 'finance-1y', priceId: 'price_finance_1y_placeholder', tier: 'paid-per-tenant' },
  {
    sku: 'wedding-events-1y',
    priceId: 'price_wedding_events_1y_placeholder',
    tier: 'paid-per-tenant',
  },
  { sku: 'frontier-fx-1y', priceId: 'price_frontier_fx_1y_placeholder', tier: 'paid-per-tenant' },
]);
