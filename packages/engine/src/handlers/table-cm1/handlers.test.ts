// packages/engine/src/handlers/table-cm1/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { type Operation, applyPatch } from 'fast-json-patch';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { TABLE_CM1_HANDLERS } from './handlers.js';

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

function tableEl(id: string, rows: number, columns: number, cells: unknown[] = []) {
  return {
    id,
    type: 'table',
    rows,
    columns,
    headerRow: true,
    cells,
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
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

function doc(elements: unknown[]): Document {
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
      slides: [{ id: 'slide-1', elements } as never],
    },
  } as unknown as Document;
}

function find(name: string) {
  const h = TABLE_CM1_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

function applyOps(d: Document, ops: JsonPatchOp[]): Document {
  return applyPatch(d, ops as Operation[], false, false).newDocument as Document;
}

function tableAt(d: Document) {
  if (d.content.mode !== 'slide') throw new Error('not slide');
  return d.content.slides[0]?.elements[0] as unknown as {
    rows: number;
    columns: number;
    cells: { row: number; col: number; content: string }[];
  };
}

// ---------------------------------------------------------------------------
// 1 — set_cell
// ---------------------------------------------------------------------------

describe('set_cell', () => {
  it('adds a new cell when absent', async () => {
    const c = ctx(doc([tableEl('t-1', 3, 3)]));
    const r = await find('set_cell').handle(
      {
        slideId: 'slide-1',
        elementId: 't-1',
        row: 1,
        col: 2,
        cell: { content: 'hello' },
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, action: 'added' });
    expect(c.patchSink.drain()).toEqual([
      {
        op: 'add',
        path: '/content/slides/0/elements/0/cells/-',
        value: { row: 1, col: 2, content: 'hello' },
      },
    ]);
  });

  it('replaces when a cell already exists', async () => {
    const c = ctx(doc([tableEl('t-1', 3, 3, [{ row: 0, col: 0, content: 'old' }])]));
    const r = await find('set_cell').handle(
      {
        slideId: 'slide-1',
        elementId: 't-1',
        row: 0,
        col: 0,
        cell: { content: 'new', bold: true },
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, action: 'replaced' });
    expect(c.patchSink.drain()).toEqual([
      {
        op: 'replace',
        path: '/content/slides/0/elements/0/cells/0',
        value: { row: 0, col: 0, content: 'new', bold: true },
      },
    ]);
  });

  it('refuses out_of_bounds for row/col beyond table shape', async () => {
    const c = ctx(doc([tableEl('t-1', 2, 2)]));
    expect(
      await find('set_cell').handle(
        {
          slideId: 'slide-1',
          elementId: 't-1',
          row: 5,
          col: 0,
          cell: { content: 'x' },
        },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'out_of_bounds' });
  });

  it('refuses wrong_element_type on non-table', async () => {
    const c = ctx(doc([shapeEl('s-1')]));
    expect(
      await find('set_cell').handle(
        {
          slideId: 'slide-1',
          elementId: 's-1',
          row: 0,
          col: 0,
          cell: { content: 'x' },
        },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'wrong_element_type' });
  });
});

// ---------------------------------------------------------------------------
// 2 — clear_cell
// ---------------------------------------------------------------------------

describe('clear_cell', () => {
  it('removes a present cell', async () => {
    const c = ctx(
      doc([
        tableEl('t-1', 2, 2, [
          { row: 0, col: 0, content: 'a' },
          { row: 1, col: 1, content: 'b' },
        ]),
      ]),
    );
    const r = await find('clear_cell').handle(
      { slideId: 'slide-1', elementId: 't-1', row: 0, col: 0 },
      c,
    );
    expect(r).toMatchObject({ ok: true, wasSet: true });
    expect(c.patchSink.drain()).toEqual([
      { op: 'remove', path: '/content/slides/0/elements/0/cells/0' },
    ]);
  });

  it('noop on absent cell (wasSet: false, no patch)', async () => {
    const c = ctx(doc([tableEl('t-1', 2, 2)]));
    const r = await find('clear_cell').handle(
      { slideId: 'slide-1', elementId: 't-1', row: 0, col: 0 },
      c,
    );
    expect(r).toMatchObject({ ok: true, wasSet: false });
    expect(c.patchSink.drain()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3 — insert_row
// ---------------------------------------------------------------------------

describe('insert_row', () => {
  it('shifts cells below and increments rows', async () => {
    const c = ctx(
      doc([
        tableEl('t-1', 3, 2, [
          { row: 0, col: 0, content: 'a' },
          { row: 2, col: 0, content: 'b' },
        ]),
      ]),
    );
    const r = await find('insert_row').handle({ slideId: 'slide-1', elementId: 't-1', at: 1 }, c);
    expect(r).toMatchObject({ ok: true, rowsAfter: 4 });
    const next = applyOps(c.document, c.patchSink.drain());
    const t = tableAt(next);
    expect(t.rows).toBe(4);
    expect(t.cells).toEqual([
      { row: 0, col: 0, content: 'a' },
      { row: 3, col: 0, content: 'b' },
    ]);
  });

  it('appends at bottom when at = rows', async () => {
    const c = ctx(doc([tableEl('t-1', 2, 2, [{ row: 1, col: 0, content: 'x' }])]));
    await find('insert_row').handle({ slideId: 'slide-1', elementId: 't-1', at: 2 }, c);
    const next = applyOps(c.document, c.patchSink.drain());
    const t = tableAt(next);
    expect(t.rows).toBe(3);
    expect(t.cells).toEqual([{ row: 1, col: 0, content: 'x' }]);
  });

  it('refuses out_of_bounds when at > rows', async () => {
    const c = ctx(doc([tableEl('t-1', 2, 2)]));
    expect(
      await find('insert_row').handle({ slideId: 'slide-1', elementId: 't-1', at: 5 }, c),
    ).toMatchObject({ ok: false, reason: 'out_of_bounds' });
  });
});

// ---------------------------------------------------------------------------
// 4 — delete_row
// ---------------------------------------------------------------------------

describe('delete_row', () => {
  it('removes row cells and shifts cells below', async () => {
    const c = ctx(
      doc([
        tableEl('t-1', 3, 2, [
          { row: 0, col: 0, content: 'a' },
          { row: 1, col: 0, content: 'dead' },
          { row: 1, col: 1, content: 'dead2' },
          { row: 2, col: 0, content: 'c' },
        ]),
      ]),
    );
    const r = await find('delete_row').handle({ slideId: 'slide-1', elementId: 't-1', at: 1 }, c);
    expect(r).toMatchObject({ ok: true, rowsAfter: 2, cellsRemoved: 2 });
    const next = applyOps(c.document, c.patchSink.drain());
    const t = tableAt(next);
    expect(t.rows).toBe(2);
    expect(t.cells).toEqual([
      { row: 0, col: 0, content: 'a' },
      { row: 1, col: 0, content: 'c' },
    ]);
  });

  it('refuses last_row when rows == 1', async () => {
    const c = ctx(doc([tableEl('t-1', 1, 3)]));
    expect(
      await find('delete_row').handle({ slideId: 'slide-1', elementId: 't-1', at: 0 }, c),
    ).toMatchObject({ ok: false, reason: 'last_row' });
  });

  it('refuses out_of_bounds when at >= rows', async () => {
    const c = ctx(doc([tableEl('t-1', 2, 2)]));
    expect(
      await find('delete_row').handle({ slideId: 'slide-1', elementId: 't-1', at: 2 }, c),
    ).toMatchObject({ ok: false, reason: 'out_of_bounds' });
  });
});

// ---------------------------------------------------------------------------
// 5 — insert_column
// ---------------------------------------------------------------------------

describe('insert_column', () => {
  it('shifts cells right and increments columns', async () => {
    const c = ctx(
      doc([
        tableEl('t-1', 2, 3, [
          { row: 0, col: 0, content: 'a' },
          { row: 0, col: 2, content: 'b' },
        ]),
      ]),
    );
    const r = await find('insert_column').handle(
      { slideId: 'slide-1', elementId: 't-1', at: 1 },
      c,
    );
    expect(r).toMatchObject({ ok: true, columnsAfter: 4 });
    const next = applyOps(c.document, c.patchSink.drain());
    const t = tableAt(next);
    expect(t.columns).toBe(4);
    expect(t.cells).toEqual([
      { row: 0, col: 0, content: 'a' },
      { row: 0, col: 3, content: 'b' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 6 — delete_column
// ---------------------------------------------------------------------------

describe('delete_column', () => {
  it('removes col cells and shifts cells right of it left', async () => {
    const c = ctx(
      doc([
        tableEl('t-1', 1, 3, [
          { row: 0, col: 0, content: 'a' },
          { row: 0, col: 1, content: 'dead' },
          { row: 0, col: 2, content: 'c' },
        ]),
      ]),
    );
    const r = await find('delete_column').handle(
      { slideId: 'slide-1', elementId: 't-1', at: 1 },
      c,
    );
    expect(r).toMatchObject({ ok: true, columnsAfter: 2, cellsRemoved: 1 });
    const next = applyOps(c.document, c.patchSink.drain());
    const t = tableAt(next);
    expect(t.columns).toBe(2);
    expect(t.cells).toEqual([
      { row: 0, col: 0, content: 'a' },
      { row: 0, col: 1, content: 'c' },
    ]);
  });

  it('refuses last_column when columns == 1', async () => {
    const c = ctx(doc([tableEl('t-1', 2, 1)]));
    expect(
      await find('delete_column').handle({ slideId: 'slide-1', elementId: 't-1', at: 0 }, c),
    ).toMatchObject({ ok: false, reason: 'last_column' });
  });
});
