// packages/import-pptx/src/elements/picture.ts
// Convert <p:pic> into a ParsedImageElement with a `ParsedAssetRef`. Image
// bytes are resolved by T-243; until then the asset reference points back to
// the OOXML relationship target.

import { emitLossFlag } from '../loss-flags.js';
import type { OrderedXmlNode } from '../opc.js';
import { makeElementId, readTransform } from '../parts/sp-tree.js';
import type { LossFlag, ParsedImageElement } from '../types.js';
import { attr, firstChild } from './shared.js';
import type { ElementContext } from './shared.js';

export function parsePicture(
  pic: OrderedXmlNode | undefined,
  ctx: ElementContext,
): { element?: ParsedImageElement; flags: LossFlag[] } {
  if (pic === undefined) return { flags: [] };
  const flags: LossFlag[] = [];

  const nvPicPr = firstChild(pic, 'p:nvPicPr');
  const cNvPr = firstChild(nvPicPr, 'p:cNvPr');
  const id = makeElementId(attr(cNvPr, 'id'));
  const name = attr(cNvPr, 'name');

  const spPr = firstChild(pic, 'p:spPr');
  const xfrm = firstChild(spPr, 'a:xfrm');
  const transform = readTransform(xfrm);

  const blipFill = firstChild(pic, 'p:blipFill');
  const blip = firstChild(blipFill, 'a:blip');
  const embedRelId = attr(blip, 'r:embed');

  let oocxmlPath = ctx.oocxmlPath;
  if (embedRelId !== undefined) {
    const rel = ctx.rels[embedRelId];
    if (rel !== undefined) oocxmlPath = rel.resolvedTarget;
  }

  flags.push(
    emitLossFlag({
      code: 'LF-PPTX-UNRESOLVED-ASSET',
      location: { slideId: ctx.slideId, elementId: id, oocxmlPath },
      message: 'image bytes deferred to T-243',
      ...(embedRelId !== undefined ? { originalSnippet: embedRelId } : {}),
    }),
  );

  const element: ParsedImageElement = {
    id,
    transform,
    visible: true,
    locked: false,
    animations: [],
    type: 'image',
    src: { kind: 'unresolved', oocxmlPath },
    fit: 'cover',
  };
  if (name !== undefined) element.name = name;
  return { element, flags };
}
