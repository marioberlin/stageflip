// packages/pack-publish-cli/src/commands/sign.test.ts
// T-500 — Tests for `runSign`. Mirrors @stageflip/pack-signing's archive
// shape with the pre-flight validate gate layered on top.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ED25519_SIGNATURE_LENGTH, verifyPackArchive } from '@stageflip/pack-format';
import { ARCHIVE_MAGIC, parseArchive } from '@stageflip/pack-signing';

import {
  type TempDir,
  makeKeyPair,
  makeRecorderDeps,
  makeTempDir,
  writeMinimalPack,
  writePem,
} from '../test-helpers.js';
import { runSign } from './sign.js';

describe('runSign', () => {
  let tmp: TempDir;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await tmp.cleanup();
  });

  it('round trip: validate → sign → verify externally → ok', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'good description here',
      repository: 'https://example.com/repo',
      keywords: ['demo'],
    });
    const { privateKeyPem, publicKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.stageflip-pack');
    const code = await runSign([packDir, '--key', privateKeyPath, '--out', archivePath], deps);
    expect(code).toBe(0);
    const archiveBytes = await readFile(archivePath);
    const sigBytes = await readFile(`${archivePath}.sig`);
    expect(sigBytes.length).toBe(ED25519_SIGNATURE_LENGTH);
    expect(verifyPackArchive(archiveBytes, sigBytes, publicKeyPem)).toBe(true);
  });

  it('refuses to sign if validate fails', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, { malformedJson: true });
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.archive');
    const code = await runSign([packDir, '--key', privateKeyPath, '--out', archivePath], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('refusing to sign');
  });

  it('refuses to sign if private key is missing', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'fine description',
      keywords: ['x'],
      homepage: 'https://example.com',
    });
    const archivePath = join(tmp.path, 'demo.archive');
    const code = await runSign(
      [packDir, '--key', join(tmp.path, 'nope.pem'), '--out', archivePath],
      deps,
    );
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('private key not found');
  });

  it('writes both <out> + <out>.sig', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'good description',
      repository: 'https://example.com/r',
      keywords: ['demo'],
    });
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.archive');
    const code = await runSign([packDir, '--key', privateKeyPath, '--out', archivePath], deps);
    expect(code).toBe(0);
    await expect(deps.fs.exists(archivePath)).resolves.toBe(true);
    await expect(deps.fs.exists(`${archivePath}.sig`)).resolves.toBe(true);
  });

  it('prints byte counts in summary', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'good description',
      repository: 'https://example.com/r',
      keywords: ['demo'],
    });
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.archive');
    await runSign([packDir, '--key', privateKeyPath, '--out', archivePath], deps);
    expect(deps.logger.joined()).toMatch(/\d+ bytes archive, \d+ files/);
  });

  it('mirrors pack-signing’s deterministic archive shape (SFPACK1 magic)', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'good description',
      repository: 'https://example.com/r',
      keywords: ['demo'],
    });
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.archive');
    await runSign([packDir, '--key', privateKeyPath, '--out', archivePath], deps);
    const onDisk = await readFile(archivePath);
    expect(onDisk.subarray(0, ARCHIVE_MAGIC.length)).toEqual(Buffer.from(ARCHIVE_MAGIC));
    // manifest.json is present in the archive.
    const parsed = parseArchive(
      new Uint8Array(onDisk.buffer, onDisk.byteOffset, onDisk.byteLength),
    );
    expect(parsed.find((f) => f.path === 'manifest.json')).toBeDefined();
  });

  it('exits 1 when --key flag is missing', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path);
    const archivePath = join(tmp.path, 'demo.archive');
    const code = await runSign([packDir, '--out', archivePath], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('--key');
  });

  it('exits 1 when --out flag is missing', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path);
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const code = await runSign([packDir, '--key', privateKeyPath], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('--out');
  });
});
