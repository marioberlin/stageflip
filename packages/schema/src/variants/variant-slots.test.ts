// packages/schema/src/variants/variant-slots.test.ts
// T-386 — `variantSlots` Document field. Pin shape + backward-compat.

import { describe, expect, it } from 'vitest';
import { variantSlotDefSchema, variantSlotsSchema } from './variant-slots.js';

describe('variantSlotDefSchema', () => {
  it('accepts a well-formed { elementId, path }', () => {
    const parsed = variantSlotDefSchema.parse({ elementId: 'el-1', path: 'text' });
    expect(parsed).toEqual({ elementId: 'el-1', path: 'text' });
  });

  it('rejects missing elementId', () => {
    expect(() => variantSlotDefSchema.parse({ path: 'text' })).toThrow();
  });

  it('rejects missing path', () => {
    expect(() => variantSlotDefSchema.parse({ elementId: 'el-1' })).toThrow();
  });

  it('rejects unknown keys (strict)', () => {
    expect(() =>
      variantSlotDefSchema.parse({ elementId: 'el-1', path: 'text', extra: 'x' }),
    ).toThrow();
  });
});

describe('variantSlotsSchema', () => {
  it('accepts an empty record', () => {
    expect(variantSlotsSchema.parse({})).toEqual({});
  });

  it('accepts multiple named slots', () => {
    const parsed = variantSlotsSchema.parse({
      headline: { elementId: 'el-h', path: 'text' },
      cta: { elementId: 'el-cta', path: 'text' },
    });
    expect(parsed.headline).toEqual({ elementId: 'el-h', path: 'text' });
    expect(parsed.cta).toEqual({ elementId: 'el-cta', path: 'text' });
  });

  it('rejects a slot value missing elementId', () => {
    expect(() => variantSlotsSchema.parse({ headline: { path: 'text' } })).toThrow();
  });
});
