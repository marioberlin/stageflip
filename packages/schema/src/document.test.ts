// packages/schema/src/document.test.ts
// T-386 — Document.variantSlots round-trip + backward-compat pin.

import { describe, expect, it } from 'vitest';
import { type Document, documentSchema } from './document.js';

function baseDoc(extra: Record<string, unknown> = {}): unknown {
  return {
    meta: {
      id: 'doc-1',
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
              id: 'el-1',
              type: 'text',
              text: 'Hello',
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
    ...extra,
  };
}

describe('Document — variantSlots backward-compat (T-386 AC #7)', () => {
  it('parses without variantSlots (existing documents unchanged)', () => {
    const parsed: Document = documentSchema.parse(baseDoc());
    expect((parsed as Document & { variantSlots?: unknown }).variantSlots).toBeUndefined();
  });

  it('round-trips JSON without introducing variantSlots', () => {
    const input = baseDoc();
    const parsed = documentSchema.parse(input);
    const json = JSON.parse(JSON.stringify(parsed));
    const reparsed = documentSchema.parse(json);
    expect('variantSlots' in (reparsed as object)).toBe(false);
  });

  it('accepts a populated variantSlots map', () => {
    const parsed = documentSchema.parse(
      baseDoc({
        variantSlots: {
          headline: { elementId: 'el-1', path: 'text' },
        },
      }),
    ) as Document & {
      variantSlots: Record<string, { elementId: string; path: string }>;
    };
    expect(parsed.variantSlots.headline).toEqual({ elementId: 'el-1', path: 'text' });
  });

  it('rejects a malformed variantSlot (missing elementId)', () => {
    expect(() =>
      documentSchema.parse(
        baseDoc({
          variantSlots: { headline: { path: 'text' } },
        }),
      ),
    ).toThrow();
  });
});

/* ---------------------- T-421 — Document.research? ---------------------- */

const SAMPLE_RESEARCH = {
  provider: 'notebooklm',
  sessionId: 'session-abc',
  sources: [
    {
      name: 'Quarterly report.pdf',
      kind: 'pdf' as const,
      providerSourceId: 'src-1',
      lastModified: '2026-05-10T12:00:00.000Z',
      contentHash: 'a'.repeat(64),
    },
    {
      name: 'Briefing slides',
      kind: 'slides' as const,
      providerSourceId: 'src-2',
      lastModified: '2026-05-10T13:00:00.000Z',
      contentHash: 'b'.repeat(64),
    },
  ],
  createdAt: '2026-05-11T00:00:00.000Z',
};

describe('Document — research backward-compat (T-421 / ADR-008 §D3)', () => {
  it('parses without research (existing documents unchanged)', () => {
    const parsed: Document = documentSchema.parse(baseDoc());
    expect((parsed as Document & { research?: unknown }).research).toBeUndefined();
  });

  it('round-trips JSON without introducing research', () => {
    const input = baseDoc();
    const parsed = documentSchema.parse(input);
    const json = JSON.parse(JSON.stringify(parsed));
    const reparsed = documentSchema.parse(json);
    expect('research' in (reparsed as object)).toBe(false);
  });

  it('accepts a populated research session and round-trips byte-equal', () => {
    const original = baseDoc({ research: SAMPLE_RESEARCH });
    const once = documentSchema.parse(original);
    const twice = documentSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
    expect(twice.research?.sessionId).toBe('session-abc');
    expect(twice.research?.sources).toHaveLength(2);
  });

  it('rejects a research entry with an unknown source kind', () => {
    expect(() =>
      documentSchema.parse(
        baseDoc({
          research: {
            ...SAMPLE_RESEARCH,
            sources: [
              {
                name: 'x',
                kind: 'magic',
                providerSourceId: 'src-1',
                lastModified: '2026-05-10T12:00:00.000Z',
                contentHash: 'h',
              },
            ],
          },
        }),
      ),
    ).toThrow();
  });

  it('rejects a research entry with an unknown top-level field (strict)', () => {
    expect(() =>
      documentSchema.parse(
        baseDoc({
          research: { ...SAMPLE_RESEARCH, futureField: 'x' },
        }),
      ),
    ).toThrow();
  });

  it('rejects a research entry missing sessionId', () => {
    const { sessionId: _omitted, ...incomplete } = SAMPLE_RESEARCH;
    expect(() => documentSchema.parse(baseDoc({ research: incomplete }))).toThrow();
  });
});
