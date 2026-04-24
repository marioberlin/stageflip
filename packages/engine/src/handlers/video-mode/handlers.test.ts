// packages/engine/src/handlers/video-mode/handlers.test.ts
// T-185 — coverage for the `video-mode` bundle. Today ships
// `bounce_to_aspect_ratios`; additions get sibling describe blocks.

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import type { DocumentContext } from '../../router/types.js';
import { VIDEO_MODE_HANDLERS } from './handlers.js';

function videoCtx(overrides: Partial<Document> = {}): DocumentContext {
  const base = {
    meta: {
      id: 'doc-v',
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
      mode: 'video',
      aspectRatio: '16:9',
      durationMs: 30000,
      frameRate: 30,
      tracks: [{ id: 't1', kind: 'visual', muted: false, elements: [] }],
    },
  } as unknown as Document;
  return { document: { ...base, ...overrides } as Document };
}

function slideCtx(): DocumentContext {
  return {
    document: {
      meta: { id: 'doc-s', version: 1, locale: 'en-US', schemaVersion: 1 },
      content: { mode: 'slide', slides: [] },
    } as unknown as Document,
  };
}

function find(name: string) {
  const handler = VIDEO_MODE_HANDLERS.find((h) => h.name === name);
  if (!handler) throw new Error(`handler ${name} not found`);
  return handler;
}

describe('bounce_to_aspect_ratios', () => {
  it('computes canvas dims for the three canonical aspects at the default basis (1080)', async () => {
    const out = await find('bounce_to_aspect_ratios').handle(
      { targets: ['16:9', '9:16', '1:1'] },
      videoCtx(),
    );
    expect(out).toEqual({
      ok: true,
      basisPx: 1080,
      variants: [
        { aspectRatio: '16:9', label: '16:9', width: 1920, height: 1080 },
        { aspectRatio: '9:16', label: '9:16', width: 1080, height: 1920 },
        { aspectRatio: '1:1', label: '1:1', width: 1080, height: 1080 },
      ],
    });
  });

  it('rounds up to even dimensions for codec compatibility', async () => {
    const out = await find('bounce_to_aspect_ratios').handle(
      { targets: [{ kind: 'custom', w: 7, h: 3 }], basisPx: 720 },
      videoCtx(),
    );
    // basis 720 on short axis (3) → width 720 * 7/3 = 1680, height 720
    expect(out).toMatchObject({
      ok: true,
      basisPx: 720,
      variants: [{ label: 'custom:7x3', width: 1680, height: 720 }],
    });
  });

  it('adjusts odd width up to the next even integer', async () => {
    const out = await find('bounce_to_aspect_ratios').handle(
      { targets: [{ kind: 'custom', w: 7, h: 3 }], basisPx: 721 },
      videoCtx(),
    );
    if (!(out as { ok: boolean }).ok) throw new Error('expected ok');
    const variant = (out as { variants: Array<{ width: number; height: number }> }).variants[0];
    expect(variant?.width).toBe(1682); // 721*7/3=1682.33 → round 1682 → even, no bump
    expect(variant?.height).toBe(722); // 721 is odd, +1 → 722
  });

  it('refuses non-video documents with wrong_mode', async () => {
    const out = await find('bounce_to_aspect_ratios').handle({ targets: ['16:9'] }, slideCtx());
    expect(out).toEqual({ ok: false, reason: 'wrong_mode' });
  });

  it('refuses out-of-range basisPx', async () => {
    const out = await find('bounce_to_aspect_ratios').handle(
      { targets: ['16:9'], basisPx: 100 },
      videoCtx(),
    );
    expect(out).toEqual({ ok: false, reason: 'basis_out_of_range' });
    const out2 = await find('bounce_to_aspect_ratios').handle(
      { targets: ['16:9'], basisPx: 9999 },
      videoCtx(),
    );
    expect(out2).toEqual({ ok: false, reason: 'basis_out_of_range' });
  });

  it('accepts every preset aspect ratio in the schema', async () => {
    const out = await find('bounce_to_aspect_ratios').handle(
      { targets: ['16:9', '9:16', '1:1', '4:5', '21:9'] },
      videoCtx(),
    );
    if (!(out as { ok: boolean }).ok) throw new Error('expected ok');
    const variants = (out as { variants: Array<{ label: string }> }).variants;
    expect(variants.map((v) => v.label)).toEqual(['16:9', '9:16', '1:1', '4:5', '21:9']);
  });

  it('preserves target order in the variants list', async () => {
    const out = await find('bounce_to_aspect_ratios').handle(
      { targets: ['9:16', '16:9'] },
      videoCtx(),
    );
    if (!(out as { ok: boolean }).ok) throw new Error('expected ok');
    const variants = (out as { variants: Array<{ label: string }> }).variants;
    expect(variants.map((v) => v.label)).toEqual(['9:16', '16:9']);
  });
});
