// packages/pack-publish-cli/src/commands/validate.test.ts
// T-500 — Tests for `runValidate` + `runValidateCommand`. Mirrors the
// T-499 CI gate invariants against an unsigned pack source directory.

import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type TempDir, makeRecorderDeps, makeTempDir, writeMinimalPack } from '../test-helpers.js';
import { runValidate, runValidateCommand } from './validate.js';

describe('runValidate', () => {
  let tmp: TempDir;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await tmp.cleanup();
  });

  it('open-licensed valid pack → ok', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'a fine open-licensed demo pack',
      repository: 'https://example.com/repo',
      keywords: ['demo', 'sample'],
    });
    const result = await runValidate(packDir, deps.fs);
    expect(result.ok).toBe(true);
    expect(result.issues.filter((i) => i.level === 'fail').length).toBe(0);
  });

  it('paid pack with sku/entitlementType → ok', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      license: { kind: 'paid-per-tenant', sku: 'demo-paid', entitlementType: 'subscription' },
      description: 'a fine paid demo pack',
      keywords: ['paid'],
      homepage: 'https://example.com',
    });
    const result = await runValidate(packDir, deps.fs);
    expect(result.ok).toBe(true);
  });

  it('bad JSON → fail with manifest-parse-error', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, { malformedJson: true });
    const result = await runValidate(packDir, deps.fs);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.invariant === 'manifest-parse-error')).toBe(true);
  });

  it('schema fail (uppercase id) → fail', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, { id: 'BadCase' });
    const result = await runValidate(packDir, deps.fs);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.invariant === 'manifest-parse-error')).toBe(true);
  });

  it('missing platformCompatibility → fail', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, { platformCompatibility: '' });
    const result = await runValidate(packDir, deps.fs);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.invariant === 'platform-compat-invalid')).toBe(true);
  });

  it('warns when description missing', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      repository: 'https://example.com/repo',
      keywords: ['demo'],
    });
    const result = await runValidate(packDir, deps.fs);
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.level === 'warn' && i.detail.includes('description'))).toBe(
      true,
    );
  });

  it('warns when repository AND homepage missing', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'a fine valid description',
      keywords: ['demo'],
    });
    const result = await runValidate(packDir, deps.fs);
    expect(result.ok).toBe(true);
    expect(
      result.issues.some(
        (i) => i.level === 'warn' && /repository.*homepage|homepage.*repository/.test(i.detail),
      ),
    ).toBe(true);
  });

  it('warns when keywords empty', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'a fine valid description',
      repository: 'https://example.com/repo',
    });
    const result = await runValidate(packDir, deps.fs);
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.level === 'warn' && i.detail.includes('keywords'))).toBe(
      true,
    );
  });

  it('missing manifest → fail with manifest-parse-error', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, { skipManifest: true });
    const result = await runValidate(packDir, deps.fs);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.invariant).toBe('manifest-parse-error');
  });

  it('bad version regex → fail with version-regex-mismatch', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, { version: 'not-semver!' });
    const result = await runValidate(packDir, deps.fs);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.invariant === 'version-regex-mismatch')).toBe(true);
  });
});

describe('runValidateCommand', () => {
  let tmp: TempDir;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await tmp.cleanup();
  });

  it('exit 0 on valid pack', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, {
      description: 'fine description here',
      repository: 'https://example.com/repo',
      keywords: ['demo'],
    });
    const code = await runValidateCommand([packDir], deps);
    expect(code).toBe(0);
    expect(deps.logger.joined()).toContain('PASS');
  });

  it('exit 1 on bad pack', async () => {
    const deps = makeRecorderDeps();
    const packDir = await writeMinimalPack(tmp.path, { malformedJson: true });
    const code = await runValidateCommand([packDir], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('FAIL');
  });

  it('exit 1 when <pack-dir> is missing', async () => {
    const deps = makeRecorderDeps();
    const code = await runValidateCommand([], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('<pack-dir>');
  });

  it('exit 1 on unknown flag', async () => {
    const deps = makeRecorderDeps();
    const code = await runValidateCommand([join(tmp.path, 'somepack'), '--bogus'], deps);
    expect(code).toBe(1);
    expect(deps.logger.joined()).toContain('unknown flag');
  });
});
