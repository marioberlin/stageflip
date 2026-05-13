// packages/pack-cli/src/commands/upgrade.test.ts

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type TempInstallRoot, makeCliDeps, makeInstallRoot, writePack } from '../test-helpers.js';
import { formatHeader, formatRow, parseTargetFlag, runUpgrade } from './upgrade.js';

describe('parseTargetFlag', () => {
  it('returns the value following --target', () => {
    expect(parseTargetFlag(['--target', '3.0.0'])).toBe('3.0.0');
  });

  it('accepts --target=value syntax', () => {
    expect(parseTargetFlag(['--target=3.0.0'])).toBe('3.0.0');
  });

  it('returns null when --target is absent', () => {
    expect(parseTargetFlag([])).toBeNull();
    expect(parseTargetFlag(['list'])).toBeNull();
  });

  it('returns null when --target is the last token', () => {
    expect(parseTargetFlag(['--target'])).toBeNull();
  });

  it('returns null when the value after --target is another flag', () => {
    expect(parseTargetFlag(['--target', '--other'])).toBeNull();
  });
});

describe('runUpgrade', () => {
  let root: TempInstallRoot;

  beforeEach(async () => {
    root = await makeInstallRoot();
  });

  afterEach(async () => {
    await root.cleanup();
  });

  it('exits 0 when every installed pack is compatible with the target', async () => {
    await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-a',
      version: '1.0.0',
      platformCompatibility: '^2.0.0',
    });
    await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-b',
      version: '1.0.0',
      platformCompatibility: '^2.0.0',
    });
    const deps = makeCliDeps(root);
    const exit = await runUpgrade(['--target', '2.5.0'], deps);
    expect(exit).toBe(0);
    const out = deps.logger.joined();
    expect(out).toContain('Target engine: 2.5.0');
    expect(out).toContain('pack-a');
    expect(out).toContain('pack-b');
    expect(out).toContain('compatible');
  });

  it('exits 1 when at least one pack is blocked against the target', async () => {
    await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-a',
      version: '1.0.0',
      platformCompatibility: '^2.0.0',
    });
    const deps = makeCliDeps(root);
    const exit = await runUpgrade(['--target', '3.0.0'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('blocked');
  });

  it('exits 1 and prints usage when --target is missing', async () => {
    const deps = makeCliDeps(root);
    const exit = await runUpgrade([], deps);
    expect(exit).toBe(1);
    const out = deps.logger.joined();
    expect(out).toContain('missing --target');
    expect(out).toContain('USAGE');
  });

  it('exits 0 with an empty-message when no packs are installed', async () => {
    const deps = makeCliDeps(root);
    const exit = await runUpgrade(['--target', '2.5.0'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('no installed packs');
  });

  it('prints a summary line covering all four statuses', async () => {
    await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-a',
      version: '1.0.0',
      platformCompatibility: '^2.0.0',
    });
    const deps = makeCliDeps(root);
    await runUpgrade(['--target', '2.5.0'], deps);
    const out = deps.logger.joined();
    expect(out).toContain('Summary:');
    expect(out).toContain('compatible');
    expect(out).toContain('needs-upgrade');
    expect(out).toContain('blocked');
    expect(out).toContain('manifest-version-incompatible');
  });

  it('skips load-failed packs (treats them as not-installed for upgrade planning)', async () => {
    await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-ok',
      version: '1.0.0',
      platformCompatibility: '^2.0.0',
    });
    await writePack(root, {
      publisher: 'pub-1',
      id: 'pack-broken',
      version: '1.0.0',
      skipArchive: true,
    });
    const deps = makeCliDeps(root);
    const exit = await runUpgrade(['--target', '2.5.0'], deps);
    // pack-broken doesn't load, so only pack-ok is in the plan.
    expect(exit).toBe(0);
    const out = deps.logger.joined();
    expect(out).toContain('pack-ok');
    // The broken pack isn't planned (its install-time gate failed).
    expect(out).not.toContain('pack-broken');
  });
});

describe('formatHeader', () => {
  it('renders the four table columns', () => {
    const header = formatHeader();
    expect(header).toContain('Pack');
    expect(header).toContain('Current');
    expect(header).toContain('Status');
    expect(header).toContain('Action');
  });
});

describe('formatRow', () => {
  it('joins publisher/pack id, version, status, and action', () => {
    const line = formatRow({
      publisherId: 'pub-1',
      packId: 'pack-a',
      currentVersion: '0.2.0',
      currentPlatformCompatibility: '^2.0.0',
      status: 'needs-upgrade',
      recommendedAction: 'Install 0.3.0',
    });
    expect(line).toContain('pub-1/pack-a');
    expect(line).toContain('0.2.0');
    expect(line).toContain('needs-upgrade');
    expect(line).toContain('Install 0.3.0');
  });
});
