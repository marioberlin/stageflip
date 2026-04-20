// packages/skills-sync/src/introspect.ts
// Zod schema introspection for skills-sync generators. Walks a schema via
// Zod's _def internals and emits a stable, human-readable description.
// Output is deterministic: field order follows the Zod shape's iteration
// order (stable in Zod 3), enum values are sorted alphabetically, and no
// runtime/timestamp data leaks in.

import type { ZodTypeAny } from 'zod';

export interface FieldDescriptor {
  name: string;
  description: string;
  required: boolean;
}

export interface SchemaDescriptor {
  kind:
    | 'object'
    | 'union'
    | 'discriminated-union'
    | 'enum'
    | 'array'
    | 'record'
    | 'literal'
    | 'primitive'
    | 'lazy'
    | 'other';
  summary: string;
  /** For objects: the field list. Empty otherwise. */
  fields: FieldDescriptor[];
  /** For unions / enums: the member strings. */
  members: string[];
  /** For arrays/records: a short inner description. */
  inner?: string;
  /** Discriminator key for discriminated unions. */
  discriminator?: string;
}

/** Extract Zod typeName from an internal _def. Stable in Zod 3.x. */
function zodTypeName(schema: ZodTypeAny): string {
  // biome-ignore lint/suspicious/noExplicitAny: Zod internal _def has no public types in 3.x
  const def = (schema as any)?._def;
  return def?.typeName ?? 'Unknown';
}

/** Short human-readable description of an inner/nested Zod schema. */
export function describeInner(schema: ZodTypeAny, depth = 0): string {
  if (depth > 3) return '…';
  const tn = zodTypeName(schema);
  // biome-ignore lint/suspicious/noExplicitAny: accessing internal _def
  const def = (schema as any)._def;

  switch (tn) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodNull':
      return 'null';
    case 'ZodUndefined':
      return 'undefined';
    case 'ZodLiteral':
      return `literal(${JSON.stringify(def.value)})`;
    case 'ZodEnum':
      return `enum(${[...def.values].sort().join(' | ')})`;
    case 'ZodOptional':
      return `${describeInner(def.innerType, depth + 1)}?`;
    case 'ZodDefault':
      return `${describeInner(def.innerType, depth + 1)} (default)`;
    case 'ZodNullable':
      return `${describeInner(def.innerType, depth + 1)} | null`;
    case 'ZodArray':
      return `array<${describeInner(def.type, depth + 1)}>`;
    case 'ZodRecord':
      return `record<string, ${describeInner(def.valueType, depth + 1)}>`;
    case 'ZodUnion': {
      const opts = def.options as ZodTypeAny[];
      return `union<${opts.map((o) => describeInner(o, depth + 1)).join(' | ')}>`;
    }
    case 'ZodDiscriminatedUnion':
      return `discriminated-union(${def.discriminator})`;
    case 'ZodObject':
      return 'object';
    case 'ZodLazy':
      return 'lazy<…>';
    case 'ZodEffects':
      return `${describeInner(def.schema, depth + 1)} (refined)`;
    case 'ZodUnknown':
    case 'ZodAny':
      return 'unknown';
    default:
      return tn.replace(/^Zod/, '').toLowerCase();
  }
}

/** Produce a `SchemaDescriptor` for a top-level schema. */
export function describeSchema(schema: ZodTypeAny): SchemaDescriptor {
  const tn = zodTypeName(schema);
  // biome-ignore lint/suspicious/noExplicitAny: accessing internal _def
  const def = (schema as any)._def;

  if (tn === 'ZodObject') {
    const shape = (def.shape as () => Record<string, ZodTypeAny>)();
    const fields: FieldDescriptor[] = Object.entries(shape).map(([name, inner]) => {
      const innerDef = zodTypeName(inner);
      const required = innerDef !== 'ZodOptional' && innerDef !== 'ZodDefault';
      return { name, description: describeInner(inner), required };
    });
    return {
      kind: 'object',
      summary: def.unknownKeys === 'strict' ? 'strict object' : 'object',
      fields,
      members: [],
    };
  }

  if (tn === 'ZodEnum') {
    const values = [...(def.values as string[])].sort();
    return {
      kind: 'enum',
      summary: `enum (${values.length} values)`,
      fields: [],
      members: values,
    };
  }

  if (tn === 'ZodUnion') {
    const opts = def.options as ZodTypeAny[];
    return {
      kind: 'union',
      summary: `union of ${opts.length} variants`,
      fields: [],
      members: opts.map((o) => describeInner(o)),
    };
  }

  if (tn === 'ZodDiscriminatedUnion') {
    const opts = def.options as ZodTypeAny[];
    return {
      kind: 'discriminated-union',
      summary: `discriminated union on \`${def.discriminator}\` (${opts.length} branches)`,
      fields: [],
      members: opts.map((o) => describeInner(o)),
      discriminator: def.discriminator,
    };
  }

  if (tn === 'ZodArray') {
    return {
      kind: 'array',
      summary: `array of ${describeInner(def.type)}`,
      fields: [],
      members: [],
      inner: describeInner(def.type),
    };
  }

  if (tn === 'ZodRecord') {
    return {
      kind: 'record',
      summary: `record<string, ${describeInner(def.valueType)}>`,
      fields: [],
      members: [],
      inner: describeInner(def.valueType),
    };
  }

  if (tn === 'ZodLazy') {
    return {
      kind: 'lazy',
      summary: 'recursive (self-referential)',
      fields: [],
      members: [],
    };
  }

  return {
    kind: 'other',
    summary: describeInner(schema),
    fields: [],
    members: [],
  };
}
