// apps/docs/scripts/build-marketplace-pages.test.ts
// T-538 — unit tests for the marketplace prebuild walker + renderer.
// Drives the script against a tempdir of fixture manifests; verifies
// site structure + per-pack content + sidebar emission.

import { promises as fs } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { PackManifest } from '@stageflip/pack-format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { pickHighestVersionPerPack } from '../src/lib/marketplace.js';
import { discoverManifests, emitMarketplaceSite } from './build-marketplace-pages.js';

interface FixtureOverrides {
  readonly id?: string;
  readonly name?: string;
  readonly version?: string;
  readonly publisher?: { id: string; displayName: string };
  readonly description?: string | undefined;
  readonly keywords?: string[] | undefined;
  readonly homepage?: string | undefined;
  readonly repository?: string | undefined;
  readonly license?: PackManifest['license'];
  readonly contributes?: PackManifest['contributes'];
}

function makeManifest(overrides: FixtureOverrides = {}): PackManifest {
  return {
    manifestVersion: '1',
    id: overrides.id ?? 'sample-pack',
    name: overrides.name ?? 'Sample Pack',
    version: overrides.version ?? '0.2.0',
    publisher: overrides.publisher ?? { id: 'stageflip', displayName: 'StageFlip' },
    platformCompatibility: '^2.0.0',
    license: overrides.license ?? {
      kind: 'paid-per-tenant',
      sku: 'sample-pack-1y',
      entitlementType: 'subscription',
    },
    integrity: {
      algorithm: 'sha256',
      hash: '0'.repeat(64),
    },
    contributes: overrides.contributes ?? {
      presets: [{ id: 'sample-preset', cluster: 'cluster-a' }],
    },
    ...(overrides.description !== undefined ? { description: overrides.description } : {}),
    ...(overrides.keywords !== undefined ? { keywords: overrides.keywords } : {}),
    ...(overrides.homepage !== undefined ? { homepage: overrides.homepage } : {}),
    ...(overrides.repository !== undefined ? { repository: overrides.repository } : {}),
  };
}

async function writeFixturePack(
  rootDir: string,
  manifest: PackManifest,
  versionOverride?: string,
): Promise<void> {
  const version = versionOverride ?? manifest.version;
  const dir = path.join(rootDir, manifest.publisher.id, manifest.id, version);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

let workspace = '';
let packsRoot = '';
let contentRoot = '';
let sidebarOut = '';

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 't-538-mkt-'));
  packsRoot = path.join(workspace, 'packs');
  contentRoot = path.join(workspace, 'content', 'marketplace');
  sidebarOut = path.join(workspace, 'generated', 'marketplace-sidebar.json');
  await fs.mkdir(packsRoot, { recursive: true });
});

afterEach(async () => {
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

describe('build-marketplace-pages — discover + emit', () => {
  it('happy path — single pack generates index + detail + sidebar', async () => {
    await writeFixturePack(packsRoot, makeManifest({ id: 'news-pro', name: 'News Pro' }));

    const discovered = await discoverManifests(packsRoot);
    expect(discovered).toHaveLength(1);

    const { pages, sidebar } = await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );
    expect(pages).toBe(2); // 1 catalogue index + 1 pack detail
    expect(sidebar[0]?.items.map((i) => i.slug)).toEqual(['marketplace', 'marketplace/news-pro']);

    const index = await fs.readFile(path.join(contentRoot, 'index.md'), 'utf8');
    expect(index).toContain('title: Marketplace');
    expect(index).toContain('[News Pro](/marketplace/news-pro/)');

    const detail = await fs.readFile(path.join(contentRoot, 'news-pro', 'index.md'), 'utf8');
    expect(detail).toContain('title: News Pro');
    expect(detail).toContain('`news-pro`');
  });

  it('multi-pack — six packs render in alphabetical order', async () => {
    const ids = [
      'news-pro',
      'sports-networks',
      'creator-style',
      'finance',
      'wedding-events',
      'frontier-fx',
    ];
    for (const id of ids) {
      await writeFixturePack(
        packsRoot,
        makeManifest({
          id,
          name: id,
          license: { kind: 'paid-per-tenant', sku: `${id}-1y`, entitlementType: 'subscription' },
        }),
      );
    }

    const discovered = await discoverManifests(packsRoot);
    expect(discovered).toHaveLength(6);

    const { sidebar } = await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );

    // First item is the catalogue index, rest are packs alphabetical by id.
    const packSlugs = sidebar[0]?.items.slice(1).map((i) => i.slug) ?? [];
    expect(packSlugs).toEqual([...ids].sort().map((id) => `marketplace/${id}`));
    for (const id of ids) {
      const detailPath = path.join(contentRoot, id, 'index.md');
      expect((await fs.stat(detailPath)).isFile()).toBe(true);
    }
  });

  it('pack with no description — detail uses fallback in YAML description', async () => {
    await writeFixturePack(
      packsRoot,
      makeManifest({ id: 'nodesc', name: 'No Desc Pack', description: undefined }),
    );
    const discovered = await discoverManifests(packsRoot);
    const { pages } = await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );
    expect(pages).toBe(2);
    const detail = await fs.readFile(path.join(contentRoot, 'nodesc', 'index.md'), 'utf8');
    expect(detail).toContain('description:');
    expect(detail).toContain('No Desc Pack — StageFlip pack');
    // No Description section emitted when there is no manifest description.
    expect(detail).not.toContain('## Description');
  });

  it('pack with empty keywords — section is skipped', async () => {
    await writeFixturePack(packsRoot, makeManifest({ id: 'nokw', keywords: undefined }));
    await writeFixturePack(packsRoot, makeManifest({ id: 'emptykw', keywords: [] }));
    const discovered = await discoverManifests(packsRoot);
    await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );
    const nokw = await fs.readFile(path.join(contentRoot, 'nokw', 'index.md'), 'utf8');
    const emptykw = await fs.readFile(path.join(contentRoot, 'emptykw', 'index.md'), 'utf8');
    expect(nokw).not.toContain('## Keywords');
    expect(emptykw).not.toContain('## Keywords');
  });

  it('highest-version-wins per (publisher, id)', async () => {
    // Same (publisher, id), different versions — only 0.3.0 should render.
    await writeFixturePack(
      packsRoot,
      makeManifest({ id: 'multi', name: 'Old', version: '0.1.0' }),
      '0.1.0',
    );
    await writeFixturePack(
      packsRoot,
      makeManifest({ id: 'multi', name: 'New', version: '0.3.0' }),
      '0.3.0',
    );
    await writeFixturePack(
      packsRoot,
      makeManifest({ id: 'multi', name: 'Mid', version: '0.2.0' }),
      '0.2.0',
    );

    const discovered = await discoverManifests(packsRoot);
    expect(discovered).toHaveLength(3);

    const highest = pickHighestVersionPerPack(discovered.map((d) => d.manifest));
    expect(highest).toHaveLength(1);
    expect(highest[0]?.version).toBe('0.3.0');
    expect(highest[0]?.name).toBe('New');
  });

  it('malformed manifest — logs warning and skips pack', async () => {
    // Valid manifest.
    await writeFixturePack(packsRoot, makeManifest({ id: 'good' }));
    // Malformed: write bogus JSON for a different pack id.
    const badDir = path.join(packsRoot, 'stageflip', 'bad', '0.1.0');
    await fs.mkdir(badDir, { recursive: true });
    await fs.writeFile(path.join(badDir, 'manifest.json'), '{ not valid json');

    const warnings: string[] = [];
    const discovered = await discoverManifests(packsRoot, (m) => warnings.push(m));
    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.manifest.id).toBe('good');
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('skipping');
    expect(warnings[0]).toContain('bad');
  });

  it('sidebar JSON includes every pack', async () => {
    await writeFixturePack(packsRoot, makeManifest({ id: 'alpha' }));
    await writeFixturePack(packsRoot, makeManifest({ id: 'beta' }));
    await writeFixturePack(packsRoot, makeManifest({ id: 'gamma' }));

    const discovered = await discoverManifests(packsRoot);
    await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );

    const raw = await fs.readFile(sidebarOut, 'utf8');
    const sidebar = JSON.parse(raw) as Array<{ items: Array<{ slug: string }> }>;
    const slugs = sidebar[0]?.items.map((i) => i.slug) ?? [];
    expect(slugs).toContain('marketplace');
    expect(slugs).toContain('marketplace/alpha');
    expect(slugs).toContain('marketplace/beta');
    expect(slugs).toContain('marketplace/gamma');
  });

  it('catalogue index lists every pack alphabetically by id', async () => {
    await writeFixturePack(packsRoot, makeManifest({ id: 'zebra', name: 'Zebra Pack' }));
    await writeFixturePack(packsRoot, makeManifest({ id: 'alpha', name: 'Alpha Pack' }));
    await writeFixturePack(packsRoot, makeManifest({ id: 'middle', name: 'Middle Pack' }));

    const discovered = await discoverManifests(packsRoot);
    await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );

    const index = await fs.readFile(path.join(contentRoot, 'index.md'), 'utf8');
    const alphaPos = index.indexOf('Alpha Pack');
    const middlePos = index.indexOf('Middle Pack');
    const zebraPos = index.indexOf('Zebra Pack');
    expect(alphaPos).toBeGreaterThan(-1);
    expect(middlePos).toBeGreaterThan(alphaPos);
    expect(zebraPos).toBeGreaterThan(middlePos);
  });

  it('per-pack page renders the install code snippet', async () => {
    await writeFixturePack(packsRoot, makeManifest({ id: 'news-pro', version: '0.2.0' }));
    const discovered = await discoverManifests(packsRoot);
    await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );

    const detail = await fs.readFile(path.join(contentRoot, 'news-pro', 'index.md'), 'utf8');
    expect(detail).toContain('## Install');
    expect(detail).toContain('```sh');
    expect(detail).toContain('stageflip-pack install news-pro@0.2.0');
  });

  it('per-pack page renders preset count by cluster', async () => {
    await writeFixturePack(
      packsRoot,
      makeManifest({
        id: 'multi-cluster',
        contributes: {
          presets: [
            { id: 'a-1', cluster: 'cluster-a' },
            { id: 'a-2', cluster: 'cluster-a' },
            { id: 'b-1', cluster: 'cluster-b' },
          ],
        },
      }),
    );
    const discovered = await discoverManifests(packsRoot);
    await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );

    const detail = await fs.readFile(path.join(contentRoot, 'multi-cluster', 'index.md'), 'utf8');
    expect(detail).toContain('## Presets');
    expect(detail).toContain('### cluster-a');
    expect(detail).toContain('### cluster-b');
    expect(detail).toContain('`a-1`');
    expect(detail).toContain('`a-2`');
    expect(detail).toContain('`b-1`');
    expect(detail).toContain('## Contributes');
    expect(detail).toContain('Presets: 3');
  });

  it('groups packs in catalogue by license tier', async () => {
    await writeFixturePack(
      packsRoot,
      makeManifest({
        id: 'paid-pack',
        license: { kind: 'paid-per-tenant', sku: 'paid-1y', entitlementType: 'subscription' },
      }),
    );
    await writeFixturePack(
      packsRoot,
      makeManifest({ id: 'open-pack', license: { kind: 'open', spdx: 'MIT' } }),
    );
    await writeFixturePack(
      packsRoot,
      makeManifest({ id: 'ent-pack', license: { kind: 'enterprise', sku: 'ent-1y' } }),
    );

    const discovered = await discoverManifests(packsRoot);
    await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );

    const index = await fs.readFile(path.join(contentRoot, 'index.md'), 'utf8');
    expect(index).toContain('## Paid (per-tenant)');
    expect(index).toContain('## Enterprise');
    expect(index).toContain('## Open');
    // Each pack lands under exactly one tier heading.
    expect(index.indexOf('## Paid (per-tenant)')).toBeLessThan(index.indexOf('paid-pack'));
    expect(index.indexOf('## Enterprise')).toBeLessThan(index.indexOf('ent-pack'));
    expect(index.indexOf('## Open')).toBeLessThan(index.indexOf('open-pack'));
  });

  it('detail page renders license tier label + sku for paid-per-tenant packs', async () => {
    await writeFixturePack(
      packsRoot,
      makeManifest({
        id: 'paid-pack',
        license: { kind: 'paid-per-tenant', sku: 'paid-pack-1y', entitlementType: 'subscription' },
      }),
    );
    const discovered = await discoverManifests(packsRoot);
    await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );
    const detail = await fs.readFile(path.join(contentRoot, 'paid-pack', 'index.md'), 'utf8');
    expect(detail).toContain('Paid (per-tenant, subscription)');
    expect(detail).toContain('`paid-pack-1y`');
  });

  it('emitMarketplaceSite is idempotent — rerun replaces stale output', async () => {
    await writeFixturePack(packsRoot, makeManifest({ id: 'first' }));
    let discovered = await discoverManifests(packsRoot);
    await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );
    const stalePath = path.join(contentRoot, 'first', 'index.md');
    expect((await fs.stat(stalePath)).isFile()).toBe(true);

    // Now delete first, add second; re-run should remove stale.
    await rm(path.join(packsRoot, 'stageflip', 'first'), { recursive: true, force: true });
    await writeFixturePack(packsRoot, makeManifest({ id: 'second' }));
    discovered = await discoverManifests(packsRoot);
    await emitMarketplaceSite(
      discovered.map((d) => d.manifest),
      contentRoot,
      sidebarOut,
    );

    await expect(fs.stat(stalePath)).rejects.toThrow();
    const newPath = path.join(contentRoot, 'second', 'index.md');
    expect((await fs.stat(newPath)).isFile()).toBe(true);
  });
});
