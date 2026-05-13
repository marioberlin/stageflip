// packages/pack-cli/src/cli.test.ts
// Dispatcher-level tests. The individual commands are exercised in
// their own `.test.ts` files; here we only verify the routing,
// help-banner, and unknown-subcommand paths.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCli } from './cli.js';
import { type TempInstallRoot, makeCliDeps, makeInstallRoot, writePack } from './test-helpers.js';

describe('runCli — dispatcher', () => {
  let root: TempInstallRoot;

  beforeEach(async () => {
    root = await makeInstallRoot();
  });

  afterEach(async () => {
    await root.cleanup();
  });

  it('exits 1 + prints help when no args are supplied', async () => {
    const deps = makeCliDeps(root);
    const exit = await runCli([], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('USAGE');
  });

  it('exits 0 + prints help on --help', async () => {
    const deps = makeCliDeps(root);
    const exit = await runCli(['--help'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('USAGE');
    expect(deps.logger.joined()).toContain('stageflip-pack');
  });

  it('exits 0 + prints help on -h', async () => {
    const deps = makeCliDeps(root);
    const exit = await runCli(['-h'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('USAGE');
  });

  it('exits 0 + prints help on the `help` keyword', async () => {
    const deps = makeCliDeps(root);
    const exit = await runCli(['help'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('USAGE');
  });

  it('exits 1 + prints help on an unknown subcommand', async () => {
    const deps = makeCliDeps(root);
    const exit = await runCli(['frobnicate'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('unknown subcommand: frobnicate');
    expect(deps.logger.joined()).toContain('USAGE');
  });

  it('routes `list` to runList', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    const deps = makeCliDeps(root);
    const exit = await runCli(['list'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('pack-a');
  });

  it('routes `info` to runInfo', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    const deps = makeCliDeps(root);
    const exit = await runCli(['info', 'pack-a'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('id: pack-a');
  });

  it('routes `verify` to runVerify', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    const deps = makeCliDeps(root);
    const exit = await runCli(['verify'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('OK   pack-a@1.0.0');
  });

  it('routes `install` to runInstall (stub-mode exit 2)', async () => {
    const deps = makeCliDeps(root);
    const exit = await runCli(['install', '/tmp/x.tar'], deps);
    expect(exit).toBe(2);
    expect(deps.logger.joined()).toContain('not yet implemented');
  });

  it('routes `remove` to runRemove', async () => {
    await writePack(root, { publisher: 'pub-1', id: 'pack-a', version: '1.0.0' });
    const deps = makeCliDeps(root);
    const exit = await runCli(['remove', 'pack-a', '--yes'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('removed');
  });
});
