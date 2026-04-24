// packages/engine/src/handlers/create-mutate/ids.ts
// Deterministic id generation for mutation handlers. Every generator
// scans the current document for existing ids of the given prefix and
// picks the next free integer suffix. Between tool calls the Executor
// applies drained patches + re-reads document, so successive `add_*`
// calls in the same step see the previous insert.

import type { Document, Slide } from '@stageflip/schema';

function nextSuffix(prefix: string, existing: Iterable<string>): number {
  const needle = `${prefix}-`;
  let max = 0;
  for (const id of existing) {
    if (!id.startsWith(needle)) continue;
    const tail = id.slice(needle.length);
    if (!/^\d+$/.test(tail)) continue;
    const n = Number.parseInt(tail, 10);
    if (n > max) max = n;
  }
  return max + 1;
}

export function nextSlideId(doc: Document): string {
  if (doc.content.mode !== 'slide') return 'slide-1';
  const existing = doc.content.slides.map((s) => s.id);
  return `slide-${nextSuffix('slide', existing)}`;
}

export function nextElementId(doc: Document, prefix = 'el'): string {
  if (doc.content.mode !== 'slide') return `${prefix}-1`;
  const existing: string[] = [];
  for (const slide of doc.content.slides) {
    for (const element of slide.elements) existing.push(element.id);
  }
  return `${prefix}-${nextSuffix(prefix, existing)}`;
}

export function deepRenameElementIds<T extends Slide['elements'][number]>(
  elements: readonly T[],
  mapping: Map<string, string>,
): T[] {
  return elements.map((el) => {
    const newId = mapping.get(el.id) ?? el.id;
    return { ...el, id: newId } as T;
  });
}
