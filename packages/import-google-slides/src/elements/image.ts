// packages/import-google-slides/src/elements/image.ts
// Convert Slides API `pageElement.image` into a ParsedImageElement carrying a
// ParsedAssetRef.unresolved with the API's contentUrl. Spec §7: the
// resolveAssets pass (re-exported from @stageflip/import-pptx) treats
// `oocxmlPath` as an opaque locator; we repurpose it as the URL string.

import type { ApiPageElement } from '../api/types.js';
import type { BboxPx } from '../geometry/affine.js';
import { emitLossFlag } from '../loss-flags.js';
import type { LossFlag, ParsedImageElement } from '../types.js';
import { makeElementId, transformFromBbox } from './shared.js';

export function emitImageElement(args: {
  apiElement: ApiPageElement;
  worldBbox: BboxPx;
  slideId: string;
  fallback: string;
}): { element: ParsedImageElement; flags: LossFlag[] } {
  const { apiElement, worldBbox, slideId, fallback } = args;
  const id = makeElementId(apiElement.objectId, fallback);
  const flags: LossFlag[] = [];

  const url = apiElement.image?.contentUrl ?? '';
  if (!url) {
    flags.push(
      emitLossFlag({
        code: 'LF-GSLIDES-IMAGE-FALLBACK',
        location: { slideId, elementId: id },
        message: 'image element has no contentUrl; emitting placeholder ref',
      }),
    );
  }
  const element: ParsedImageElement = {
    id,
    transform: transformFromBbox(worldBbox),
    visible: true,
    locked: false,
    animations: [],
    type: 'image',
    src: { kind: 'unresolved', oocxmlPath: url },
    fit: 'cover',
  };
  return { element, flags };
}
