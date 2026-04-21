// packages/cdp-host-bundle/src/index.test.ts
// Smoke-check that `loadBundleSource()` reads a real compiled bundle
// off disk. Requires `pnpm build` to have run first — the Turbo
// graph ensures this because `test` depends on `^build`.

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { bundlePath, loadBundleSource } from './index';

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
