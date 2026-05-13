// packages/pack-loader/src/discover-packs.test.ts

import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { signPackArchive } from '@stageflip/pack-format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PackLoaderDependencies } from './dependencies.js';
import { discoverPacks } from './discover-packs.js';
import { isPackLoadFailure } from './load-pack.js';

describe('discoverPacks', () => {
  let root: string;
  let publicKeyPem: string;
  let privateKeyPem: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pack-loader-discover-'));
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
          return id === 'pub-1' ? publicKeyPem : null;
        },
      },
      platformVersion: '2.5.0',
    };
  }

  async function writePack(publisher: string, id: string, version: string) {
    const dir = join(root, publisher, id, version);
    await mkdir(dir, { recursive: true });
    const archive = new TextEncoder().encode(`${id}@${version}`);
    const manifest = {
      manifestVersion: '1',
      id,
      name: id,
      version,
      publisher: { id: publisher, displayName: publisher },
      platformCompatibility: '^2.0.0',
      license: { kind: 'open', spdx: 'MIT' },
      integrity: { algorithm: 'sha256', hash: 'a'.repeat(64) },
      contributes: {},
    };
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(join(dir, 'archive.tar.zst'), archive);
    await writeFile(join(dir, 'signature.bin'), signPackArchive(archive, privateKeyPem));
    return dir;
  }

  it('discovers nested <publisher>/<id>/<version> installs', async () => {
    const p1 = await writePack('pub-1', 'pack-a', '1.0.0');
    const p2 = await writePack('pub-1', 'pack-a', '1.1.0');
    const p3 = await writePack('pub-1', 'pack-b', '2.0.0');

    const results = await discoverPacks(root, deps());
    const installPaths = results.map((r) => r.installPath).sort();
    expect(installPaths).toEqual([p1, p2, p3].sort());
    for (const r of results) {
      expect(isPackLoadFailure(r.result)).toBe(false);
    }
  });

  it('returns [] for a missing root', async () => {
    const results = await discoverPacks(join(root, 'does-not-exist'), deps());
    expect(results).toEqual([]);
  });

  it('reports per-pack failures rather than throwing', async () => {
    const dir = join(root, 'pub-1', 'bad-pack', '1.0.0');
    await mkdir(dir, { recursive: true });
    // no manifest written → LF-PACK-MANIFEST-PARSE-ERROR
    const results = await discoverPacks(root, deps());
    expect(results).toHaveLength(1);
    expect(results[0]?.result).toMatchObject({ reason: 'LF-PACK-MANIFEST-PARSE-ERROR' });
  });

  it('ignores debris that does not match the <publisher>/<id>/<version> depth', async () => {
    // file at top level
    await writeFile(join(root, 'README.txt'), 'debris');
    // empty publisher dir
    await mkdir(join(root, 'empty-pub'), { recursive: true });
    // publisher with empty pack dir
    await mkdir(join(root, 'pub-x', 'pack-x'), { recursive: true });

    await writePack('pub-1', 'pack-a', '1.0.0');
    const results = await discoverPacks(root, deps());
    expect(results).toHaveLength(1);
    expect(results[0]?.installPath.endsWith('pub-1/pack-a/1.0.0')).toBe(true);
  });
});
