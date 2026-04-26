// packages/import-pptx/src/parts/presentation.ts
// Reads `ppt/presentation.xml` to enumerate slide / layout / master IDs and
// resolve them against `ppt/_rels/presentation.xml.rels`. The output is a
// list of (relId, targetPath) pairs the slide-tree walker consumes.

import { attr, children, firstChild, parseXml, readRels } from '../opc.js';
import { PptxParseError } from '../types.js';
import type { ZipEntries } from '../zip.js';

const PRESENTATION_PART = 'ppt/presentation.xml';

/** A resolved (rel-id, OPC path) pair for a slide-like part. */
export interface PartRef {
  relId: string;
  oocxmlPath: string;
}

/**
 * Discover slide / layout / master references from `ppt/presentation.xml` +
 * its rels. Layouts and masters are reachable transitively from slides; we
 * collect them in a separate pass during slide walk.
 */
export function readPresentation(entries: ZipEntries): { slides: PartRef[] } {
  const xml = parseXml(entries, PRESENTATION_PART);
  const presentation = firstChild(xml, 'p:presentation');
  if (presentation === undefined) {
    throw new PptxParseError('INVALID_XML', 'missing <p:presentation> root', PRESENTATION_PART);
  }

  const rels = readRels(entries, PRESENTATION_PART);
  const sldIdLst = firstChild(presentation, 'p:sldIdLst');
  const slideIdNodes = children(sldIdLst, 'p:sldId');
  const slides: PartRef[] = [];
  for (const node of slideIdNodes) {
    const relId = attr(node, 'r:id');
    if (relId === undefined) continue;
    const rel = rels[relId];
    if (rel === undefined) continue;
    slides.push({ relId, oocxmlPath: rel.resolvedTarget });
  }
  return { slides };
}
