// packages/export-pptx/src/elements/group.ts
// Emit a `GroupElement` as `<p:grpSp>`. The base writer pre-flattens nested
// transforms upstream (the schema-shape input is post-`accumulateGroupTransforms`,
// so children carry world-space transforms). The group's own xfrm is emitted
// with `chOff`/`chExt` set to the group's own offset/extent — the no-op
// composition that's the inverse of the importer's accumulator.

import { compareToPlaceholder } from '@stageflip/schema';
import type { Element, GroupElement } from '@stageflip/schema';
import type { SlideEmitContext } from './shared.js';
import { pxToEmu, renderNvPr, renderXfrm, resolveAndFlagInheritsFrom } from './shared.js';

/**
 * Emit `<p:grpSp>` for a `GroupElement`. Children dispatch is provided by
 * the caller via `renderChild` so this module doesn't import the per-type
 * emitters (avoids a recursive module cycle).
 */
export function emitGroupElement(
  el: GroupElement,
  ctx: SlideEmitContext,
  renderChild: (child: GroupElement['children'][number], ctx: SlideEmitContext) => string,
): string {
  const idAttr = escapeAttr(el.id);
  const nameAttr = escapeAttr(el.name ?? el.id);
  const resolution = resolveAndFlagInheritsFrom(el, ctx);
  const suppress =
    resolution !== null && resolution.kind === 'resolved'
      ? new Set(compareToPlaceholder(el as Element, resolution.placeholder).suppressKeys)
      : new Set<string>();
  const nvPr = renderNvPr(resolution);
  const isPlaceholderRef = resolution !== null && resolution.kind === 'resolved';
  const xfrm = renderXfrm(el.transform);
  // chOff / chExt: the group's own offset/extent in EMU; identity composition
  // means children's world-space coordinates pass through unchanged.
  const chOffX = pxToEmu(el.transform.x);
  const chOffY = pxToEmu(el.transform.y);
  const chExtCx = Math.max(1, pxToEmu(el.transform.width));
  const chExtCy = Math.max(1, pxToEmu(el.transform.height));

  const childXmls: string[] = [];
  for (const child of el.children) {
    const out = renderChild(child, ctx);
    if (out !== '') childXmls.push(out);
  }

  // Replace `<a:xfrm>...</a:xfrm>` with the chOff/chExt-augmented variant.
  const xfrmWithChild = xfrm.replace(
    '</a:xfrm>',
    `<a:chOff x="${chOffX}" y="${chOffY}"/><a:chExt cx="${chExtCx}" cy="${chExtCy}"/></a:xfrm>`,
  );
  const grpSpPrInner = isPlaceholderRef && suppress.has('transform') ? '' : xfrmWithChild;

  return `<p:grpSp>\
<p:nvGrpSpPr><p:cNvPr id="${idAttr}" name="${nameAttr}"/><p:cNvGrpSpPr/>${nvPr}</p:nvGrpSpPr>\
<p:grpSpPr>${grpSpPrInner}</p:grpSpPr>\
${childXmls.join('')}\
</p:grpSp>`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
