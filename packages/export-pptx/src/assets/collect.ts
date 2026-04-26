// packages/export-pptx/src/assets/collect.ts
// Walk a Document, collect every distinct image AssetRef, fetch its bytes
// once via the AssetReader, and assign a stable media path. Emits
// LF-PPTX-EXPORT-ASSET-MISSING for absent or unknown-content-type assets so
// the slide emitter can drop the corresponding element.

import type { LossFlag } from '@stageflip/loss-flags';
import type { Document, Element, Slide, SlideContent } from '@stageflip/schema';
import { parseAssetId } from '../elements/image.js';
import { emitLossFlag } from '../loss-flags.js';
import { extensionForImageContentType } from '../parts/content-types.js';
import type { AssetReader } from './types.js';

export interface CollectedAsset {
  assetId: string;
  /** Archive path under `ppt/media/`. */
  mediaPath: string;
  /** File extension without the leading dot, lowercase. */
  extension: string;
  bytes: Uint8Array;
}

export interface CollectAssetsResult {
  /** Resolved-asset map keyed by asset id. */
  resolved: Map<string, CollectedAsset>;
  /** Asset ids that resolved to `undefined` or to a known-broken content type. */
  missing: Set<string>;
  /** Loss flags raised during the walk. */
  flags: LossFlag[];
  /** Distinct media file extensions present, sorted alphabetically. */
  mediaExtensions: string[];
}

/**
 * Walk every slide's element tree, collect distinct image asset refs, fetch
 * bytes once, and assign deterministic media paths
 * (`ppt/media/imageN.<ext>`). The order of `imageN` indices follows
 * first-seen-in-document-order across slides + recursive groups, then
 * sorted by asset id within ties (rare).
 */
export async function collectAssets(
  doc: Document,
  reader: AssetReader | undefined,
): Promise<CollectAssetsResult> {
  const flags: LossFlag[] = [];
  const resolved = new Map<string, CollectedAsset>();
  const missing = new Set<string>();
  const mediaExts = new Set<string>();

  // The base writer only handles slide-mode docs — collect-side dispatches
  // on `content.mode` and skips video/display.
  if (doc.content.mode !== 'slide') {
    return { resolved, missing, flags, mediaExtensions: [] };
  }

  // Walk in document order to assign stable image indices.
  const seen = new Set<string>();
  const ordered: { assetId: string; slideId: string; elementId: string }[] = [];

  for (const slide of (doc.content as SlideContent).slides) {
    walkSlide(slide, ordered, seen);
  }

  let imgIndex = 1;
  for (const entry of ordered) {
    const got = reader === undefined ? undefined : await reader.get(entry.assetId);
    if (got === undefined) {
      missing.add(entry.assetId);
      flags.push(
        emitLossFlag({
          code: 'LF-PPTX-EXPORT-ASSET-MISSING',
          location: { slideId: entry.slideId, elementId: entry.elementId },
          message: `asset "${entry.assetId}" not available from AssetReader`,
          originalSnippet: entry.assetId,
        }),
      );
      continue;
    }
    const ext = extensionForImageContentType(got.contentType);
    if (ext === 'bin') {
      // Unknown content type — surface as missing per spec AC #20.
      missing.add(entry.assetId);
      flags.push(
        emitLossFlag({
          code: 'LF-PPTX-EXPORT-ASSET-MISSING',
          location: { slideId: entry.slideId, elementId: entry.elementId },
          message: `asset "${entry.assetId}" has unsupported content type "${got.contentType}"`,
          originalSnippet: got.contentType,
        }),
      );
      continue;
    }
    const mediaPath = `ppt/media/image${imgIndex}.${ext}`;
    imgIndex++;
    mediaExts.add(ext);
    resolved.set(entry.assetId, {
      assetId: entry.assetId,
      mediaPath,
      extension: ext,
      bytes: got.bytes,
    });
  }

  return {
    resolved,
    missing,
    flags,
    mediaExtensions: [...mediaExts].sort(),
  };
}

function walkSlide(
  slide: Slide,
  out: { assetId: string; slideId: string; elementId: string }[],
  seen: Set<string>,
): void {
  // Slide background may carry an asset ref ({ kind: 'asset', value: '<id>' }).
  // We do NOT route slide-background assets through media/ in the base writer —
  // backgrounds are emitted inline with their own `<a:blipFill>` referencing
  // the same image asset. Future T-253 follow-up can wire the rel; for now
  // the round-trip predicate accepts a flagged loss for image-mode background.
  for (const el of slide.elements) {
    walkElement(el, slide.id, out, seen);
  }
}

function walkElement(
  el: Element,
  slideId: string,
  out: { assetId: string; slideId: string; elementId: string }[],
  seen: Set<string>,
): void {
  if (el.type === 'image') {
    const id = parseAssetId(el.src);
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      out.push({ assetId: id, slideId, elementId: el.id });
    }
  } else if (el.type === 'group') {
    for (const child of el.children) walkElement(child, slideId, out, seen);
  }
}
