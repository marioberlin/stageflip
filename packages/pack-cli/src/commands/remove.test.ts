// packages/pack-cli/src/commands/remove.test.ts

import { stat } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type TempInstallRoot,
  makeCliDeps,
  makeInstallRoot,
  scriptedPrompter,
  writePack,
} from '../test-helpers.js';
import { runRemove } from './remove.js';

describe('runRemove', () => {
  let root: TempInstallRoot;

  beforeEach(async () => {
    root = await makeInstallRoot();
  });

  afterEach(async () => {
    await root.cleanup();
  });

  it('exits 1 with usage error when <pack-id> is missing', async () => {
    const deps = makeCliDeps(root);
    const exit = await runRemove([], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('missing <pack-id>');
  });

  it('exits 1 when the named pack does not exist', async () => {
    const deps = makeCliDeps(root);
    const exit = await runRemove(['pack-zzz', '--yes'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('no pack matches');
  });

  it('exits 1 when the user aborts at the confirm prompt', async () => {
    const installPath = await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-a',
      version: '1.0.0',
    });
    const deps = makeCliDeps(root, { prompter: scriptedPrompter([false]) });
    const exit = await runRemove(['pack-a'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('aborted');
    // The directory must still exist.
    const s = await stat(installPath);
    expect(s.isDirectory()).toBe(true);
  });

  it('removes the install directory on the happy path (--yes)', async () => {
    const installPath = await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-a',
      version: '1.0.0',
    });
    const deps = makeCliDeps(root);
    const exit = await runRemove(['pack-a', '--yes'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('removed');
    expect(deps.fs.removed).toContain(installPath);
    await expect(stat(installPath)).rejects.toThrow();
  });

  it('removes after the user confirms (default prompter answers yes)', async () => {
    const installPath = await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-a',
      version: '1.0.0',
    });
    const deps = makeCliDeps(root); // default prompter says true
    const exit = await runRemove(['pack-a'], deps);
    expect(exit).toBe(0);
    expect(deps.fs.removed).toContain(installPath);
  });

  it('exits 1 + asks for @<version> when multiple versions of the same pack exist', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '2.0.0' });
    const deps = makeCliDeps(root);
    const exit = await runRemove(['pack-a', '--yes'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('specify @<version>');
  });

  it('removes a load-failed pack (debris cleanup path)', async () => {
    const installPath = await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-broken',
      version: '1.0.0',
      skipArchive: true,
    });
    const deps = makeCliDeps(root);
    const exit = await runRemove(['pack-broken', '--yes'], deps);
    expect(exit).toBe(0);
    expect(deps.fs.removed).toContain(installPath);
  });

  it('exits 1 on an unknown flag', async () => {
    const deps = makeCliDeps(root);
    const exit = await runRemove(['--nope', 'pack-a'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('missing <pack-id>');
  });

  it('honours -y as an alias for --yes', async () => {
    const installPath = await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-a',
      version: '1.0.0',
    });
    const deps = makeCliDeps(root, { prompter: scriptedPrompter([false]) });
    const exit = await runRemove(['pack-a', '-y'], deps);
    expect(exit).toBe(0);
    expect(deps.fs.removed).toContain(installPath);
  });
});
