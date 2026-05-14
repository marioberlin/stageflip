// packages/pack-discovery/src/editor/recommendation-cache.test.ts

import { describe, expect, it } from 'vitest';

import type { PackCatalogueEntry } from '../catalogue.js';
import type { PackRecommendation } from '../recommender.js';
import { RecommendationCache } from './recommendation-cache.js';

function rec(overrides: Partial<PackRecommendation> = {}): PackRecommendation {
  const entry: PackCatalogueEntry = {
    publisherId: 'acme',
    publisherDisplayName: 'ACME',
    packId: 'pack-a',
    name: 'Pack A',
    version: '1.0.0',
    licenseKind: 'paid-per-tenant',
    description: undefined,
    keywords: [],
    clusters: [],
    installed: false,
    installPath: null,
  };
  return {
    entry,
    score: 0.5,
    reason: 'test',
    ...overrides,
  };
}

describe('RecommendationCache', () => {
  it('get() on an unknown key returns null', () => {
    const cache = new RecommendationCache({ ttlMs: 1000, now: () => 0 });
    expect(cache.get('missing')).toBeNull();
  });

  it('set() then get() returns the cached recommendations', () => {
    let nowMs = 0;
    const cache = new RecommendationCache({ ttlMs: 1000, now: () => nowMs });
    const recs = [rec()];
    cache.set('k', recs);
    expect(cache.get('k')).toBe(recs);
    nowMs = 500;
    expect(cache.get('k')).toBe(recs);
  });

  it('get() returns null after the entry exceeds ttlMs and evicts it', () => {
    let nowMs = 0;
    const cache = new RecommendationCache({ ttlMs: 1000, now: () => nowMs });
    cache.set('k', [rec()]);
    nowMs = 1000;
    expect(cache.get('k')).toBeNull();
    // Confirm eviction: size should drop too.
    expect(cache.size()).toBe(0);
  });

  it('clear() empties every entry', () => {
    const cache = new RecommendationCache({ ttlMs: 1000, now: () => 0 });
    cache.set('a', [rec()]);
    cache.set('b', [rec()]);
    expect(cache.size()).toBe(2);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('a')).toBeNull();
  });

  it('size() counts non-expired entries and lazily evicts expired ones', () => {
    let nowMs = 0;
    const cache = new RecommendationCache({ ttlMs: 1000, now: () => nowMs });
    cache.set('a', [rec()]);
    nowMs = 500;
    cache.set('b', [rec()]);
    nowMs = 1200;
    // 'a' is expired (>= 1000ms), 'b' is still alive (700ms old).
    expect(cache.size()).toBe(1);
    expect(cache.get('b')).not.toBeNull();
  });

  it('uses the injected `now()` rather than wall-clock time', () => {
    let nowMs = 1_000_000;
    const cache = new RecommendationCache({ ttlMs: 100, now: () => nowMs });
    cache.set('k', [rec()]);
    nowMs += 50;
    expect(cache.get('k')).not.toBeNull();
    nowMs += 60;
    expect(cache.get('k')).toBeNull();
  });

  it('overwriting the same key resets the timestamp', () => {
    let nowMs = 0;
    const cache = new RecommendationCache({ ttlMs: 1000, now: () => nowMs });
    cache.set('k', [rec({ score: 0.1 })]);
    nowMs = 900;
    cache.set('k', [rec({ score: 0.9 })]);
    nowMs = 1800;
    // 900ms after the second set → not yet expired.
    const got = cache.get('k');
    expect(got).not.toBeNull();
    expect(got?.[0]?.score).toBe(0.9);
  });

  it('defaults `now` to a real-time clock when not supplied', () => {
    const cache = new RecommendationCache({ ttlMs: 60_000 });
    cache.set('k', [rec()]);
    // Just-set entry must be retrievable.
    expect(cache.get('k')).not.toBeNull();
  });
});
