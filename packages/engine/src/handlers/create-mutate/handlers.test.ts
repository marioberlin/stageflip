// packages/engine/src/handlers/create-mutate/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { type Operation, applyPatch } from 'fast-json-patch';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { CREATE_MUTATE_HANDLERS } from './handlers.js';

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

function fixture(): Document {
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
      slides: [
        {
          id: 'slide-1',
          elements: [
            {
              id: 'el-1',
              type: 'text',
              visible: true,
              locked: false,
              animations: [],
              transform: {
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                rotation: 0,
                opacity: 1,
              },
              runs: [{ text: 'Hello', style: {} }],
              align: 'left',
            } as never,
          ],
        },
        { id: 'slide-2', elements: [] },
      ],
    },
  } as unknown as Document;
}

function find(name: string) {
  const h = CREATE_MUTATE_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

function applyOps(doc: Document, ops: JsonPatchOp[]): Document {
  return applyPatch(doc, ops as Operation[], false, false).newDocument as Document;
}

describe('add_slide', () => {
  it('inserts a new slide at the end and returns its id + position', async () => {
    const c = ctx(fixture());
    const result = await find('add_slide').handle({}, c);
    expect(result).toMatchObject({ ok: true, slideId: 'slide-3', position: 2 });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      expect(next.content.slides.map((s) => s.id)).toEqual(['slide-1', 'slide-2', 'slide-3']);
    }
  });

  it('inserts at a given position and carries title / duration through', async () => {
    const c = ctx(fixture());
    await find('add_slide').handle({ position: 0, title: 'Intro', durationMs: 3000 }, c);
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      expect(next.content.slides[0]?.id).toBe('slide-3');
      expect(next.content.slides[0]?.title).toBe('Intro');
      expect(next.content.slides[0]?.durationMs).toBe(3000);
    }
  });

  it('rejects wrong mode', async () => {
    const c = ctx({
      ...fixture(),
      content: { mode: 'video', tracks: [], durationMs: 1 } as never,
    } as Document);
    expect(await find('add_slide').handle({}, c)).toEqual({ ok: false, reason: 'wrong_mode' });
  });
});

describe('update_slide', () => {
  it('updates title + durationMs + notes and reports the changed fields', async () => {
    const c = ctx(fixture());
    const result = await find('update_slide').handle(
      { slideId: 'slide-1', title: 'Renamed', durationMs: 4000, notes: 'speaker' },
      c,
    );
    expect(result).toMatchObject({
      ok: true,
      slideId: 'slide-1',
      updatedFields: ['title', 'durationMs', 'notes'],
    });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      expect(next.content.slides[0]?.title).toBe('Renamed');
      expect(next.content.slides[0]?.durationMs).toBe(4000);
      expect(next.content.slides[0]?.notes).toBe('speaker');
    }
  });

  it('empty-string title emits a remove op (field deleted)', async () => {
    const c = ctx({
      ...fixture(),
      content: {
        ...fixture().content,
        slides: [
          { id: 'slide-1', title: 'x', elements: [] },
          { id: 'slide-2', elements: [] },
        ],
      } as never,
    } as Document);
    await find('update_slide').handle({ slideId: 'slide-1', title: '' }, c);
    expect(c.patchSink.drain()).toEqual([{ op: 'remove', path: '/content/slides/0/title' }]);
  });

  it('returns not_found for missing slides', async () => {
    const c = ctx(fixture());
    expect(await find('update_slide').handle({ slideId: 'ghost' }, c)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});

describe('duplicate_slide', () => {
  it('deep-copies with fresh slide + element ids, inserted after source by default', async () => {
    const c = ctx(fixture());
    const result = await find('duplicate_slide').handle({ slideId: 'slide-1' }, c);
    expect(result).toMatchObject({
      ok: true,
      originalSlideId: 'slide-1',
      newSlideId: 'slide-3',
    });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      expect(next.content.slides.map((s) => s.id)).toEqual(['slide-1', 'slide-3', 'slide-2']);
      const clonedElements = next.content.slides[1]?.elements ?? [];
      expect(clonedElements).toHaveLength(1);
      expect(clonedElements[0]?.id).not.toBe('el-1');
    }
  });

  it('not_found on missing source', async () => {
    const c = ctx(fixture());
    expect(await find('duplicate_slide').handle({ slideId: 'nope' }, c)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});

describe('reorder_slides', () => {
  it('replaces the slide order and reports the applied count', async () => {
    const c = ctx(fixture());
    const result = await find('reorder_slides').handle({ order: ['slide-2', 'slide-1'] }, c);
    expect(result).toEqual({ ok: true, applied: 2 });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      expect(next.content.slides.map((s) => s.id)).toEqual(['slide-2', 'slide-1']);
    }
  });

  it('rejects mismatched count / unknown id / duplicates without mutating', async () => {
    const c = ctx(fixture());
    expect(await find('reorder_slides').handle({ order: ['slide-1'] }, c)).toMatchObject({
      ok: false,
      reason: 'mismatched_count',
    });
    expect(await find('reorder_slides').handle({ order: ['slide-1', 'slide-x'] }, c)).toMatchObject(
      { ok: false, reason: 'mismatched_ids' },
    );
    expect(await find('reorder_slides').handle({ order: ['slide-1', 'slide-1'] }, c)).toMatchObject(
      { ok: false, reason: 'mismatched_ids' },
    );
    expect(c.patchSink.drain()).toEqual([]); // no patches emitted
  });
});

describe('delete_slide', () => {
  it('removes the slide and reports the remaining count', async () => {
    const c = ctx(fixture());
    const result = await find('delete_slide').handle({ slideId: 'slide-2' }, c);
    expect(result).toEqual({
      ok: true,
      deletedSlideId: 'slide-2',
      remainingCount: 1,
    });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      expect(next.content.slides.map((s) => s.id)).toEqual(['slide-1']);
    }
  });

  it('refuses to delete the only remaining slide', async () => {
    const doc: Document = {
      ...fixture(),
      content: {
        ...fixture().content,
        slides: [{ id: 'slide-1', elements: [] }],
      } as never,
    } as Document;
    const c = ctx(doc);
    expect(await find('delete_slide').handle({ slideId: 'slide-1' }, c)).toEqual({
      ok: false,
      reason: 'last_slide',
    });
    expect(c.patchSink.drain()).toEqual([]);
  });
});

describe('add_element', () => {
  it('appends a valid element and returns its id + parent slide id', async () => {
    const c = ctx(fixture());
    const newElement = {
      id: 'el-2',
      type: 'shape',
      visible: true,
      locked: false,
      animations: [],
      transform: { x: 0, y: 0, width: 50, height: 50, rotation: 0, opacity: 1 },
      shape: 'rect',
      fill: '#ff0000',
    };
    const result = await find('add_element').handle({ slideId: 'slide-1', element: newElement }, c);
    expect(result).toMatchObject({ ok: true, slideId: 'slide-1', elementId: 'el-2' });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      expect(next.content.slides[0]?.elements.map((e) => e.id)).toEqual(['el-1', 'el-2']);
    }
  });

  it('auto-reassigns id on collision with an existing element', async () => {
    const c = ctx(fixture());
    const collider = {
      id: 'el-1',
      type: 'shape',
      visible: true,
      locked: false,
      animations: [],
      transform: { x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1 },
      shape: 'rect',
      fill: '#fff',
    };
    const result = await find('add_element').handle({ slideId: 'slide-1', element: collider }, c);
    expect((result as { elementId: string }).elementId).not.toBe('el-1');
  });
});

describe('update_element', () => {
  it('replaces allowed fields via per-field patches', async () => {
    const c = ctx(fixture());
    const result = await find('update_element').handle(
      {
        slideId: 'slide-1',
        elementId: 'el-1',
        updates: { visible: false, name: 'Title line' },
      },
      c,
    );
    expect(result).toMatchObject({
      ok: true,
      updatedFields: expect.arrayContaining(['visible', 'name']),
    });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      expect(next.content.slides[0]?.elements[0]?.visible).toBe(false);
      expect(next.content.slides[0]?.elements[0]?.name).toBe('Title line');
    }
  });

  it('refuses to change id or type', async () => {
    const c = ctx(fixture());
    const result = await find('update_element').handle(
      {
        slideId: 'slide-1',
        elementId: 'el-1',
        updates: { id: 'nope', type: 'shape' },
      },
      c,
    );
    expect(result).toMatchObject({ ok: false, reason: 'rejected_fields' });
    expect(c.patchSink.drain()).toEqual([]);
  });
});

describe('delete_element', () => {
  it('removes an element by id', async () => {
    const c = ctx(fixture());
    const result = await find('delete_element').handle(
      { slideId: 'slide-1', elementId: 'el-1' },
      c,
    );
    expect(result).toEqual({ ok: true, deletedElementId: 'el-1', slideId: 'slide-1' });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      expect(next.content.slides[0]?.elements).toEqual([]);
    }
  });

  it('not_found for missing element', async () => {
    const c = ctx(fixture());
    expect(
      await find('delete_element').handle({ slideId: 'slide-1', elementId: 'ghost' }, c),
    ).toEqual({ ok: false, reason: 'not_found' });
  });
});
