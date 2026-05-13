// apps/docs/src/lib/marketplace.test.ts
// T-538 — pure-function tests for the catalogue + per-pack
// markdown renderers + sidebar builder. The walker-level tests
// live alongside the build script in
// `scripts/build-marketplace-pages.test.ts`.

import type { PackManifest } from '@stageflip/pack-format';
import { describe, expect, it } from 'vitest';

import {
  buildMarketplaceSidebar,
  compareSemver,
  groupPresetsByCluster,
  licenseTierLabel,
  pickHighestVersionPerPack,
  renderCatalogueIndex,
  renderPackDetail,
  summarizeContributes,
} from './marketplace.js';

function manifest(overrides: Partial<PackManifest> = {}): PackManifest {
  const base: PackManifest = {
    manifestVersion: '1',
    id: 'sample',
    name: 'Sample',
    version: '0.1.0',
    publisher: { id: 'stageflip', displayName: 'StageFlip' },
    platformCompatibility: '^2.0.0',
    license: { kind: 'paid-per-tenant', sku: 'sample-1y', entitlementType: 'subscription' },
    integrity: { algorithm: 'sha256', hash: '0'.repeat(64) },
    contributes: { presets: [{ id: 'p-1', cluster: 'cluster-a' }] },
  };
  return { ...base, ...overrides } as PackManifest;
}

describe('compareSemver', () => {
  it('orders patch / minor / major releases correctly', () => {
    expect(compareSemver('0.1.0', '0.2.0')).toBeLessThan(0);
    expect(compareSemver('0.2.0', '0.1.5')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '0.99.99')).toBeGreaterThan(0);
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });
});

describe('pickHighestVersionPerPack', () => {
  it('keeps highest version per (publisher, id) pair', () => {
    const old = manifest({ id: 'a', version: '0.1.0' });
    const newer = manifest({ id: 'a', version: '0.2.0' });
    const other = manifest({ id: 'b', version: '1.0.0' });
    const result = pickHighestVersionPerPack([old, newer, other]);
    expect(result).toHaveLength(2);
    expect(result.find((m) => m.id === 'a')?.version).toBe('0.2.0');
  });

  it('treats different publishers as distinct packs (no collision)', () => {
    const a = manifest({ id: 'shared', publisher: { id: 'pub-1', displayName: 'P1' } });
    const b = manifest({ id: 'shared', publisher: { id: 'pub-2', displayName: 'P2' } });
    const result = pickHighestVersionPerPack([a, b]);
    expect(result).toHaveLength(2);
  });
});

describe('licenseTierLabel', () => {
  it('returns a readable label per license kind', () => {
    expect(licenseTierLabel({ kind: 'open', spdx: 'MIT' })).toContain('MIT');
    expect(
      licenseTierLabel({ kind: 'paid-per-tenant', sku: 'x', entitlementType: 'subscription' }),
    ).toContain('subscription');
    expect(licenseTierLabel({ kind: 'enterprise', sku: 'x' })).toBe('Enterprise');
  });
});

describe('groupPresetsByCluster', () => {
  it('groups presets by cluster id', () => {
    const m = manifest({
      contributes: {
        presets: [
          { id: 'p-1', cluster: 'cluster-a' },
          { id: 'p-2', cluster: 'cluster-b' },
          { id: 'p-3', cluster: 'cluster-a' },
        ],
      },
    });
    const groups = groupPresetsByCluster(m);
    expect(groups.find((g) => g.cluster === 'cluster-a')?.presetIds).toEqual(['p-1', 'p-3']);
    expect(groups.find((g) => g.cluster === 'cluster-b')?.presetIds).toEqual(['p-2']);
  });

  it('returns empty array when manifest has no presets', () => {
    const m = manifest({ contributes: {} });
    expect(groupPresetsByCluster(m)).toEqual([]);
  });
});

describe('summarizeContributes', () => {
  it('omits zero-count buckets', () => {
    const m = manifest({
      contributes: {
        presets: [{ id: 'p-1', cluster: 'cluster-a' }],
        adapters: [{ id: 'adp', modality: 'data-source' }],
      },
    });
    const summary = summarizeContributes(m);
    expect(summary.map((s) => s.label)).toEqual(['Presets', 'Adapters']);
  });
});

describe('renderCatalogueIndex', () => {
  it('renders Starlight-safe frontmatter + tier headings', () => {
    const md = renderCatalogueIndex([manifest({ id: 'a', name: 'Alpha' })]);
    expect(md).toMatch(/^---\ntitle: Marketplace\n/);
    expect(md).toContain('description:');
    expect(md).toContain('## Paid (per-tenant)');
    expect(md).toContain('[Alpha](/marketplace/a/)');
  });

  it('omits tier headings with no packs', () => {
    const md = renderCatalogueIndex([
      manifest({
        id: 'a',
        license: { kind: 'paid-per-tenant', sku: 's', entitlementType: 'subscription' },
      }),
    ]);
    expect(md).not.toContain('## Open');
    expect(md).not.toContain('## Enterprise');
  });
});

describe('renderPackDetail', () => {
  it('renders id / version / publisher / install snippet', () => {
    const md = renderPackDetail(manifest({ id: 'news-pro', version: '0.2.0' }));
    expect(md).toContain('**Pack id:** `news-pro`');
    expect(md).toContain('**Version:** `0.2.0`');
    expect(md).toContain('**Publisher:** StageFlip (`stageflip`)');
    expect(md).toContain('stageflip-pack install news-pro@0.2.0');
  });

  it('renders homepage + repository when present', () => {
    const md = renderPackDetail(
      manifest({
        homepage: 'https://example.test/pack',
        repository: 'https://github.com/example/pack',
      }),
    );
    expect(md).toContain('https://example.test/pack');
    expect(md).toContain('https://github.com/example/pack');
  });

  it('omits homepage + repository sections when absent', () => {
    const md = renderPackDetail(manifest());
    expect(md).not.toContain('Homepage');
    expect(md).not.toContain('Repository');
  });
});

describe('buildMarketplaceSidebar', () => {
  it('emits catalogue index first, then packs alphabetical by id', () => {
    const sidebar = buildMarketplaceSidebar([
      manifest({ id: 'zebra' }),
      manifest({ id: 'alpha' }),
      manifest({ id: 'middle' }),
    ]);
    expect(sidebar).toHaveLength(1);
    expect(sidebar[0]?.items.map((i) => i.slug)).toEqual([
      'marketplace',
      'marketplace/alpha',
      'marketplace/middle',
      'marketplace/zebra',
    ]);
  });

  it('produces a single Marketplace group label', () => {
    const sidebar = buildMarketplaceSidebar([]);
    expect(sidebar[0]?.label).toBe('Marketplace');
  });
});
