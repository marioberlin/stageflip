// packages/schema/src/variants/matrix-spec.test.ts
// T-386 — `variantMatrixSpecSchema` validation tests.

import { describe, expect, it } from 'vitest';
import { variantMatrixSpecSchema } from './matrix-spec.js';

describe('variantMatrixSpecSchema', () => {
  it('accepts a fully populated spec', () => {
    const spec = {
      messages: [
        { id: 'm1', slots: { headline: 'Hello' } },
        { id: 'm2', slots: { headline: 'Salut' } },
      ],
      locales: [{ tag: 'en-US' }, { tag: 'de-DE' }],
      maxVariants: 50,
    };
    const parsed = variantMatrixSpecSchema.parse(spec);
    expect(parsed.messages?.[0]?.id).toBe('m1');
    expect(parsed.locales?.[1]?.tag).toBe('de-DE');
    expect(parsed.maxVariants).toBe(50);
  });

  it('accepts an empty spec (no axes, no maxVariants)', () => {
    expect(variantMatrixSpecSchema.parse({})).toEqual({});
  });

  it('rejects maxVariants of 0', () => {
    expect(() => variantMatrixSpecSchema.parse({ maxVariants: 0 })).toThrow();
  });

  it('rejects maxVariants below 1', () => {
    expect(() => variantMatrixSpecSchema.parse({ maxVariants: -3 })).toThrow();
  });

  it('rejects messages[].id collisions', () => {
    expect(() =>
      variantMatrixSpecSchema.parse({
        messages: [
          { id: 'dup', slots: { headline: 'A' } },
          { id: 'dup', slots: { headline: 'B' } },
        ],
      }),
    ).toThrow(/unique/i);
  });

  it('rejects an invalid BCP-47 tag', () => {
    expect(() => variantMatrixSpecSchema.parse({ locales: [{ tag: 'not a tag' }] })).toThrow();
  });

  it('rejects an empty BCP-47 tag', () => {
    expect(() => variantMatrixSpecSchema.parse({ locales: [{ tag: '' }] })).toThrow();
  });

  it('accepts common BCP-47 tags', () => {
    const spec = variantMatrixSpecSchema.parse({
      locales: [{ tag: 'en' }, { tag: 'en-US' }, { tag: 'pt-BR' }, { tag: 'zh-Hant-TW' }],
    });
    expect(spec.locales).toHaveLength(4);
  });

  it('rejects an out-of-spec `size` axis (D-T386-8)', () => {
    expect(() =>
      // @ts-expect-error — TypeScript rejects size due to `size?: never`.
      variantMatrixSpecSchema.parse({ size: ['16:9', '9:16'] }),
    ).toThrow();
  });

  it('rejects unknown root keys (strict)', () => {
    expect(() =>
      variantMatrixSpecSchema.parse({ messages: [], locales: [], extra: true }),
    ).toThrow();
  });
});
