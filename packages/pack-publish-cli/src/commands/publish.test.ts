// packages/pack-publish-cli/src/commands/publish.test.ts
// T-500 — Tests for `runPublish`. Covers dry-run, HTTP path, env-var
// resolution, signature verification, archive/signature existence,
// and HTTP status-code error handling.

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type TempDir,
  makeKeyPair,
  makeRecorderDeps,
  makeTempDir,
  writeMinimalPack,
  writePem,
} from '../test-helpers.js';
import { runPublish } from './publish.js';
import { runSign } from './sign.js';

/**
 * Sign a fresh pack under `tmp` and return `{ archivePath, publisherKeyPath }`.
 * Used as the setup for every test in this file.
 */
async function signFreshPack(tmpPath: string): Promise<{
  archivePath: string;
  publisherKeyPath: string;
  bogusKeyPath: string;
}> {
  const deps = makeRecorderDeps();
  const packDir = await writeMinimalPack(tmpPath, {
    description: 'good description here',
    repository: 'https://example.com/repo',
    keywords: ['demo'],
  });
  const { privateKeyPem, publicKeyPem } = makeKeyPair();
  const privateKeyPath = await writePem(join(tmpPath, 'priv.pem'), privateKeyPem);
  const publisherKeyPath = await writePem(join(tmpPath, 'pub.pem'), publicKeyPem);
  // Another, non-matching key for the verify-fails case.
  const bogus = makeKeyPair();
  const bogusKeyPath = await writePem(join(tmpPath, 'bogus.pem'), bogus.publicKeyPem);
  const archivePath = join(tmpPath, 'demo.archive');
  const code = await runSign([packDir, '--key', privateKeyPath, '--out', archivePath], deps);
  expect(code).toBe(0);
  return { archivePath, publisherKeyPath, bogusKeyPath };
}

describe('runPublish', () => {
  let tmp: TempDir;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await tmp.cleanup();
  });

  it('dry-run URL → prints would publish + exit 0, no HTTP call', async () => {
    const { archivePath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps();
    const code = await runPublish([archivePath, '--registry', 'dry-run://localhost'], deps);
    expect(code).toBe(0);
    expect(deps.http.calls.length).toBe(0);
    expect(deps.logger.joined()).toContain('would publish demo@1.0.0');
  });

  it('real URL → POST to <url>/api/v1/packs with Authorization header', async () => {
    const { archivePath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps({ env: { STAGEFLIP_TOKEN: 'secret-123' } });
    const code = await runPublish(
      [archivePath, '--registry', 'https://registry.example.com', '--token', 'STAGEFLIP_TOKEN'],
      deps,
    );
    expect(code).toBe(0);
    expect(deps.http.calls.length).toBe(1);
    const call = deps.http.calls[0];
    expect(call?.url).toBe('https://registry.example.com/api/v1/packs');
    expect(call?.headers.authorization).toBe('Bearer secret-123');
  });

  it('token from env var (different name)', async () => {
    const { archivePath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps({ env: { MY_TOKEN: 'tok-abc' } });
    const code = await runPublish(
      [archivePath, '--registry', 'https://registry.example.com', '--token', 'MY_TOKEN'],
      deps,
    );
    expect(code).toBe(0);
    expect(deps.http.calls[0]?.headers.authorization).toBe('Bearer tok-abc');
  });

  it('missing token env var → exit 1', async () => {
    const { archivePath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps();
    const code = await runPublish(
      [archivePath, '--registry', 'https://registry.example.com', '--token', 'NOT_SET'],
      deps,
    );
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain("'NOT_SET' is not set");
  });

  it('missing archive file → exit 1', async () => {
    const deps = makeRecorderDeps();
    const code = await runPublish(
      [join(tmp.path, 'no-such.archive'), '--registry', 'dry-run://x'],
      deps,
    );
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('archive not found');
  });

  it('missing signature file → exit 1', async () => {
    const { archivePath } = await signFreshPack(tmp.path);
    // Copy archive to a new path WITHOUT the .sig sidecar.
    const stripped = join(tmp.path, 'no-sig.archive');
    const { readFile } = await import('node:fs/promises');
    await writeFile(stripped, await readFile(archivePath));
    const deps = makeRecorderDeps();
    const code = await runPublish([stripped, '--registry', 'dry-run://x'], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('signature not found');
  });

  it('signature verify fails (wrong publisher key) → exit 1', async () => {
    const { archivePath, bogusKeyPath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps();
    const code = await runPublish(
      [archivePath, '--registry', 'dry-run://x', '--publisher-key', bogusKeyPath],
      deps,
    );
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('signature did not verify');
  });

  it('signature verify succeeds (matching publisher key) → ok', async () => {
    const { archivePath, publisherKeyPath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps();
    const code = await runPublish(
      [archivePath, '--registry', 'dry-run://x', '--publisher-key', publisherKeyPath],
      deps,
    );
    expect(code).toBe(0);
    expect(deps.logger.joined()).toContain('would publish demo@1.0.0');
  });

  it('HTTP 200 → exit 0 with success message', async () => {
    const { archivePath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps({ env: { TOKEN: 't' } });
    const code = await runPublish(
      [archivePath, '--registry', 'https://registry.example.com', '--token', 'TOKEN'],
      deps,
    );
    expect(code).toBe(0);
    expect(deps.logger.joined()).toContain('status 200');
  });

  it('HTTP 4xx → exit 1 with status code in error', async () => {
    const { archivePath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps({ env: { TOKEN: 't' } });
    deps.http.respond = async () => ({ status: 403, statusText: 'Forbidden', bodyText: 'no' });
    const code = await runPublish(
      [archivePath, '--registry', 'https://registry.example.com', '--token', 'TOKEN'],
      deps,
    );
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('403');
    expect(deps.logger.joined()).toContain('Forbidden');
  });

  it('HTTP 5xx → exit 1 with status code in error', async () => {
    const { archivePath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps({ env: { TOKEN: 't' } });
    deps.http.respond = async () => ({
      status: 500,
      statusText: 'Internal Error',
      bodyText: 'boom',
    });
    const code = await runPublish(
      [archivePath, '--registry', 'https://registry.example.com', '--token', 'TOKEN'],
      deps,
    );
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('500');
  });

  it('exits 1 when archive-path positional is missing', async () => {
    const deps = makeRecorderDeps();
    const code = await runPublish(['--registry', 'dry-run://x'], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('<archive-path>');
  });

  it('exits 1 when --registry is missing', async () => {
    const { archivePath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps();
    const code = await runPublish([archivePath], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('--registry');
  });

  it('exits 1 when --token missing for real HTTP url', async () => {
    const { archivePath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps();
    const code = await runPublish(
      [archivePath, '--registry', 'https://registry.example.com'],
      deps,
    );
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('--token');
  });

  it('HTTP error thrown by post() → exit 1', async () => {
    const { archivePath } = await signFreshPack(tmp.path);
    const deps = makeRecorderDeps({ env: { TOKEN: 't' } });
    deps.http.respond = async () => {
      throw new Error('network down');
    };
    const code = await runPublish(
      [archivePath, '--registry', 'https://registry.example.com', '--token', 'TOKEN'],
      deps,
    );
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('network down');
  });
});
