// packages/engine/src/handlers/display-mode/handlers.test.ts
// T-206 — coverage for the `display-mode` bundle:
// `optimize_for_file_size` + `preview_at_sizes`.

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import type { DocumentContext } from '../../router/types.js';
import { DISPLAY_MODE_HANDLERS } from './handlers.js';

function displayCtx(
  overrides: Partial<{
    sizes: ReadonlyArray<{ id?: string; width: number; height: number; name?: string }>;
    durationMs: number;
    budget: { totalZipKb: number };
  }> = {},
): DocumentContext {
  const base = {
    meta: {
      id: 'doc-d',
      version: 1,
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      locale: 'en-US',
      schemaVersion: 1,
    },
    theme: { tokens: {}, palette: {} },
    variables: {},
    components: {},
    content: {
      mode: 'display',
      sizes: overrides.sizes ?? [{ id: 'mpu', width: 300, height: 250, name: 'Medium Rectangle' }],
      durationMs: overrides.durationMs ?? 15_000,
      budget: overrides.budget ?? { totalZipKb: 150 },
      elements: [],
    },
  } as unknown as Document;
  return { document: base };
}

function videoCtx(): DocumentContext {
  return {
    document: {
      meta: { id: 'doc-v', version: 1, locale: 'en-US', schemaVersion: 1 },
      content: {
        mode: 'video',
        aspectRatio: '16:9',
        durationMs: 30_000,
        frameRate: 30,
        tracks: [],
      },
    } as unknown as Document,
  };
}

function find(name: string) {
  const handler = DISPLAY_MODE_HANDLERS.find((h) => h.name === name);
  if (!handler) throw new Error(`handler ${name} not found`);
  return handler;
}

/* ---------------------------------------------------------------------- */
/* optimize_for_file_size                                                 */
/* ---------------------------------------------------------------------- */

describe('optimize_for_file_size', () => {
  it('returns every pass enabled by default, sorted by estimated saving', async () => {
    const out = await find('optimize_for_file_size').handle({}, displayCtx());
    expect(out).toMatchObject({ ok: true, targetKb: 150, budgetSourceKb: 150 });
    const recs = (out as { recommendations: Array<{ pass: string; enabled: boolean }> })
      .recommendations;
    expect(recs.map((r) => r.pass)).toEqual(['optimize-images', 'minify-js', 'strip-unused-css']);
    for (const r of recs) expect(r.enabled).toBe(true);
  });

  it('disables passes not listed in input.passes but still returns them', async () => {
    const out = await find('optimize_for_file_size').handle(
      { passes: ['minify-js'] },
      displayCtx(),
    );
    const recs = (out as { recommendations: Array<{ pass: string; enabled: boolean }> })
      .recommendations;
    const byPass = new Map(recs.map((r) => [r.pass, r]));
    expect(byPass.get('minify-js')?.enabled).toBe(true);
    expect(byPass.get('strip-unused-css')?.enabled).toBe(false);
    expect(byPass.get('optimize-images')?.enabled).toBe(false);
  });

  it('uses the document budget when no targetKb is supplied', async () => {
    const out = await find('optimize_for_file_size').handle(
      {},
      displayCtx({ budget: { totalZipKb: 100 } }),
    );
    expect(out).toMatchObject({ targetKb: 100, budgetSourceKb: 100 });
  });

  it('caller targetKb overrides the document budget', async () => {
    const out = await find('optimize_for_file_size').handle(
      { targetKb: 80 },
      displayCtx({ budget: { totalZipKb: 200 } }),
    );
    expect(out).toMatchObject({ targetKb: 80, budgetSourceKb: 200 });
  });

  it('fails in non-display mode', async () => {
    const out = await find('optimize_for_file_size').handle({}, videoCtx());
    expect(out).toEqual({ ok: false, reason: 'wrong_mode' });
  });
});

/* ---------------------------------------------------------------------- */
/* preview_at_sizes                                                       */
/* ---------------------------------------------------------------------- */

describe('preview_at_sizes', () => {
  it('defaults to the document sizes when no input.sizes is supplied', async () => {
    const out = await find('preview_at_sizes').handle(
      {},
      displayCtx({
        sizes: [
          { id: 'mpu', width: 300, height: 250 },
          { id: 'lb', width: 728, height: 90 },
        ],
      }),
    );
    expect(out).toEqual({
      ok: true,
      previews: [
        { sizeId: 'mpu', width: 300, height: 250, durationMs: 15_000 },
        { sizeId: 'lb', width: 728, height: 90, durationMs: 15_000 },
      ],
    });
  });

  it('uses explicit caller sizes over the document sizes', async () => {
    const out = await find('preview_at_sizes').handle(
      { sizes: [{ width: 160, height: 600 }] },
      displayCtx(),
    );
    expect(out).toMatchObject({
      ok: true,
      previews: [{ sizeId: '160x600', width: 160, height: 600 }],
    });
  });

  it('falls back to sizeId = WxH when no id is supplied', async () => {
    const out = await find('preview_at_sizes').handle(
      { sizes: [{ width: 300, height: 250 }] },
      displayCtx(),
    );
    expect((out as { previews: Array<{ sizeId: string }> }).previews[0]?.sizeId).toBe('300x250');
  });

  it('returns the document durationMs verbatim', async () => {
    const out = await find('preview_at_sizes').handle({}, displayCtx({ durationMs: 22_000 }));
    expect((out as { previews: Array<{ durationMs: number }> }).previews[0]?.durationMs).toBe(
      22_000,
    );
  });

  it('fails with no_sizes_available when neither input nor document supplies sizes', async () => {
    const out = await find('preview_at_sizes').handle({}, displayCtx({ sizes: [] }));
    expect(out).toEqual({ ok: false, reason: 'no_sizes_available' });
  });

  it('fails in non-display mode', async () => {
    const out = await find('preview_at_sizes').handle({}, videoCtx());
    expect(out).toEqual({ ok: false, reason: 'wrong_mode' });
  });
});
