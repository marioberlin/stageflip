// packages/engine/src/handlers/arrange-variants/handlers.test.ts
// T-386 — `arrange_variants` agent-tool tests (AC #22-24).

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { ARRANGE_VARIANTS_HANDLERS, type VariantPersistenceContext } from './handlers.js';

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

function makeSourceDoc(): Document {
  return {
    meta: {
      id: 'doc-source',
      version: 1,
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
      schemaVersion: 1,
      locale: 'en',
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: {
      mode: 'slide',
      slides: [
        {
          id: 'slide-1',
          elements: [
            {
              id: 'el-headline',
              type: 'text',
              text: 'Buy Now',
              align: 'left',
              visible: true,
              locked: false,
              animations: [],
              transform: { x: 0, y: 0, width: 200, height: 80, rotation: 0, opacity: 1 },
            },
          ],
        },
      ],
    },
    variantSlots: {
      headline: { elementId: 'el-headline', path: 'text' },
    },
  } as unknown as Document;
}

function ctx(document: Document): VariantPersistenceContext & {
  patchSink: ReturnType<typeof collectingSink>;
  persisted: Document[];
} {
  const persisted: Document[] = [];
  return {
    document,
    patchSink: collectingSink(),
    persistVariant: (doc) => {
      persisted.push(doc);
      return doc.meta.id;
    },
    persisted,
  };
}

function find(name: string) {
  const h = ARRANGE_VARIANTS_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

describe('arrange_variants — AC #22 response shape', () => {
  it('returns IDs (not full Documents) for each variant', async () => {
    const c = ctx(makeSourceDoc());
    const r = (await find('arrange_variants').handle(
      {
        matrixSpec: {
          messages: [
            { id: 'm1', slots: { headline: 'A' } },
            { id: 'm2', slots: { headline: 'B' } },
          ],
        },
      },
      c as unknown as MutationContext,
    )) as { ok: true; variants: Array<{ documentId: string; cacheKey: string }> };
    expect(r.ok).toBe(true);
    expect(r.variants).toHaveLength(2);
    for (const v of r.variants) {
      expect(typeof v.documentId).toBe('string');
      expect(v.documentId.length).toBeGreaterThan(0);
      expect(v.cacheKey).toMatch(/^[0-9a-f]{64}$/);
      expect((v as Record<string, unknown>).document).toBeUndefined();
    }
    expect(c.persisted).toHaveLength(2);
  });
});

describe('arrange_variants — AC #23 empty matrix', () => {
  it('empty matrixSpec returns an empty variants array', async () => {
    const c = ctx(makeSourceDoc());
    const r = (await find('arrange_variants').handle(
      { matrixSpec: {} },
      c as unknown as MutationContext,
    )) as { ok: true; variants: unknown[] };
    expect(r.ok).toBe(true);
    expect(r.variants).toEqual([]);
    expect(c.persisted).toHaveLength(0);
  });
});

describe('arrange_variants — AC #24 cap-exceeded', () => {
  it('returns ok:false with reason `matrix_cap_exceeded` when the cap is exceeded', async () => {
    const c = ctx(makeSourceDoc());
    const r = await find('arrange_variants').handle(
      {
        matrixSpec: {
          messages: Array.from({ length: 4 }, (_, i) => ({
            id: `m${i}`,
            slots: { headline: 'X' },
          })),
          locales: Array.from({ length: 2 }, (_, i) => ({ tag: `l-${i}` })),
          maxVariants: 5,
        },
      },
      c as unknown as MutationContext,
    );
    expect(r).toMatchObject({ ok: false, reason: 'matrix_cap_exceeded' });
    expect(c.persisted).toHaveLength(0);
  });
});

describe('arrange_variants — persistence-unavailable (PR-review M-1, 2026-04-30)', () => {
  it('returns ok:false reason `persistence_unavailable` when persistVariant seam is absent', async () => {
    // Context WITHOUT persistVariant — pre-T-408 executor shape.
    const ctxNoSeam = {
      document: makeSourceDoc(),
      patchSink: collectingSink(),
    };
    const r = await find('arrange_variants').handle(
      {
        matrixSpec: {
          messages: [
            { id: 'm1', slots: { headline: 'A' } },
            { id: 'm2', slots: { headline: 'B' } },
          ],
        },
      },
      ctxNoSeam as unknown as MutationContext,
    );
    expect(r).toMatchObject({ ok: false, reason: 'persistence_unavailable' });
    // Refusing to emit synthetic IDs — no variants array on the failure response.
    expect((r as Record<string, unknown>).variants).toBeUndefined();
    // Detail message references the missing seam.
    expect((r as { detail: string }).detail).toMatch(/persistVariant/);
  });

  it('does not emit patches when persistVariant is absent (no partial output)', async () => {
    const sink = collectingSink();
    const ctxNoSeam = {
      document: makeSourceDoc(),
      patchSink: sink,
    };
    await find('arrange_variants').handle(
      { matrixSpec: { messages: [{ id: 'm1', slots: { headline: 'A' } }] } },
      ctxNoSeam as unknown as MutationContext,
    );
    expect(sink.drain()).toEqual([]);
  });

  it('still surfaces matrix_cap_exceeded ahead of persistence_unavailable when both apply', async () => {
    const ctxNoSeam = {
      document: makeSourceDoc(),
      patchSink: collectingSink(),
    };
    const r = await find('arrange_variants').handle(
      {
        matrixSpec: {
          messages: Array.from({ length: 4 }, (_, i) => ({
            id: `m${i}`,
            slots: { headline: 'X' },
          })),
          locales: Array.from({ length: 2 }, (_, i) => ({ tag: `l-${i}` })),
          maxVariants: 5,
        },
      },
      ctxNoSeam as unknown as MutationContext,
    );
    expect(r).toMatchObject({ ok: false, reason: 'matrix_cap_exceeded' });
  });
});

describe('arrange_variants — coordinate echoed into the response', () => {
  it('echoes the matrix coordinate alongside each variant entry', async () => {
    const c = ctx(makeSourceDoc());
    const r = (await find('arrange_variants').handle(
      {
        matrixSpec: {
          messages: [{ id: 'm1', slots: { headline: 'A' } }],
          locales: [{ tag: 'de-DE' }],
        },
      },
      c as unknown as MutationContext,
    )) as { ok: true; variants: Array<{ coordinate: { messageId?: string; locale?: string } }> };
    expect(r.variants[0]?.coordinate).toEqual({ messageId: 'm1', locale: 'de-DE' });
  });
});
