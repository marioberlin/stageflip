// packages/import-pptx/src/parts/slide.ts
// Parse a single slide / layout / master XML part into a ParsedSlide. The
// same shape walker handles all three because their XML root differs only by
// the outer tag (`<p:sld>` / `<p:sldLayout>` / `<p:sldMaster>`).

import type { ElementContext } from '../elements/shared.js';
import { emitLossFlag } from '../loss-flags.js';
import { type OrderedXmlNode, attr, firstChild, parseXml, readRels } from '../opc.js';
import type { LossFlag, ParsedSlide } from '../types.js';
import { PptxParseError } from '../types.js';
import type { ZipEntries } from '../zip.js';
import { walkSpTree } from './sp-tree.js';

const SLIDE_ROOTS = ['p:sld', 'p:sldLayout', 'p:sldMaster'] as const;

/** Parse a slide-like part. Returns the slide + every loss flag raised. */
export function parseSlidePart(
  entries: ZipEntries,
  oocxmlPath: string,
  slideId: string,
): { slide: ParsedSlide; flags: LossFlag[] } {
  const xml = parseXml(entries, oocxmlPath);

  let root: OrderedXmlNode | undefined;
  for (const tag of SLIDE_ROOTS) {
    root = firstChild(xml, tag);
    if (root !== undefined) break;
  }
  if (root === undefined) {
    throw new PptxParseError(
      'INVALID_XML',
      'missing slide root element (expected one of <p:sld>, <p:sldLayout>, <p:sldMaster>)',
      oocxmlPath,
    );
  }

  const flags: LossFlag[] = [];

  const cSld = firstChild(root, 'p:cSld');
  if (cSld === undefined) {
    throw new PptxParseError('INVALID_XML', 'missing <p:cSld> in slide part', oocxmlPath);
  }
  const spTree = firstChild(cSld, 'p:spTree');
  if (spTree === undefined) {
    throw new PptxParseError('INVALID_XML', 'missing <p:spTree> in <p:cSld>', oocxmlPath);
  }

  const rels = readRels(entries, oocxmlPath);
  const ctx: ElementContext = { slideId, oocxmlPath, rels };
  const walked = walkSpTree(spTree, ctx);
  flags.push(...walked.flags);

  // PPTX speaker notes live in a separate `notesSlideN.xml` part referenced
  // via a relationship. T-240 drops them and emits a flag — T-249 / T-250
  // routes them through the canonical schema.
  const notesPath = findNotesRelPath(rels);
  if (notesPath !== undefined) {
    flags.push(
      emitLossFlag({
        code: 'LF-PPTX-NOTES-DROPPED',
        location: { slideId, oocxmlPath: notesPath },
        message: 'speaker notes not yet round-tripped (T-249 / T-250 follow-up)',
      }),
    );
  }

  const title = readSlideTitle(cSld);
  const slide: ParsedSlide = {
    id: slideId,
    elements: walked.elements,
  };
  if (title !== undefined) slide.title = title;
  return { slide, flags };
}

function findNotesRelPath(
  rels: Record<string, { type: string; resolvedTarget: string }>,
): string | undefined {
  for (const rel of Object.values(rels)) {
    if (rel.type.includes('/relationships/notesSlide')) return rel.resolvedTarget;
  }
  return undefined;
}

function readSlideTitle(cSld: OrderedXmlNode): string | undefined {
  const v = attr(cSld, 'name');
  return v !== undefined && v.length > 0 ? v : undefined;
}
