// packages/marketplace-registry/src/storage/in-memory.ts
// T-536 — In-memory `StorageAdapter` shim for unit tests + local dev.
// All state lives in maps inside the instance — there is NO global
// state; each instance is independent.
//
// Determinism perimeter: outside (server-side).

import type { StorageAdapter } from './storage.js';

/**
 * In-memory implementation of `StorageAdapter`. Archives + manifests
 * are stored in separate maps so the production split (Cloud Storage
 * buckets for binary + structured metadata bucket for JSON) is
 * mirrored at the shim layer.
 *
 * `signedUrl` returns a deterministic pseudo-URL — callers wanting
 * a real bytes-roundtrip should call `getArchive` / `getManifest`
 * directly.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly archives = new Map<string, Uint8Array>();
  private readonly manifests = new Map<string, string>();

  /** Round-trip `putArchive` → `getArchive`. */
  readonly putArchive = async (key: string, bytes: Uint8Array): Promise<void> => {
    // Defensive copy so callers can't mutate stored bytes post-put.
    this.archives.set(key, new Uint8Array(bytes));
  };

  /** Returns a defensive copy of the stored archive bytes, or `null`. */
  readonly getArchive = async (key: string): Promise<Uint8Array | null> => {
    const v = this.archives.get(key);
    if (v === undefined) {
      return null;
    }
    return new Uint8Array(v);
  };

  /** Persist a manifest JSON string. */
  readonly putManifest = async (key: string, manifestJson: string): Promise<void> => {
    this.manifests.set(key, manifestJson);
  };

  /** Returns the stored manifest JSON string, or `null`. */
  readonly getManifest = async (key: string): Promise<string | null> => {
    const v = this.manifests.get(key);
    return v ?? null;
  };

  /** Enumerate keys (across both archive + manifest maps) by prefix. */
  readonly listKeys = async (prefix: string): Promise<readonly string[]> => {
    const out: string[] = [];
    for (const k of this.archives.keys()) {
      if (k.startsWith(prefix)) {
        out.push(k);
      }
    }
    for (const k of this.manifests.keys()) {
      if (k.startsWith(prefix)) {
        out.push(k);
      }
    }
    return out;
  };

  /** Pseudo-URL for test assertions. */
  readonly signedUrl = async (key: string, ttlSeconds: number): Promise<string> => {
    const kind = this.archives.has(key) ? 'archive' : 'manifest';
    return `inmem://${kind}/${key}?ttl=${ttlSeconds}`;
  };
}
