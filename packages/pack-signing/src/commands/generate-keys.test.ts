// packages/pack-signing/src/commands/generate-keys.test.ts
// T-498 — Tests for the `generate-keys` subcommand.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { signPackArchive, verifyPackArchive } from '@stageflip/pack-format';

import { type TempDir, makeNodeDepsWithRecorder, makeTempDir } from '../test-helpers.js';
import {
  GenerateKeysRefusalError,
  PRIVATE_KEY_FILENAME,
  PUBLIC_KEY_FILENAME,
  generateKeyPair,
  runGenerateKeysCommand,
} from './generate-keys.js';

describe('generate-keys', () => {
  let tmp: TempDir;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await tmp.cleanup();
  });

  it('writes both PEMs to the out-dir', async () => {
    const deps = makeNodeDepsWithRecorder();
    const result = await generateKeyPair({ outDir: tmp.path }, deps);
    expect(result.privateKeyPath).toBe(join(tmp.path, PRIVATE_KEY_FILENAME));
    expect(result.publicKeyPath).toBe(join(tmp.path, PUBLIC_KEY_FILENAME));
    const priv = await readFile(result.privateKeyPath, 'utf8');
    const pub = await readFile(result.publicKeyPath, 'utf8');
    expect(priv).toContain('BEGIN PRIVATE KEY');
    expect(pub).toContain('BEGIN PUBLIC KEY');
  });

  it('refuses to overwrite when files exist', async () => {
    const deps = makeNodeDepsWithRecorder();
    await generateKeyPair({ outDir: tmp.path }, deps);
    await expect(generateKeyPair({ outDir: tmp.path }, deps)).rejects.toBeInstanceOf(
      GenerateKeysRefusalError,
    );
  });

  it('--force overrides the refusal', async () => {
    const deps = makeNodeDepsWithRecorder();
    const first = await generateKeyPair({ outDir: tmp.path }, deps);
    const before = await readFile(first.privateKeyPath, 'utf8');
    const second = await generateKeyPair({ outDir: tmp.path, force: true }, deps);
    const after = await readFile(second.privateKeyPath, 'utf8');
    // Fresh keygen → different keypair.
    expect(before).not.toBe(after);
  });

  it('generated keypair signs + verifies a payload round-trip', async () => {
    const deps = makeNodeDepsWithRecorder();
    const { privateKeyPem, publicKeyPem } = await generateKeyPair({ outDir: tmp.path }, deps);
    const payload = new TextEncoder().encode('hello, stageflip');
    const sig = signPackArchive(payload, privateKeyPem);
    expect(verifyPackArchive(payload, sig, publicKeyPem)).toBe(true);
  });

  it('runGenerateKeysCommand: routes valid args to success', async () => {
    const deps = makeNodeDepsWithRecorder();
    const code = await runGenerateKeysCommand(['--out-dir', tmp.path], deps);
    expect(code).toBe(0);
    expect(deps.logger.joined()).toContain(PRIVATE_KEY_FILENAME);
    expect(deps.logger.joined()).toContain(PUBLIC_KEY_FILENAME);
  });

  it('runGenerateKeysCommand: exits 1 when --out-dir is missing', async () => {
    const deps = makeNodeDepsWithRecorder();
    const code = await runGenerateKeysCommand([], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('--out-dir');
  });

  it('runGenerateKeysCommand: exits 1 on refusal without --force', async () => {
    const deps = makeNodeDepsWithRecorder();
    await runGenerateKeysCommand(['--out-dir', tmp.path], deps);
    const code = await runGenerateKeysCommand(['--out-dir', tmp.path], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('refusing to overwrite');
  });
});
