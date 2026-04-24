// packages/export-html5-zip/src/orchestrator.test.ts
// T-203b — orchestrator behaviour: bundle → clickTag inject → fallback
// embed → deterministic ZIP → budget check.

import type { AssetRef, BannerFallback, DisplayBudget } from '@stageflip/schema';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { InMemoryAssetResolver } from './asset-resolver.js';
import {
  type ExportOrchestratorOptions,
  exportHtml5Zip,
  exportHtml5ZipForSize,
} from './orchestrator.js';
import type {
  BannerExportInput,
  BannerSize,
  FallbackProvider,
  HtmlBundle,
  HtmlBundler,
} from './types.js';
import { stringToZipBytes } from './zip.js';

const MPU: BannerSize = { width: 300, height: 250, name: 'Medium Rectangle' };
const LEADERBOARD: BannerSize = { width: 728, height: 90, name: 'Leaderboard', id: 'lb' };

const BASE_HTML = '<!doctype html><html><head></head><body></body></html>';

class StaticBundler implements HtmlBundler {
  constructor(
    private readonly html = BASE_HTML,
    private readonly assets: HtmlBundle['assets'] = [],
  ) {}
  async bundle(): Promise<HtmlBundle> {
    return { html: this.html, assets: this.assets };
  }
}

function simpleBudget(totalZipKb = 500): DisplayBudget {
  return {
    totalZipKb,
    externalFontsAllowed: false,
    externalFontsKbCap: 0,
    assetsInlined: true,
  };
}

function makeResolver(
  entries: Record<string, Uint8Array> = { 'asset:pngbytes': stringToZipBytes('PNG') },
): InMemoryAssetResolver {
  const list: [AssetRef, Uint8Array][] = Object.entries(entries) as [AssetRef, Uint8Array][];
  return new InMemoryAssetResolver(list);
}

function baseInput(overrides: Partial<BannerExportInput> = {}): BannerExportInput {
  return {
    sizes: [MPU],
    clickTag: 'https://example.com',
    fallback: { png: 'asset:pngbytes' } as BannerFallback,
    budget: simpleBudget(),
    ...overrides,
  };
}

/**
 * Build a deterministic, effectively-incompressible byte stream. Deflate
 * can't do better than ~8 bits/byte on inputs that walk every byte value
 * with no runs — this matches real-world non-text payloads (PNG, WOFF).
 * Exported test helper so the budget-exceeded assertions don't depend on
 * `Math.random`.
 */
function incompressibleBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  let state = 0x1234_5678;
  for (let i = 0; i < length; i++) {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    out[i] = state & 0xff;
  }
  return out;
}

function baseOpts(overrides: Partial<ExportOrchestratorOptions> = {}): ExportOrchestratorOptions {
  return {
    bundler: new StaticBundler(),
    assetResolver: makeResolver(),
    ...overrides,
  };
}

describe('exportHtml5ZipForSize', () => {
  it('produces a ZIP containing index.html + fallback.png', async () => {
    const result = await exportHtml5ZipForSize(MPU, baseInput(), baseOpts());
    const entries = unzipSync(result.zipBytes);
    expect(Object.keys(entries).sort()).toEqual(['fallback.png', 'index.html']);
  });

  it('injects the clickTag into index.html', async () => {
    const result = await exportHtml5ZipForSize(MPU, baseInput(), baseOpts());
    const entries = unzipSync(result.zipBytes);
    const html = new TextDecoder().decode(entries['index.html']);
    expect(html).toContain('var clickTag = "https://example.com"');
    expect(html).toContain('window.clickTag = clickTag');
  });

  it('embeds the optional animated GIF fallback when present', async () => {
    const input = baseInput({
      fallback: { png: 'asset:png', gif: 'asset:gif' } as BannerFallback,
    });
    const resolver = makeResolver({
      'asset:png': stringToZipBytes('PNG'),
      'asset:gif': stringToZipBytes('GIF'),
    });
    const result = await exportHtml5ZipForSize(MPU, input, baseOpts({ assetResolver: resolver }));
    const entries = unzipSync(result.zipBytes);
    expect(Object.keys(entries).sort()).toEqual(['fallback.gif', 'fallback.png', 'index.html']);
  });

  it('includes non-inlined bundler assets', async () => {
    const bundler = new StaticBundler(BASE_HTML, [
      { path: 'assets/a.png', bytes: stringToZipBytes('A') },
    ]);
    const result = await exportHtml5ZipForSize(MPU, baseInput(), baseOpts({ bundler }));
    const entries = unzipSync(result.zipBytes);
    expect(Object.keys(entries)).toContain('assets/a.png');
  });

  it('is deterministic — two runs produce byte-identical ZIPs', async () => {
    const a = await exportHtml5ZipForSize(MPU, baseInput(), baseOpts());
    const b = await exportHtml5ZipForSize(MPU, baseInput(), baseOpts());
    expect(a.zipBytes).toEqual(b.zipBytes);
  });

  it('emits a budget-exceeded finding when the ZIP is over cap', async () => {
    const hugeAsset = incompressibleBytes(60 * 1024); // 60 KB incompressible
    const bundler = new StaticBundler(BASE_HTML, [{ path: 'assets/huge.bin', bytes: hugeAsset }]);
    const input = baseInput({ budget: simpleBudget(10) }); // 10 KB cap
    const result = await exportHtml5ZipForSize(MPU, input, baseOpts({ bundler }));
    expect(result.findings.length).toBe(1);
    expect(result.findings[0]).toMatchObject({
      severity: 'error',
      code: 'budget-exceeded',
      sizeId: '300x250',
    });
  });

  it('uses the explicit size.id in findings when provided', async () => {
    const hugeAsset = incompressibleBytes(60 * 1024);
    const bundler = new StaticBundler(BASE_HTML, [{ path: 'assets/huge.bin', bytes: hugeAsset }]);
    const input = baseInput({ sizes: [LEADERBOARD], budget: simpleBudget(10) });
    const result = await exportHtml5ZipForSize(LEADERBOARD, input, baseOpts({ bundler }));
    expect(result.findings[0]?.sizeId).toBe('lb');
  });

  it('accepts a FallbackProvider when no input.fallback is supplied', async () => {
    const provider: FallbackProvider = {
      async generate() {
        return { png: 'asset:pngbytes' } as BannerFallback;
      },
    };
    const { fallback: _unused, ...rest } = baseInput();
    void _unused;
    const result = await exportHtml5ZipForSize(MPU, rest as BannerExportInput, {
      ...baseOpts(),
      fallbackProvider: provider,
    });
    expect(result.findings.length).toBe(0);
  });

  it('throws when neither input.fallback nor a FallbackProvider is available', async () => {
    const { fallback: _unused, ...rest } = baseInput();
    void _unused;
    await expect(exportHtml5ZipForSize(MPU, rest as BannerExportInput, baseOpts())).rejects.toThrow(
      /no fallback source/,
    );
  });

  it('rejects zero-byte fallbacks', async () => {
    const resolver = makeResolver({ 'asset:pngbytes': new Uint8Array(0) });
    await expect(
      exportHtml5ZipForSize(MPU, baseInput(), baseOpts({ assetResolver: resolver })),
    ).rejects.toThrow(/zero bytes/);
  });

  it('reports zipKb as a non-negative number', async () => {
    const result = await exportHtml5ZipForSize(MPU, baseInput(), baseOpts());
    expect(result.zipKb).toBeGreaterThan(0);
    expect(result.zipKb).toBeCloseTo(result.zipBytes.length / 1024, 4);
  });
});

describe('exportHtml5Zip (multi-size)', () => {
  it('produces one result per size', async () => {
    const input = baseInput({ sizes: [MPU, LEADERBOARD] });
    const out = await exportHtml5Zip(input, baseOpts());
    expect(out.results.length).toBe(2);
    expect(out.ok).toBe(true);
  });

  it('preserves input order in results', async () => {
    const input = baseInput({ sizes: [LEADERBOARD, MPU] });
    const out = await exportHtml5Zip(input, baseOpts());
    expect(out.results[0]?.size).toEqual(LEADERBOARD);
    expect(out.results[1]?.size).toEqual(MPU);
  });

  it('flips ok=false when any size has an error finding', async () => {
    const hugeAsset = incompressibleBytes(60 * 1024);
    const bundler: HtmlBundler = {
      async bundle(size): Promise<HtmlBundle> {
        // Blow the budget on the leaderboard only.
        if (size.width === 728) {
          return { html: BASE_HTML, assets: [{ path: 'big.bin', bytes: hugeAsset }] };
        }
        return { html: BASE_HTML, assets: [] };
      },
    };
    const input = baseInput({ sizes: [MPU, LEADERBOARD], budget: simpleBudget(10) });
    const out = await exportHtml5Zip(input, baseOpts({ bundler }));
    expect(out.ok).toBe(false);
    expect(out.results[0]?.findings).toEqual([]);
    expect(out.results[1]?.findings[0]?.code).toBe('budget-exceeded');
  });

  it('runs under the configured concurrency cap', async () => {
    let inFlight = 0;
    let peak = 0;
    const bundler: HtmlBundler = {
      async bundle(): Promise<HtmlBundle> {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return { html: BASE_HTML, assets: [] };
      },
    };
    const sizes = Array.from({ length: 5 }, (_, i) => ({
      width: 100 + i,
      height: 100,
      id: `s${i}`,
    }));
    const input = baseInput({ sizes });
    await exportHtml5Zip(input, baseOpts({ bundler, concurrency: 2 }));
    expect(peak).toBeLessThanOrEqual(2);
  });
});
