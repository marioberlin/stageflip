// packages/pack-cli/src/commands/list.test.ts

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type TempInstallRoot, makeCliDeps, makeInstallRoot, writePack } from '../test-helpers.js';
import { formatRow, runList } from './list.js';

describe('runList', () => {
  let root: TempInstallRoot;

  beforeEach(async () => {
    root = await makeInstallRoot();
  });

  afterEach(async () => {
    await root.cleanup();
  });

  it('emits a "no packs" line for an empty root', async () => {
    const deps = makeCliDeps(root);
    const exit = await runList(deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('no packs installed');
  });

  it('prints one row per installed pack + a tail count', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    await writePack(root, { publisher: 'pub-1', id: 'pack-b', version: '2.0.0' });
    const deps = makeCliDeps(root);
    const exit = await runList(deps);
    expect(exit).toBe(0);
    const out = deps.logger.joined();
    expect(out).toContain('pack-a');
    expect(out).toContain('1.0.0');
    expect(out).toContain('pack-b');
    expect(out).toContain('2.0.0');
    expect(out).toContain('(2 packs)');
  });

  it('shows the LF-* code for a failed-load pack', async () => {
    // Skip writing archive → loader gate 3 fails.
    await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-broken',
      version: '1.0.0',
      skipArchive: true,
    });
    const deps = makeCliDeps(root);
    const exit = await runList(deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('LF-PACK-MANIFEST-PARSE-ERROR');
  });

  it('uses singular "pack" in tail count for length 1', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    const deps = makeCliDeps(root);
    await runList(deps);
    expect(deps.logger.joined()).toContain('(1 pack)');
  });
});

describe('formatRow', () => {
  it('renders a loaded manifest with publisher + license-kind', () => {
    const row = {
      installPath: '/root/pub-1/pack-a/1.0.0',
      result: {
        manifest: {
          id: 'pack-a',
          version: '1.0.0',
          publisher: { id: 'pub-1', displayName: 'pub-1' },
          license: { kind: 'open', spdx: 'MIT' },
        },
        installPath: '/root/pub-1/pack-a/1.0.0',
        archiveBytes: new Uint8Array(),
      },
    } as never;
    const line = formatRow(row);
    expect(line).toContain('[loaded]');
    expect(line).toContain('pack-a');
    expect(line).toContain('1.0.0');
    expect(line).toContain('publisher=pub-1');
    expect(line).toContain('license=open');
  });

  it('renders a failure with the LF-* code first', () => {
    const row = {
      installPath: '/root/pub-1/pack-broken/1.0.0',
      result: { reason: 'LF-PACK-SIGNATURE-INVALID', detail: 'bad sig' },
    } as never;
    const line = formatRow(row);
    expect(line.startsWith('[LF-PACK-SIGNATURE-INVALID]')).toBe(true);
    expect(line).toContain('bad sig');
  });
});
