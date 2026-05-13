// packages/pack-cli/src/commands/install.test.ts

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type TempInstallRoot, makeCliDeps, makeInstallRoot } from '../test-helpers.js';
import { runInstall } from './install.js';

describe('runInstall (stub mode)', () => {
  let root: TempInstallRoot;

  beforeEach(async () => {
    root = await makeInstallRoot();
  });

  afterEach(async () => {
    await root.cleanup();
  });

  it('exits 2 with "not yet implemented" + the tar path', async () => {
    const deps = makeCliDeps(root);
    const exit = await runInstall(['/tmp/some.stageflip-pack'], deps);
    expect(exit).toBe(2);
    const out = deps.logger.joined();
    expect(out).toContain('not yet implemented');
    expect(out).toContain('/tmp/some.stageflip-pack');
    expect(out).toContain(root.rootPath);
  });

  it('exits 2 with usage error when the path arg is missing', async () => {
    const deps = makeCliDeps(root);
    const exit = await runInstall([], deps);
    expect(exit).toBe(2);
    expect(deps.logger.joined()).toContain('missing <path-to-pack-tar>');
  });
});
