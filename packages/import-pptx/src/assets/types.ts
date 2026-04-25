// packages/import-pptx/src/assets/types.ts
// Public types for T-243's asset-resolution pass. The `AssetStorage`
// interface keeps the importer package free of any concrete Firebase /
// HTTP / local-disk dependency; the caller wires the adapter.

/**
 * Abstract upload primitive. Implementations live elsewhere
 * (e.g. `@stageflip/storage-firebase`) and are passed to `resolveAssets`.
 *
 * Contract: `put` is idempotent on identical content. The returned id is
 * what the caller wants in the canonical schema's `asset:<id>` form, minus
 * the `asset:` prefix. Implementations are free to use the `contentHash`
 * hint for keying / dedup.
 */
export interface AssetStorage {
  put(
    content: Uint8Array,
    opts: { contentType: string; contentHash: string },
  ): Promise<{ id: string }>;
}

/** Codes carried by `AssetResolutionError`. */
export type AssetResolutionErrorCode = 'STORAGE_UPLOAD_FAILED' | 'BROKEN_REL';

/**
 * Typed error thrown by `resolveAssets`. Failures inside the storage adapter
 * (network, permission denied, quota) bubble up as `STORAGE_UPLOAD_FAILED`
 * with the original error attached as `cause`. `BROKEN_REL` is reserved for
 * the rare hard-fail case where a ZIP entry can't even be read; the common
 * "rel target not in entries" case emits `LF-PPTX-MISSING-ASSET-BYTES`
 * instead and does not throw.
 */
export class AssetResolutionError extends Error {
  override readonly name = 'AssetResolutionError';
  readonly code: AssetResolutionErrorCode;

  constructor(code: AssetResolutionErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}
