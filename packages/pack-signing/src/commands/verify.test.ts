// packages/pack-signing/src/commands/verify.test.ts
// T-498 — Tests for `verifySignedPack` + `runVerifyCommand`.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type TempDir,
  makeKeyPair,
  makeNodeDepsWithRecorder,
  makeTempDir,
  writeMinimalPack,
  writePem,
} from '../test-helpers.js';
import { signPackDirectory } from './sign.js';
import { runVerifyCommand, verifySignedPack } from './verify.js';

interface SignedFixture {
  archivePath: string;
  signaturePath: string;
  publicKeyPath: string;
}

async function signFixture(tmpPath: string): Promise<SignedFixture> {
  const deps = makeNodeDepsWithRecorder();
  const packDir = await writeMinimalPack(tmpPath);
  const { privateKeyPem, publicKeyPem } = makeKeyPair();
  const privateKeyPath = await writePem(join(tmpPath, 'priv.pem'), privateKeyPem);
  const publicKeyPath = await writePem(join(tmpPath, 'pub.pem'), publicKeyPem);
  const archivePath = join(tmpPath, 'demo.archive');
  const result = await signPackDirectory({ packDir, privateKeyPath, archivePath }, deps);
  return {
    archivePath: result.archivePath,
    signaturePath: result.signaturePath,
    publicKeyPath,
  };
}

describe('verifySignedPack', () => {
  let tmp: TempDir;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await tmp.cleanup();
  });

  it('verifies a freshly-signed archive', async () => {
    const fix = await signFixture(tmp.path);
    const deps = makeNodeDepsWithRecorder();
    const result = await verifySignedPack(
      { archivePath: fix.archivePath, publicKeyPath: fix.publicKeyPath },
      deps,
    );
    expect(result.ok).toBe(true);
  });

  it('rejects when the archive is tampered with', async () => {
    const fix = await signFixture(tmp.path);
    // Flip one byte near the end (so the magic stays intact).
    const bytes = await readFile(fix.archivePath);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    await writeFile(fix.archivePath, bytes);
    const deps = makeNodeDepsWithRecorder();
    const result = await verifySignedPack(
      { archivePath: fix.archivePath, publicKeyPath: fix.publicKeyPath },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toContain('signature did not verify');
    }
  });

  it('rejects when the signature is tampered with', async () => {
    const fix = await signFixture(tmp.path);
    const sig = await readFile(fix.signaturePath);
    sig[0] = (sig[0] ?? 0) ^ 0xff;
    await writeFile(fix.signaturePath, sig);
    const deps = makeNodeDepsWithRecorder();
    const result = await verifySignedPack(
      { archivePath: fix.archivePath, publicKeyPath: fix.publicKeyPath },
      deps,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects with the wrong public key', async () => {
    const fix = await signFixture(tmp.path);
    const wrong = makeKeyPair();
    const wrongPath = await writePem(join(tmp.path, 'wrong-pub.pem'), wrong.publicKeyPem);
    const deps = makeNodeDepsWithRecorder();
    const result = await verifySignedPack(
      { archivePath: fix.archivePath, publicKeyPath: wrongPath },
      deps,
    );
    expect(result.ok).toBe(false);
  });

  it('returns structured ok=false when the archive is missing', async () => {
    const deps = makeNodeDepsWithRecorder();
    const result = await verifySignedPack(
      { archivePath: join(tmp.path, 'no-such.archive'), publicKeyPath: join(tmp.path, 'no.pem') },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toContain('archive not found');
    }
  });

  it('runVerifyCommand: prints `verified` on success, exit 0', async () => {
    const fix = await signFixture(tmp.path);
    const deps = makeNodeDepsWithRecorder();
    const code = await runVerifyCommand([fix.archivePath, '--key', fix.publicKeyPath], deps);
    expect(code).toBe(0);
    expect(deps.logger.info_).toContain('verified');
  });

  it('runVerifyCommand: exit 1 on bad signature', async () => {
    const fix = await signFixture(tmp.path);
    const bytes = await readFile(fix.archivePath);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    await writeFile(fix.archivePath, bytes);
    const deps = makeNodeDepsWithRecorder();
    const code = await runVerifyCommand([fix.archivePath, '--key', fix.publicKeyPath], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('signature did not verify');
  });

  it('runVerifyCommand: exit 1 when --key is missing', async () => {
    const deps = makeNodeDepsWithRecorder();
    const code = await runVerifyCommand(['some-archive'], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('--key');
  });
});
