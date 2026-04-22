// packages/editor-shell/src/zodform/introspect.test.ts
// Unit tests for the Zod-3 schema introspector (T-125b).

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { type FieldKind, introspectField, introspectSchema } from './introspect';

describe('introspectSchema', () => {
  it('returns [] when the root is not a ZodObject', () => {
    expect(introspectSchema(z.string())).toEqual([]);
    expect(introspectSchema(z.array(z.string()))).toEqual([]);
  });

  it('walks every top-level field of a ZodObject', () => {
    const schema = z.object({
      title: z.string(),
      count: z.number(),
      active: z.boolean(),
    });
    const fields = introspectSchema(schema);
    expect(fields.map((f) => f.name)).toEqual(['title', 'count', 'active']);
    expect(fields.map((f) => f.kind)).toEqual(['text', 'number', 'boolean']);
  });

  it('prettifies field names into labels', () => {
    const schema = z.object({ fontSize: z.number(), snake_case_name: z.string() });
    const fields = introspectSchema(schema);
    expect(fields[0]?.label).toBe('Font size');
    expect(fields[1]?.label).toBe('Snake case name');
  });

  it('uses `.describe()` as the label when provided', () => {
    const schema = z.object({
      fontSize: z.number().describe('Point size'),
    });
    const [field] = introspectSchema(schema);
    expect(field?.label).toBe('Point size');
    expect(field?.description).toBe('Point size');
  });
});

describe('classification — primitives', () => {
  it('strings classify as text unless they carry a hex-color regex', () => {
    const schema = z.object({
      plain: z.string(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      colorShort: z.string().regex(/^#[0-9a-fA-F]{3}$/),
    });
    const kinds = kindMap(introspectSchema(schema));
    expect(kinds.plain).toBe('text');
    expect(kinds.color).toBe('color');
    expect(kinds.colorShort).toBe('color');
  });

  it('number with both min and max classifies as slider', () => {
    const schema = z.object({
      unbounded: z.number(),
      halfOpen: z.number().min(0),
      bounded: z.number().min(0).max(100),
    });
    const fields = introspectSchema(schema);
    expect(fields[0]?.kind).toBe('number');
    expect(fields[1]?.kind).toBe('number');
    expect(fields[1]?.min).toBe(0);
    expect(fields[2]?.kind).toBe('slider');
    expect(fields[2]?.min).toBe(0);
    expect(fields[2]?.max).toBe(100);
  });

  it('number `.int()` sets step to 1', () => {
    const schema = z.object({ n: z.number().int().min(0).max(10) });
    const [field] = introspectSchema(schema);
    expect(field?.step).toBe(1);
  });

  it('booleans classify as boolean', () => {
    const schema = z.object({ on: z.boolean() });
    expect(introspectSchema(schema)[0]?.kind).toBe('boolean');
  });
});

describe('classification — enums and arrays', () => {
  it('string enum yields the option values', () => {
    const schema = z.object({ align: z.enum(['left', 'center', 'right']) });
    const [field] = introspectSchema(schema);
    expect(field?.kind).toBe('enum');
    expect(field?.enumValues).toEqual(['left', 'center', 'right']);
  });

  it('native enum yields string values', () => {
    enum Align {
      Left = 'left',
      Right = 'right',
    }
    const schema = z.object({ align: z.nativeEnum(Align) });
    const [field] = introspectSchema(schema);
    expect(field?.kind).toBe('enum');
    expect(field?.enumValues?.sort()).toEqual(['left', 'right']);
  });

  it('array of strings classifies as tag-list', () => {
    const schema = z.object({ tags: z.array(z.string()) });
    const [field] = introspectSchema(schema);
    expect(field?.kind).toBe('tag-list');
    expect(field?.elementKind).toBe('string');
  });

  it('array of numbers classifies as number-list', () => {
    const schema = z.object({ xs: z.array(z.number()) });
    const [field] = introspectSchema(schema);
    expect(field?.kind).toBe('number-list');
    expect(field?.elementKind).toBe('number');
  });

  it('array of non-primitives falls back to unknown', () => {
    const schema = z.object({ rows: z.array(z.object({ a: z.number() })) });
    const [field] = introspectSchema(schema);
    expect(field?.kind).toBe('unknown');
  });
});

describe('classification — wrappers', () => {
  it('optional / nullable wrappers preserve the inner kind and flag optional', () => {
    const schema = z.object({
      a: z.string().optional(),
      b: z.number().nullable(),
      c: z.boolean().nullish(),
    });
    const fields = introspectSchema(schema);
    expect(fields[0]?.kind).toBe('text');
    expect(fields[0]?.optional).toBe(true);
    expect(fields[1]?.kind).toBe('number');
    expect(fields[1]?.optional).toBe(true);
    expect(fields[2]?.kind).toBe('boolean');
    expect(fields[2]?.optional).toBe(true);
  });

  it('default wrapper exposes the resolved default value', () => {
    const schema = z.object({
      size: z.number().default(12),
      greeting: z.string().default(() => 'hello'),
    });
    const fields = introspectSchema(schema);
    expect(fields[0]?.defaultValue).toBe(12);
    expect(fields[1]?.defaultValue).toBe('hello');
  });

  it('nested wrappers unwrap iteratively', () => {
    const schema = z.object({
      x: z.number().min(0).max(10).default(5).optional(),
    });
    const [field] = introspectSchema(schema);
    expect(field?.kind).toBe('slider');
    expect(field?.min).toBe(0);
    expect(field?.max).toBe(10);
    expect(field?.defaultValue).toBe(5);
    expect(field?.optional).toBe(true);
  });
});

describe('classification — nested objects and discriminated unions', () => {
  it('nested object recurses into children', () => {
    const schema = z.object({
      meta: z.object({
        author: z.string(),
        year: z.number(),
      }),
    });
    const [field] = introspectSchema(schema);
    expect(field?.kind).toBe('object');
    expect(field?.children?.map((c) => c.name)).toEqual(['author', 'year']);
    expect(field?.children?.[0]?.kind).toBe('text');
  });

  it('discriminated union reports its branches and discriminator', () => {
    const schema = z.object({
      shape: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('circle'), radius: z.number() }),
        z.object({ kind: z.literal('square'), side: z.number() }),
      ]),
    });
    const [field] = introspectSchema(schema);
    expect(field?.kind).toBe('discriminated-union');
    expect(field?.discriminator).toBe('kind');
    expect(field?.branches?.map((b) => b.tag)).toEqual(['circle', 'square']);
    const circle = field?.branches?.[0];
    expect(circle?.fields?.map((f) => f.name)).toEqual(['kind', 'radius']);
    expect(circle?.fields?.[1]?.kind).toBe('number');
  });

  it('plain union (non-discriminated) falls through to unknown', () => {
    const schema = z.object({
      v: z.union([z.string(), z.number()]),
    });
    const [field] = introspectSchema(schema);
    expect(field?.kind).toBe('unknown');
  });
});

describe('introspectField — direct entry point', () => {
  it('classifies a field in isolation without a parent object', () => {
    const spec = introspectField('opacity', z.number().min(0).max(1).default(1));
    expect(spec.kind).toBe('slider');
    expect(spec.defaultValue).toBe(1);
  });
});

function kindMap(fields: Array<{ name: string; kind: FieldKind }>): Record<string, FieldKind> {
  const map: Record<string, FieldKind> = {};
  for (const f of fields) map[f.name] = f.kind;
  return map;
}
