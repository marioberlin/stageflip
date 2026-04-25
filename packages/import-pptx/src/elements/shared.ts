// packages/import-pptx/src/elements/shared.ts
// Helpers shared by every element converter. `ElementContext` carries the
// metadata each converter needs but cannot derive locally (slide id, OOXML
// part path for diagnostics, the part's relationship map for asset lookup).

import type { OpcRelMap } from '../opc.js';

/** Per-call metadata threaded through every element converter. */
export interface ElementContext {
  /** Schema id of the slide (or layout / master) currently being walked. */
  slideId: string;
  /** OPC path of the currently parsed part. */
  oocxmlPath: string;
  /** Resolved relationship map for the current part. */
  rels: OpcRelMap;
}

/** True when `v` is a plain object (not array, not null). */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Helper: collapse fast-xml-parser's "single child becomes object" shape. */
export function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v === undefined) return [];
  return [v];
}

/** Read a `@_<name>` string attribute. */
export function pickAttr(node: unknown, name: string): string | undefined {
  if (!isRecord(node)) return undefined;
  const v = node[`@_${name}`];
  return typeof v === 'string' ? v : undefined;
}

/** Read a `@_<name>` numeric attribute, returning `undefined` on miss/parse-fail. */
export function pickAttrNumber(node: unknown, name: string): number | undefined {
  const v = pickAttr(node, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Pull a child object out by tag name; `undefined` when absent. */
export function pickRecord(node: unknown, name: string): Record<string, unknown> | undefined {
  if (!isRecord(node)) return undefined;
  const v = node[name];
  return isRecord(v) ? v : undefined;
}
