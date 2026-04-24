// packages/engine/src/handlers/layout/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { LAYOUT_HANDLERS } from './handlers.js';

function sink(): PatchSink & { drain(): JsonPatchOp[] } {
  const q: JsonPatchOp[] = [];
  return {
    push: (op) => void q.push(op),
    pushAll: (ops) => {
      for (const op of ops) q.push(op);
    },
    drain: () => {
      const out = q.slice();
      q.length = 0;
      return out;
    },
  };
}

function el(id: string, x: number, y: number, w = 100, h = 50) {
  return {
    id,
    type: 'shape',
    visible: true,
    locked: false,
    animations: [],
    transform: { x, y, width: w, height: h, rotation: 0, opacity: 1 },
  };
}

function doc(elements: ReturnType<typeof el>[]): Document {
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

function ctx(d: Document) {
  return { document: d, patchSink: sink() };
}

function find(name: string) {
  const h = LAYOUT_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

describe('align_elements', () => {
  it('horizontal start aligns top edges (y = min y)', async () => {
    const c = ctx(doc([el('a', 0, 10), el('b', 200, 40), el('c', 400, 80)]));
    const r = await find('align_elements').handle(
      { slideId: 'slide-1', elementIds: ['a', 'b', 'c'], axis: 'horizontal', mode: 'start' },
      c as unknown as MutationContext,
    );
    expect(r).toMatchObject({ ok: true, aligned: 3 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(3);
    for (const p of patches) {
      expect((p.value as { y: number }).y).toBe(10);
    }
  });

  it('vertical center aligns vertical centers', async () => {
    const c = ctx(doc([el('a', 0, 0, 100, 50), el('b', 200, 0, 100, 100)]));
    await find('align_elements').handle(
      { slideId: 'slide-1', elementIds: ['a', 'b'], axis: 'vertical', mode: 'center' },
      c as unknown as MutationContext,
    );
    const patches = c.patchSink.drain();
    // both elements should have x such that x + w/2 equals target center.
    const centers = patches.map((p) => {
      const t = p.value as { x: number; width: number };
      return t.x + t.width / 2;
    });
    expect(centers[0]).toBeCloseTo(centers[1] ?? Number.NaN, 5);
  });

  it('horizontal end aligns bottom edges', async () => {
    const c = ctx(doc([el('a', 0, 0, 100, 50), el('b', 200, 10, 100, 100)]));
    await find('align_elements').handle(
      { slideId: 'slide-1', elementIds: ['a', 'b'], axis: 'horizontal', mode: 'end' },
      c as unknown as MutationContext,
    );
    const patches = c.patchSink.drain();
    for (const p of patches) {
      const t = p.value as { y: number; height: number };
      expect(t.y + t.height).toBe(110);
    }
  });

  it('returns element_not_found for unknown ids', async () => {
    const c = ctx(doc([el('a', 0, 0), el('b', 200, 0)]));
    expect(
      await find('align_elements').handle(
        { slideId: 'slide-1', elementIds: ['a', 'ghost'], axis: 'horizontal', mode: 'start' },
        c as unknown as MutationContext,
      ),
    ).toEqual({ ok: false, reason: 'element_not_found' });
  });

  it('returns wrong_mode / slide_not_found as appropriate', async () => {
    const video = ctx({
      ...doc([el('a', 0, 0)]),
      content: { mode: 'video', tracks: [], durationMs: 1 } as never,
    } as Document);
    expect(
      await find('align_elements').handle(
        { slideId: 'slide-1', elementIds: ['a', 'b'], axis: 'horizontal', mode: 'start' },
        video as unknown as MutationContext,
      ),
    ).toEqual({ ok: false, reason: 'wrong_mode' });

    const c = ctx(doc([el('a', 0, 0), el('b', 200, 0)]));
    expect(
      await find('align_elements').handle(
        { slideId: 'ghost', elementIds: ['a', 'b'], axis: 'horizontal', mode: 'start' },
        c as unknown as MutationContext,
      ),
    ).toEqual({ ok: false, reason: 'slide_not_found' });
  });
});

describe('distribute_elements', () => {
  it('evenly distributes middle element between outer two (x axis via vertical)', async () => {
    const c = ctx(doc([el('a', 0, 0), el('c', 400, 0), el('b', 100, 0)]));
    const r = await find('distribute_elements').handle(
      { slideId: 'slide-1', elementIds: ['a', 'b', 'c'], axis: 'vertical' },
      c as unknown as MutationContext,
    );
    expect(r).toMatchObject({ ok: true, distributed: 3, axis: 'vertical' });
    const patches = c.patchSink.drain();
    // only the middle element (b) should move; outermost stay put.
    expect(patches).toHaveLength(1);
    const p = patches[0];
    if (!p) throw new Error('expected one patch');
    const t = p.value as { x: number; width: number };
    expect(t.x + t.width / 2).toBe(250); // midpoint between 50 and 450
  });

  it('requires at least 3 elementIds (Zod enforced; runtime still safe)', async () => {
    const c = ctx(doc([el('a', 0, 0), el('b', 100, 0), el('c', 200, 0)]));
    const r = await find('distribute_elements').handle(
      { slideId: 'slide-1', elementIds: ['a', 'b', 'c'], axis: 'vertical' },
      c as unknown as MutationContext,
    );
    expect(r).toMatchObject({ ok: true });
  });
});

describe('snap_to_grid', () => {
  it('rounds x + y to nearest grid multiple, leaves w + h alone', async () => {
    const c = ctx(doc([el('a', 23, 47, 100, 60), el('b', 88, 12)]));
    const r = await find('snap_to_grid').handle(
      { slideId: 'slide-1', elementIds: ['a', 'b'], gridSize: 10 },
      c as unknown as MutationContext,
    );
    expect(r).toMatchObject({ ok: true, snapped: 2, gridSize: 10 });
    const patches = c.patchSink.drain();
    const tA = patches[0]?.value as { x: number; y: number; width: number; height: number };
    const tB = patches[1]?.value as { x: number; y: number };
    expect(tA.x).toBe(20);
    expect(tA.y).toBe(50);
    expect(tA.width).toBe(100); // untouched
    expect(tB.x).toBe(90);
    expect(tB.y).toBe(10);
  });
});

describe('set_element_transform', () => {
  it('patches only the provided fields via per-field replace ops', async () => {
    const c = ctx(doc([el('a', 0, 0)]));
    const r = await find('set_element_transform').handle(
      {
        slideId: 'slide-1',
        elementId: 'a',
        transform: { x: 42, opacity: 0.5 },
      },
      c as unknown as MutationContext,
    );
    expect(r).toMatchObject({ ok: true, updatedFields: ['x', 'opacity'] });
    expect(c.patchSink.drain()).toEqual([
      { op: 'replace', path: '/content/slides/0/elements/0/transform/x', value: 42 },
      { op: 'replace', path: '/content/slides/0/elements/0/transform/opacity', value: 0.5 },
    ]);
  });

  it('returns element_not_found for missing id', async () => {
    const c = ctx(doc([el('a', 0, 0)]));
    expect(
      await find('set_element_transform').handle(
        { slideId: 'slide-1', elementId: 'nope', transform: { x: 1 } },
        c as unknown as MutationContext,
      ),
    ).toEqual({ ok: false, reason: 'element_not_found' });
  });
});

describe('match_size', () => {
  it('copies width + height from source to all targets by default', async () => {
    const c = ctx(doc([el('a', 0, 0, 200, 80), el('b', 100, 100, 50, 50), el('c', 0, 0, 10, 10)]));
    const r = await find('match_size').handle(
      {
        slideId: 'slide-1',
        sourceElementId: 'a',
        targetElementIds: ['b', 'c'],
      },
      c as unknown as MutationContext,
    );
    expect(r).toMatchObject({ ok: true, matched: 2, dimensions: 'both' });
    const patches = c.patchSink.drain();
    // 2 targets × 2 dims = 4 patches
    expect(patches).toHaveLength(4);
    for (const p of patches) {
      if (p.path.endsWith('/width')) expect(p.value).toBe(200);
      if (p.path.endsWith('/height')) expect(p.value).toBe(80);
    }
  });

  it('respects dimensions=width (only width patches)', async () => {
    const c = ctx(doc([el('a', 0, 0, 200, 80), el('b', 0, 0)]));
    await find('match_size').handle(
      {
        slideId: 'slide-1',
        sourceElementId: 'a',
        targetElementIds: ['b'],
        dimensions: 'width',
      },
      c as unknown as MutationContext,
    );
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(1);
    expect(patches[0]?.path.endsWith('/width')).toBe(true);
  });
});
