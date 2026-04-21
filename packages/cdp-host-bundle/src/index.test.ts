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
    expect(report.message).toMatch(/\d+(\.\d+)? KB/);
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
});
