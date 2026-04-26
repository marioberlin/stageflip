// packages/import-pptx/src/opc.ts
// OPC (Open Packaging Conventions) helpers: namespace-aware XML parse +
// relationship resolution. PPTX is a ZIP of XML parts joined by .rels files.
// Every parser entry-point lives on top of this layer.
//
// XML shape (T-242d): the underlying parser runs with `preserveOrder: true`.
// Every parsed node is therefore an *ordered array* of single-key element
// records `{ "<tag>": [...children], ":@": {...attributes} }`. Document order
// is preserved across heterogeneous tag names — required for `<a:custGeom>`
// where `<a:moveTo>` / `<a:lnTo>` / `<a:arcTo>` interleaving carries meaning.
// Callers should navigate via the helpers below (`firstChild` / `children` /
// `attrs` / `attr`) rather than indexing into the raw shape directly.
//
// References (cited per CLAUDE.md §7 — public docs only, no vendored prior art):
//   https://learn.microsoft.com/en-us/openspecs/office_standards/ms-pptx/
//   https://ecma-international.org/publications-and-standards/standards/ecma-376/
//   https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/docs/v4/2.XMLparseOptions.md

import { XMLParser } from 'fast-xml-parser';
import { PptxParseError } from './types.js';
import { type ZipEntries, readTextEntry } from './zip.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  allowBooleanAttributes: true,
  preserveOrder: true,
  trimValues: true,
});

/**
 * A single element record in the `preserveOrder: true` shape. Exactly one
 * non-`':@'` key — the tag name — whose value is the ordered children array.
 * The optional `:@` key carries the element's attribute map.
 *
 * Concrete shape:
 *   { "p:sld":  [...children], ":@": { "@_xmlns:p": "..." } }
 *   { "a:close": [],            ":@": {} }                    // empty element
 *   { "#text":  "literal text" }                              // text node
 */
export type OrderedXmlNode = Record<string, unknown>;

/** Result of `parseXml` — the ordered top-level children of the document. */
export type OrderedXmlDocument = OrderedXmlNode[];

/** Sentinel attribute key fast-xml-parser uses in `preserveOrder` mode. */
const ATTR_KEY = ':@';

/** A single OPC relationship row (`<Relationship>` in any `*.rels` file). */
export interface OpcRel {
  id: string;
  type: string;
  /** Target as it appears in the rels file; may be relative. */
  target: string;
  /** Resolved absolute path within the package. */
  resolvedTarget: string;
  /**
   * `TargetMode` attribute. Defaults to Internal when absent (per OOXML
   * spec). T-243b reads this to disambiguate in-ZIP video relationships
   * from external-URL `r:link` references.
   */
  targetMode?: 'Internal' | 'External';
}

/** Map of relId -> rel for a single source part. */
export type OpcRelMap = Record<string, OpcRel>;

/**
 * Parse an XML byte payload into the ordered-array shape documented above.
 * Throws `PptxParseError(INVALID_XML, …, oocxmlPath)` on decoder failure.
 */
export function parseXml(entries: ZipEntries, partPath: string): OrderedXmlDocument {
  const text = readTextEntry(entries, partPath);
  if (text === undefined) {
    throw new PptxParseError('MISSING_PART', `part not found in pptx: ${partPath}`, partPath);
  }
  try {
    const parsed = xmlParser.parse(text);
    return Array.isArray(parsed) ? (parsed as OrderedXmlDocument) : [];
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new PptxParseError('INVALID_XML', `failed to parse xml: ${cause}`, partPath);
  }
}

/**
 * Read `value[':@']` as a string-keyed attribute map. Returns an empty object
 * when the node has no attributes.
 */
export function attrs(node: OrderedXmlNode | undefined): Record<string, string> {
  if (node === undefined) return {};
  const raw = node[ATTR_KEY];
  if (raw === undefined || raw === null || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    // fast-xml-parser prefixes attribute keys with `@_`; strip it for callers.
    const name = k.startsWith('@_') ? k.slice(2) : k;
    if (typeof v === 'string') out[name] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[name] = String(v);
  }
  return out;
}

/**
 * Read a single attribute by unprefixed name (e.g. `attr(node, 'r:id')`).
 * Returns `undefined` when absent or non-string.
 */
export function attr(node: OrderedXmlNode | undefined, name: string): string | undefined {
  if (node === undefined) return undefined;
  const raw = node[ATTR_KEY];
  if (raw === undefined || raw === null || typeof raw !== 'object') return undefined;
  const map = raw as Record<string, unknown>;
  const v = map[`@_${name}`] ?? map[name];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Get the ordered children of a node. The node is expected to have exactly
 * one non-attribute key (its tag name) whose value is the children array.
 */
function nodeChildren(node: OrderedXmlNode): OrderedXmlNode[] {
  for (const k of Object.keys(node)) {
    if (k === ATTR_KEY) continue;
    const v = node[k];
    if (Array.isArray(v)) return v as OrderedXmlNode[];
    return [];
  }
  return [];
}

/**
 * Find the first child of `parent` matching `tagName`. `parent` may be a
 * single element node (search its children) or an array of nodes (search the
 * array directly — useful for `parseXml`'s document-root return value).
 */
export function firstChild(
  parent: OrderedXmlNode | OrderedXmlNode[] | undefined,
  tagName: string,
): OrderedXmlNode | undefined {
  if (parent === undefined) return undefined;
  const list = Array.isArray(parent) ? parent : nodeChildren(parent);
  for (const child of list) {
    if (child !== null && typeof child === 'object' && tagName in child) return child;
  }
  return undefined;
}

/**
 * Get every child of `parent` matching `tagName`, in document order. Same
 * `parent` polymorphism as `firstChild`.
 */
export function children(
  parent: OrderedXmlNode | OrderedXmlNode[] | undefined,
  tagName: string,
): OrderedXmlNode[] {
  if (parent === undefined) return [];
  const list = Array.isArray(parent) ? parent : nodeChildren(parent);
  const out: OrderedXmlNode[] = [];
  for (const child of list) {
    if (child !== null && typeof child === 'object' && tagName in child) out.push(child);
  }
  return out;
}

/**
 * Get every child of `parent`, in document order, regardless of tag. Useful
 * when callers must iterate heterogeneous commands (e.g. cust-geom path
 * walking) and dispatch by tag.
 */
export function allChildren(
  parent: OrderedXmlNode | OrderedXmlNode[] | undefined,
): OrderedXmlNode[] {
  if (parent === undefined) return [];
  return Array.isArray(parent) ? parent : nodeChildren(parent);
}

/**
 * Get the (single) tag name of an element record. Returns `undefined` for
 * pseudo-records that have no tag (e.g. attribute-only fragments).
 */
export function tagOf(node: OrderedXmlNode | undefined): string | undefined {
  if (node === undefined) return undefined;
  for (const k of Object.keys(node)) {
    if (k === ATTR_KEY) continue;
    return k;
  }
  return undefined;
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

  let parsed: OrderedXmlDocument;
  try {
    const raw = xmlParser.parse(text);
    parsed = Array.isArray(raw) ? (raw as OrderedXmlDocument) : [];
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new PptxParseError('INVALID_XML', `failed to parse rels: ${cause}`, relsPath);
  }

  const root = firstChild(parsed, 'Relationships');
  const rows = root === undefined ? [] : children(root, 'Relationship');
  const map: OpcRelMap = {};
  for (const row of rows) {
    const id = attr(row, 'Id');
    const type = attr(row, 'Type');
    const target = attr(row, 'Target');
    if (id === undefined || type === undefined || target === undefined) continue;
    const targetMode = attr(row, 'TargetMode');
    const isExternal = targetMode === 'External';
    map[id] = {
      id,
      type,
      target,
      // External targets are URLs, not in-package paths — keep them verbatim.
      resolvedTarget: isExternal ? target : resolveRelTarget(partPath, target),
      ...(targetMode === 'External' || targetMode === 'Internal'
        ? { targetMode }
        : {}),
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
