// packages/import-pptx/src/opc.ts
// OPC (Open Packaging Conventions) helpers: namespace-aware XML parse +
// relationship resolution. PPTX is a ZIP of XML parts joined by .rels files.
// Every parser entry-point lives on top of this layer.
//
// References (cited per CLAUDE.md §7 — public docs only, no vendored prior art):
//   https://learn.microsoft.com/en-us/openspecs/office_standards/ms-pptx/
//   https://ecma-international.org/publications-and-standards/standards/ecma-376/

import { XMLParser } from 'fast-xml-parser';
import { PptxParseError } from './types.js';
import { type ZipEntries, readTextEntry } from './zip.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  allowBooleanAttributes: true,
  preserveOrder: false,
  trimValues: true,
});

/** A single OPC relationship row (`<Relationship>` in any `*.rels` file). */
export interface OpcRel {
  id: string;
  type: string;
  /** Target as it appears in the rels file; may be relative. */
  target: string;
  /** Resolved absolute path within the package. */
  resolvedTarget: string;
}

/** Map of relId -> rel for a single source part. */
export type OpcRelMap = Record<string, OpcRel>;

/**
 * Parse an XML byte payload into a JS object. Throws
 * `PptxParseError(INVALID_XML, …, oocxmlPath)` on decoder failure.
 */
export function parseXml(entries: ZipEntries, partPath: string): unknown {
  const text = readTextEntry(entries, partPath);
  if (text === undefined) {
    throw new PptxParseError('MISSING_PART', `part not found in pptx: ${partPath}`, partPath);
  }
  try {
    return xmlParser.parse(text);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new PptxParseError('INVALID_XML', `failed to parse xml: ${cause}`, partPath);
  }
}

/**
 * Resolve a relationship `Target` against the package directory of `sourcePart`.
 * Relative targets are resolved against the source part's directory; absolute
 * targets (leading `/`) are taken verbatim minus the leading slash.
 */
export function resolveRelTarget(sourcePart: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const dir = sourcePart.includes('/') ? sourcePart.slice(0, sourcePart.lastIndexOf('/')) : '';
  // Walk `..` segments by joining and normalising manually.
  const segments = (dir === '' ? target : `${dir}/${target}`).split('/');
  const stack: string[] = [];
  for (const seg of segments) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      stack.pop();
      continue;
    }
    stack.push(seg);
  }
  return stack.join('/');
}

/**
 * Read the `.rels` file paired with `partPath`. Returns an empty map when no
 * rels file is present (legitimate for parts with no outgoing relationships).
 */
export function readRels(entries: ZipEntries, partPath: string): OpcRelMap {
  const relsPath = relsPathFor(partPath);
  const text = readTextEntry(entries, relsPath);
  if (text === undefined) return {};

  let parsed: unknown;
  try {
    parsed = xmlParser.parse(text);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new PptxParseError('INVALID_XML', `failed to parse rels: ${cause}`, relsPath);
  }

  const rows = relationshipRows(parsed);
  const map: OpcRelMap = {};
  for (const row of rows) {
    const id = pickAttr(row, 'Id');
    const type = pickAttr(row, 'Type');
    const target = pickAttr(row, 'Target');
    if (id === undefined || type === undefined || target === undefined) continue;
    map[id] = {
      id,
      type,
      target,
      resolvedTarget: resolveRelTarget(partPath, target),
    };
  }
  return map;
}

/** Compute the conventional rels path for a given part path. */
export function relsPathFor(partPath: string): string {
  const slash = partPath.lastIndexOf('/');
  if (slash === -1) return `_rels/${partPath}.rels`;
  const dir = partPath.slice(0, slash);
  const file = partPath.slice(slash + 1);
  return `${dir}/_rels/${file}.rels`;
}

/**
 * Pull `<Relationship>` rows out of a parsed rels document. fast-xml-parser
 * collapses single-element arrays, so we normalise the common shapes here.
 */
function relationshipRows(parsed: unknown): unknown[] {
  if (!isRecord(parsed)) return [];
  const rels = parsed.Relationships;
  if (!isRecord(rels)) return [];
  const row = rels.Relationship;
  if (Array.isArray(row)) return row;
  if (row !== undefined) return [row];
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
