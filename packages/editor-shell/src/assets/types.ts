// packages/editor-shell/src/assets/types.ts
// Shared types for the asset registry (T-139b).

/**
 * An entry in the editor's in-memory asset registry. Asset IDs are URL-safe
 * strings produced by the registering surface (file upload, import
 * converter, etc.). The registry is deliberately storage-agnostic — the
 * URL may be an `http(s)://` link, a `blob:` object URL, or a `data:`
 * URI. Consumers treat it as an opaque resource handle.
 */
export type AssetKind = 'image' | 'video' | 'audio';

/**
 * One asset in the registry. `ref` is the canonical `asset:<id>` reference
 * that slide elements will carry; `url` is the concrete resource.
 */
export interface Asset {
  /** URL-safe id; also the `<id>` portion of `ref`. */
  id: string;
  /** Canonical `asset:<id>` reference mirrored from `id`. */
  ref: `asset:${string}`;
  kind: AssetKind;
  /** Human-readable label surfaced in the browser grid. */
  name: string;
  /** Resource URL (http(s), blob:, or data:). */
  url: string;
  /** Optional preview URL — often identical to `url` for images. */
  thumbnailUrl?: string;
  /** Byte size; `undefined` when the registering surface does not know. */
  sizeBytes?: number;
  /** Epoch millis — editor-shell is outside the determinism-restricted
   * scope, so wall-clock timestamps are allowed here. */
  addedAt: number;
}
