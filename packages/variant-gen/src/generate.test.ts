// packages/variant-gen/src/generate.test.ts
// `generateVariants` end-to-end tests (T-386 AC #8-14, #18, #21).

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { generateVariants } from './generate.js';
import { VariantMatrixCapExceededError } from './errors.js';
import { InMemoryLocaleProvider } from './locale-provider.js';

function makeSourceDoc(variantSlots?: Record<string, { elementId: string; path: string }>): Document {
  const doc: Record<string, unknown> = {
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
            {
              id: 'el-cta',
              type: 'text',
              text: 'Click',
              align: 'left',
              visible: true,
              locked: false,
              animations: [],
              transform: { x: 0, y: 100, width: 200, height: 80, rotation: 0, opacity: 1 },
            },
          ],
        },
      ],
    },
  };
  if (variantSlots) doc.variantSlots = variantSlots;
  return doc as unknown as Document;
}

describe('generateVariants — AC #8 empty spec', () => {
  it('produces zero variants on an empty spec', () => {
    const out = [...generateVariants(makeSourceDoc(), {})];
    expect(out).toEqual([]);
  });
});

describe('generateVariants — AC #9 messages-only matrix', () => {
  it('produces 3 variants for 3 messages × 0 locales', () => {
    const slots = { headline: { elementId: 'el-headline', path: 'text' } };
    const source = makeSourceDoc(slots);
    const out = [
      ...generateVariants(source, {
        messages: [
          { id: 'm1', slots: { headline: 'A' } },
          { id: 'm2', slots: { headline: 'B' } },
          { id: 'm3', slots: { headline: 'C' } },
        ],
      }),
    ];
    expect(out).toHaveLength(3);
    expect(out.map((v) => v.coordinate.messageId)).toEqual(['m1', 'm2', 'm3']);
    expect(out.every((v) => v.coordinate.locale === undefined)).toBe(true);
  });
});

describe('generateVariants — AC #10 locales-only matrix', () => {
  it('produces 5 variants for 0 messages × 5 locales (source text translated)', () => {
    const slots = { headline: { elementId: 'el-headline', path: 'text' } };
    const source = makeSourceDoc(slots);
    const provider = new InMemoryLocaleProvider({
      catalogue: {
        'de-DE': { headline: 'Kaufen' },
        'fr-FR': { headline: 'Acheter' },
      },
    });
    const out = [
      ...generateVariants(
        source,
        {
          locales: [
            { tag: 'en-US' },
            { tag: 'de-DE' },
            { tag: 'fr-FR' },
            { tag: 'es-ES' },
            { tag: 'ja-JP' },
          ],
        },
        { localeProvider: provider },
      ),
    ];
    expect(out).toHaveLength(5);
    expect(out.map((v) => v.coordinate.locale)).toEqual([
      'en-US',
      'de-DE',
      'fr-FR',
      'es-ES',
      'ja-JP',
    ]);
  });
});

describe('generateVariants — AC #11 row-major order', () => {
  it('emits 3×5 = 15 variants in row-major order: (m,l)', () => {
    const slots = { headline: { elementId: 'el-headline', path: 'text' } };
    const source = makeSourceDoc(slots);
    const out = [
      ...generateVariants(source, {
        messages: [
          { id: 'm1', slots: { headline: 'A' } },
          { id: 'm2', slots: { headline: 'B' } },
          { id: 'm3', slots: { headline: 'C' } },
        ],
        locales: [
          { tag: 'en' },
          { tag: 'de' },
          { tag: 'fr' },
          { tag: 'es' },
          { tag: 'ja' },
        ],
      }),
    ];
    expect(out).toHaveLength(15);
    const expected = [];
    for (const mid of ['m1', 'm2', 'm3']) {
      for (const tag of ['en', 'de', 'fr', 'es', 'ja']) {
        expected.push({ messageId: mid, locale: tag });
      }
    }
    expect(out.map((v) => v.coordinate)).toEqual(expected);
  });
});

describe('generateVariants — AC #13 substitution', () => {
  it('substitutes the slot text in the variant Document', () => {
    const slots = { headline: { elementId: 'el-headline', path: 'text' } };
    const source = makeSourceDoc(slots);
    const out = [
      ...generateVariants(source, {
        messages: [{ id: 'm1', slots: { headline: 'Substituted' } }],
      }),
    ];
    const v = out[0]!;
    if (v.document.content.mode !== 'slide') throw new Error('expected slide');
    const textEl = v.document.content.slides[0]?.elements.find(
      (e) => e.id === 'el-headline',
    ) as { text: string } | undefined;
    expect(textEl?.text).toBe('Substituted');
  });
});

describe('generateVariants — AC #14 maxVariants cap', () => {
  it('returns all 4 variants when cap (5) >= total (4)', () => {
    const slots = { headline: { elementId: 'el-headline', path: 'text' } };
    const source = makeSourceDoc(slots);
    const out = [
      ...generateVariants(source, {
        messages: [
          { id: 'm1', slots: { headline: 'A' } },
          { id: 'm2', slots: { headline: 'B' } },
        ],
        locales: [{ tag: 'en' }, { tag: 'de' }],
        maxVariants: 5,
      }),
    ];
    expect(out).toHaveLength(4);
  });

  it('throws VariantMatrixCapExceededError synchronously when total exceeds cap (no partial output)', () => {
    const slots = { headline: { elementId: 'el-headline', path: 'text' } };
    const source = makeSourceDoc(slots);
    expect(() =>
      // Wrap in array to force iteration
      [
        ...generateVariants(source, {
          messages: Array.from({ length: 4 }, (_, i) => ({
            id: `m${i}`,
            slots: { headline: 'X' },
          })),
          locales: Array.from({ length: 2 }, (_, i) => ({ tag: `l-${i}` })),
          maxVariants: 5,
        }),
      ],
    ).toThrow(VariantMatrixCapExceededError);
  });

  it('uses the default cap (100) when maxVariants is omitted', () => {
    const slots = { headline: { elementId: 'el-headline', path: 'text' } };
    const source = makeSourceDoc(slots);
    expect(() =>
      [
        ...generateVariants(source, {
          messages: Array.from({ length: 11 }, (_, i) => ({
            id: `m${i}`,
            slots: { headline: 'X' },
          })),
          locales: Array.from({ length: 11 }, (_, i) => ({ tag: `l-${i}` })),
        }),
      ],
    ).toThrow(VariantMatrixCapExceededError);
  });
});

describe('generateVariants — AC #18 determinism', () => {
  it('produces identical outputs for identical inputs', () => {
    const slots = { headline: { elementId: 'el-headline', path: 'text' } };
    const source = makeSourceDoc(slots);
    const spec = {
      messages: [
        { id: 'm1', slots: { headline: 'A' } },
        { id: 'm2', slots: { headline: 'B' } },
      ],
      locales: [{ tag: 'en' }, { tag: 'de' }],
    } as const;
    const a = [...generateVariants(source, spec)];
    const b = [...generateVariants(source, spec)];
    expect(a.map((v) => v.cacheKey)).toEqual(b.map((v) => v.cacheKey));
    expect(a.map((v) => v.coordinate)).toEqual(b.map((v) => v.coordinate));
  });
});

describe('generateVariants — AC #21 structural sharing on a 100-element source', () => {
  it('every unchanged element remains reference-equal to the source element', () => {
    // 100 elements, vary one slot — every other element ref-shared.
    const elements: unknown[] = [];
    for (let i = 0; i < 100; i += 1) {
      elements.push({
        id: `el-${i}`,
        type: 'text',
        text: `text-${i}`,
        align: 'left',
        visible: true,
        locked: false,
        animations: [],
        transform: { x: 0, y: 0, width: 200, height: 80, rotation: 0, opacity: 1 },
      });
    }
    const source = {
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
      content: { mode: 'slide', slides: [{ id: 'slide-1', elements }] },
      variantSlots: {
        headline: { elementId: 'el-50', path: 'text' },
      },
    } as unknown as Document;

    const out = [
      ...generateVariants(source, {
        messages: [{ id: 'm1', slots: { headline: 'changed' } }],
      }),
    ];
    const v = out[0]!;
    if (v.document.content.mode !== 'slide' || source.content.mode !== 'slide') {
      throw new Error('mode mismatch');
    }
    const variantEls = v.document.content.slides[0]!.elements;
    const sourceEls = source.content.slides[0]!.elements;
    for (let i = 0; i < 100; i += 1) {
      if (i === 50) {
        expect(variantEls[i]).not.toBe(sourceEls[i]);
      } else {
        expect(variantEls[i]).toBe(sourceEls[i]);
      }
    }
  });
});

describe('generateVariants — variant.document.meta.id (per-variant identity)', () => {
  it('writes a deterministic per-variant ID derived from cacheKey', () => {
    const slots = { headline: { elementId: 'el-headline', path: 'text' } };
    const source = makeSourceDoc(slots);
    const out = [
      ...generateVariants(source, {
        messages: [{ id: 'm1', slots: { headline: 'A' } }],
      }),
    ];
    const v = out[0]!;
    expect(v.document.meta.id).toContain('doc-source');
    expect(v.document.meta.id).not.toBe(source.meta.id);
  });
});
