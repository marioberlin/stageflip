// packages/pack-discovery/src/sources/installed.test.ts

import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { signPackArchive } from '@stageflip/pack-format';
import type { PackLoaderDependencies } from '@stageflip/pack-loader';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type DiscoveryLogger, InstalledPackSource } from './installed.js';

interface WritePackOptions {
  readonly publisher: string;
  readonly id: string;
  readonly version: string;
  readonly licenseKind?: 'open' | 'paid-per-tenant';
  readonly description?: string;
  readonly keywords?: readonly string[];
  readonly presets?: ReadonlyArray<{ id: string; cluster: string }>;
}

describe('InstalledPackSource', () => {
  let root: string;
  let publicKeyPem: string;
  let privateKeyPem: string;
  const warnings: string[] = [];
  const logger: DiscoveryLogger = {
    warn: (msg) => warnings.push(msg),
  };

  beforeEach(async () => {
    warnings.length = 0;
    root = await mkdtemp(join(tmpdir(), 'pack-discovery-installed-'));
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function deps(): PackLoaderDependencies {
    return {
      entitlements: {
        async getEntitlement() {
          return null;
        },
      },
      publisherKeys: {
        async getPublisherKey(id) {
          return id === 'acme' ? publicKeyPem : null;
        },
      },
      platformVersion: '2.5.0',
    };
  }

  async function writePack(opts: WritePackOptions): Promise<string> {
    const { publisher, id, version } = opts;
    const dir = join(root, publisher, id, version);
    await mkdir(dir, { recursive: true });
    const archive = new TextEncoder().encode(`${id}@${version}`);
    const license =
      opts.licenseKind === 'paid-per-tenant'
        ? { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' }
        : { kind: 'open', spdx: 'MIT' };
    const manifest: Record<string, unknown> = {
      manifestVersion: '1',
      id,
      name: `${id} display`,
      version,
      publisher: { id: publisher, displayName: `${publisher} display` },
      platformCompatibility: '^2.0.0',
      license,
      integrity: { algorithm: 'sha256', hash: 'a'.repeat(64) },
      contributes: opts.presets !== undefined ? { presets: opts.presets } : {},
    };
    if (opts.description !== undefined) manifest.description = opts.description;
    if (opts.keywords !== undefined) manifest.keywords = opts.keywords;
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(join(dir, 'archive.tar.zst'), archive);
    await writeFile(join(dir, 'signature.bin'), signPackArchive(archive, privateKeyPem));
    return dir;
  }

  it('returns empty array when root does not exist', async () => {
    const src = new InstalledPackSource({
      rootPath: join(root, 'does-not-exist'),
      loaderDeps: deps(),
      logger,
    });
    expect(await src.listAll()).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('maps a discovered pack to a PackCatalogueEntry', async () => {
    const installPath = await writePack({ publisher: 'acme', id: 'pack-a', version: '1.0.0' });
    const src = new InstalledPackSource({ rootPath: root, loaderDeps: deps(), logger });
    const out = await src.listAll();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      publisherId: 'acme',
      publisherDisplayName: 'acme display',
      packId: 'pack-a',
      name: 'pack-a display',
      version: '1.0.0',
      licenseKind: 'open',
      installed: true,
      installPath,
    });
  });

  it('derives clusters from manifest.contributes.presets[].cluster (deduped)', async () => {
    await writePack({
      publisher: 'acme',
      id: 'pack-a',
      version: '1.0.0',
      presets: [
        { id: 'preset-1', cluster: 'cluster-a' },
        { id: 'preset-2', cluster: 'cluster-b' },
        { id: 'preset-3', cluster: 'cluster-a' },
      ],
    });
    const src = new InstalledPackSource({ rootPath: root, loaderDeps: deps(), logger });
    const out = await src.listAll();
    expect(out[0]?.clusters).toEqual(['cluster-a', 'cluster-b']);
  });

  it('skips failed loads with a warning', async () => {
    // Write a malformed pack (no manifest.json) — LF-PACK-MANIFEST-PARSE-ERROR.
    await mkdir(join(root, 'acme', 'broken', '1.0.0'), { recursive: true });
    // And one good pack.
    await writePack({ publisher: 'acme', id: 'pack-a', version: '1.0.0' });

    const src = new InstalledPackSource({ rootPath: root, loaderDeps: deps(), logger });
    const out = await src.listAll();
    expect(out).toHaveLength(1);
    expect(out[0]?.packId).toBe('pack-a');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('LF-PACK-MANIFEST-PARSE-ERROR');
  });

  it('honors description + keywords from the manifest', async () => {
    await writePack({
      publisher: 'acme',
      id: 'pack-a',
      version: '1.0.0',
      description: 'A test pack',
      keywords: ['sports', 'broadcast'],
    });
    const src = new InstalledPackSource({ rootPath: root, loaderDeps: deps(), logger });
    const out = await src.listAll();
    expect(out[0]?.description).toBe('A test pack');
    expect(out[0]?.keywords).toEqual(['sports', 'broadcast']);
  });

  it('sets installed=true and installPath to the on-disk dir', async () => {
    const installPath = await writePack({ publisher: 'acme', id: 'pack-a', version: '1.0.0' });
    const src = new InstalledPackSource({ rootPath: root, loaderDeps: deps(), logger });
    const out = await src.listAll();
    expect(out[0]?.installed).toBe(true);
    expect(out[0]?.installPath).toBe(installPath);
  });

  it('returns empty keywords + clusters arrays when manifest omits them', async () => {
    await writePack({ publisher: 'acme', id: 'pack-a', version: '1.0.0' });
    const src = new InstalledPackSource({ rootPath: root, loaderDeps: deps(), logger });
    const out = await src.listAll();
    expect(out[0]?.keywords).toEqual([]);
    expect(out[0]?.clusters).toEqual([]);
    expect(out[0]?.description).toBeUndefined();
  });
});
