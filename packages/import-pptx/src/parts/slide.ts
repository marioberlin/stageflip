// packages/import-pptx/src/parts/slide.ts
// Parse a single slide / layout / master XML part into a ParsedSlide. The
// same shape walker handles all three because their XML root differs only by
// the outer tag (`<p:sld>` / `<p:sldLayout>` / `<p:sldMaster>`).

import type { ElementContext } from '../elements/shared.js';
import { emitLossFlag } from '../loss-flags.js';
import { parseXml, readRels } from '../opc.js';
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
  if (typeof xml !== 'object' || xml === null) {
    throw new PptxParseError('INVALID_XML', 'slide root is not an object', oocxmlPath);
  }

  const root = SLIDE_ROOTS.map((tag) => (xml as Record<string, unknown>)[tag]).find(
    (v) => v !== undefined,
  );
  if (root === undefined) {
    throw new PptxParseError(
      'INVALID_XML',
      'missing slide root element (expected one of <p:sld>, <p:sldLayout>, <p:sldMaster>)',
      oocxmlPath,
    );
  }

  const flags: LossFlag[] = [];

  const cSld = pickRecord(root, 'p:cSld');
  if (cSld === undefined) {
    throw new PptxParseError('INVALID_XML', 'missing <p:cSld> in slide part', oocxmlPath);
  }
  const spTree = pickRecord(cSld, 'p:spTree');
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

function readSlideTitle(cSld: Record<string, unknown>): string | undefined {
  const v = cSld['@_name'];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function pickRecord(node: unknown, name: string): Record<string, unknown> | undefined {
  if (typeof node !== 'object' || node === null) return undefined;
  const v = (node as Record<string, unknown>)[name];
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}
