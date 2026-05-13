// packages/pack-signing/src/cli.test.ts
// T-498 — Dispatcher-level tests. Individual command behaviour is
// exercised in `commands/*.test.ts`; here we only verify routing,
// help-banner, and unknown-subcommand paths.

import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSignCli } from './cli.js';
import {
  type TempDir,
  makeNodeDepsWithRecorder,
  makeTempDir,
  writeMinimalPack,
  writePem,
} from './test-helpers.js';

describe('runSignCli — dispatcher', () => {
  let tmp: TempDir;

  beforeEach(async () => {
    tmp = await makeTempDir();
  });

  afterEach(async () => {
    await tmp.cleanup();
  });

  it('exits 1 + prints help when no args are supplied', async () => {
    const deps = makeNodeDepsWithRecorder();
    const exit = await runSignCli([], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('USAGE');
  });

  it('exits 0 + prints help on --help', async () => {
    const deps = makeNodeDepsWithRecorder();
    const exit = await runSignCli(['--help'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('stageflip-pack-sign');
  });

  it('exits 0 + prints help on -h', async () => {
    const deps = makeNodeDepsWithRecorder();
    const exit = await runSignCli(['-h'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('USAGE');
  });

  it('exits 1 + prints help on an unknown subcommand', async () => {
    const deps = makeNodeDepsWithRecorder();
    const exit = await runSignCli(['frobnicate'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('unknown subcommand: frobnicate');
    expect(deps.logger.joined()).toContain('USAGE');
  });

  it('routes `generate-keys` to its handler', async () => {
    const deps = makeNodeDepsWithRecorder();
    const exit = await runSignCli(['generate-keys', '--out-dir', tmp.path], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('publisher.private.pem');
  });

  it('routes `sign` to its handler', async () => {
    const deps = makeNodeDepsWithRecorder();
    // Bootstrap a fresh keypair + pack dir via the same CLI surface.
    const keysCode = await runSignCli(['generate-keys', '--out-dir', tmp.path], deps);
    expect(keysCode).toBe(0);
    const packDir = await writeMinimalPack(tmp.path);
    const archivePath = join(tmp.path, 'demo.archive');
    const exit = await runSignCli(
      ['sign', packDir, '--key', join(tmp.path, 'publisher.private.pem'), '--out', archivePath],
      deps,
    );
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('integrity');
  });

  it('routes `verify` to its handler', async () => {
    const deps = makeNodeDepsWithRecorder();
    await runSignCli(['generate-keys', '--out-dir', tmp.path], deps);
    const packDir = await writeMinimalPack(tmp.path);
    const archivePath = join(tmp.path, 'demo.archive');
    await runSignCli(
      ['sign', packDir, '--key', join(tmp.path, 'publisher.private.pem'), '--out', archivePath],
      deps,
    );
    const verifyExit = await runSignCli(
      ['verify', archivePath, '--key', join(tmp.path, 'publisher.public.pem')],
      deps,
    );
    expect(verifyExit).toBe(0);
    expect(deps.logger.info_).toContain('verified');
  });

  it('sign exits 1 when --out is missing', async () => {
    const deps = makeNodeDepsWithRecorder();
    await writePem(join(tmp.path, 'priv.pem'), '---');
    const exit = await runSignCli(['sign', tmp.path, '--key', join(tmp.path, 'priv.pem')], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('--out');
  });
});
