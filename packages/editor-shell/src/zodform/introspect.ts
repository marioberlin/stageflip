// packages/editor-shell/src/zodform/introspect.ts
// Zod-3 schema introspector — powers ZodForm's auto-generated inspector.

/**
 * Walks a ZodObject and classifies each field into a UI-kind that <ZodForm>
 * can render without bespoke clip-specific code. This module deliberately
 * knows nothing about React — the renderer is a thin pass over the output.
 *
 * Zod 3 internals consumed here:
 *   `_def.typeName`     → a ZodFirstPartyTypeKind string ('ZodString', …)
 *   `_def.shape()`      → object field map for ZodObject (a function, not a plain obj)
 *   `_def.innerType`    → wrapped inner for Optional / Nullable / Default
 *   `_def.defaultValue` → thunk returning the default for ZodDefault
 *   `_def.type`         → element ZodType for ZodArray
 *   `_def.values`       → tuple (ZodEnum) or native-enum object (ZodNativeEnum)
 *   `_def.checks`       → { kind, value, regex, inclusive } check array
 *   `_def.discriminator` + `_def.options` → ZodDiscriminatedUnion
 *   `_def.description`  → value from `.describe(...)`
 *
 * Adding support for a new Zod type: extend the `classify` switch below.
 * The `FieldSpec` shape evolves additively — the renderer falls through to
 * `'unknown'` for anything it doesn't recognise, so missing coverage is
 * visible as a raw-text input, never a crash.
 */

import type { ZodType } from 'zod';

/** UI-kind classification. ZodForm maps each to a concrete control. */
export type FieldKind =
  | 'text'
  | 'number'
  | 'slider'
  | 'color'
  | 'boolean'
  | 'enum'
  | 'tag-list'
  | 'number-list'
  | 'object'
  | 'discriminated-union'
  | 'unknown';

/** Everything the renderer needs to display one field. */
export interface FieldSpec {
  name: string;
  label: string;
  kind: FieldKind;
  description?: string;
  optional: boolean;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  enumValues?: string[];
  children?: FieldSpec[];
  elementKind?: 'string' | 'number';
  /** Discriminator key on the parent object for discriminated unions. */
  discriminator?: string;
  /** One entry per branch of a discriminated union. */
  branches?: DiscriminatedBranch[];
}

/** One branch of a discriminated union — its tag value plus field list. */
export interface DiscriminatedBranch {
  /** The literal value on the discriminator (e.g. `'circle'`). */
  tag: string;
  /** Fields inside the branch, including the discriminator itself. */
  fields: FieldSpec[];
}

// ---- internal shape of Zod 3 nodes, narrowed just enough to walk ----------

interface ZodNode {
  _def?: ZodNodeDef;
  description?: string;
}

interface ZodNodeDef {
  typeName?: string;
  innerType?: ZodNode;
  defaultValue?: () => unknown;
  shape?: () => Record<string, ZodNode>;
  type?: ZodNode;
  values?: readonly string[] | Record<string, string | number>;
  checks?: Array<ZodCheck>;
  discriminator?: string;
  options?: ZodNode[];
  description?: string;
}

type ZodCheck =
  | { kind: 'min'; value: number; inclusive?: boolean }
  | { kind: 'max'; value: number; inclusive?: boolean }
  | { kind: 'int' }
  | { kind: 'multipleOf'; value: number }
  | { kind: 'regex'; regex: RegExp }
  | { kind: string; [k: string]: unknown };

// ---- helpers --------------------------------------------------------------

/** Conservative hex-color regex-source match: covers `[0-9a-fA-F]{3}` and `{6}`. */
const HEX_COLOR_PATTERN_RE = /\[0-9a-fA-F\]\{(3|6)\}/;

function prettify(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Peel ZodOptional / ZodNullable / ZodDefault to reach the meaningful inner node. */
function unwrap(node: ZodNode): { inner: ZodNode; optional: boolean; defaultValue: unknown } {
  let cur: ZodNode = node;
  let optional = false;
  let defaultValue: unknown;
  // A `z.number().default(5).optional()` stacks ZodOptional over ZodDefault.
  while (cur._def) {
    const typeName = cur._def.typeName;
    if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
      optional = true;
      if (cur._def.innerType) {
        cur = cur._def.innerType;
        continue;
      }
      break;
    }
    if (typeName === 'ZodDefault') {
      if (defaultValue === undefined) {
        try {
          defaultValue = cur._def.defaultValue?.();
        } catch {
          // A thrown default thunk is treated as "no default" rather than crashing
          // the introspector — the form just won't pre-fill the field.
          defaultValue = undefined;
        }
      }
      if (cur._def.innerType) {
        cur = cur._def.innerType;
        continue;
      }
      break;
    }
    break;
  }
  return { inner: cur, optional, defaultValue };
}

function numberChecks(node: ZodNode): { min?: number; max?: number; step?: number } {
  const out: { min?: number; max?: number; step?: number } = {};
  for (const check of node._def?.checks ?? []) {
    if (check.kind === 'min' && typeof check.value === 'number') out.min = check.value;
    else if (check.kind === 'max' && typeof check.value === 'number') out.max = check.value;
    else if (check.kind === 'int') out.step = 1;
  }
  return out;
}

function stringLooksLikeHexColor(node: ZodNode): boolean {
  for (const check of node._def?.checks ?? []) {
    if (check.kind === 'regex' && check.regex instanceof RegExp) {
      if (HEX_COLOR_PATTERN_RE.test(check.regex.source)) return true;
    }
  }
  return false;
}

function classify(inner: ZodNode): Partial<FieldSpec> & { kind: FieldKind } {
  const typeName = inner._def?.typeName;
  switch (typeName) {
    case 'ZodString':
      return stringLooksLikeHexColor(inner) ? { kind: 'color' } : { kind: 'text' };

    case 'ZodNumber': {
      const { min, max, step } = numberChecks(inner);
      const spec: Partial<FieldSpec> = {};
      if (min !== undefined) spec.min = min;
      if (max !== undefined) spec.max = max;
      if (step !== undefined) spec.step = step;
      return { kind: min !== undefined && max !== undefined ? 'slider' : 'number', ...spec };
    }

    case 'ZodBoolean':
      return { kind: 'boolean' };

    case 'ZodEnum': {
      const raw = inner._def?.values ?? [];
      const values = Array.isArray(raw) ? raw.map(String) : [];
      return { kind: 'enum', enumValues: values };
    }

    case 'ZodNativeEnum': {
      const raw = inner._def?.values ?? {};
      const values = Object.values(raw as Record<string, string | number>)
        .filter((v): v is string => typeof v === 'string')
        .map(String);
      return { kind: 'enum', enumValues: values };
    }

    case 'ZodArray': {
      const elementTypeName = inner._def?.type?._def?.typeName;
      if (elementTypeName === 'ZodString') return { kind: 'tag-list', elementKind: 'string' };
      if (elementTypeName === 'ZodNumber') return { kind: 'number-list', elementKind: 'number' };
      return { kind: 'unknown' };
    }

    case 'ZodObject': {
      const shape = inner._def?.shape?.() ?? {};
      const children = Object.entries(shape).map(([name, t]) =>
        introspectField(name, t as ZodType),
      );
      return { kind: 'object', children };
    }

    case 'ZodDiscriminatedUnion': {
      const discriminator = inner._def?.discriminator;
      const options = inner._def?.options ?? [];
      if (!discriminator) return { kind: 'unknown' };
      const branches: DiscriminatedBranch[] = [];
      for (const option of options) {
        const shape = option._def?.shape?.() ?? {};
        const tagNode = shape[discriminator] as ZodNode | undefined;
        const tag = readLiteralTag(tagNode);
        if (tag === undefined) continue;
        const fields = Object.entries(shape).map(([name, t]) =>
          introspectField(name, t as ZodType),
        );
        branches.push({ tag, fields });
      }
      return { kind: 'discriminated-union', discriminator, branches };
    }

    default:
      return { kind: 'unknown' };
  }
}

/** Extract the value from a ZodLiteral node, or undefined if it isn't one. */
function readLiteralTag(node: ZodNode | undefined): string | undefined {
  if (!node?._def) return undefined;
  if (node._def.typeName !== 'ZodLiteral') return undefined;
  const literal = (node._def as { value?: unknown }).value;
  return typeof literal === 'string' ? literal : undefined;
}

// ---- public API -----------------------------------------------------------

/** Build a complete FieldSpec for one field. Handles wrapper unwrapping. */
export function introspectField(name: string, type: ZodType): FieldSpec {
  const node = type as unknown as ZodNode;
  const { inner, optional, defaultValue } = unwrap(node);
  // `.describe()` sets `_def.description` on the wrapper; also sometimes `description`
  // is copied onto the node directly. Prefer the most-specific, then fall back.
  const description =
    inner._def?.description ?? inner.description ?? node._def?.description ?? node.description;
  const classification = classify(inner);

  const spec: FieldSpec = {
    ...classification,
    name,
    label: description ?? prettify(name),
    kind: classification.kind,
    optional,
  };
  if (description !== undefined) spec.description = description;
  if (defaultValue !== undefined) spec.defaultValue = defaultValue;
  return spec;
}

/** Introspect a whole ZodObject. Returns [] if the input isn't a ZodObject. */
export function introspectSchema(schema: ZodType): FieldSpec[] {
  const node = schema as unknown as ZodNode;
  if (node._def?.typeName !== 'ZodObject') return [];
  const shape = node._def.shape?.() ?? {};
  return Object.entries(shape).map(([name, t]) => introspectField(name, t as ZodType));
}
