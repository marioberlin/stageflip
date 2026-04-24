// packages/engine/src/handlers/fact-check/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { FACT_CHECK_HANDLERS } from './handlers.js';

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

function textEl(id: string, text: string, runs?: Array<{ text: string }>) {
  return {
    id,
    type: 'text',
    text,
    align: 'left',
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
    ...(runs ? { runs } : {}),
  };
}

function doc(slides: Array<Record<string, unknown>>): Document {
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
      slides: slides.map(
        (s, i) =>
          ({
            id: (s.id as string) ?? `slide-${i + 1}`,
            elements: (s.elements as unknown[]) ?? [],
            ...s,
          }) as never,
      ),
    },
  } as unknown as Document;
}

function find(name: string) {
  const h = FACT_CHECK_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

// ---------------------------------------------------------------------------
// 1 — list_factual_claims
// ---------------------------------------------------------------------------

describe('list_factual_claims', () => {
  it('picks up percentage + dollar + year claims from text elements + notes', async () => {
    const c = ctx(
      doc([
        {
          id: 'slide-1',
          elements: [textEl('t-1', 'Revenue grew 40% last year. The team remained lean.')],
          notes:
            'According to Gartner, AI spending reached $15B in 2023. Nothing notable otherwise.',
        },
      ]),
    );
    const r = (await find('list_factual_claims').handle({}, c)) as {
      ok: true;
      claims: Array<{ source: string; snippet: string }>;
    };
    expect(r.ok).toBe(true);
    const elementClaims = r.claims.filter((c) => c.source === 'element');
    const noteClaims = r.claims.filter((c) => c.source === 'notes');
    expect(elementClaims.map((c) => c.snippet)).toEqual(['Revenue grew 40% last year.']);
    expect(noteClaims[0]?.snippet).toContain('According to Gartner');
  });

  it('handles runs-style text elements (runs joined)', async () => {
    const c = ctx(
      doc([
        {
          id: 'slide-1',
          elements: [textEl('t-1', 'fallback', [{ text: 'In 2024 ' }, { text: 'we shipped.' }])],
        },
      ]),
    );
    const r = (await find('list_factual_claims').handle({}, c)) as {
      ok: true;
      claims: Array<{ snippet: string }>;
    };
    expect(r.claims[0]?.snippet).toContain('In 2024');
  });

  it('returns empty array when nothing matches', async () => {
    const c = ctx(
      doc([
        {
          id: 'slide-1',
          elements: [textEl('t-1', 'Hello world.')],
          notes: 'Plain commentary.',
        },
      ]),
    );
    const r = (await find('list_factual_claims').handle({}, c)) as {
      ok: true;
      claims: unknown[];
    };
    expect(r.claims).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2 — record_fact_check_result
// ---------------------------------------------------------------------------

describe('record_fact_check_result', () => {
  it('appends a structured block to empty notes via add op', async () => {
    const c = ctx(doc([{ id: 'slide-1', elements: [] }]));
    const r = await find('record_fact_check_result').handle(
      {
        slideId: 'slide-1',
        status: 'verified',
        claim: 'Revenue grew 40% last year.',
        source: 'https://example.com/report',
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, status: 'verified' });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(1);
    expect(patches[0]?.op).toBe('add');
    expect(patches[0]?.value).toContain('[fact-check:verified]');
    expect(patches[0]?.value).toContain('Revenue grew 40% last year.');
    expect(patches[0]?.value).toContain('https://example.com/report');
    expect(patches[0]?.value).toContain('[/fact-check]');
  });

  it('concatenates with \\n\\n separator when notes already exist', async () => {
    const c = ctx(doc([{ id: 'slide-1', elements: [], notes: 'Prior note.' }]));
    await find('record_fact_check_result').handle(
      { slideId: 'slide-1', status: 'disputed', claim: 'X is Y.' },
      c,
    );
    const patch = c.patchSink.drain()[0];
    expect(patch?.op).toBe('replace');
    expect(patch?.value).toBe('Prior note.\n\n[fact-check:disputed]\nX is Y.\n[/fact-check]');
  });

  it('refuses exceeds_max_length when block would push past 5000 chars', async () => {
    const c = ctx(doc([{ id: 'slide-1', elements: [], notes: 'x'.repeat(4990) }]));
    const r = await find('record_fact_check_result').handle(
      { slideId: 'slide-1', status: 'unverified', claim: 'y'.repeat(200) },
      c,
    );
    expect(r).toMatchObject({ ok: false, reason: 'exceeds_max_length' });
    expect(c.patchSink.drain()).toEqual([]);
  });

  it('returns slide_not_found for unknown slide id', async () => {
    const c = ctx(doc([{ id: 'slide-1', elements: [] }]));
    expect(
      await find('record_fact_check_result').handle(
        { slideId: 'ghost', status: 'verified', claim: 'x' },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'slide_not_found' });
  });
});
