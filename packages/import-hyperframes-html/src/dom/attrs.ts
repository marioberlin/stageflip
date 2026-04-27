// packages/import-hyperframes-html/src/dom/attrs.ts
// data-* attribute extraction helpers over parse5's `Element` shape.
// Hyperframes encodes deck-level dimensions / per-composition track index /
// per-element start offsets via inline `data-*` attrs, so the importer
// needs typed accessors that handle missing-attr / non-numeric cases without
// surprising the caller.

import type { DefaultTreeAdapterTypes } from 'parse5';

type Element = DefaultTreeAdapterTypes.Element;

/** Returns the `name` attribute value, or `undefined` if absent. */
export function getAttr(el: Element, name: string): string | undefined {
  for (const a of el.attrs) {
    if (a.name === name) return a.value;
  }
  return undefined;
}

/** Returns true if `class` contains the exact whitespace-separated token. */
export function hasClass(el: Element, token: string): boolean {
  const cls = getAttr(el, 'class');
  if (cls === undefined) return false;
  return cls.split(/\s+/).includes(token);
}

/** Read `name` as a finite number, or return `undefined` if missing/NaN. */
export function getAttrNumber(el: Element, name: string): number | undefined {
  const raw = getAttr(el, name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}
