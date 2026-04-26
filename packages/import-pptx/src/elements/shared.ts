// packages/import-pptx/src/elements/shared.ts
// Helpers shared by every element converter. `ElementContext` carries the
// metadata each converter needs but cannot derive locally (slide id, OOXML
// part path for diagnostics, the part's relationship map for asset lookup).
//
// XML shape (T-242d): every element converter consumes the ordered-array
// `preserveOrder: true` shape produced by `opc.ts`'s `parseXml`. The helpers
// re-exported here (`firstChild` / `children` / `attr` / etc.) are the only
// supported way to navigate that shape — no callsite indexes into the raw
// `:@` / array form directly.

import { type OpcRelMap, type OrderedXmlNode, attr, attrs, children, firstChild } from '../opc.js';

/** Per-call metadata threaded through every element converter. */
export interface ElementContext {
  /** Schema id of the slide (or layout / master) currently being walked. */
  slideId: string;
  /** OPC path of the currently parsed part. */
  oocxmlPath: string;
  /** Resolved relationship map for the current part. */
  rels: OpcRelMap;
}

/**
 * Read an attribute as a number (parsed via `Number(...)`). Returns
 * `undefined` when the attribute is absent or not finite.
 */
export function attrNumber(node: OrderedXmlNode | undefined, name: string): number | undefined {
  const v = attr(node, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Concatenate the `#text` content of a node's direct children. Whitespace
 * between siblings is preserved per fast-xml-parser's emission. Returns
 * `undefined` when the node has no text children (distinct from empty
 * string, which means "child present but empty").
 */
export function textContent(node: OrderedXmlNode | undefined): string | undefined {
  if (node === undefined) return undefined;
  const parts: string[] = [];
  for (const c of children(node, '#text')) {
    const v = (c as Record<string, unknown>)['#text'];
    if (typeof v === 'string') parts.push(v);
    else if (typeof v === 'number' || typeof v === 'boolean') parts.push(String(v));
  }
  if (parts.length === 0) return undefined;
  return parts.join('');
}

// Re-export the navigation helpers so element converters import a single
// helper module rather than reaching into `opc.ts` directly.
export { attr, attrs, children, firstChild };
