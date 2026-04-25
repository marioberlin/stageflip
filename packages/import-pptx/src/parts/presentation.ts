// packages/import-pptx/src/parts/presentation.ts
// Reads `ppt/presentation.xml` to enumerate slide / layout / master IDs and
// resolve them against `ppt/_rels/presentation.xml.rels`. The output is a
// list of (relId, targetPath) pairs the slide-tree walker consumes.

import { parseXml, readRels } from '../opc.js';
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
  if (!isRecord(xml)) {
    throw new PptxParseError(
      'INVALID_XML',
      'presentation root is not an object',
      PRESENTATION_PART,
    );
  }

  const presentation = xml['p:presentation'] ?? xml.presentation;
  if (!isRecord(presentation)) {
    throw new PptxParseError('INVALID_XML', 'missing <p:presentation> root', PRESENTATION_PART);
  }

  const rels = readRels(entries, PRESENTATION_PART);
  const slideIdNodes = pickSldIdRows(presentation);
  const slides: PartRef[] = [];
  for (const node of slideIdNodes) {
    const relId = pickAttr(node, 'r:id') ?? pickAttr(node, 'id');
    if (relId === undefined) continue;
    const rel = rels[relId];
    if (rel === undefined) continue;
    slides.push({ relId, oocxmlPath: rel.resolvedTarget });
  }
  return { slides };
}

function pickSldIdRows(presentation: Record<string, unknown>): unknown[] {
  const list = presentation['p:sldIdLst'] ?? presentation.sldIdLst;
  if (!isRecord(list)) return [];
  const rows = list['p:sldId'] ?? list.sldId;
  if (Array.isArray(rows)) return rows;
  if (rows !== undefined) return [rows];
  return [];
}

function pickAttr(node: unknown, name: string): string | undefined {
  if (!isRecord(node)) return undefined;
  const v = node[`@_${name}`];
  return typeof v === 'string' ? v : undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
