// packages/adapter-regression/src/snapshot-format.ts
// On-disk shape of a per-adapter regression snapshot (T-435), and pure
// helpers for computing the two SHA-256 digests the snapshot stores:
//
//   1. `descriptorSha256` — over `canonicalize(descriptor)`.
//   2. `outputSha256`     — over `canonicalize(<synthesize/generate result>)`.
//
// Canonicalization re-uses `canonicalize()` from `@stageflip/asset-cache`
// (recursive key-sort, stable JSON) so both digests are stable independent
// of object-key insertion order.
//
// SHA-256 via Web Crypto SubtleCrypto.digest — same pattern as
// `packages/asset-cache/src/cache-key.ts`. Pure + deterministic.

import { canonicalize } from '@stageflip/asset-cache';

/** Lowercase hex of a byte array. */
function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

const TEXT_ENCODER = new TextEncoder();

/**
 * SHA-256 hex over the canonicalized JSON form of `value`. Async because
 * `crypto.subtle.digest` is async on every runtime.
 */
export async function canonicalSha256Hex(value: unknown): Promise<string> {
  const canonical = canonicalize(value);
  const buf = await crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(canonical));
  return toHex(new Uint8Array(buf));
}

/**
 * Hash an adapter descriptor. Used by the regression gate to detect
 * descriptor-shape drift (e.g. a new capability field, a renamed key,
 * a license-posture change).
 */
export async function descriptorSha256(descriptor: unknown): Promise<string> {
  return canonicalSha256Hex(descriptor);
}

/**
 * Hash a `synthesize()` / `generate()` result. The result's `cacheKey` is
 * stored separately on the snapshot for diagnostic clarity; both fields
 * MUST drift together (the cache-key is part of the result).
 */
export async function outputSha256(result: unknown): Promise<string> {
  return canonicalSha256Hex(result);
}

/**
 * One row in a snapshot's `sampleInputs` array. `name` is human-facing
 * (e.g. `'minimal'`); `input` is the canonical input fed to the adapter;
 * `outputSha256` + `cacheKey` are what the gate compares against.
 */
export interface SampleInputSnapshot {
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly outputSha256: string;
  readonly cacheKey: string;
}

/**
 * One per-adapter regression snapshot. Committed to disk at
 * `packages/adapter-regression/snapshots/<id>.json`.
 */
export interface AdapterRegressionSnapshot {
  readonly id: string;
  readonly modality: string;
  readonly descriptorSha256: string;
  readonly sampleInputs: ReadonlyArray<SampleInputSnapshot>;
}

/**
 * Type-narrow an unknown JSON-parsed object into an
 * `AdapterRegressionSnapshot`. Pure validator — does NOT compare against a
 * registry; the snapshot-runner is responsible for matching id +
 * modality against the live adapter.
 *
 * Throws `Error` with a human-legible diagnostic on shape mismatch.
 */
export function parseAdapterRegressionSnapshot(input: unknown): AdapterRegressionSnapshot {
  if (typeof input !== 'object' || input === null) {
    throw new Error('snapshot: root must be an object');
  }
  const o = input as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) {
    throw new Error('snapshot: `id` must be a non-empty string');
  }
  if (typeof o.modality !== 'string' || o.modality.length === 0) {
    throw new Error('snapshot: `modality` must be a non-empty string');
  }
  if (typeof o.descriptorSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(o.descriptorSha256)) {
    throw new Error('snapshot: `descriptorSha256` must be a 64-hex lowercase string');
  }
  if (!Array.isArray(o.sampleInputs) || o.sampleInputs.length === 0) {
    throw new Error('snapshot: `sampleInputs` must be a non-empty array');
  }
  const sampleInputs: SampleInputSnapshot[] = [];
  const rawSamples = o.sampleInputs;
  for (let i = 0; i < rawSamples.length; i += 1) {
    const s = rawSamples[i];
    if (typeof s !== 'object' || s === null) {
      throw new Error(`snapshot: sampleInputs[${i}] must be an object`);
    }
    const so = s as Record<string, unknown>;
    if (typeof so.name !== 'string' || so.name.length === 0) {
      throw new Error(`snapshot: sampleInputs[${i}].name must be a non-empty string`);
    }
    if (typeof so.input !== 'object' || so.input === null || Array.isArray(so.input)) {
      throw new Error(`snapshot: sampleInputs[${i}].input must be an object`);
    }
    if (typeof so.outputSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(so.outputSha256)) {
      throw new Error(
        `snapshot: sampleInputs[${i}].outputSha256 must be a 64-hex lowercase string`,
      );
    }
    if (typeof so.cacheKey !== 'string' || so.cacheKey.length === 0) {
      throw new Error(`snapshot: sampleInputs[${i}].cacheKey must be a non-empty string`);
    }
    sampleInputs.push({
      name: so.name,
      input: so.input as Readonly<Record<string, unknown>>,
      outputSha256: so.outputSha256,
      cacheKey: so.cacheKey,
    });
  }
  return {
    id: o.id,
    modality: o.modality,
    descriptorSha256: o.descriptorSha256,
    sampleInputs,
  };
}

/**
 * Serialize a snapshot to its committed-to-disk form: pretty-printed
 * JSON with a trailing newline. The 2-space indent is the same form
 * Prettier/Biome's default JSON formatter emits — minimizes diff churn
 * when a snapshot legitimately changes.
 */
export function serializeAdapterRegressionSnapshot(snapshot: AdapterRegressionSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
