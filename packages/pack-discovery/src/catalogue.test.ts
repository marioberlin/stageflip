// packages/pack-discovery/src/catalogue.test.ts

import { describe, expect, it } from 'vitest';

import { PackCatalogue, type PackCatalogueEntry } from './catalogue.js';
import { InMemoryPackSource } from './sources/in-memory.js';

function entry(overrides: Partial<PackCatalogueEntry> = {}): PackCatalogueEntry {
  return {
    publisherId: 'acme',
    publisherDisplayName: 'ACME Co',
    packId: 'pack-a',
    name: 'ACME Sports Pack',
    version: '1.0.0',
    licenseKind: 'open',
    description: 'Sports broadcast presets',
    keywords: ['sports', 'broadcast'],
    clusters: ['cluster-a'],
    installed: false,
    installPath: null,
    ...overrides,
  };
}

describe('PackCatalogue.list', () => {
  it('returns all entries with no opts', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({ packId: 'pack-a' }),
      entry({ packId: 'pack-b' }),
    ]);
    const out = await cat.list();
    expect(out).toHaveLength(2);
  });

  it('filters by licenseKind', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({ packId: 'pack-a', licenseKind: 'open' }),
      entry({ packId: 'pack-b', licenseKind: 'paid-per-tenant' }),
      entry({ packId: 'pack-c', licenseKind: 'enterprise' }),
    ]);
    const out = await cat.list({ licenseKind: 'open' });
    expect(out).toHaveLength(1);
    expect(out[0]?.packId).toBe('pack-a');
  });

  it('filters by cluster', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({ packId: 'pack-a', clusters: ['cluster-a'] }),
      entry({ packId: 'pack-b', clusters: ['cluster-b'] }),
      entry({ packId: 'pack-c', clusters: ['cluster-a', 'cluster-c'] }),
    ]);
    const out = await cat.list({ cluster: 'cluster-a' });
    const ids = out.map((e) => e.packId).sort();
    expect(ids).toEqual(['pack-a', 'pack-c']);
  });

  it('filters by keyword (case-insensitive) across name + description + keywords', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({ packId: 'pack-a', name: 'Sports Pack', description: undefined, keywords: [] }),
      entry({
        packId: 'pack-b',
        name: 'News Pack',
        description: 'Breaking sports headlines',
        keywords: [],
      }),
      entry({
        packId: 'pack-c',
        name: 'Weather Pack',
        description: undefined,
        keywords: ['SPORTS'],
      }),
      entry({
        packId: 'pack-d',
        name: 'Music Pack',
        description: 'Concert visuals',
        keywords: ['music'],
      }),
    ]);
    const out = await cat.list({ keyword: 'sports' });
    const ids = out.map((e) => e.packId).sort();
    expect(ids).toEqual(['pack-a', 'pack-b', 'pack-c']);
  });

  it('filters by publisherId', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({ publisherId: 'acme', packId: 'pack-a' }),
      entry({ publisherId: 'globex', packId: 'pack-b' }),
    ]);
    const out = await cat.list({ publisherId: 'acme' });
    expect(out).toHaveLength(1);
    expect(out[0]?.publisherId).toBe('acme');
  });

  it('truncates to limit', async () => {
    const cat = PackCatalogue.fromEntries(
      Array.from({ length: 10 }, (_, i) => entry({ packId: `pack-${i}` })),
    );
    const out = await cat.list({ limit: 2 });
    expect(out).toHaveLength(2);
  });

  it('clamps limit to 200', async () => {
    const cat = PackCatalogue.fromEntries(
      Array.from({ length: 250 }, (_, i) =>
        entry({ packId: `pack-${String(i).padStart(3, '0')}` }),
      ),
    );
    const out = await cat.list({ limit: 250 });
    expect(out).toHaveLength(200);
  });

  it('returns sorted output: publisherId ASC, packId ASC, version DESC', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({ publisherId: 'globex', packId: 'pack-z', version: '1.0.0' }),
      entry({ publisherId: 'acme', packId: 'pack-b', version: '1.0.0' }),
      entry({ publisherId: 'acme', packId: 'pack-a', version: '1.0.0' }),
    ]);
    const out = await cat.list();
    expect(out.map((e) => `${e.publisherId}/${e.packId}`)).toEqual([
      'acme/pack-a',
      'acme/pack-b',
      'globex/pack-z',
    ]);
  });

  it('combines multiple filter dimensions', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({
        publisherId: 'acme',
        packId: 'pack-a',
        licenseKind: 'open',
        clusters: ['cluster-a'],
      }),
      entry({
        publisherId: 'acme',
        packId: 'pack-b',
        licenseKind: 'paid-per-tenant',
        clusters: ['cluster-a'],
      }),
    ]);
    const out = await cat.list({ publisherId: 'acme', licenseKind: 'open' });
    expect(out).toHaveLength(1);
    expect(out[0]?.packId).toBe('pack-a');
  });
});

describe('PackCatalogue.get', () => {
  it('returns the entry by publisherId+packId', async () => {
    const cat = PackCatalogue.fromEntries([
      entry({ publisherId: 'acme', packId: 'pack-a' }),
      entry({ publisherId: 'globex', packId: 'pack-b' }),
    ]);
    const found = await cat.get('acme', 'pack-a');
    expect(found?.packId).toBe('pack-a');
  });

  it('returns null for a missing key', async () => {
    const cat = PackCatalogue.fromEntries([entry({ publisherId: 'acme', packId: 'pack-a' })]);
    expect(await cat.get('missing', 'x')).toBeNull();
  });

  it('is case-sensitive', async () => {
    const cat = PackCatalogue.fromEntries([entry({ publisherId: 'acme', packId: 'pack-a' })]);
    expect(await cat.get('ACME', 'pack-a')).toBeNull();
  });
});

describe('PackCatalogue aggregation', () => {
  it('collapses same-key entries to the highest version', async () => {
    const cat = new PackCatalogue([
      new InMemoryPackSource([entry({ publisherId: 'acme', packId: 'pack-a', version: '1.0.0' })]),
      new InMemoryPackSource([entry({ publisherId: 'acme', packId: 'pack-a', version: '2.0.0' })]),
    ]);
    const out = await cat.list();
    expect(out).toHaveLength(1);
    expect(out[0]?.version).toBe('2.0.0');
  });

  it('ORs the installed flag across sources for the same pack', async () => {
    const cat = new PackCatalogue([
      new InMemoryPackSource([
        entry({
          publisherId: 'acme',
          packId: 'pack-a',
          version: '1.0.0',
          installed: false,
          installPath: null,
        }),
      ]),
      new InMemoryPackSource([
        entry({
          publisherId: 'acme',
          packId: 'pack-a',
          version: '1.0.0',
          installed: true,
          installPath: '/tmp/acme/pack-a/1.0.0',
        }),
      ]),
    ]);
    const out = await cat.list();
    expect(out[0]?.installed).toBe(true);
    expect(out[0]?.installPath).toBe('/tmp/acme/pack-a/1.0.0');
  });

  it('sort is stable across sources', async () => {
    const cat = new PackCatalogue([
      new InMemoryPackSource([
        entry({ publisherId: 'globex', packId: 'pack-x', version: '1.0.0' }),
      ]),
      new InMemoryPackSource([
        entry({ publisherId: 'acme', packId: 'pack-b', version: '1.0.0' }),
        entry({ publisherId: 'acme', packId: 'pack-a', version: '2.1.0' }),
        entry({ publisherId: 'acme', packId: 'pack-a', version: '1.0.0' }),
      ]),
    ]);
    const out = await cat.list();
    expect(out.map((e) => `${e.publisherId}/${e.packId}@${e.version}`)).toEqual([
      'acme/pack-a@2.1.0',
      'acme/pack-b@1.0.0',
      'globex/pack-x@1.0.0',
    ]);
  });
});
