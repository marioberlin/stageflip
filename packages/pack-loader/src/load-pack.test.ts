// packages/pack-loader/src/load-pack.test.ts
// Unit tests for the install-time gate stack (ADR-012 §D6).
// Each test drives one gate to failure and asserts the LF-* code.

import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { signPackArchive } from '@stageflip/pack-format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  PackLoaderDependencies,
  PublisherKeyRegistryLike,
  TenantEntitlement,
  TenantEntitlementsLike,
} from './dependencies.js';
import { isPackLoadFailure, loadPack } from './load-pack.js';

interface KeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
}

function makeKeyPairPem(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

function publisherKeys(map: Record<string, string>): PublisherKeyRegistryLike {
  return {
    async getPublisherKey(id) {
      return map[id] ?? null;
    },
  };
}

function entitlements(map: Record<string, TenantEntitlement>): TenantEntitlementsLike {
  return {
    async getEntitlement(sku) {
      return map[sku] ?? null;
    },
  };
}

function baseManifest(overrides: Record<string, unknown> = {}) {
  return {
    manifestVersion: '1',
    id: 'demo-pack',
    name: 'Demo Pack',
    version: '1.0.0',
    publisher: { id: 'pub-1', displayName: 'Pub 1' },
    platformCompatibility: '^2.0.0',
    license: { kind: 'open', spdx: 'MIT' },
    integrity: { algorithm: 'sha256', hash: 'a'.repeat(64) },
    contributes: {},
    ...overrides,
  };
}

async function writeInstall(
  dir: string,
  opts: {
    manifest: unknown;
    archive: Uint8Array;
    signature: Uint8Array;
  },
) {
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(opts.manifest));
  await writeFile(join(dir, 'archive.tar.zst'), opts.archive);
  await writeFile(join(dir, 'signature.bin'), opts.signature);
}

describe('loadPack', () => {
  let installPath: string;
  let keys: KeyPair;
  const archive = new TextEncoder().encode('archive bytes');

  beforeEach(async () => {
    installPath = await mkdtemp(join(tmpdir(), 'pack-loader-'));
    keys = makeKeyPairPem();
  });

  afterEach(async () => {
    await rm(installPath, { recursive: true, force: true });
  });

  function makeDeps(overrides: Partial<PackLoaderDependencies> = {}): PackLoaderDependencies {
    return {
      entitlements: entitlements({}),
      publisherKeys: publisherKeys({ 'pub-1': keys.publicKeyPem }),
      platformVersion: '2.5.0',
      ...overrides,
    };
  }

  it('loads a valid open-licensed pack', async () => {
    const signature = signPackArchive(archive, keys.privateKeyPem);
    await writeInstall(installPath, { manifest: baseManifest(), archive, signature });

    const result = await loadPack(installPath, makeDeps());
    expect(isPackLoadFailure(result)).toBe(false);
    if (!isPackLoadFailure(result)) {
      expect(result.manifest.id).toBe('demo-pack');
      expect(result.installPath).toBe(installPath);
      expect(result.archiveBytes.length).toBe(archive.length);
    }
  });

  it('LF-PACK-MANIFEST-PARSE-ERROR when manifest.json is missing', async () => {
    const result = await loadPack(installPath, makeDeps());
    expect(result).toMatchObject({ reason: 'LF-PACK-MANIFEST-PARSE-ERROR' });
  });

  it('LF-PACK-MANIFEST-PARSE-ERROR when manifest fails Zod', async () => {
    const signature = signPackArchive(archive, keys.privateKeyPem);
    await writeInstall(installPath, {
      manifest: baseManifest({ id: 'BAD-ID' }), // uppercase rejects
      archive,
      signature,
    });
    const result = await loadPack(installPath, makeDeps());
    expect(result).toMatchObject({ reason: 'LF-PACK-MANIFEST-PARSE-ERROR' });
  });

  it('LF-PACK-INCOMPATIBLE-VERSION when platform mismatches', async () => {
    const signature = signPackArchive(archive, keys.privateKeyPem);
    await writeInstall(installPath, {
      manifest: baseManifest({ platformCompatibility: '^3.0.0' }),
      archive,
      signature,
    });
    const result = await loadPack(installPath, makeDeps());
    expect(result).toMatchObject({ reason: 'LF-PACK-INCOMPATIBLE-VERSION' });
  });

  it('LF-PACK-SIGNATURE-INVALID when publisher key is missing', async () => {
    const signature = signPackArchive(archive, keys.privateKeyPem);
    await writeInstall(installPath, { manifest: baseManifest(), archive, signature });
    const result = await loadPack(installPath, makeDeps({ publisherKeys: publisherKeys({}) }));
    expect(result).toMatchObject({ reason: 'LF-PACK-SIGNATURE-INVALID' });
  });

  it('LF-PACK-SIGNATURE-INVALID when signature does not verify', async () => {
    const otherKeys = makeKeyPairPem();
    const signature = signPackArchive(archive, otherKeys.privateKeyPem);
    await writeInstall(installPath, { manifest: baseManifest(), archive, signature });
    const result = await loadPack(installPath, makeDeps());
    expect(result).toMatchObject({ reason: 'LF-PACK-SIGNATURE-INVALID' });
  });

  it('LF-PACK-SIGNATURE-INVALID when signature length is wrong', async () => {
    await writeInstall(installPath, {
      manifest: baseManifest(),
      archive,
      signature: new Uint8Array(32), // not 64
    });
    const result = await loadPack(installPath, makeDeps());
    expect(result).toMatchObject({ reason: 'LF-PACK-SIGNATURE-INVALID' });
  });

  it('LF-LICENSE-PACK-DENIED when paid pack has no entitlement', async () => {
    const signature = signPackArchive(archive, keys.privateKeyPem);
    await writeInstall(installPath, {
      manifest: baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
      }),
      archive,
      signature,
    });
    const result = await loadPack(installPath, makeDeps());
    expect(result).toMatchObject({ reason: 'LF-LICENSE-PACK-DENIED' });
  });

  it('LF-LICENSE-PACK-DENIED when entitlement is lapsed', async () => {
    const signature = signPackArchive(archive, keys.privateKeyPem);
    await writeInstall(installPath, {
      manifest: baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
      }),
      archive,
      signature,
    });
    const result = await loadPack(
      installPath,
      makeDeps({
        entitlements: entitlements({
          'sku-1': {
            sku: 'sku-1',
            entitlementType: 'subscription',
            status: 'lapsed',
            issuedAt: '2026-01-01T00:00:00Z',
          },
        }),
      }),
    );
    expect(result).toMatchObject({ reason: 'LF-LICENSE-PACK-DENIED' });
  });

  it('admits a paid pack when entitlement is active', async () => {
    const signature = signPackArchive(archive, keys.privateKeyPem);
    await writeInstall(installPath, {
      manifest: baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
      }),
      archive,
      signature,
    });
    const result = await loadPack(
      installPath,
      makeDeps({
        entitlements: entitlements({
          'sku-1': {
            sku: 'sku-1',
            entitlementType: 'subscription',
            status: 'active',
            issuedAt: '2026-01-01T00:00:00Z',
          },
        }),
      }),
    );
    expect(isPackLoadFailure(result)).toBe(false);
  });

  it('admits a paid pack when entitlement is trial (T-505)', async () => {
    const signature = signPackArchive(archive, keys.privateKeyPem);
    await writeInstall(installPath, {
      manifest: baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
      }),
      archive,
      signature,
    });
    const result = await loadPack(
      installPath,
      makeDeps({
        entitlements: entitlements({
          'sku-1': {
            sku: 'sku-1',
            entitlementType: 'subscription',
            status: 'trial',
            issuedAt: '2026-01-01T00:00:00Z',
            expiresAt: '2099-01-01T00:00:00Z',
          },
        }),
      }),
    );
    expect(isPackLoadFailure(result)).toBe(false);
  });

  it('LF-LICENSE-PACK-DENIED when trial entitlement expired (T-505)', async () => {
    const signature = signPackArchive(archive, keys.privateKeyPem);
    await writeInstall(installPath, {
      manifest: baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
      }),
      archive,
      signature,
    });
    const result = await loadPack(
      installPath,
      makeDeps({
        entitlements: entitlements({
          'sku-1': {
            sku: 'sku-1',
            entitlementType: 'subscription',
            status: 'trial',
            issuedAt: '2024-01-01T00:00:00Z',
            expiresAt: '2024-02-01T00:00:00Z',
          },
        }),
      }),
    );
    expect(result).toMatchObject({ reason: 'LF-LICENSE-PACK-DENIED' });
    if (isPackLoadFailure(result)) {
      expect(result.detail).toMatch(/trial/);
      expect(result.detail).toMatch(/expired/);
    }
  });

  it('admits an enterprise pack when entitlement is active', async () => {
    const signature = signPackArchive(archive, keys.privateKeyPem);
    await writeInstall(installPath, {
      manifest: baseManifest({
        license: { kind: 'enterprise', sku: 'ent-1', contractRef: 'C-001' },
      }),
      archive,
      signature,
    });
    const result = await loadPack(
      installPath,
      makeDeps({
        entitlements: entitlements({
          'ent-1': {
            sku: 'ent-1',
            entitlementType: 'one-time',
            status: 'active',
            issuedAt: '2026-01-01T00:00:00Z',
            contractRef: 'C-001',
          },
        }),
      }),
    );
    expect(isPackLoadFailure(result)).toBe(false);
  });
});
