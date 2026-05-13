// packages/pack-cli/src/commands/info.test.ts

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type TempInstallRoot, makeCliDeps, makeInstallRoot, writePack } from '../test-helpers.js';
import { runInfo } from './info.js';

describe('runInfo', () => {
  let root: TempInstallRoot;

  beforeEach(async () => {
    root = await makeInstallRoot();
  });

  afterEach(async () => {
    await root.cleanup();
  });

  it('exits 1 when no <pack-id> arg is supplied', async () => {
    const deps = makeCliDeps(root);
    const exit = await runInfo([], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('missing <pack-id>');
  });

  it('exits 1 when no installed pack matches the id', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    const deps = makeCliDeps(root);
    const exit = await runInfo(['pack-zzz'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('no pack matches');
  });

  it('prints the manifest detail block on a happy match', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    const deps = makeCliDeps(root);
    const exit = await runInfo(['pack-a'], deps);
    expect(exit).toBe(0);
    const out = deps.logger.joined();
    expect(out).toContain('status: loaded');
    expect(out).toContain('id: pack-a');
    expect(out).toContain('version: 1.0.0');
    expect(out).toContain('publisher: pub-1');
    expect(out).toContain('license.kind: open');
    expect(out).toContain('license.spdx: MIT');
  });

  it('filters by version when supplied', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '2.0.0' });
    const deps = makeCliDeps(root);
    const exit = await runInfo(['pack-a@2.0.0'], deps);
    expect(exit).toBe(0);
    const out = deps.logger.joined();
    expect(out).toContain('version: 2.0.0');
    expect(out).not.toContain('version: 1.0.0');
  });

  it('reports a load-failed pack with its LF-* code', async () => {
    await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-broken',
      version: '1.0.0',
      skipArchive: true,
    });
    const deps = makeCliDeps(root);
    const exit = await runInfo(['pack-broken'], deps);
    expect(exit).toBe(0); // info reports detail even for failures
    expect(deps.logger.joined()).toContain('status: LF-PACK-MANIFEST-PARSE-ERROR');
  });

  it('shows license.sku for paid packs', async () => {
    await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-paid',
      version: '1.0.0',
      license: { kind: 'paid-per-tenant', sku: 'sku-pro' },
    });
    const deps = makeCliDeps(root, {
      loader: {
        entitlements: {
          async getEntitlement(sku) {
            if (sku === 'sku-pro') {
              return {
                sku,
                entitlementType: 'subscription',
                status: 'active',
                issuedAt: '2025-01-01T00:00:00Z',
              };
            }
            return null;
          },
        },
        publisherKeys: {
          async getPublisherKey() {
            return root.publicKeyPem;
          },
        },
        platformVersion: '2.5.0',
      },
    });
    const exit = await runInfo(['pack-paid'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('license.kind: paid-per-tenant');
    expect(deps.logger.joined()).toContain('license.sku: sku-pro');
  });
});
