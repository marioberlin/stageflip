// packages/export-pptx/src/xml/emit.ts
// Tiny dependency-free XML emitter. Attribute order is the order in which
// keys were inserted into the input object (callers control order). This
// keeps output byte-deterministic without dragging in a real XML library.
// Handles the four standard XML escapes for attributes and text content.

/** Standard XML 1.0 prolog used at the top of every part we emit. */
export const XML_PROLOG = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Attributes whose value is `undefined` are skipped at emission time. */
export type AttrMap = Record<string, string | number | undefined>;

/** Escape a value for use inside a double-quoted attribute. */
export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape a value for use as an XML text child. */
export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderAttrs(attrs: AttrMap): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue;
    parts.push(` ${k}="${escapeAttr(String(v))}"`);
  }
  return parts.join('');
}

/** Emit a self-closing element: `<tag attr="..."/>`. */
export function emitSelfClosing(name: string, attrs: AttrMap = {}): string {
  return `<${name}${renderAttrs(attrs)}/>`;
}

/**
 * Emit an element with children. Children are concatenated verbatim in the
 * order passed; the caller is responsible for already having escaped any
 * raw text content via `escapeText`.
 */
export function emitElement(name: string, attrs: AttrMap, children: readonly string[]): string {
  if (children.length === 0) return emitSelfClosing(name, attrs);
  return `<${name}${renderAttrs(attrs)}>${children.join('')}</${name}>`;
}
