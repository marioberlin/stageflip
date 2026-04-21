// packages/cdp-host-bundle/src/index.test.ts
// Smoke-check that `loadBundleSource()` reads a real compiled bundle
// off disk + `bundleDoctor()` reports on it. Requires `pnpm build`
// to have run first — the Turbo graph ensures this because `test`
// depends on `^build`.

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { bundleDoctor, bundlePath, loadBundleSource } from './index';

describe('loadBundleSource', () => {
  it('reads the compiled IIFE bundle off dist/browser/bundle.js', async () => {
    const source = await loadBundleSource();
    expect(typeof source).toBe('string');
    // Sanity: the bundle is an IIFE and mentions React jsx runtime.
    expect(source.length).toBeGreaterThan(1000);
    expect(source.startsWith('(function(')).toBe(true);
  });

  it('bundlePath returns the filesystem location that loadBundleSource reads', async () => {
    const path = await bundlePath();
    expect(path).toMatch(/dist\/browser\/bundle\.js$/);
    const directRead = await readFile(path, 'utf8');
    const viaLoader = await loadBundleSource();
    expect(viaLoader).toBe(directRead);
  });
});

describe('bundleDoctor', () => {
  it('reports sizeBytes + a human-readable message for a built bundle', async () => {
    const report = await bundleDoctor();
    expect(report.exists).toBe(true);
    expect(report.sizeBytes).toBeGreaterThan(0);
    expect(report.path).toMatch(/dist\/browser\/bundle\.js$/);
    expect(report.message).toContain('cdp-host-bundle');
    // T-100e bundle is ~1.59 MB so the formatter should switch to MB;
    // accept either unit so the test stays robust if T-100d-size
    // bundles ever re-surface (e.g. CSS-only rebuilds for doctor tests).
    expect(report.message).toMatch(/\d+(\.\d+)? (KB|MB)/);
  });

  it('flags warn=true when the bundle exceeds warnAtBytes', async () => {
    // Deliberately tiny threshold — any non-empty bundle will trip it.
    const report = await bundleDoctor({ warnAtBytes: 1 });
    expect(report.warn).toBe(true);
    expect(report.message).toContain('exceeds');
  });

  it('flags warn=false when the bundle is under warnAtBytes', async () => {
    const report = await bundleDoctor({ warnAtBytes: 100 * 1024 * 1024 });
    expect(report.warn).toBe(false);
    expect(report.message).toContain('within');
  });

  it('returns exists=false with actionable message when the bundle is missing', async () => {
    // Point bundleDoctor at a path that certainly doesn't exist so it
    // takes the catch branch. No module mocking needed.
    const report = await bundleDoctor({
      path: '/tmp/stageflip-cdp-host-bundle-does-not-exist.js',
      warnAtBytes: 1,
    });
    expect(report.exists).toBe(false);
    expect(report.sizeBytes).toBe(0);
    expect(report.warn).toBe(false);
    expect(report.message).toContain('bundle not found');
    expect(report.message).toContain('pnpm --filter @stageflip/cdp-host-bundle build');
    expect(report.path).toBe('/tmp/stageflip-cdp-host-bundle-does-not-exist.js');
  });

  it('honours a custom path pointing at a file that is NOT the default bundle', async () => {
    // Point bundleDoctor at `package.json` (guaranteed to exist +
    // guaranteed to differ from bundlePath()'s `dist/browser/bundle.js`).
    // If the implementation silently ignored `opts.path` and fell
    // through to `bundlePath()`, `report.path` would come back as
    // the bundle path instead and this assertion would fail.
    const pkgRoot = await bundlePath(); // ends in .../dist/browser/bundle.js
    const packageJsonPath = pkgRoot.replace(/\/dist\/browser\/bundle\.js$/, '/package.json');
    expect(packageJsonPath).not.toBe(pkgRoot);
    const report = await bundleDoctor({ path: packageJsonPath, warnAtBytes: 1 });
    expect(report.exists).toBe(true);
    expect(report.path).toBe(packageJsonPath);
    expect(report.path).not.toBe(pkgRoot);
    expect(report.sizeBytes).toBeGreaterThan(0);
  });
});
