// packages/pack-discovery/src/editor/recommendation-ranker.test.ts

import { describe, expect, it } from 'vitest';

import { PackCatalogue, type PackCatalogueEntry } from '../catalogue.js';
import { ClusterUsageTracker } from './cluster-usage-tracker.js';
import { rankRecommendationsForEditor } from './recommendation-ranker.js';

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

describe('rankRecommendationsForEditor', () => {
  it('passes clustersInUse from the tracker through to recommendPacks', async () => {
    const usage = new ClusterUsageTracker();
    usage.recordClipAdded('text', 'cluster-a', 1000);
    const cat = PackCatalogue.fromEntries([
      entry({ packId: 'match', clusters: ['cluster-a'] }),
      entry({ packId: 'nomatch', clusters: ['cluster-b'] }),
    ]);
    const out = await rankRecommendationsForEditor(cat, { usage, installed: new Set() });
    expect(out[0]?.entry.packId).toBe('match');
    expect(out[0]?.score).toBeCloseTo(0.4);
  });

  it('empty usage tracker → empty clustersInUse → baseline scores only', async () => {
    const usage = new ClusterUsageTracker();
    const cat = PackCatalogue.fromEntries([
      entry({ packId: 'paid', licenseKind: 'paid-per-tenant' }),
      entry({ packId: 'open', licenseKind: 'open' }),
    ]);
    const out = await rankRecommendationsForEditor(cat, { usage, installed: new Set() });
    // Open ranks above paid because of +0.1 license bonus.
    expect(out[0]?.entry.packId).toBe('open');
  });

  it('forwards the installed set to the base recommender', async () => {
    const usage = new ClusterUsageTracker();
    usage.recordClipAdded('text', 'cluster-a', 1000);
    const cat = PackCatalogue.fromEntries([
      entry({ publisherId: 'acme', packId: 'pack-a', clusters: ['cluster-a'] }),
    ]);
    const out = await rankRecommendationsForEditor(cat, {
      usage,
      installed: new Set(['acme/pack-a']),
    });
    // 0.4 cluster − 0.5 installed = clamped to 0.
    expect(out[0]?.score).toBe(0);
  });

  it('honors the limit parameter', async () => {
    const usage = new ClusterUsageTracker();
    usage.recordClipAdded('text', 'cluster-a', 1000);
    const cat = PackCatalogue.fromEntries(
      Array.from({ length: 8 }, (_, i) =>
        entry({ packId: `pack-${String(i).padStart(2, '0')}`, clusters: ['cluster-a'] }),
      ),
    );
    const out = await rankRecommendationsForEditor(cat, {
      usage,
      installed: new Set(),
      limit: 2,
    });
    expect(out).toHaveLength(2);
  });

  it('uses default limit of 5 when not specified', async () => {
    const usage = new ClusterUsageTracker();
    usage.recordClipAdded('text', 'cluster-a', 1000);
    const cat = PackCatalogue.fromEntries(
      Array.from({ length: 12 }, (_, i) =>
        entry({ packId: `pack-${String(i).padStart(2, '0')}`, clusters: ['cluster-a'] }),
      ),
    );
    const out = await rankRecommendationsForEditor(cat, { usage, installed: new Set() });
    expect(out).toHaveLength(5);
  });

  it('multiple distinct clusters all flow through', async () => {
    const usage = new ClusterUsageTracker();
    usage.recordClipAdded('text', 'cluster-a', 1000);
    usage.recordClipAdded('text', 'cluster-b', 2000);
    const cat = PackCatalogue.fromEntries([
      entry({ packId: 'two-cluster', clusters: ['cluster-a', 'cluster-b'] }),
      entry({ packId: 'one-cluster', clusters: ['cluster-a'] }),
    ]);
    const out = await rankRecommendationsForEditor(cat, { usage, installed: new Set() });
    expect(out[0]?.entry.packId).toBe('two-cluster');
    expect(out[0]?.score).toBeCloseTo(0.8);
    expect(out[1]?.score).toBeCloseTo(0.4);
  });

  it('returns rows with `entry`, `score`, and `reason` from the base recommender', async () => {
    const usage = new ClusterUsageTracker();
    usage.recordClipAdded('text', 'cluster-a', 1000);
    const cat = PackCatalogue.fromEntries([entry({ clusters: ['cluster-a'] })]);
    const out = await rankRecommendationsForEditor(cat, { usage, installed: new Set() });
    expect(out[0]).toHaveProperty('entry');
    expect(out[0]).toHaveProperty('score');
    expect(out[0]).toHaveProperty('reason');
    expect(out[0]?.reason).toContain('cluster-a');
  });

  it('reset() on the tracker clears the cluster signal on the next call', async () => {
    const usage = new ClusterUsageTracker();
    usage.recordClipAdded('text', 'cluster-a', 1000);
    const cat = PackCatalogue.fromEntries([entry({ clusters: ['cluster-a'] })]);
    const before = await rankRecommendationsForEditor(cat, { usage, installed: new Set() });
    expect(before[0]?.score).toBeCloseTo(0.4);
    usage.reset();
    const after = await rankRecommendationsForEditor(cat, { usage, installed: new Set() });
    expect(after[0]?.score).toBe(0);
  });

  it('a removed clip stops contributing on the next call', async () => {
    const usage = new ClusterUsageTracker();
    usage.recordClipAdded('text', 'cluster-a', 1000);
    usage.recordClipRemoved('cluster-a');
    const cat = PackCatalogue.fromEntries([entry({ clusters: ['cluster-a'] })]);
    const out = await rankRecommendationsForEditor(cat, { usage, installed: new Set() });
    expect(out[0]?.score).toBe(0);
  });

  it('keyword overlap with cluster name still works through the wrapper', async () => {
    const usage = new ClusterUsageTracker();
    usage.recordClipAdded('text', 'cluster-a', 1000);
    const cat = PackCatalogue.fromEntries([
      entry({
        clusters: [],
        keywords: ['cluster-a'],
      }),
    ]);
    const out = await rankRecommendationsForEditor(cat, { usage, installed: new Set() });
    expect(out[0]?.score).toBeCloseTo(0.2);
    expect(out[0]?.reason).toContain('keyword');
  });
});
