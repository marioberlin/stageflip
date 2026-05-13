// packages/pack-publish-cli/src/commands/license.test.ts
// T-501 — Tests for `runLicense` — verifies file emission, default
// out-dir, --force overwrite semantics, unknown-tier exit, and
// required-var validation.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type TempDir, makeRecorderDeps, makeTempDir } from '../test-helpers.js';
import { DEFAULT_OUT_DIR, runLicense } from './license.js';

describe('runLicense', () => {
  let tmp: TempDir;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await tmp.cleanup();
  });

  it('writes all 3 files into --out-dir', async () => {
    const deps = makeRecorderDeps();
    const outDir = join(tmp.path, 'out');
    const exit = await runLicense(['attribution-required', '--out-dir', outDir], deps);
    expect(exit).toBe(0);
    const license = await readFile(join(outDir, 'LICENSE.md'), 'utf-8');
    const notice = await readFile(join(outDir, 'NOTICE.md'), 'utf-8');
    const snippet = await readFile(join(outDir, 'MANIFEST_LICENSE_SNIPPET.json'), 'utf-8');
    expect(license).toContain('SPDX-License-Identifier: Apache-2.0');
    expect(notice).toContain('Apache License');
    expect(JSON.parse(snippet)).toEqual({ kind: 'open', spdx: 'Apache-2.0' });
  });

  it('default out-dir is ./license-templates/', () => {
    expect(DEFAULT_OUT_DIR).toBe('./license-templates/');
  });

  it('substitutes --var k=v into the rendered LICENSE.md', async () => {
    const deps = makeRecorderDeps();
    const outDir = join(tmp.path, 'out');
    const exit = await runLicense(
      [
        'attribution-required',
        '--out-dir',
        outDir,
        '--var',
        'packName=Cool Pack',
        '--var',
        'publisherDisplayName=Cool Org',
      ],
      deps,
    );
    expect(exit).toBe(0);
    const license = await readFile(join(outDir, 'LICENSE.md'), 'utf-8');
    expect(license).toContain('Cool Pack');
    expect(license).toContain('Cool Org');
  });

  it('refuses to overwrite an existing file without --force', async () => {
    const deps = makeRecorderDeps();
    const outDir = join(tmp.path, 'out');
    // First call succeeds.
    const exit1 = await runLicense(['attribution-required', '--out-dir', outDir], deps);
    expect(exit1).toBe(0);
    // Second call refuses without --force.
    const exit2 = await runLicense(['attribution-required', '--out-dir', outDir], deps);
    expect(exit2).toBe(1);
    expect(deps.logger.joined()).toContain('already exists');
  });

  it('--force overrides the refuse-to-overwrite guard', async () => {
    const deps = makeRecorderDeps();
    const outDir = join(tmp.path, 'out');
    const exit1 = await runLicense(['attribution-required', '--out-dir', outDir], deps);
    expect(exit1).toBe(0);
    // Manually overwrite LICENSE.md with mock content.
    await writeFile(join(outDir, 'LICENSE.md'), 'STALE');
    const exit2 = await runLicense(['attribution-required', '--out-dir', outDir, '--force'], deps);
    expect(exit2).toBe(0);
    const license = await readFile(join(outDir, 'LICENSE.md'), 'utf-8');
    expect(license).not.toContain('STALE');
    expect(license).toContain('Apache-2.0');
  });

  it('unknown tier-id exits 1 with a hint listing valid IDs', async () => {
    const deps = makeRecorderDeps();
    const outDir = join(tmp.path, 'out');
    const exit = await runLicense(['no-such-tier', '--out-dir', outDir], deps);
    expect(exit).toBe(1);
    const joined = deps.logger.joined();
    expect(joined).toContain('unknown tier');
    expect(joined).toContain('commercial-subscription');
    expect(joined).toContain('attribution-required');
    expect(joined).toContain('non-commercial-only');
    expect(joined).toContain('public-domain');
  });

  it('missing tier-id positional exits 1', async () => {
    const deps = makeRecorderDeps();
    const exit = await runLicense([], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('<tier-id> is required');
  });

  it('explicit empty required var (e.g. sku for commercial) exits 1', async () => {
    const deps = makeRecorderDeps();
    const outDir = join(tmp.path, 'out');
    const exit = await runLicense(
      ['commercial-subscription', '--out-dir', outDir, '--var', 'sku='],
      deps,
    );
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain("'sku'");
  });

  it('unknown flag exits 1', async () => {
    const deps = makeRecorderDeps();
    const exit = await runLicense(['attribution-required', '--frobnicate'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('unknown flag');
  });

  it('--var without a value exits 1', async () => {
    const deps = makeRecorderDeps();
    const exit = await runLicense(['attribution-required', '--var'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('--var requires');
  });

  it('--var with malformed pair (no =) exits 1', async () => {
    const deps = makeRecorderDeps();
    const exit = await runLicense(['attribution-required', '--var', 'badpair'], deps);
    expect(exit).toBe(1);
    expect(deps.logger.joined()).toContain('--var expects');
  });

  it('commercial-subscription emits a manifest snippet with sku substituted', async () => {
    const deps = makeRecorderDeps();
    const outDir = join(tmp.path, 'out');
    const exit = await runLicense(
      [
        'commercial-subscription',
        '--out-dir',
        outDir,
        '--var',
        'sku=newsroom-pro',
        '--var',
        'contactEmail=licensing@example.com',
      ],
      deps,
    );
    expect(exit).toBe(0);
    const snippet = JSON.parse(
      await readFile(join(outDir, 'MANIFEST_LICENSE_SNIPPET.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(snippet).toEqual({
      kind: 'paid-per-tenant',
      sku: 'newsroom-pro',
      entitlementType: 'subscription',
    });
  });
});
