// packages/design-system/src/pipeline/step6-fonts.test.ts
// AC #18-20.

import { describe, expect, it } from 'vitest';
import { StubFontFetcher } from '../fonts/stub-fetcher.js';
import { buildTestState, makeDoc } from '../test-helpers.js';
import type { AssetStorage } from '../types.js';
import { runStep2 } from './step2-typography.js';
import { runStep6 } from './step6-fonts.js';

class CapturingStorage implements AssetStorage {
  uploads: Array<{ contentType: string; size: number }> = [];
  async put(content: Uint8Array, opts: { contentType: string; contentHash: string }) {
    this.uploads.push({ contentType: opts.contentType, size: content.length });
    return { id: `f-${opts.contentHash.slice(0, 8)}` };
  }
}

function buildStateWithTypography(opts: {
  fontFetcher?: StubFontFetcher;
  storage?: AssetStorage;
  failFamilies?: string[];
}) {
  const doc = makeDoc([
    {
      textRuns: [
        { family: 'Roboto', size: 12 },
        { family: 'Inter', size: 24 },
      ],
    },
  ]);
  const init = buildTestState(doc, {
    ...(opts.fontFetcher !== undefined ? { fontFetcher: opts.fontFetcher } : {}),
    ...(opts.storage !== undefined ? { storage: opts.storage } : {}),
  });
  const r2 = runStep2(init);
  init.typographyClusters = r2.typographyClusters;
  return init;
}

describe('step 6 — font fetching', () => {
  it('AC #18: stub fetcher → fontAssets populated for each family', async () => {
    const fetcher = new StubFontFetcher({
      bytesByFamily: {
        Roboto: new Uint8Array([1, 2, 3]),
        Inter: new Uint8Array([4, 5, 6]),
      },
    });
    const storage = new CapturingStorage();
    const state = buildStateWithTypography({ fontFetcher: fetcher, storage });
    const r = await runStep6(state);
    expect(r.fontAssets.Roboto).toMatch(/^asset:/);
    expect(r.fontAssets.Inter).toMatch(/^asset:/);
    expect(r.diagnostic.fetched).toBe(2);
    expect(r.diagnostic.failed).toBe(0);
    expect(r.lossFlags).toEqual([]);
  });

  it('AC #19: fontFetcher undefined → step skipped, fontAssets {}', async () => {
    const state = buildStateWithTypography({});
    const r = await runStep6(state);
    expect(r.fontAssets).toEqual({});
    expect(r.diagnostic.fetched).toBe(0);
  });

  it('AC #20: failed fetch → LF-DESIGN-SYSTEM-FONT-FETCH-FAILED, family absent', async () => {
    const fetcher = new StubFontFetcher({
      bytesByFamily: { Roboto: new Uint8Array([1]) },
      failFamilies: ['Inter'],
    });
    const storage = new CapturingStorage();
    const state = buildStateWithTypography({ fontFetcher: fetcher, storage });
    const r = await runStep6(state);
    expect(r.fontAssets.Roboto).toBeDefined();
    expect(r.fontAssets.Inter).toBeUndefined();
    expect(r.lossFlags.length).toBe(1);
    expect(r.lossFlags[0]?.code).toBe('LF-DESIGN-SYSTEM-FONT-FETCH-FAILED');
  });
});
