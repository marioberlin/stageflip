// packages/renderer-cdp/src/vendor-integrity.test.ts
// Vendor-integrity test (T-080). Asserts the vendored @hyperframes/engine
// payload is present, license-preserved, and pin-recorded. Runs inside the
// @stageflip/renderer-cdp test gate so any future edit that moves or breaks
// the vendor directory fails CI.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR_ROOT = resolve(HERE, '..', 'vendor');
const VENDOR_ENGINE = resolve(VENDOR_ROOT, 'engine');

interface Pin {
  upstream: string;
  package: string;
  packagePath: string;
  commit: string;
  vendoredAt: string;
  license: string;
  task: string;
}

const EXPECTED_COMMIT = 'd1f992570a2a2d7cb4fa0b4a7e31687a0791803d';

describe('vendor/engine (T-080)', () => {
  it('preserves upstream Apache-2.0 LICENSE at vendor root', () => {
    const licensePath = join(VENDOR_ENGINE, 'LICENSE');
    expect(existsSync(licensePath)).toBe(true);
    const license = readFileSync(licensePath, 'utf8');
    expect(license).toMatch(/Apache License[\s\S]+Version 2\.0/);
  });

  it('has PIN.json recording upstream + exact commit + date', () => {
    const pinPath = join(VENDOR_ENGINE, 'PIN.json');
    expect(existsSync(pinPath)).toBe(true);
    const pin = JSON.parse(readFileSync(pinPath, 'utf8')) as Pin;
    expect(pin.upstream).toBe('https://github.com/heygen-com/hyperframes');
    expect(pin.package).toBe('@hyperframes/engine');
    expect(pin.packagePath).toBe('packages/engine');
    expect(pin.commit).toBe(EXPECTED_COMMIT);
    expect(pin.vendoredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(pin.license).toBe('Apache-2.0');
    expect(pin.task).toBe('T-080');
  });

  it('carries the engine source entrypoint', () => {
    expect(existsSync(join(VENDOR_ENGINE, 'src', 'index.ts'))).toBe(true);
  });

  it('carries the engine package.json (upstream, unmodified)', () => {
    const pkgPath = join(VENDOR_ENGINE, 'package.json');
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string };
    expect(pkg.name).toBe('@hyperframes/engine');
  });
});

describe('vendor/NOTICE (T-081)', () => {
  const noticePath = join(VENDOR_ROOT, 'NOTICE');

  it('exists at vendor/ root', () => {
    expect(existsSync(noticePath)).toBe(true);
  });

  it('attributes @hyperframes/engine under Apache-2.0 with upstream + commit', () => {
    const notice = readFileSync(noticePath, 'utf8');
    expect(notice).toMatch(/@hyperframes\/engine/);
    expect(notice).toMatch(/HeyGen Inc\./);
    expect(notice).toMatch(/Apache License,? Version 2\.0/);
    expect(notice).toMatch(/https:\/\/github\.com\/heygen-com\/hyperframes/);
    expect(notice).toContain(EXPECTED_COMMIT);
  });

  it('documents the StageFlip modification policy (THIRD_PARTY.md §2)', () => {
    const notice = readFileSync(noticePath, 'utf8');
    expect(notice).toMatch(/Modifications by StageFlip/i);
    expect(notice).toMatch(/Modified by StageFlip/);
  });
});

describe('vendor/README.md (T-082)', () => {
  const readmePath = join(VENDOR_ROOT, 'README.md');

  it('exists at vendor/ root (distinct from upstream engine README)', () => {
    expect(existsSync(readmePath)).toBe(true);
  });

  it('explains what is vendored and pins @hyperframes/engine with the same commit', () => {
    const readme = readFileSync(readmePath, 'utf8');
    expect(readme).toMatch(/@hyperframes\/engine/);
    expect(readme).toContain(EXPECTED_COMMIT);
  });

  it('explains why we vendor (not reimplement) and covers the upgrade protocol', () => {
    const readme = readFileSync(readmePath, 'utf8');
    expect(readme).toMatch(/Why vendor/i);
    expect(readme).toMatch(/Upgrading/i);
    expect(readme).toMatch(/ADR/);
  });

  it('lists or links the current modification record', () => {
    const readme = readFileSync(readmePath, 'utf8');
    expect(readme).toMatch(/## Modifications/);
    expect(readme).toMatch(/Modified by StageFlip, YYYY-MM-DD/);
  });

  it('cross-references the canonical provenance files', () => {
    const readme = readFileSync(readmePath, 'utf8');
    expect(readme).toMatch(/THIRD_PARTY\.md/);
    expect(readme).toMatch(/docs\/dependencies\.md/);
    expect(readme).toMatch(/NOTICE/);
    expect(readme).toMatch(/PIN\.json/);
  });
});
