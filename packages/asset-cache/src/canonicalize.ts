// packages/asset-cache/src/canonicalize.ts
// JSON canonical-form serializer. Produces a stable string representation of
// a JSON-compatible value where object keys are sorted alphabetically at every
// level. Used by deriveCacheKey to produce a deterministic byte input to
// SHA-256 regardless of caller-side object construction order.
//
// Semantics:
//   - Object keys sorted alphabetically (recursive).
//   - Properties whose value is `undefined` are omitted (matches JSON.stringify).
//   - Arrays preserve order (arrays are ordered structures).
//   - `undefined` inside an array becomes `null` (matches JSON.stringify).
//   - Scalars (string, number, boolean, null) are encoded as JSON.
//
// Pure + deterministic — same input always produces same output, no clocks /
// random / I/O.

type CanonicalScalar = string | number | boolean | null;
type CanonicalValue =
  | CanonicalScalar
  | undefined
  | { readonly [key: string]: CanonicalValue }
  | readonly CanonicalValue[];

/**
 * Serialize a JSON-compatible value to a canonical string form: object keys
 * sorted alphabetically at every level, otherwise identical to JSON.stringify.
 */
export function canonicalize(value: unknown): string {
  return stringify(value as CanonicalValue);
}

function stringify(value: CanonicalValue): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null'; // only reachable from inside an array; top-level callers never pass undefined into stringify directly because objects strip it
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      parts.push(stringify(item ?? null));
    }
    return `[${parts.join(',')}]`;
  }
  // Plain object — sort keys, omit undefined values.
  const obj = value as { readonly [key: string]: CanonicalValue };
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const v = obj[key];
    if (v === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${stringify(v)}`);
  }
  return `{${parts.join(',')}}`;
}
