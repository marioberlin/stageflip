// packages/import-pptx/src/elements/video.ts
// T-243b — Convert a `<p:sp>` whose `<p:nvSpPr><p:nvPr>` carries a
// `<p:videoFile>` child into a `ParsedVideoElement` with a
// `ParsedAssetRef.unresolved`. The walker (`parts/sp-tree.ts`) decides
// whether to dispatch a `<p:sp>` to `parseShape` or `parseVideo` based on
// the presence of `<p:videoFile>` and the relationship's `TargetMode`;
// `parseVideo` itself is pure and assumes the caller already verified
// that this sp carries an in-ZIP video relationship.

import { emitLossFlag } from '../loss-flags.js';
import type { OrderedXmlNode } from '../opc.js';
import { makeElementId, readTransform } from '../parts/sp-tree.js';
import type { LossFlag, ParsedVideoElement } from '../types.js';
import { attr, firstChild } from './shared.js';
import type { ElementContext } from './shared.js';

/**
 * Parse a `<p:sp>` carrying an in-ZIP `<p:videoFile>` extension into a
 * `ParsedVideoElement`. Emits one `LF-PPTX-UNRESOLVED-VIDEO` flag pointing
 * at the resolved part path; T-243b's `resolveAssets` extension uploads
 * the bytes and clears the flag.
 *
 * The caller is responsible for disambiguating `TargetMode="External"` —
 * those cases must NOT reach this function (they fall through to
 * `parseShape` + `LF-PPTX-UNSUPPORTED-ELEMENT`).
 */
export function parseVideo(
  sp: OrderedXmlNode | undefined,
  ctx: ElementContext,
): { element?: ParsedVideoElement; flags: LossFlag[] } {
  if (sp === undefined) return { flags: [] };
  const flags: LossFlag[] = [];

  const nvSpPr = firstChild(sp, 'p:nvSpPr');
  const cNvPr = firstChild(nvSpPr, 'p:cNvPr');
  const id = makeElementId(attr(cNvPr, 'id'));
  const name = attr(cNvPr, 'name');

  const spPr = firstChild(sp, 'p:spPr');
  const xfrm = firstChild(spPr, 'a:xfrm');
  const transform = readTransform(xfrm);

  const nvPr = firstChild(nvSpPr, 'p:nvPr');
  const videoFile = firstChild(nvPr, 'p:videoFile');
  // OOXML accepts either r:embed or r:link on <p:videoFile>. Both map to
  // the same in-ZIP byte path when the rel's TargetMode is Internal (the
  // walker has already gated on that).
  const relId = attr(videoFile, 'r:embed') ?? attr(videoFile, 'r:link');

  let oocxmlPath = ctx.oocxmlPath;
  if (relId !== undefined) {
    const rel = ctx.rels[relId];
    if (rel !== undefined) oocxmlPath = rel.resolvedTarget;
  }

  flags.push(
    emitLossFlag({
      code: 'LF-PPTX-UNRESOLVED-VIDEO',
      location: { slideId: ctx.slideId, elementId: id, oocxmlPath },
      message: 'video bytes deferred to T-243b resolveAssets',
      ...(relId !== undefined ? { originalSnippet: relId } : {}),
    }),
  );

  const element: ParsedVideoElement = {
    id,
    transform,
    visible: true,
    locked: false,
    animations: [],
    type: 'video',
    src: { kind: 'unresolved', oocxmlPath },
    muted: false,
    loop: false,
    playbackRate: 1,
  };
  if (name !== undefined) element.name = name;
  return { element, flags };
}
