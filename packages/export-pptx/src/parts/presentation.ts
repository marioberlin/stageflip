// packages/export-pptx/src/parts/presentation.ts
// Emit `ppt/presentation.xml` and its `_rels/presentation.xml.rels`. T-253-rider:
// when `masterCount > 0`, the presentation emits `<p:sldMasterIdLst>` entries
// and the rels file lists every master part. Layouts are reached transitively
// from masters via their `<p:sldLayoutIdLst>` (Office consumers walk that chain).

import { XML_PROLOG } from '../xml/emit.js';

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TYPE_SLIDE = `${NS_R}/slide`;
const TYPE_THEME = `${NS_R}/theme`;
const TYPE_SLIDE_MASTER = `${NS_R}/slideMaster`;

/** Default 16:9 slide size in EMU (9144000 × 5143500). */
export const DEFAULT_SLIDE_SIZE = { cx: 9144000, cy: 5143500 } as const;

export interface PresentationInput {
  slideCount: number;
  /** EMU width / height. Defaults to 16:9 when omitted. */
  size?: { cx: number; cy: number };
  /** T-253-rider: number of masters; drives `<p:sldMasterIdLst>` emission. */
  masterCount?: number;
}

/**
 * Build `ppt/presentation.xml`. Emits a `<p:sldIdLst>` for slides and (when
 * `masterCount > 0`) a `<p:sldMasterIdLst>` for masters. The slide / master
 * rels share an allocation table — slides take `rId1..rIdN`, masters take
 * `rId{N+1}..rId{N+M}`, and the theme rel takes `rId{N+M+1}`.
 */
export function emitPresentation(input: PresentationInput): string {
  const size = input.size ?? DEFAULT_SLIDE_SIZE;
  const masterCount = input.masterCount ?? 0;
  const sldIds: string[] = [];
  for (let i = 0; i < input.slideCount; i++) {
    // PPTX `<p:sldId id="...">` values must be in the inclusive range
    // [256, 2147483647]; we use 256 + index for stable, deterministic ids.
    sldIds.push(`<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`);
  }
  const masterIds: string[] = [];
  for (let i = 0; i < masterCount; i++) {
    // PPTX `<p:sldMasterId id="...">` values must be in [2147483648, 4294967295].
    masterIds.push(`<p:sldMasterId id="${2147483648 + i}" r:id="rId${input.slideCount + i + 1}"/>`);
  }
  const masterIdLst =
    masterCount > 0 ? `<p:sldMasterIdLst>${masterIds.join('')}</p:sldMasterIdLst>` : '';
  // Office prefers `<p:sldMasterIdLst>` to come before `<p:sldIdLst>`. Order matters.
  const body = `<p:presentation xmlns:p="${NS_P}" xmlns:r="${NS_R}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">\
${masterIdLst}\
<p:sldIdLst>${sldIds.join('')}</p:sldIdLst>\
<p:sldSz cx="${size.cx}" cy="${size.cy}"/>\
<p:notesSz cx="${size.cy}" cy="${size.cx}"/>\
</p:presentation>`;
  return `${XML_PROLOG}${body}`;
}

/**
 * Build `ppt/_rels/presentation.xml.rels`. Slides come first, then masters,
 * then the theme rel. Layouts are NOT in this top-level rels file — they are
 * reached transitively from each master's rels.
 */
export function emitPresentationRels(slideCount: number, masterCount = 0): string {
  const rows: string[] = [];
  for (let i = 0; i < slideCount; i++) {
    rows.push(
      `<Relationship Id="rId${i + 1}" Type="${TYPE_SLIDE}" Target="slides/slide${i + 1}.xml"/>`,
    );
  }
  for (let i = 0; i < masterCount; i++) {
    rows.push(
      `<Relationship Id="rId${slideCount + i + 1}" Type="${TYPE_SLIDE_MASTER}" Target="slideMasters/slideMaster${i + 1}.xml"/>`,
    );
  }
  const themeRelId = `rId${slideCount + masterCount + 1}`;
  rows.push(`<Relationship Id="${themeRelId}" Type="${TYPE_THEME}" Target="theme/theme1.xml"/>`);
  const body = `<Relationships xmlns="${REL_NS}">${rows.join('')}</Relationships>`;
  return `${XML_PROLOG}${body}`;
}
