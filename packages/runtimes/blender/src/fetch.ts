// packages/runtimes/blender/src/fetch.ts
// `getBakedFrames(inputsHash, { region })` (T-265 D-T265-4, AC #14–#16).
// Reads from a region-aware bucket; returns one of three statuses:
//   - 'ready'   → manifest.json exists; frame URLs derived from the manifest.
//   - 'pending' → no manifest, no failure marker.
//   - 'failed'  → `bake_failed.json` marker present.
//
// The fetch path is read-only and stateless. No auth is required (frames are
// content-addressed; whoever has the hash already knows the inputs). The
// region argument lets callers respect T-271 residency without going through
// the org → region resolver themselves.

import type { Region } from '@stageflip/auth-schema';

/** Manifest written by the worker on successful completion. */
export interface BakeManifest {
  readonly inputsHash: string;
  readonly frameCount: number;
  readonly fps: number;
  readonly durationMs: number;
  readonly outputBucket: string;
  readonly region: Region;
  /** ISO-8601 timestamp; provenance only. */
  readonly completedAt: string;
}

/** Failure marker written by the worker when all retries are exhausted. */
export interface BakeFailureMarker {
  readonly inputsHash: string;
  readonly error: string;
  readonly failedAt: string;
}

/** Result returned by {@link getBakedFrames}. */
export type BakedFramesResult =
  | {
      readonly status: 'ready';
      readonly bakeId: string;
      readonly inputsHash: string;
      readonly frames: readonly string[];
      readonly manifestUrl: string;
      readonly manifest: BakeManifest;
    }
  | { readonly status: 'pending'; readonly inputsHash: string }
  | {
      readonly status: 'failed';
      readonly inputsHash: string;
      readonly error: string;
      readonly failedAt: string;
    };

/**
 * Read-only bucket accessor used by the fetch path. Concrete callers wire
 * this to GCS, Firebase Storage, S3, etc. Returns `null` when the object
 * does not exist (vs throwing) so the caller can branch cheaply.
 */
export interface BakeBucketReader {
  /** Read an object as a UTF-8 string, or `null` if it does not exist. */
  getText(path: string): Promise<string | null>;
  /** Compute the public URL for an object. */
  publicUrl(path: string): string;
  /** The bucket name — used to enrich the manifest if the writer omitted it. */
  readonly bucketName: string;
}

export interface GetBakedFramesOptions {
  readonly region: Region;
  readonly reader: BakeBucketReader;
}

/** The bucket-relative path prefix for a hash. */
export function bakeKeyPrefix(inputsHash: string): string {
  return `bakes/${inputsHash}`;
}

/** Path to the manifest object for a hash. */
export function manifestKey(inputsHash: string): string {
  return `${bakeKeyPrefix(inputsHash)}/manifest.json`;
}

/** Path to the failure marker for a hash. */
export function failureMarkerKey(inputsHash: string): string {
  return `${bakeKeyPrefix(inputsHash)}/bake_failed.json`;
}

/** Path to a specific frame (0-based). */
export function frameKey(inputsHash: string, n: number): string {
  return `${bakeKeyPrefix(inputsHash)}/frame-${n}.png`;
}

/**
 * Read the bake state for an `inputsHash`. Order of precedence:
 *   1. manifest.json present       → 'ready'
 *   2. bake_failed.json present    → 'failed'
 *   3. neither                     → 'pending'
 *
 * The reader is region-routed by the caller; this function does no auth.
 */
export async function getBakedFrames(
  inputsHash: string,
  opts: GetBakedFramesOptions,
): Promise<BakedFramesResult> {
  const { reader } = opts;

  const manifestText = await reader.getText(manifestKey(inputsHash));
  if (manifestText !== null) {
    const manifest = parseManifest(manifestText, inputsHash);
    const frames: string[] = [];
    for (let i = 0; i < manifest.frameCount; i++) {
      frames.push(reader.publicUrl(frameKey(inputsHash, i)));
    }
    return {
      status: 'ready',
      bakeId: inputsHash,
      inputsHash,
      frames,
      manifestUrl: reader.publicUrl(manifestKey(inputsHash)),
      manifest,
    };
  }

  const failureText = await reader.getText(failureMarkerKey(inputsHash));
  if (failureText !== null) {
    const marker = parseFailureMarker(failureText, inputsHash);
    return {
      status: 'failed',
      inputsHash,
      error: marker.error,
      failedAt: marker.failedAt,
    };
  }

  return { status: 'pending', inputsHash };
}

function parseManifest(text: string, inputsHash: string): BakeManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(`getBakedFrames: corrupt manifest for ${inputsHash}: ${String(err)}`);
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`getBakedFrames: manifest for ${inputsHash} is not an object`);
  }
  const obj = raw as Record<string, unknown>;
  const out: BakeManifest = {
    inputsHash: typeof obj.inputsHash === 'string' ? obj.inputsHash : inputsHash,
    frameCount: requireInt(obj.frameCount, 'frameCount'),
    fps: requireInt(obj.fps, 'fps'),
    durationMs: requireInt(obj.durationMs, 'durationMs'),
    outputBucket: requireString(obj.outputBucket, 'outputBucket'),
    region: requireRegion(obj.region),
    completedAt: requireString(obj.completedAt, 'completedAt'),
  };
  return out;
}

function parseFailureMarker(text: string, inputsHash: string): BakeFailureMarker {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(`getBakedFrames: corrupt failure marker for ${inputsHash}: ${String(err)}`);
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`getBakedFrames: failure marker for ${inputsHash} is not an object`);
  }
  const obj = raw as Record<string, unknown>;
  return {
    inputsHash: typeof obj.inputsHash === 'string' ? obj.inputsHash : inputsHash,
    error: typeof obj.error === 'string' ? obj.error : 'unknown error',
    failedAt: typeof obj.failedAt === 'string' ? obj.failedAt : new Date(0).toISOString(),
  };
}

function requireInt(v: unknown, name: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new Error(`getBakedFrames: manifest field "${name}" must be a non-negative integer`);
  }
  return v;
}
function requireString(v: unknown, name: string): string {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`getBakedFrames: manifest field "${name}" must be a non-empty string`);
  }
  return v;
}
function requireRegion(v: unknown): Region {
  if (v === 'us' || v === 'eu') return v;
  throw new Error(`getBakedFrames: manifest region must be "us" or "eu" (got ${String(v)})`);
}
