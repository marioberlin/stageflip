// packages/import-pptx/src/elements/picture.ts
// Convert <p:pic> into a ParsedImageElement with a `ParsedAssetRef`. Image
// bytes are resolved by T-243; until then the asset reference points back to
// the OOXML relationship target.

import { emitLossFlag } from '../loss-flags.js';
import { makeElementId, readTransform } from '../parts/sp-tree.js';
import type { LossFlag, ParsedImageElement } from '../types.js';
import { isRecord, pickAttr, pickRecord } from './shared.js';
import type { ElementContext } from './shared.js';

export function parsePicture(
  pic: unknown,
  ctx: ElementContext,
): { element?: ParsedImageElement; flags: LossFlag[] } {
  if (!isRecord(pic)) return { flags: [] };
  const flags: LossFlag[] = [];

  const nvPicPr = pickRecord(pic, 'p:nvPicPr');
  const cNvPr = pickRecord(nvPicPr, 'p:cNvPr');
  const id = makeElementId(pickAttr(cNvPr, 'id'));
  const name = pickAttr(cNvPr, 'name');

  const spPr = pickRecord(pic, 'p:spPr');
  const xfrm = pickRecord(spPr, 'a:xfrm');
  const transform = readTransform(xfrm);

  const blipFill = pickRecord(pic, 'p:blipFill');
  const blip = pickRecord(blipFill, 'a:blip');
  const embedRelId = pickAttr(blip, 'r:embed');

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
