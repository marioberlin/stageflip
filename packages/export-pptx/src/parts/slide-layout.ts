// packages/export-pptx/src/parts/slide-layout.ts
// Emit `ppt/slideLayouts/slideLayoutN.xml` and its `_rels/slideLayoutN.xml.rels`.
// Each layout part hosts the layout's placeholder elements (full-shape Elements
// per T-251). Layouts reference their owning master via a single `slideMaster`
// rel; downstream consumers (Office) walk the master from there.

import type { LossFlag } from '@stageflip/loss-flags';
import type { SlideLayout, SlideMaster } from '@stageflip/schema';
import { type SlideEmitContext, emitSrgbClr } from '../elements/shared.js';
import { XML_PROLOG } from '../xml/emit.js';
import { renderTemplateElements } from './template-elements.js';

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TYPE_SLIDE_MASTER = `${NS_R}/slideMaster`;

export interface EmitSlideLayoutInput {
  layout: SlideLayout;
  /** 1-based index — used in the OOXML path + rels file naming. */
  layoutIndex: number;
  /** 1-based index of the master this layout points at, in `Document.masters`. */
  masterIndex: number;
  /** Deck-level layouts/masters maps for transitive `inheritsFrom` resolution. */
  layoutsById: ReadonlyMap<string, SlideLayout>;
  mastersById: ReadonlyMap<string, SlideMaster>;
}

export interface EmitSlideLayoutResult {
  xml: string;
  relsXml: string;
  flags: LossFlag[];
}

/** Emit one `<p:sldLayout>` part plus its rels file. */
export function emitSlideLayout(input: EmitSlideLayoutInput): EmitSlideLayoutResult {
  const { layout, layoutIndex, masterIndex } = input;
  const flags: LossFlag[] = [];
  const oocxmlPath = `ppt/slideLayouts/slideLayout${layoutIndex}.xml`;

  const ctx: SlideEmitContext = {
    slideId: layout.id,
    oocxmlPath,
    flags,
    registerImageRel: () => {
      // Layout parts don't own image rels — placeholders are typically text/shape;
      // image placeholders are uncommon and not yet round-tripped at the layout
      // tier. Throwing here would be loud; we return a stub rId so emitters
      // continue without writing media. A future T-253-templates-images rider
      // can wire real layout-side rels.
      return 'rId-template';
    },
    layoutsById: input.layoutsById,
    mastersById: input.mastersById,
    emitMode: 'template',
  };

  // Background — layouts may carry their own background; placeholder for now.
  const bgXml = renderBackground(layout);

  const elementXmls = renderTemplateElements(layout.placeholders, ctx);

  const xml = `${XML_PROLOG}<p:sldLayout xmlns:p="${NS_P}" xmlns:a="${NS_A}" xmlns:r="${NS_R}" preserve="1">\
<p:cSld${escapeAttrPair('name', layout.name)}>${bgXml}<p:spTree>\
<p:nvGrpSpPr><p:cNvPr id="1" name="layoutRoot"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>\
<p:grpSpPr/>\
${elementXmls.join('')}\
</p:spTree></p:cSld>\
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>\
</p:sldLayout>`;

  // Rels: one entry pointing at the master.
  const relsXml = `${XML_PROLOG}<Relationships xmlns="${REL_NS}">\
<Relationship Id="rId1" Type="${TYPE_SLIDE_MASTER}" Target="../slideMasters/slideMaster${masterIndex}.xml"/>\
</Relationships>`;

  return { xml, relsXml, flags };
}

function renderBackground(_layout: SlideLayout): string {
  // The schema's SlideLayout doesn't yet carry a background field; placeholders
  // can paint backgrounds via shape elements. Reserved for future schema growth.
  return '';
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

/**
 * Re-export for tests / other parts that need the same color-emission helper.
 * Keeps the dep tree shallow.
 */
export { emitSrgbClr };
