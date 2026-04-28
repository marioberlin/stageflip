// packages/runtimes/blender/src/inputs-hash.ts
// Deterministic SHA-256 over a BlenderClip's `{scene, duration}` — the cache
// key for the bake tier (T-265 D-T265-2). Same inputs → same hex digest;
// any field change → different digest. The bake worker writes frames to
// `bakes/{inputsHash}/frame-{N}.png` so the hash IS the global address.
//
// Determinism rules pinned in tests (AC #5–#7):
//   - 1000 invocations on the same input return the same digest.
//   - Field order in objects is normalized (sorted-key JSON canonicalization).
//   - Field types are NOT coerced: `1` and `"1"` produce different hashes.
//   - Floats are serialized exactly as `JSON.stringify` would (no rounding).
//   - Arrays preserve order (semantic — order matters).
//
// Implementation: a hand-rolled JSON canonicalizer that emits with sorted keys,
// then `crypto.createHash('sha256')`.

import { createHash } from 'node:crypto';

import type { BlenderDuration, BlenderScene } from '@stageflip/schema';

/** Inputs to `computeInputsHash`. Must match `BlenderClip.scene` + `.duration`. */
export interface BlenderInputs {
  readonly scene: BlenderScene;
  readonly duration: BlenderDuration;
}

/**
 * Compute the deterministic inputs hash. Result is the lowercase hex SHA-256
 * digest (64 chars). Throws on circular structures.
 */
export function computeInputsHash(inputs: BlenderInputs): string {
  // The canonical envelope. Top-level keys are stable; the canonicalizer sorts
  // nested object keys.
  const canonical = canonicalize({ scene: inputs.scene, duration: inputs.duration });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Canonical JSON serializer with sorted object keys. Differs from
 * `JSON.stringify` only on object key order; numbers, strings, booleans,
 * `null`, and arrays serialize identically. `undefined` values inside objects
 * are omitted (matching `JSON.stringify`); functions and symbols are rejected
 * (the schema does not permit them, but the worker handles only validated
 * input — this layer is the trust boundary).
 */
export function canonicalize(value: unknown): string {
  return canon(value, new WeakSet());
}

function canon(value: unknown, seen: WeakSet<object>): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number': {
      if (!Number.isFinite(value)) {
        throw new Error(`canonicalize: non-finite number ${String(value)} not serializable`);
      }
      return JSON.stringify(value);
    }
    case 'string':
      return JSON.stringify(value);
    case 'bigint':
      throw new Error('canonicalize: bigint values are not supported');
    case 'function':
    case 'symbol':
    case 'undefined':
      // `undefined` at the top level is invalid JSON; in arrays it serializes
      // to `null` per `JSON.stringify`; in objects the key is dropped (handled
      // in the object branch). Top-level undefined is an error.
      throw new Error(`canonicalize: ${typeof value} is not serializable at top level`);
    case 'object': {
      if (seen.has(value as object)) {
        throw new Error('canonicalize: circular structure');
      }
      seen.add(value as object);
      try {
        if (Array.isArray(value)) {
          const parts = value.map((v) => (v === undefined ? 'null' : canonInsideArray(v, seen)));
          return `[${parts.join(',')}]`;
        }
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        const parts: string[] = [];
        for (const k of keys) {
          const v = obj[k];
          if (v === undefined) continue; // matches JSON.stringify semantics
          parts.push(`${JSON.stringify(k)}:${canon(v, seen)}`);
        }
        return `{${parts.join(',')}}`;
      } finally {
        seen.delete(value as object);
      }
    }
    default: {
      // Exhaustiveness; never reached at runtime.
      throw new Error(`canonicalize: unknown type ${typeof value}`);
    }
  }
}

function canonInsideArray(value: unknown, seen: WeakSet<object>): string {
  // Inside arrays, undefined is allowed and becomes `null` (handled by caller).
  return canon(value, seen);
}
