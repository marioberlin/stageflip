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
const VENDOR_ENGINE = resolve(HERE, '..', 'vendor', 'engine');

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
