// packages/engine/src/handlers/timing/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { type Operation, applyPatch } from 'fast-json-patch';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { TIMING_HANDLERS } from './handlers.js';

function collectingSink(): PatchSink & { drain(): JsonPatchOp[] } {
  const queue: JsonPatchOp[] = [];
  return {
    push(op) {
      queue.push(op);
    },
    pushAll(ops) {
      for (const op of ops) queue.push(op);
    },
    drain() {
      const out = queue.slice();
      queue.length = 0;
      return out;
    },
  };
}

function ctx(document: Document): MutationContext & {
  patchSink: ReturnType<typeof collectingSink>;
} {
  return { document, patchSink: collectingSink() };
}

function fixture(
  overrides: { slide1?: Partial<{ durationMs: number; transition: unknown }> } = {},
): Document {
  const slide1: Record<string, unknown> = { id: 'slide-1', elements: [] };
  if (overrides.slide1?.durationMs !== undefined) slide1.durationMs = overrides.slide1.durationMs;
  if (overrides.slide1?.transition !== undefined) slide1.transition = overrides.slide1.transition;
  return {
    meta: {
      id: 'doc-1',
      version: 1,
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      schemaVersion: 1,
      locale: 'en',
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: {
      mode: 'slide',
      slides: [slide1 as never, { id: 'slide-2', elements: [] } as never],
    },
  } as unknown as Document;
}

function find(name: string) {
  const h = TIMING_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

function applyOps(doc: Document, ops: JsonPatchOp[]): Document {
  return applyPatch(doc, ops as Operation[], false, false).newDocument as Document;
}

describe('set_slide_duration', () => {
  it('adds durationMs on a slide that had none', async () => {
    const c = ctx(fixture());
    const result = await find('set_slide_duration').handle(
      { slideId: 'slide-1', durationMs: 3000 },
      c,
    );
    expect(result).toMatchObject({ ok: true, slideId: 'slide-1', durationMs: 3000 });
    const ops = c.patchSink.drain();
    expect(ops).toEqual([{ op: 'add', path: '/content/slides/0/durationMs', value: 3000 }]);
    const next = applyOps(c.document, ops);
    if (next.content.mode === 'slide') {
      expect(next.content.slides[0]?.durationMs).toBe(3000);
    }
  });

  it('replaces durationMs on a slide that already had one', async () => {
    const c = ctx(fixture({ slide1: { durationMs: 1000 } }));
    await find('set_slide_duration').handle({ slideId: 'slide-1', durationMs: 5000 }, c);
    expect(c.patchSink.drain()).toEqual([
      { op: 'replace', path: '/content/slides/0/durationMs', value: 5000 },
    ]);
  });

  it('returns wrong_mode for non-slide documents', async () => {
    const c = ctx({
      ...fixture(),
      content: { mode: 'video', tracks: [], durationMs: 1 } as never,
    } as Document);
    expect(
      await find('set_slide_duration').handle({ slideId: 'slide-1', durationMs: 1000 }, c),
    ).toEqual({ ok: false, reason: 'wrong_mode' });
  });

  it('returns not_found for unknown slide ids', async () => {
    const c = ctx(fixture());
    expect(
      await find('set_slide_duration').handle({ slideId: 'ghost', durationMs: 1000 }, c),
    ).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('clear_slide_duration', () => {
  it('removes durationMs when it was set and reports wasSet=true', async () => {
    const c = ctx(fixture({ slide1: { durationMs: 1000 } }));
    const result = await find('clear_slide_duration').handle({ slideId: 'slide-1' }, c);
    expect(result).toEqual({ ok: true, slideId: 'slide-1', wasSet: true });
    expect(c.patchSink.drain()).toEqual([{ op: 'remove', path: '/content/slides/0/durationMs' }]);
  });

  it('reports wasSet=false and emits no patch when the field was absent', async () => {
    const c = ctx(fixture());
    const result = await find('clear_slide_duration').handle({ slideId: 'slide-1' }, c);
    expect(result).toEqual({ ok: true, slideId: 'slide-1', wasSet: false });
    expect(c.patchSink.drain()).toEqual([]);
  });

  it('returns not_found for unknown slide ids', async () => {
    const c = ctx(fixture());
    expect(await find('clear_slide_duration').handle({ slideId: 'ghost' }, c)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});

describe('set_slide_transition', () => {
  it('adds transition with explicit durationMs', async () => {
    const c = ctx(fixture());
    const result = await find('set_slide_transition').handle(
      { slideId: 'slide-1', kind: 'fade', durationMs: 250 },
      c,
    );
    expect(result).toMatchObject({ ok: true, slideId: 'slide-1', kind: 'fade', durationMs: 250 });
    expect(c.patchSink.drain()).toEqual([
      {
        op: 'add',
        path: '/content/slides/0/transition',
        value: { kind: 'fade', durationMs: 250 },
      },
    ]);
  });

  it('defaults durationMs to 400 when omitted (matches the schema default)', async () => {
    const c = ctx(fixture());
    const result = await find('set_slide_transition').handle(
      { slideId: 'slide-1', kind: 'zoom' },
      c,
    );
    expect(result).toMatchObject({ durationMs: 400 });
  });

  it('replaces an existing transition', async () => {
    const c = ctx(fixture({ slide1: { transition: { kind: 'fade', durationMs: 400 } } }));
    await find('set_slide_transition').handle(
      { slideId: 'slide-1', kind: 'slide-left', durationMs: 500 },
      c,
    );
    expect(c.patchSink.drain()).toEqual([
      {
        op: 'replace',
        path: '/content/slides/0/transition',
        value: { kind: 'slide-left', durationMs: 500 },
      },
    ]);
  });

  it('returns wrong_mode / not_found appropriately', async () => {
    const c = ctx(fixture());
    expect(
      await find('set_slide_transition').handle({ slideId: 'ghost', kind: 'fade' }, c),
    ).toEqual({ ok: false, reason: 'not_found' });

    const video = ctx({
      ...fixture(),
      content: { mode: 'video', tracks: [], durationMs: 1 } as never,
    } as Document);
    expect(
      await find('set_slide_transition').handle({ slideId: 'slide-1', kind: 'fade' }, video),
    ).toEqual({ ok: false, reason: 'wrong_mode' });
  });
});

describe('clear_slide_transition', () => {
  it('removes transition and reports wasSet=true', async () => {
    const c = ctx(fixture({ slide1: { transition: { kind: 'fade', durationMs: 400 } } }));
    const result = await find('clear_slide_transition').handle({ slideId: 'slide-1' }, c);
    expect(result).toEqual({ ok: true, slideId: 'slide-1', wasSet: true });
    expect(c.patchSink.drain()).toEqual([{ op: 'remove', path: '/content/slides/0/transition' }]);
  });

  it('wasSet=false when the field was absent (no patch)', async () => {
    const c = ctx(fixture());
    const result = await find('clear_slide_transition').handle({ slideId: 'slide-1' }, c);
    expect(result).toEqual({ ok: true, slideId: 'slide-1', wasSet: false });
    expect(c.patchSink.drain()).toEqual([]);
  });
});
