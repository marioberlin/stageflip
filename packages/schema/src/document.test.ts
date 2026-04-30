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
