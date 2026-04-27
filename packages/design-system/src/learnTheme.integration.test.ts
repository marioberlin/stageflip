// packages/design-system/src/learnTheme.integration.test.ts
// Top-level integration tests for the 8-step theme learning pipeline.
// AC #1-3, #29 (determinism), AC writeback round-trip.

import { describe, expect, it } from 'vitest';
import { StubFontFetcher } from './fonts/stub-fetcher.js';
import { learnTheme } from './learnTheme.js';
import { makeDoc } from './test-helpers.js';
import type { AssetStorage } from './types.js';

class StubStorage implements AssetStorage {
  async put(_content: Uint8Array, opts: { contentType: string; contentHash: string }) {
    return { id: `f-${opts.contentHash.slice(0, 8)}` };
  }
}

describe('learnTheme — integration', () => {
  it('AC #1: returns LearnThemeResult with all five fields', async () => {
    const doc = makeDoc([{ fills: ['#cc4444', '#4477bb'] }]);
    const r = await learnTheme({ doc });
    expect(r.theme).toBeDefined();
    expect(r.document).toBeDefined();
    expect(r.componentLibrary).toBeDefined();
    expect(r.lossFlags).toBeDefined();
    expect(r.stepDiagnostics).toBeDefined();
  });

  it('AC #2: stopAfterStep: 1 runs only step 1', async () => {
    const doc = makeDoc([
      {
        fills: ['#cc4444'],
        textRuns: [{ family: 'Roboto', size: 12 }],
      },
    ]);
    const r = await learnTheme({ doc, stopAfterStep: 1 });
    expect(Object.keys(r.theme.palette).length).toBeGreaterThan(0);
    expect(r.theme.typography).toEqual({});
    expect(r.theme.spacing).toEqual({});
    expect(r.stepDiagnostics).toHaveLength(1);
    expect(r.stepDiagnostics[0]?.step).toBe(1);
  });

  it('AC #3: stopAfterStep: 8 runs the full pipeline', async () => {
    const doc = makeDoc([
      {
        fills: ['#cc4444'],
        textRuns: [{ family: 'Roboto', size: 12 }],
      },
    ]);
    const r = await learnTheme({ doc });
    expect(r.stepDiagnostics).toHaveLength(8);
    const steps = r.stepDiagnostics.map((d) => d.step);
    expect(steps).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('AC #29: deterministic — two runs with same opts produce structurally-equal results', async () => {
    const docA = makeDoc([
      {
        fills: ['#cc4444', '#4477bb', '#888888'],
        textRuns: [{ family: 'Roboto', size: 12 }],
      },
      {
        fills: ['#cc4544', '#888888'],
        textRuns: [{ family: 'Roboto', size: 24 }],
      },
    ]);
    const docB = makeDoc([
      {
        fills: ['#cc4444', '#4477bb', '#888888'],
        textRuns: [{ family: 'Roboto', size: 12 }],
      },
      {
        fills: ['#cc4544', '#888888'],
        textRuns: [{ family: 'Roboto', size: 24 }],
      },
    ]);
    const r1 = await learnTheme({ doc: docA, kMeansSeed: 42 });
    const r2 = await learnTheme({ doc: docB, kMeansSeed: 42 });
    expect(JSON.stringify(r1.theme)).toBe(JSON.stringify(r2.theme));
    expect(JSON.stringify(r1.componentLibrary)).toBe(JSON.stringify(r2.componentLibrary));
    expect(JSON.stringify(r1.document)).toBe(JSON.stringify(r2.document));
  });

  it('integration: writeback replaces matching literals with theme refs', async () => {
    const doc = makeDoc([
      {
        fills: ['#cc4444', '#cc4444', '#cc4444'],
      },
    ]);
    const r = await learnTheme({ doc, kMeansSeed: 42 });
    if (r.document.content.mode !== 'slide') throw new Error();
    const fills = r.document.content.slides[0]?.elements.map((e) =>
      e.type === 'shape' ? e.fill : undefined,
    );
    // At least one fill becomes a theme: ref.
    expect(fills?.some((f) => typeof f === 'string' && f.startsWith('theme:color.'))).toBe(true);
  });

  it('integration: idempotent on re-run (already-tokenized doc)', async () => {
    const doc = makeDoc([{ fills: ['#cc4444', '#4477bb'] }, { fills: ['#cc4444', '#4477bb'] }]);
    const r1 = await learnTheme({ doc, kMeansSeed: 42 });
    const after1 = JSON.stringify(r1.document);
    const r2 = await learnTheme({ doc: r1.document, kMeansSeed: 42 });
    const after2 = JSON.stringify(r2.document);
    expect(after2).toBe(after1);
  });

  it('integration: with stub font fetcher populates fontAssets', async () => {
    const fetcher = new StubFontFetcher({
      bytesByFamily: { Roboto: new Uint8Array([1, 2, 3]) },
    });
    const storage = new StubStorage();
    const doc = makeDoc([{ textRuns: [{ family: 'Roboto', size: 12 }] }]);
    const r = await learnTheme({ doc, fontFetcher: fetcher, storage });
    expect(r.theme.fontAssets.Roboto).toMatch(/^asset:/);
  });

  it('source.learnedAt matches modifiedAt opts (frozen-epoch default)', async () => {
    const doc = makeDoc([{ fills: ['#cc4444'] }]);
    const r = await learnTheme({ doc });
    expect(r.theme.source.learnedAt).toBe('1970-01-01T00:00:00.000Z');
    const r2 = await learnTheme({
      doc: makeDoc([{ fills: ['#cc4444'] }]),
      modifiedAt: '2026-01-15T00:00:00.000Z',
    });
    expect(r2.theme.source.learnedAt).toBe('2026-01-15T00:00:00.000Z');
  });
});
