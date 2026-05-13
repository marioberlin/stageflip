// packages/pack-publish-cli/src/cli.test.ts
// T-500 — Dispatcher-level tests. Individual command behaviour is
// exercised in `commands/*.test.ts`; here we only verify routing,
// help-banner, and unknown-subcommand paths.

import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HELP_BANNER, runPublishCli } from './cli.js';
import {
  type TempDir,
  makeKeyPair,
  makeRecorderDeps,
  makeTempDir,
  writeMinimalPack,
  writePem,
} from './test-helpers.js';

describe('runPublishCli — dispatcher', () => {
  let tmp: TempDir;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await tmp.cleanup();
  });

  it('exits 1 + prints help when no args are supplied', async () => {
    const deps = makeRecorderDeps();
    const exit = await runPublishCli([], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('USAGE');
  });

  it('exits 0 + prints help on --help', async () => {
    const deps = makeRecorderDeps();
    const exit = await runPublishCli(['--help'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('stageflip-pack-publish');
  });

  it('exits 0 + prints help on -h', async () => {
    const deps = makeRecorderDeps();
    const exit = await runPublishCli(['-h'], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('USAGE');
  });

  it('exits 1 + prints help on an unknown subcommand', async () => {
    const deps = makeRecorderDeps();
    const exit = await runPublishCli(['frobnicate'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('unknown subcommand: frobnicate');
    expect(deps.logger.joined()).toContain('USAGE');
  });

  it('routes `validate` to its handler', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'fine description',
      repository: 'https://example.com/r',
      keywords: ['demo'],
    });
    const exit = await runPublishCli(['validate', packDir], deps);
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('PASS');
  });

  it('routes `sign` to its handler', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'fine description',
      repository: 'https://example.com/r',
      keywords: ['demo'],
    });
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.archive');
    const exit = await runPublishCli(
      ['sign', packDir, '--key', privateKeyPath, '--out', archivePath],
      deps,
    );
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('signed');
  });

  it('routes `publish` to its handler (dry-run)', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'fine description',
      repository: 'https://example.com/r',
      keywords: ['demo'],
    });
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.archive');
    await runPublishCli(['sign', packDir, '--key', privateKeyPath, '--out', archivePath], deps);
    const exit = await runPublishCli(
      ['publish', archivePath, '--registry', 'dry-run://local'],
      deps,
    );
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('would publish');
  });

  it('HELP_BANNER mentions every subcommand', () => {
    expect(HELP_BANNER).toContain('validate');
    expect(HELP_BANNER).toContain('sign');
    expect(HELP_BANNER).toContain('publish');
    expect(HELP_BANNER).toContain('license');
  });

  it('routes `license` to its handler', async () => {
    const deps = makeRecorderDeps();
    const outDir = join(tmp.path, 'lic-out');
    const exit = await runPublishCli(
      ['license', 'attribution-required', '--out-dir', outDir],
      deps,
    );
    expect(exit).toBe(0);
    expect(deps.logger.joined()).toContain('license: emitted');
  });
});
