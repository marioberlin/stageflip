// packages/marketplace-registry/src/storage/storage.ts
// T-536 — Storage abstraction for the marketplace registry per
// ADR-014 §D1. The production deployment uses Google Cloud Storage
// behind Cloud CDN; tests + dev use the in-memory shim sibling.
// Pack archives, signatures, and manifests all live behind this
// interface — publisher keys are NOT a storage concern (see
// `publishers/registry.ts`).
//
// Determinism perimeter: `@stageflip/marketplace-registry` lives
// OUTSIDE per CLAUDE.md §3 (host-side / server-side).

/**
 * Abstract artifact store the registry routes consume. Implementations
 * MUST be transactional at the per-key level (a successful `put*` call
 * makes the value retrievable on subsequent `get*` calls); the registry
 * does NOT issue compare-and-swap calls — duplicate-version detection
 * happens via `listKeys` + an explicit pre-publish check.
 */
export interface StorageAdapter {
  /**
   * Persist an archive blob under `key`. Overwrites silently if the
   * key already exists; the registry's publish handler guards against
   * version overwrite at the API layer, not at the storage layer.
   */
  readonly putArchive: (key: string, bytes: Uint8Array) => Promise<void>;

  /**
   * Read an archive blob by `key`. Returns `null` when the key is not
   * present.
   */
  readonly getArchive: (key: string) => Promise<Uint8Array | null>;

  /**
   * Persist a manifest JSON string under `key`. Manifests are stored
   * canonicalized (the publish handler stringifies `parsePackManifest`'s
   * output deterministically).
   */
  readonly putManifest: (key: string, manifestJson: string) => Promise<void>;

  /**
   * Read a manifest JSON string by `key`. Returns `null` when the key
   * is not present.
   */
  readonly getManifest: (key: string) => Promise<string | null>;

  /**
   * Enumerate all keys whose path starts with `prefix`. Returns an
   * empty array when the prefix matches nothing. Order is
   * implementation-defined; callers SHOULD sort before comparison.
   */
  readonly listKeys: (prefix: string) => Promise<readonly string[]>;

  /**
   * Issue a short-TTL signed URL for `key` per ADR-014 §D1. The URL
   * format is implementation-defined; the in-memory shim returns a
   * pseudo-URL of the shape `inmem://archive/<key>?ttl=<ttl>` for
   * deterministic test assertions.
   */
  readonly signedUrl: (key: string, ttlSeconds: number) => Promise<string>;
}

/** Canonical storage-key shape conventions per ADR-014 §D1 + spec. */
export const STORAGE_KEYS = {
  archive: (publisherId: string, packId: string, version: string): string =>
    `archives/${publisherId}/${packId}/${version}/archive.sfpack`,
  signature: (publisherId: string, packId: string, version: string): string =>
    `signatures/${publisherId}/${packId}/${version}/signature.bin`,
  manifest: (publisherId: string, packId: string, version: string): string =>
    `manifests/${publisherId}/${packId}/${version}/manifest.json`,
} as const;
