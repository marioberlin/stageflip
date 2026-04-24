// packages/engine/src/handlers/validate/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { DocumentContext } from '../../router/types.js';
import { VALIDATE_HANDLERS } from './handlers.js';

function doc(overrides: Partial<Document> = {}): Document {
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
              type: 'shape',
              visible: true,
              locked: false,
              animations: [],
              transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1 },
              shape: 'rect',
              fill: '#000',
            } as never,
          ],
          durationMs: 3000,
        },
      ],
    },
    ...overrides,
  } as Document;
}

function ctx(d: Document): DocumentContext {
  return { document: d };
}

function find(name: string) {
  const h = VALIDATE_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

describe('validate_schema', () => {
  it('returns ok:true + empty issues on a valid document', async () => {
    const r = await find('validate_schema').handle({}, ctx(doc()));
    expect(r).toEqual({ ok: true, issues: [] });
  });

  it('returns ok:false + issues when the schema rejects the doc', async () => {
    const bad = { meta: { id: '' } } as unknown as Document;
    const r = await find('validate_schema').handle({}, ctx(bad));
    expect((r as { ok: boolean }).ok).toBe(false);
    expect((r as { issues: unknown[] }).issues.length).toBeGreaterThan(0);
  });
});

describe('check_duplicate_ids', () => {
  it('returns ok:true when ids are unique', async () => {
    const r = await find('check_duplicate_ids').handle({}, ctx(doc()));
    expect(r).toEqual({
      ok: true,
      duplicateSlideIds: [],
      duplicateElementIds: [],
    });
  });

  it('flags duplicate slide ids', async () => {
    const d = doc({
      content: {
        mode: 'slide',
        slides: [
          { id: 'slide-1', elements: [] } as never,
          { id: 'slide-1', elements: [] } as never,
        ],
      } as never,
    });
    const r = await find('check_duplicate_ids').handle({}, ctx(d));
    expect((r as { duplicateSlideIds: string[] }).duplicateSlideIds).toEqual(['slide-1']);
    expect((r as { ok: boolean }).ok).toBe(false);
  });

  it('flags duplicate element ids across slides', async () => {
    const d = doc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide-1',
            elements: [
              {
                id: 'el-a',
                type: 'text',
                visible: true,
                locked: false,
                animations: [],
                transform: { x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1 },
                runs: [],
              } as never,
            ],
          } as never,
          {
            id: 'slide-2',
            elements: [
              {
                id: 'el-a',
                type: 'text',
                visible: true,
                locked: false,
                animations: [],
                transform: { x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1 },
                runs: [],
              } as never,
            ],
          } as never,
        ],
      } as never,
    });
    const r = await find('check_duplicate_ids').handle({}, ctx(d));
    const dups = (r as { duplicateElementIds: Array<{ id: string; occurrences: unknown[] }> })
      .duplicateElementIds;
    expect(dups).toHaveLength(1);
    expect(dups[0]?.id).toBe('el-a');
    expect(dups[0]?.occurrences).toHaveLength(2);
  });

  it('returns ok:true for non-slide modes (no slides to check)', async () => {
    const d = {
      ...doc(),
      content: { mode: 'video', tracks: [], durationMs: 1 } as never,
    } as Document;
    const r = await find('check_duplicate_ids').handle({}, ctx(d));
    expect(r).toEqual({ ok: true, duplicateSlideIds: [], duplicateElementIds: [] });
  });
});

describe('check_timing_coverage', () => {
  it('reports totals + sums knownDurationMs', async () => {
    const d = doc({
      content: {
        mode: 'slide',
        slides: [
          { id: 's1', elements: [], durationMs: 2000 } as never,
          { id: 's2', elements: [] } as never,
          { id: 's3', elements: [], durationMs: 3000 } as never,
        ],
      } as never,
    });
    const r = await find('check_timing_coverage').handle({}, ctx(d));
    expect(r).toEqual({
      mode: 'slide',
      totalSlides: 3,
      slidesWithoutDuration: ['s2'],
      knownDurationMs: 5000,
    });
  });

  it('returns mode=video and zero counts for non-slide docs', async () => {
    const d = {
      ...doc(),
      content: { mode: 'video', tracks: [], durationMs: 1 } as never,
    } as Document;
    const r = await find('check_timing_coverage').handle({}, ctx(d));
    expect(r).toEqual({
      mode: 'video',
      totalSlides: 0,
      slidesWithoutDuration: [],
      knownDurationMs: 0,
    });
  });
});

describe('validate_all', () => {
  it('aggregates findings across every check', async () => {
    const d = doc({
      content: {
        mode: 'slide',
        slides: [
          { id: 's1', elements: [] } as never,
          { id: 's1', elements: [] } as never, // duplicate slide id
        ],
      } as never,
    });
    const r = await find('validate_all').handle({}, ctx(d));
    expect((r as { ok: boolean }).ok).toBe(false);
    const findings = (r as { findings: Array<{ kind: string }> }).findings;
    const kinds = findings.map((f) => f.kind);
    expect(kinds).toContain('duplicate_slide_id');
    expect(kinds).toContain('missing_duration');
  });

  it('returns ok:true + empty findings for a clean doc', async () => {
    const r = await find('validate_all').handle({}, ctx(doc()));
    expect(r).toEqual({ ok: true, findings: [] });
  });
});
