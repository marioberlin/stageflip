// packages/pack-discovery/src/recommender.test.ts

import { describe, expect, it } from 'vitest';

import { PackCatalogue, type PackCatalogueEntry } from './catalogue.js';
import { recommendPacks } from './recommender.js';

function entry(overrides: Partial<PackCatalogueEntry> = {}): PackCatalogueEntry {
  return {
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
    ...overrides,
  };
}

describe('recommendPacks', () => {
  it('with no clustersInUse → entries get baseline (license) scores, sorted alphabetically as tiebreak', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({ publisherId: 'globex', packId: 'pack-x', licenseKind: 'paid-per-tenant' }),
      entry({ publisherId: 'acme', packId: 'pack-a', licenseKind: 'paid-per-tenant' }),
    ]);
    const out = await recommendPacks(cat, {
      clustersInUse: [],
      installed: new Set(),
    });
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.entry.publisherId)).toEqual(['acme', 'globex']);
  });

  it('single cluster match adds +0.4', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({
        publisherId: 'acme',
        packId: 'pack-a',
        clusters: ['cluster-a'],
        licenseKind: 'paid-per-tenant',
      }),
      entry({
        publisherId: 'acme',
        packId: 'pack-b',
        clusters: ['cluster-b'],
        licenseKind: 'paid-per-tenant',
      }),
    ]);
    const out = await recommendPacks(cat, {
      clustersInUse: ['cluster-a'],
      installed: new Set(),
    });
    expect(out[0]?.entry.packId).toBe('pack-a');
    expect(out[0]?.score).toBeCloseTo(0.4);
    expect(out[1]?.score).toBe(0);
  });

  it('applies the installed penalty when the pack is in `installed`', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({
        publisherId: 'acme',
        packId: 'pack-a',
        clusters: ['cluster-a'],
        licenseKind: 'paid-per-tenant',
      }),
    ]);
    const out = await recommendPacks(cat, {
      clustersInUse: ['cluster-a'],
      installed: new Set(['acme/pack-a']),
    });
    // +0.4 cluster − 0.5 installed = -0.1 → clamped to 0
    expect(out[0]?.score).toBe(0);
  });

  it('applies the installed penalty when entry.installed is true', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({
        publisherId: 'acme',
        packId: 'pack-a',
        clusters: ['cluster-a', 'cluster-b'],
        licenseKind: 'paid-per-tenant',
        installed: true,
      }),
    ]);
    const out = await recommendPacks(cat, {
      clustersInUse: ['cluster-a', 'cluster-b'],
      installed: new Set(),
    });
    // +0.8 cluster − 0.5 installed = 0.3
    expect(out[0]?.score).toBeCloseTo(0.3);
  });

  it('caps the final score at 1.0', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({
        publisherId: 'acme',
        packId: 'pack-a',
        clusters: ['c1', 'c2', 'c3', 'c4'],
        keywords: ['c1', 'c2', 'c3', 'c4'],
        licenseKind: 'open',
      }),
    ]);
    const out = await recommendPacks(cat, {
      clustersInUse: ['c1', 'c2', 'c3', 'c4'],
      installed: new Set(),
    });
    expect(out[0]?.score).toBe(1);
  });

  it('honors the limit parameter', async () => {
    const cat = PackCatalogue.fromEntries(
      Array.from({ length: 10 }, (_, i) =>
        entry({
          packId: `pack-${String(i).padStart(2, '0')}`,
          clusters: ['cluster-a'],
          licenseKind: 'paid-per-tenant',
        }),
      ),
    );
    const out = await recommendPacks(cat, {
      clustersInUse: ['cluster-a'],
      installed: new Set(),
      limit: 3,
    });
    expect(out).toHaveLength(3);
  });

  it('reason string mentions the matched cluster when cluster match dominates', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({
        publisherId: 'acme',
        packId: 'pack-a',
        clusters: ['cluster-a'],
        licenseKind: 'paid-per-tenant',
      }),
    ]);
    const out = await recommendPacks(cat, {
      clustersInUse: ['cluster-a'],
      installed: new Set(),
    });
    expect(out[0]?.reason).toContain('cluster-a');
  });

  it('reason mentions keyword overlap when no cluster match', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({
        publisherId: 'acme',
        packId: 'pack-a',
        clusters: [],
        keywords: ['cluster-a'],
        licenseKind: 'paid-per-tenant',
      }),
    ]);
    const out = await recommendPacks(cat, {
      clustersInUse: ['cluster-a'],
      installed: new Set(),
    });
    expect(out[0]?.reason).toContain('keyword');
  });

  it('open license adds +0.1 bonus', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({
        publisherId: 'acme',
        packId: 'pack-paid',
        licenseKind: 'paid-per-tenant',
      }),
      entry({
        publisherId: 'acme',
        packId: 'pack-open',
        licenseKind: 'open',
      }),
    ]);
    const out = await recommendPacks(cat, {
      clustersInUse: [],
      installed: new Set(),
    });
    const openRow = out.find((r) => r.entry.packId === 'pack-open');
    const paidRow = out.find((r) => r.entry.packId === 'pack-paid');
    expect(openRow?.score).toBeCloseTo(0.1);
    expect(paidRow?.score).toBe(0);
    // Open should be ranked above paid.
    expect(out[0]?.entry.packId).toBe('pack-open');
  });

  it('enterprise license applies a -0.1 penalty', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({
        publisherId: 'acme',
        packId: 'pack-ent',
        clusters: ['cluster-a'],
        licenseKind: 'enterprise',
      }),
      entry({
        publisherId: 'acme',
        packId: 'pack-open',
        clusters: ['cluster-a'],
        licenseKind: 'open',
      }),
    ]);
    const out = await recommendPacks(cat, {
      clustersInUse: ['cluster-a'],
      installed: new Set(),
    });
    const ent = out.find((r) => r.entry.packId === 'pack-ent');
    const open = out.find((r) => r.entry.packId === 'pack-open');
    // ent: 0.4 - 0.1 = 0.3
    // open: 0.4 + 0.1 = 0.5
    expect(ent?.score).toBeCloseTo(0.3);
    expect(open?.score).toBeCloseTo(0.5);
  });

  it('returns top-N sorted descending by score', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({
        publisherId: 'acme',
        packId: 'high',
        clusters: ['cluster-a', 'cluster-b'],
        licenseKind: 'open',
      }),
      entry({
        publisherId: 'acme',
        packId: 'mid',
        clusters: ['cluster-a'],
        licenseKind: 'paid-per-tenant',
      }),
      entry({
        publisherId: 'acme',
        packId: 'low',
        clusters: [],
        licenseKind: 'enterprise',
      }),
    ]);
    const out = await recommendPacks(cat, {
      clustersInUse: ['cluster-a', 'cluster-b'],
      installed: new Set(),
    });
    expect(out.map((r) => r.entry.packId)).toEqual(['high', 'mid', 'low']);
    if (out.length >= 2) {
      // Type guard to satisfy noUncheckedIndexedAccess.
      const first = out[0];
      const second = out[1];
      expect(first !== undefined && second !== undefined ? first.score >= second.score : true).toBe(
        true,
      );
    }
  });

  it('keyword match contributes +0.2 separately from cluster match', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({
        publisherId: 'acme',
        packId: 'pack-a',
        clusters: ['cluster-a'],
        keywords: ['cluster-a'],
        licenseKind: 'paid-per-tenant',
      }),
    ]);
    const out = await recommendPacks(cat, {
      clustersInUse: ['cluster-a'],
      installed: new Set(),
    });
    // 0.4 (cluster) + 0.2 (keyword) = 0.6
    expect(out[0]?.score).toBeCloseTo(0.6);
  });
});
