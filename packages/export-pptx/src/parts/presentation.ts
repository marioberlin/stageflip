// packages/export-pptx/src/parts/presentation.ts
// Emit `ppt/presentation.xml` and its `_rels/presentation.xml.rels`. The base
// writer does NOT emit `<p:sldMasterIdLst>` content — masters/layouts are
// activated by T-253-rider. Presentation rels point at slides + theme only.

import { XML_PROLOG } from '../xml/emit.js';

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TYPE_SLIDE = `${NS_R}/slide`;
const TYPE_THEME = `${NS_R}/theme`;

/** Default 16:9 slide size in EMU (9144000 × 5143500). */
export const DEFAULT_SLIDE_SIZE = { cx: 9144000, cy: 5143500 } as const;

export interface PresentationInput {
  slideCount: number;
  /** EMU width / height. Defaults to 16:9 when omitted. */
  size?: { cx: number; cy: number };
}

/**
 * Build `ppt/presentation.xml`. Emits a single `<p:sldIdLst>` referencing
 * `rId1`..`rId{slideCount}` for slides; the theme rel uses the next free id.
 */
export function emitPresentation(input: PresentationInput): string {
  const size = input.size ?? DEFAULT_SLIDE_SIZE;
  const sldIds: string[] = [];
  for (let i = 0; i < input.slideCount; i++) {
    // PPTX `<p:sldId id="...">` values must be in the inclusive range
    // [256, 2147483647]; we use 256 + index for stable, deterministic ids.
    sldIds.push(`<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`);
  }
  const body = `<p:presentation xmlns:p="${NS_P}" xmlns:r="${NS_R}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">\
<p:sldIdLst>${sldIds.join('')}</p:sldIdLst>\
<p:sldSz cx="${size.cx}" cy="${size.cy}"/>\
<p:notesSz cx="${size.cy}" cy="${size.cx}"/>\
</p:presentation>`;
  return `${XML_PROLOG}${body}`;
}

/** Build `ppt/_rels/presentation.xml.rels`. */
export function emitPresentationRels(slideCount: number): string {
  const rows: string[] = [];
  for (let i = 0; i < slideCount; i++) {
    rows.push(
      `<Relationship Id="rId${i + 1}" Type="${TYPE_SLIDE}" Target="slides/slide${i + 1}.xml"/>`,
    );
  }
  const themeRelId = `rId${slideCount + 1}`;
  rows.push(`<Relationship Id="${themeRelId}" Type="${TYPE_THEME}" Target="theme/theme1.xml"/>`);
  const body = `<Relationships xmlns="${REL_NS}">${rows.join('')}</Relationships>`;
  return `${XML_PROLOG}${body}`;
}
