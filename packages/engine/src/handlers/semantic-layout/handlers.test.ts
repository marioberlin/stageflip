// packages/engine/src/handlers/semantic-layout/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { SEMANTIC_LAYOUT_HANDLERS } from './handlers.js';

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

function ctx(doc: Document) {
  return { document: doc, patchSink: sink() } as MutationContext & {
    patchSink: ReturnType<typeof sink>;
  };
}

function transform() {
  return { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 };
}

function el(id: string) {
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

function doc(elementIds: string[]): Document {
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
      slides: [{ id: 'slide-1', elements: elementIds.map(el) } as never],
    },
  } as unknown as Document;
}

function find(name: string) {
  const h = SEMANTIC_LAYOUT_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

describe('apply_title_body_layout', () => {
  it('positions title at top + body below with default title height', async () => {
    const c = ctx(doc(['t-1', 'b-1']));
    const r = await find('apply_title_body_layout').handle(
      { slideId: 'slide-1', titleElementId: 't-1', bodyElementId: 'b-1' },
      c,
    );
    expect(r).toMatchObject({ ok: true, titleHeight: 160 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(2);
    const title = patches[0]?.value as { y: number; height: number };
    const body = patches[1]?.value as { y: number };
    expect(title.y).toBe(80);
    expect(title.height).toBe(160);
    expect(body.y).toBe(280);
  });

  it('refuses element_not_found', async () => {
    const c = ctx(doc(['t-1']));
    expect(
      await find('apply_title_body_layout').handle(
        { slideId: 'slide-1', titleElementId: 't-1', bodyElementId: 'ghost' },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'element_not_found' });
  });
});

describe('apply_two_column_layout', () => {
  it('lays out left + right columns with equal heights', async () => {
    const c = ctx(doc(['a', 'b', 'c']));
    const r = await find('apply_two_column_layout').handle(
      {
        slideId: 'slide-1',
        leftElementIds: ['a'],
        rightElementIds: ['b', 'c'],
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, leftCount: 1, rightCount: 2 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(3);
    const leftX = (patches[0]?.value as { x: number }).x;
    const rightX = (patches[1]?.value as { x: number }).x;
    expect(rightX).toBeGreaterThan(leftX);
  });
});

describe('apply_kpi_strip_layout', () => {
  it('lays out 3 cards equal-width with default y + height', async () => {
    const c = ctx(doc(['a', 'b', 'c']));
    const r = await find('apply_kpi_strip_layout').handle(
      { slideId: 'slide-1', elementIds: ['a', 'b', 'c'] },
      c,
    );
    expect(r).toMatchObject({ ok: true, applied: 3 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(3);
    const widths = patches.map((p) => (p.value as { width: number }).width);
    // All widths equal
    expect(new Set(widths).size).toBe(1);
  });
});

describe('apply_centered_hero_layout', () => {
  it('centers the hero with default ratios (1440×540 at 240, 270)', async () => {
    const c = ctx(doc(['hero']));
    const r = await find('apply_centered_hero_layout').handle(
      { slideId: 'slide-1', elementId: 'hero' },
      c,
    );
    expect(r).toMatchObject({ ok: true, width: 1440, height: 540 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(1);
    const t = patches[0]?.value as { x: number; y: number; width: number; height: number };
    expect(t.x).toBe(240);
    expect(t.y).toBe(270);
    expect(t.width).toBe(1440);
    expect(t.height).toBe(540);
  });

  it('refuses slide_not_found', async () => {
    const c = ctx(doc(['x']));
    expect(
      await find('apply_centered_hero_layout').handle({ slideId: 'ghost', elementId: 'x' }, c),
    ).toMatchObject({ ok: false, reason: 'slide_not_found' });
  });
});
