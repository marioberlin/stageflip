// packages/export-pptx/src/assets/types.ts
// Read-only asset interface consumed by the exporter. The narrow shape lets
// unit tests use an in-memory map without faking the importer-side
// upload path; production callers wrap their `@stageflip/storage-firebase`
// adapter to implement this interface.

/**
 * Resolves an asset id (the `<id>` of `asset:<id>`) to bytes plus a content
 * type. `undefined` means the asset isn't available (the exporter emits
 * `LF-PPTX-EXPORT-ASSET-MISSING` and drops the referencing element).
 */
export interface AssetReader {
  get(id: string): Promise<{ bytes: Uint8Array; contentType: string } | undefined>;
}
