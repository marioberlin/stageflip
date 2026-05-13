// packages/pack-signing/src/commands/sign.test.ts
// T-498 — Tests for `signPackDirectory` + `runSignCommand`.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ED25519_SIGNATURE_LENGTH, verifyPackArchive } from '@stageflip/pack-format';

import { ARCHIVE_MAGIC, parseArchive } from '../archive.js';
import {
  type TempDir,
  makeKeyPair,
  makeNodeDepsWithRecorder,
  makeTempDir,
  writeMinimalPack,
  writePem,
} from '../test-helpers.js';
import { SignPackError, runSignCommand, signPackDirectory } from './sign.js';

describe('signPackDirectory', () => {
  let tmp: TempDir;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await tmp.cleanup();
  });

  it('round-trip: sign a dir → verify the archive externally', async () => {
    const deps = makeNodeDepsWithRecorder();
    const packDir = await writeMinimalPack(tmp.path);
    const { privateKeyPem, publicKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.stageflip-pack');
    const result = await signPackDirectory({ packDir, privateKeyPath, archivePath }, deps);
    expect(verifyPackArchive(result.archiveBytes, result.signature, publicKeyPem)).toBe(true);
    // Sanity: archive header is the expected magic.
    const onDisk = await readFile(archivePath);
    expect(onDisk.subarray(0, ARCHIVE_MAGIC.length)).toEqual(Buffer.from(ARCHIVE_MAGIC));
  });

  it('refuses if manifest.json is missing', async () => {
    const fs = await import('node:fs/promises');
    const deps = makeNodeDepsWithRecorder();
    const emptyPackDir = join(tmp.path, 'empty-pack');
    await fs.mkdir(emptyPackDir, { recursive: true });
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.archive');
    await expect(
      signPackDirectory({ packDir: emptyPackDir, privateKeyPath, archivePath }, deps),
    ).rejects.toBeInstanceOf(SignPackError);
  });

  it('refuses if private key is unreadable', async () => {
    const deps = makeNodeDepsWithRecorder();
    const packDir = await writeMinimalPack(tmp.path);
    const archivePath = join(tmp.path, 'demo.archive');
    await expect(
      signPackDirectory(
        { packDir, privateKeyPath: join(tmp.path, 'no-such.pem'), archivePath },
        deps,
      ),
    ).rejects.toBeInstanceOf(SignPackError);
  });

  it('writes a 64-byte signature file', async () => {
    const deps = makeNodeDepsWithRecorder();
    const packDir = await writeMinimalPack(tmp.path);
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.archive');
    const result = await signPackDirectory({ packDir, privateKeyPath, archivePath }, deps);
    const sigOnDisk = await readFile(result.signaturePath);
    expect(sigOnDisk.length).toBe(ED25519_SIGNATURE_LENGTH);
  });

  it('updates integrity.hash on the manifest inside the archive', async () => {
    const deps = makeNodeDepsWithRecorder();
    const packDir = await writeMinimalPack(tmp.path);
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.archive');
    const result = await signPackDirectory({ packDir, privateKeyPath, archivePath }, deps);
    expect(result.integrityHash).toMatch(/^[0-9a-f]{64}$/);
    // Verify by re-parsing the archive: the manifest entry should
    // have the same hash.
    const parsed = parseArchive(result.archiveBytes);
    const manifestEntry = parsed.find((f) => f.path === 'manifest.json');
    expect(manifestEntry).toBeDefined();
    const manifestText = new TextDecoder().decode(manifestEntry?.content);
    const parsedManifest = JSON.parse(manifestText) as { integrity: { hash: string } };
    expect(parsedManifest.integrity.hash).toBe(result.integrityHash);
  });

  it('produces different archives for different inputs', async () => {
    const deps = makeNodeDepsWithRecorder();
    const packDirA = await writeMinimalPack(tmp.path);
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archiveA = join(tmp.path, 'a.archive');
    const archiveB = join(tmp.path, 'b.archive');
    const resultA = await signPackDirectory(
      { packDir: packDirA, privateKeyPath, archivePath: archiveA },
      deps,
    );
    // Mutate one file in the pack.
    await writeFile(join(packDirA, 'assets', 'a.txt'), 'different');
    const resultB = await signPackDirectory(
      { packDir: packDirA, privateKeyPath, archivePath: archiveB },
      deps,
    );
    expect(resultA.integrityHash).not.toBe(resultB.integrityHash);
    expect(Buffer.from(resultA.archiveBytes).equals(Buffer.from(resultB.archiveBytes))).toBe(false);
  });

  it('produces byte-identical archives on repeated runs with same input', async () => {
    const deps = makeNodeDepsWithRecorder();
    const packDir = await writeMinimalPack(tmp.path);
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const r1 = await signPackDirectory(
      { packDir, privateKeyPath, archivePath: join(tmp.path, 'a1.archive') },
      deps,
    );
    const r2 = await signPackDirectory(
      { packDir, privateKeyPath, archivePath: join(tmp.path, 'a2.archive') },
      deps,
    );
    expect(Buffer.from(r1.archiveBytes).equals(Buffer.from(r2.archiveBytes))).toBe(true);
    expect(r1.integrityHash).toBe(r2.integrityHash);
  });

  it('runSignCommand: dispatches a full successful sign', async () => {
    const deps = makeNodeDepsWithRecorder();
    const packDir = await writeMinimalPack(tmp.path);
    const { privateKeyPem } = makeKeyPair();
    const privateKeyPath = await writePem(join(tmp.path, 'priv.pem'), privateKeyPem);
    const archivePath = join(tmp.path, 'demo.archive');
    const code = await runSignCommand(
      [packDir, '--key', privateKeyPath, '--out', archivePath],
      deps,
    );
    expect(code).toBe(0);
    expect(deps.logger.joined()).toContain('wrote');
    expect(deps.logger.joined()).toContain('integrity');
  });

  it('runSignCommand: exits 1 when --key is missing', async () => {
    const deps = makeNodeDepsWithRecorder();
    const packDir = await writeMinimalPack(tmp.path);
    const archivePath = join(tmp.path, 'demo.archive');
    const code = await runSignCommand([packDir, '--out', archivePath], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('--key');
  });
});
