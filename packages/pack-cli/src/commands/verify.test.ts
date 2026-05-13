// packages/pack-cli/src/commands/verify.test.ts

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type TempInstallRoot, makeCliDeps, makeInstallRoot, writePack } from '../test-helpers.js';
import { runVerify } from './verify.js';

describe('runVerify', () => {
  let root: TempInstallRoot;

  beforeEach(async () => {
    root = await makeInstallRoot();
  });

  afterEach(async () => {
    await root.cleanup();
  });

  it('exits 0 with a "no packs" message when no packs and no arg', async () => {
    const deps = makeCliDeps(root);
    const exit = await runVerify([], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('no packs installed');
  });

  it('exits 1 when the named pack does not exist', async () => {
    const deps = makeCliDeps(root);
    const exit = await runVerify(['pack-zzz'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('no pack matches');
  });

  it('exits 0 when every installed pack loads cleanly', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    await writePack(root, { publisher: 'pub-1', id: 'pack-b', version: '2.0.0' });
    const deps = makeCliDeps(root);
    const exit = await runVerify([], deps);
    expect(exit).toBe(0);
    const out = deps.logger.joined();
    expect(out).toContain('OK   pack-a@1.0.0');
    expect(out).toContain('OK   pack-b@2.0.0');
    expect(out).toContain('2/2 pass');
  });

  it('exits 1 + emits the LF-* code when any pack fails', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-ok', version: '1.0.0' });
    await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-broken',
      version: '1.0.0',
      skipArchive: true,
    });
    const deps = makeCliDeps(root);
    const exit = await runVerify([], deps);
    expect(exit).toBe(1);
    const out = deps.logger.joined();
    expect(out).toContain('OK   pack-ok@1.0.0');
    expect(out).toContain('FAIL');
    expect(out).toContain('LF-PACK-MANIFEST-PARSE-ERROR');
    expect(out).toContain('1 fail');
  });

  it('filters down to one pack when a ref is supplied', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '2.0.0' });
    const deps = makeCliDeps(root);
    const exit = await runVerify(['pack-a@2.0.0'], deps);
    expect(exit).toBe(0);
    const out = deps.logger.joined();
    expect(out).toContain('pack-a@2.0.0');
    expect(out).not.toContain('pack-a@1.0.0');
  });

  it('reports an entitlement gate failure with LF-LICENSE-PACK-DENIED', async () => {
    await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-paid',
      version: '1.0.0',
      license: { kind: 'paid-per-tenant', sku: 'sku-no-ent' },
    });
    const deps = makeCliDeps(root); // default entitlements returns null
    const exit = await runVerify([], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('LF-LICENSE-PACK-DENIED');
  });
});
