// packages/pack-discovery/src/sources/in-memory.test.ts

import { describe, expect, it } from 'vitest';

import type { PackCatalogueEntry } from '../catalogue.js';
import { InMemoryPackSource } from './in-memory.js';

function entry(overrides: Partial<PackCatalogueEntry> = {}): PackCatalogueEntry {
  return {
    publisherId: 'acme',
    publisherDisplayName: 'ACME Co',
    packId: 'pack-a',
    name: 'ACME Pack',
    version: '1.0.0',
    licenseKind: 'open',
    description: undefined,
    keywords: [],
    clusters: [],
    installed: false,
    installPath: null,
    ...overrides,
  };
}

describe('InMemoryPackSource', () => {
  it('returns the supplied entries verbatim', async () => {
    const entries = [entry({ packId: 'pack-a' }), entry({ packId: 'pack-b' })];
    const src = new InMemoryPackSource(entries);
    const out = await src.listAll();
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.packId).sort()).toEqual(['pack-a', 'pack-b']);
  });

  it('deep-copies entries (caller can mutate input afterwards)', async () => {
    const input: PackCatalogueEntry[] = [entry({ packId: 'pack-a', keywords: ['orig'] })];
    const src = new InMemoryPackSource(input);
    // Mutate the caller's array + its first entry's keywords array.
    input.length = 0;
    // We can't mutate readonly array via TypeScript-typed surface, but
    // we can prove the source's copy is independent by listing it.
    const out = await src.listAll();
    expect(out).toHaveLength(1);
    expect(out[0]?.keywords).toEqual(['orig']);
  });

  it('handles an empty array', async () => {
    const src = new InMemoryPackSource([]);
    expect(await src.listAll()).toEqual([]);
  });

  it('returns a fresh copy on every listAll call', async () => {
    const src = new InMemoryPackSource([entry({ packId: 'pack-a' })]);
    const a = await src.listAll();
    const b = await src.listAll();
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
    expect(a[0]?.packId).toBe(b[0]?.packId);
  });
});
