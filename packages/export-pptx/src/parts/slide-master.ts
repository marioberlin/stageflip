// packages/export-pptx/src/parts/slide-master.ts
// Emit `ppt/slideMasters/slideMasterN.xml` and its `_rels/slideMasterN.xml.rels`.
// Each master part hosts the master's placeholder elements plus the
// `<p:sldLayoutIdLst>` listing every layout whose `masterId` matches.
//
// The master rels point at the theme + every layout it owns.

import type { LossFlag } from '@stageflip/loss-flags';
import type { SlideLayout, SlideMaster } from '@stageflip/schema';
import type { SlideEmitContext } from '../elements/shared.js';
import { XML_PROLOG } from '../xml/emit.js';
import { renderTemplateElements } from './template-elements.js';

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TYPE_THEME = `${NS_R}/theme`;
const TYPE_SLIDE_LAYOUT = `${NS_R}/slideLayout`;

export interface EmitSlideMasterInput {
  master: SlideMaster;
  /** 1-based index — used in the OOXML path + rels file naming. */
  masterIndex: number;
  /**
   * Layouts whose `masterId` matches this master's id, paired with their
   * 1-based index in `Document.layouts`. Used to emit `<p:sldLayoutIdLst>` and
   * the master's layout rels.
   */
  ownedLayouts: ReadonlyArray<{ layout: SlideLayout; layoutIndex: number }>;
  layoutsById: ReadonlyMap<string, SlideLayout>;
  mastersById: ReadonlyMap<string, SlideMaster>;
}

export interface EmitSlideMasterResult {
  xml: string;
  relsXml: string;
  flags: LossFlag[];
}

/** Emit one `<p:sldMaster>` part plus its rels file. */
export function emitSlideMaster(input: EmitSlideMasterInput): EmitSlideMasterResult {
  const { master, masterIndex, ownedLayouts } = input;
  const flags: LossFlag[] = [];
  const oocxmlPath = `ppt/slideMasters/slideMaster${masterIndex}.xml`;

  const ctx: SlideEmitContext = {
    slideId: master.id,
    oocxmlPath,
    flags,
    registerImageRel: () => 'rId-template',
    layoutsById: input.layoutsById,
    mastersById: input.mastersById,
    emitMode: 'template',
  };

  const elementXmls = renderTemplateElements(master.placeholders, ctx);

  // `<p:sldLayoutIdLst>` lists every owned layout with a synthetic id and
  // the rel id pointing at the layout. PPTX `<p:sldLayoutId id="...">` values
  // must be in [2147483648, 4294967295]; we use 2147483648 + index for stable,
  // deterministic ids.
  const layoutIdLst = ownedLayouts
    .map(
      (_entry, i) => `<p:sldLayoutId id="${2147483648 + i}" r:id="rId${i + 2}"/>`, // rId1 reserved for theme
    )
    .join('');

  const colorMap =
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';

  const xml = `${XML_PROLOG}<p:sldMaster xmlns:p="${NS_P}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">\
<p:cSld${escapeAttrPair('name', master.name)}><p:spTree>\
<p:nvGrpSpPr><p:cNvPr id="1" name="masterRoot"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>\
<p:grpSpPr/>\
${elementXmls.join('')}\
</p:spTree></p:cSld>\
${colorMap}\
<p:sldLayoutIdLst>${layoutIdLst}</p:sldLayoutIdLst>\
<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:otherStyle></p:txStyles>\
</p:sldMaster>`;

  // Rels: rId1 → theme, then one rel per owned layout.
  const layoutRels = ownedLayouts
    .map(
      (entry, i) =>
        `<Relationship Id="rId${i + 2}" Type="${TYPE_SLIDE_LAYOUT}" Target="../slideLayouts/slideLayout${entry.layoutIndex}.xml"/>`,
    )
    .join('');
  const relsXml = `${XML_PROLOG}<Relationships xmlns="${REL_NS}">\
<Relationship Id="rId1" Type="${TYPE_THEME}" Target="../theme/theme1.xml"/>\
${layoutRels}\
</Relationships>`;

  return { xml, relsXml, flags };
}

function escapeAttrPair(name: string, value: string | undefined): string {
  if (value === undefined) return '';
  const v = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return ` ${name}="${v}"`;
}
