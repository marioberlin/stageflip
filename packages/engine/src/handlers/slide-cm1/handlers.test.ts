// packages/engine/src/handlers/slide-cm1/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { type Operation, applyPatch } from 'fast-json-patch';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { SLIDE_CM1_HANDLERS } from './handlers.js';

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

function transform() {
  return { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 };
}

function imageEl(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'image',
    src: 'asset:foo',
    fit: 'cover',
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
    ...overrides,
  };
}

function shapeEl(id: string) {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
  };
}

function doc(slide: Record<string, unknown>): Document {
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
      slides: [{ id: 'slide-1', elements: [], ...slide } as never],
    },
  } as unknown as Document;
}

function videoDoc(): Document {
  return {
    ...doc({}),
    content: { mode: 'video', tracks: [], durationMs: 1 } as never,
  } as Document;
}

function find(name: string) {
  const h = SLIDE_CM1_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

function applyOps(d: Document, ops: JsonPatchOp[]): Document {
  return applyPatch(d, ops as Operation[], false, false).newDocument as Document;
}

// ---------------------------------------------------------------------------
// 1 — set_slide_title
// ---------------------------------------------------------------------------

describe('set_slide_title', () => {
  it('adds title when absent, replaces when present', async () => {
    const c1 = ctx(doc({}));
    await find('set_slide_title').handle({ slideId: 'slide-1', title: 'Intro' }, c1);
    expect(c1.patchSink.drain()[0]?.op).toBe('add');

    const c2 = ctx(doc({ title: 'Old' }));
    const r2 = await find('set_slide_title').handle({ slideId: 'slide-1', title: 'New' }, c2);
    expect(r2).toMatchObject({ ok: true, action: 'set' });
    expect(c2.patchSink.drain()[0]?.op).toBe('replace');
  });

  it('empty-string clears the title; noop when already absent', async () => {
    const c1 = ctx(doc({ title: 'Old' }));
    const r1 = await find('set_slide_title').handle({ slideId: 'slide-1', title: '' }, c1);
    expect(r1).toMatchObject({ ok: true, action: 'cleared' });
    expect(c1.patchSink.drain()).toEqual([{ op: 'remove', path: '/content/slides/0/title' }]);

    const c2 = ctx(doc({}));
    const r2 = await find('set_slide_title').handle({ slideId: 'slide-1', title: '' }, c2);
    expect(r2).toMatchObject({ ok: true, action: 'cleared' });
    expect(c2.patchSink.drain()).toEqual([]);
  });

  it('returns wrong_mode / slide_not_found', async () => {
    expect(
      await find('set_slide_title').handle({ slideId: 'slide-1', title: 'x' }, ctx(videoDoc())),
    ).toEqual({ ok: false, reason: 'wrong_mode' });
    expect(
      await find('set_slide_title').handle({ slideId: 'ghost', title: 'x' }, ctx(doc({}))),
    ).toEqual({ ok: false, reason: 'slide_not_found' });
  });
});

// ---------------------------------------------------------------------------
// 2 — set_slide_notes
// ---------------------------------------------------------------------------

describe('set_slide_notes', () => {
  it('sets notes (add on fresh slide, replace when present)', async () => {
    const c1 = ctx(doc({}));
    await find('set_slide_notes').handle({ slideId: 'slide-1', notes: 'hi' }, c1);
    expect(c1.patchSink.drain()[0]?.op).toBe('add');

    const c2 = ctx(doc({ notes: 'old' }));
    await find('set_slide_notes').handle({ slideId: 'slide-1', notes: 'new' }, c2);
    expect(c2.patchSink.drain()[0]?.op).toBe('replace');
  });

  it('empty-string clears the notes', async () => {
    const c = ctx(doc({ notes: 'bye' }));
    const r = await find('set_slide_notes').handle({ slideId: 'slide-1', notes: '' }, c);
    expect(r).toMatchObject({ ok: true, action: 'cleared' });
    expect(c.patchSink.drain()).toEqual([{ op: 'remove', path: '/content/slides/0/notes' }]);
  });
});

// ---------------------------------------------------------------------------
// 3 — append_slide_notes
// ---------------------------------------------------------------------------

describe('append_slide_notes', () => {
  it('creates notes when absent', async () => {
    const c = ctx(doc({}));
    const r = await find('append_slide_notes').handle({ slideId: 'slide-1', text: 'first' }, c);
    expect(r).toMatchObject({ ok: true, lengthBefore: 0, lengthAfter: 5 });
    expect(c.patchSink.drain()).toEqual([
      { op: 'add', path: '/content/slides/0/notes', value: 'first' },
    ]);
  });

  it('concatenates with default paragraph separator when notes exist', async () => {
    const c = ctx(doc({ notes: 'line1' }));
    await find('append_slide_notes').handle({ slideId: 'slide-1', text: 'line2' }, c);
    expect(c.patchSink.drain()).toEqual([
      { op: 'replace', path: '/content/slides/0/notes', value: 'line1\n\nline2' },
    ]);
  });

  it('honors custom separator', async () => {
    const c = ctx(doc({ notes: 'a' }));
    await find('append_slide_notes').handle({ slideId: 'slide-1', text: 'b', separator: ' / ' }, c);
    expect(c.patchSink.drain()[0]?.value).toBe('a / b');
  });

  it('refuses exceeds_max_length when total > 5000', async () => {
    const c = ctx(doc({ notes: 'x'.repeat(4900) }));
    const r = await find('append_slide_notes').handle(
      { slideId: 'slide-1', text: 'y'.repeat(200) },
      c,
    );
    expect(r).toMatchObject({ ok: false, reason: 'exceeds_max_length' });
    expect(c.patchSink.drain()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4 — set_slide_background
// ---------------------------------------------------------------------------

describe('set_slide_background', () => {
  it('adds a color background when absent', async () => {
    const c = ctx(doc({}));
    const r = await find('set_slide_background').handle(
      { slideId: 'slide-1', background: { kind: 'color', value: '#000000' } },
      c,
    );
    expect(r).toMatchObject({ ok: true, action: 'set' });
    expect(c.patchSink.drain()).toEqual([
      {
        op: 'add',
        path: '/content/slides/0/background',
        value: { kind: 'color', value: '#000000' },
      },
    ]);
  });

  it('clears existing background when passed null', async () => {
    const c = ctx(doc({ background: { kind: 'color', value: '#ffffff' } }));
    const r = await find('set_slide_background').handle(
      { slideId: 'slide-1', background: null },
      c,
    );
    expect(r).toMatchObject({ ok: true, action: 'cleared' });
    expect(c.patchSink.drain()).toEqual([{ op: 'remove', path: '/content/slides/0/background' }]);
  });

  it('noop-clear when already absent', async () => {
    const c = ctx(doc({}));
    await find('set_slide_background').handle({ slideId: 'slide-1', background: null }, c);
    expect(c.patchSink.drain()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5 — reorder_slide_elements
// ---------------------------------------------------------------------------

describe('reorder_slide_elements', () => {
  it('replaces the elements array in the given order', async () => {
    const c = ctx(doc({ elements: [shapeEl('a'), shapeEl('b'), shapeEl('c')] }));
    const r = await find('reorder_slide_elements').handle(
      { slideId: 'slide-1', order: ['c', 'a', 'b'] },
      c,
    );
    expect(r).toMatchObject({ ok: true, applied: 3 });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      const ids = (next.content.slides[0]?.elements ?? []).map((e) => e.id);
      expect(ids).toEqual(['c', 'a', 'b']);
    }
  });

  it('refuses mismatched_count / mismatched_ids', async () => {
    const c = ctx(doc({ elements: [shapeEl('a'), shapeEl('b')] }));
    expect(
      await find('reorder_slide_elements').handle({ slideId: 'slide-1', order: ['a'] }, c),
    ).toMatchObject({ ok: false, reason: 'mismatched_count' });
    expect(
      await find('reorder_slide_elements').handle({ slideId: 'slide-1', order: ['a', 'ghost'] }, c),
    ).toMatchObject({ ok: false, reason: 'mismatched_ids' });
  });
});

// ---------------------------------------------------------------------------
// 6 — bulk_set_alt_text
// ---------------------------------------------------------------------------

describe('bulk_set_alt_text', () => {
  it('sets alt on multiple images, picking add vs replace per element', async () => {
    const c = ctx(doc({ elements: [imageEl('i-1'), imageEl('i-2', { alt: 'old' })] }));
    const r = await find('bulk_set_alt_text').handle(
      {
        slideId: 'slide-1',
        assignments: [
          { elementId: 'i-1', alt: 'first' },
          { elementId: 'i-2', alt: 'second' },
        ],
      },
      c,
    );
    expect(r).toMatchObject({
      ok: true,
      applied: [
        { elementId: 'i-1', action: 'set' },
        { elementId: 'i-2', action: 'set' },
      ],
    });
    expect(c.patchSink.drain()).toEqual([
      { op: 'add', path: '/content/slides/0/elements/0/alt', value: 'first' },
      { op: 'replace', path: '/content/slides/0/elements/1/alt', value: 'second' },
    ]);
  });

  it('empty-string alt marks image decorative (removes field)', async () => {
    const c = ctx(doc({ elements: [imageEl('i-1', { alt: 'logo' })] }));
    const r = await find('bulk_set_alt_text').handle(
      { slideId: 'slide-1', assignments: [{ elementId: 'i-1', alt: '' }] },
      c,
    );
    expect(r).toMatchObject({ ok: true, applied: [{ elementId: 'i-1', action: 'cleared' }] });
    expect(c.patchSink.drain()).toEqual([
      { op: 'remove', path: '/content/slides/0/elements/0/alt' },
    ]);
  });

  it('validates atomically — rejects without emitting patches', async () => {
    const c = ctx(doc({ elements: [imageEl('i-1'), shapeEl('s-1')] }));
    const result = await find('bulk_set_alt_text').handle(
      {
        slideId: 'slide-1',
        assignments: [
          { elementId: 'i-1', alt: 'ok' },
          { elementId: 's-1', alt: 'bad' },
        ],
      },
      c,
    );
    expect(result).toMatchObject({ ok: false, reason: 'wrong_element_type' });
    expect(c.patchSink.drain()).toEqual([]);
  });

  it('refuses element_not_found on first unknown id', async () => {
    const c = ctx(doc({ elements: [imageEl('i-1')] }));
    expect(
      await find('bulk_set_alt_text').handle(
        {
          slideId: 'slide-1',
          assignments: [{ elementId: 'ghost', alt: 'x' }],
        },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'element_not_found' });
  });
});
