// packages/export-pptx/src/elements/image.ts
// Emit an `ImageElement` as `<p:pic>` with a `<a:blip r:embed="rId..."/>`
// reference. The slide-rel allocator on the SlideEmitContext registers the
// asset → media path mapping; bytes themselves are written by the top-level
// driver via `collectAssets`.

import type { ImageElement } from '@stageflip/schema';
import type { SlideEmitContext } from './shared.js';
import { renderXfrm } from './shared.js';

/**
 * Emit `<p:pic>` for an `ImageElement`. Returns `undefined` (and emits no
 * XML) when the underlying asset id wasn't pre-registered (the upstream
 * collector emits `LF-PPTX-EXPORT-ASSET-MISSING` and skips the element).
 */
export function emitImageElement(
  el: ImageElement,
  ctx: SlideEmitContext,
  resolvedAssets: Map<string, { mediaPath: string }>,
): string | undefined {
  const assetId = parseAssetId(el.src);
  if (assetId === undefined) return undefined;
  const resolved = resolvedAssets.get(assetId);
  if (resolved === undefined) return undefined;
  const relId = ctx.registerImageRel(assetId, resolved.mediaPath);
  const idAttr = escapeAttr(el.id);
  const nameAttr = escapeAttr(el.name ?? el.id);
  const xfrm = renderXfrm(el.transform);
  return `<p:pic>\
<p:nvPicPr><p:cNvPr id="${idAttr}" name="${nameAttr}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>\
<p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>\
<p:spPr>${xfrm}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>\
</p:pic>`;
}

/** Parse `asset:<id>` and return `<id>`, or `undefined` if malformed. */
export function parseAssetId(ref: string): string | undefined {
  if (!ref.startsWith('asset:')) return undefined;
  const id = ref.slice('asset:'.length);
  if (id.length === 0) return undefined;
  return id;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
