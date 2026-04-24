// packages/export-html5-zip/src/asset-resolver.ts
// Small asset-resolver contract: turn an opaque `AssetRef` (see
// `@stageflip/schema` primitives) into concrete bytes. The orchestrator
// uses it to pull fallback PNG / GIF bytes without coupling this package
// to a specific storage backend. T-084a's storage pipeline registers a
// concrete resolver at wire time.

import type { AssetRef } from '@stageflip/schema';

export interface AssetResolver {
  /**
   * Resolve an asset reference to its raw bytes. Throws if the ref is
   * unknown. Implementations MUST be deterministic for a given ref —
   * see `concepts/determinism` and the parity harness's byte-level
   * expectations.
   */
  resolve(ref: AssetRef): Promise<Uint8Array>;
}

/**
 * Map-backed resolver for tests + preview flows that have the bytes in
 * memory already (e.g. the fallback generator T-204 produces bytes on
 * the fly and hands them straight to the orchestrator).
 */
export class InMemoryAssetResolver implements AssetResolver {
  private readonly entries: Map<AssetRef, Uint8Array>;

  constructor(entries: Iterable<readonly [AssetRef, Uint8Array]> = []) {
    this.entries = new Map(entries);
  }

  set(ref: AssetRef, bytes: Uint8Array): this {
    this.entries.set(ref, bytes);
    return this;
  }

  async resolve(ref: AssetRef): Promise<Uint8Array> {
    const bytes = this.entries.get(ref);
    if (bytes === undefined) {
      throw new Error(`asset not found in resolver: ${ref}`);
    }
    return bytes;
  }
}
