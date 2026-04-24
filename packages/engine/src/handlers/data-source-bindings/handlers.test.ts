// packages/engine/src/handlers/data-source-bindings/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { DATA_SOURCE_BINDINGS_HANDLERS } from './handlers.js';

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

function chartEl(id: string, data: unknown) {
  return {
    id,
    type: 'chart',
    chartKind: 'bar',
    data,
    legend: true,
    axes: true,
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
  const h = DATA_SOURCE_BINDINGS_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

describe('bind_chart_to_data_source', () => {
  it('replaces inline chart data with a ds ref, reports previousKind=inline', async () => {
    const c = ctx(
      doc([chartEl('c-1', { labels: ['Q1', 'Q2'], series: [{ name: 'X', values: [1, 2] }] })]),
    );
    const r = await find('bind_chart_to_data_source').handle(
      { slideId: 'slide-1', elementId: 'c-1', dataSourceRef: 'ds:revenue-q3' },
      c,
    );
    expect(r).toMatchObject({
      ok: true,
      previousKind: 'inline',
      dataSourceRef: 'ds:revenue-q3',
    });
    expect(c.patchSink.drain()).toEqual([
      {
        op: 'replace',
        path: '/content/slides/0/elements/0/data',
        value: 'ds:revenue-q3',
      },
    ]);
  });

  it('replaces an existing ref, reports previousKind=reference', async () => {
    const c = ctx(doc([chartEl('c-1', 'ds:old-ref')]));
    const r = await find('bind_chart_to_data_source').handle(
      { slideId: 'slide-1', elementId: 'c-1', dataSourceRef: 'ds:new-ref' },
      c,
    );
    expect(r).toMatchObject({ ok: true, previousKind: 'reference' });
  });

  it('refuses wrong_element_type on non-chart', async () => {
    const c = ctx(doc([shapeEl('s-1')]));
    expect(
      await find('bind_chart_to_data_source').handle(
        { slideId: 'slide-1', elementId: 's-1', dataSourceRef: 'ds:x' },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'wrong_element_type' });
  });
});

describe('unbind_chart_data_source', () => {
  it('replaces a ds ref with inline chart data', async () => {
    const c = ctx(doc([chartEl('c-1', 'ds:old-ref')]));
    const r = await find('unbind_chart_data_source').handle(
      {
        slideId: 'slide-1',
        elementId: 'c-1',
        replacement: { labels: ['A'], series: [{ name: 'S', values: [1] }] },
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, previousRef: 'ds:old-ref' });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(1);
    expect(patches[0]?.op).toBe('replace');
    expect(patches[0]?.value).toEqual({
      labels: ['A'],
      series: [{ name: 'S', values: [1] }],
    });
  });

  it('refuses not_bound if chart has inline data', async () => {
    const c = ctx(doc([chartEl('c-1', { labels: ['Q1'], series: [{ name: 'X', values: [1] }] })]));
    expect(
      await find('unbind_chart_data_source').handle(
        {
          slideId: 'slide-1',
          elementId: 'c-1',
          replacement: { labels: ['A'], series: [{ name: 'S', values: [1] }] },
        },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'not_bound' });
  });
});
