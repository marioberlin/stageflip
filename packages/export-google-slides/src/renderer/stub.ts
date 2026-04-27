// packages/export-google-slides/src/renderer/stub.ts
// Test stub for `RendererCdpProvider`. Returns canned PNG bytes per slideId.
// Production wires through `@stageflip/renderer-cdp`; tests inject this stub
// to keep the convergence loop deterministic without spinning up Chromium.

import type { Document } from '@stageflip/schema';
import type { RendererCdpProvider } from '../types.js';

export interface StubRendererOptions {
  /** Map of slideId → canned PNG bytes. Missing keys throw on render. */
  pngsBySlideId: Record<string, Uint8Array>;
}

/**
 * Build a `RendererCdpProvider` that returns canned bytes per slideId. The
 * `sizePx` arg is ignored — fixture tests pre-baked the bytes at the
 * expected size. Throws when no canned bytes exist for a slideId so test
 * authors can't accidentally exercise an unconfigured path.
 */
export function createStubRenderer(opts: StubRendererOptions): RendererCdpProvider {
  return {
    async renderSlide(_doc: Document, slideId: string, _sizePx) {
      const bytes = opts.pngsBySlideId[slideId];
      if (bytes === undefined) {
        throw new Error(`StubRenderer: no canned PNG for slideId="${slideId}"`);
      }
      return bytes;
    },
  };
}
