// packages/design-system/src/components/slot-identification.ts
// Slot identification — given a set of element instances grouped by
// structural hash, emit a SlotDefinition list. Per-element fields that
// vary across instances (text content, image src, fill color) become slots;
// stable fields bake into the component definition.

import type { Element, Slide, SlotDefinition } from '@stageflip/schema';

/** A grouping found by structural-hash matching. */
export interface RecurringGrouping {
  /** Stable id derived from the hash. */
  hash: string;
  instances: Array<{ slideId: string; elementIds: string[] }>;
}

interface IdentificationResult {
  slots: SlotDefinition[];
  /** Maps grouping element-position (0..n-1) → slot index. */
  positionToSlot: Map<number, number>;
}

/**
 * Identify slots across instances of a recurring grouping. For position i in
 * the grouping (after spatially-sorting the elements), determine if
 * instances vary at that position; if so, emit a slot.
 *
 * Returns null if instances are inconsistent (different element-counts or
 * incompatible types at any position).
 */
export function identifySlots(
  grouping: RecurringGrouping,
  slidesById: ReadonlyMap<string, Slide>,
): IdentificationResult | null {
  if (grouping.instances.length === 0) return null;
  const firstInstance = grouping.instances[0];
  if (!firstInstance) return null;
  const expectedSize = firstInstance.elementIds.length;
  if (expectedSize === 0) return null;
  // Confirm all instances have the same size + same kinds at each position.
  const elementsAt: Element[][] = [];
  for (const instance of grouping.instances) {
    if (instance.elementIds.length !== expectedSize) return null;
    const slide = slidesById.get(instance.slideId);
    if (!slide) return null;
    const elsForInstance: Element[] = [];
    for (const id of instance.elementIds) {
      const el = slide.elements.find((e) => e.id === id);
      if (!el) return null;
      elsForInstance.push(el);
    }
    elementsAt.push(elsForInstance);
  }
  const slots: SlotDefinition[] = [];
  const positionToSlot = new Map<number, number>();
  for (let pos = 0; pos < expectedSize; pos += 1) {
    // Verify same element-type across instances.
    const types = new Set<string>();
    for (const arr of elementsAt) {
      const e = arr[pos];
      if (!e) return null;
      types.add(e.type);
    }
    if (types.size !== 1) return null;
    const [type] = Array.from(types);
    if (!isSlottableKind(type)) continue;
    // Determine if the position varies in some user-visible way (text, src).
    const varies = varyAcrossInstances(elementsAt, pos);
    if (!varies) continue;
    const slotIdx = slots.length;
    slots.push({
      id: `slot${slotIdx}`,
      name: defaultSlotName(type, slotIdx),
      kind: type as SlotDefinition['kind'],
      optional: false,
    });
    positionToSlot.set(pos, slotIdx);
  }
  return { slots, positionToSlot };
}

function isSlottableKind(type: string | undefined): boolean {
  return (
    type === 'text' ||
    type === 'image' ||
    type === 'video' ||
    type === 'audio' ||
    type === 'shape' ||
    type === 'table' ||
    type === 'chart' ||
    type === 'embed' ||
    type === 'code'
  );
}

function defaultSlotName(type: string | undefined, idx: number): string {
  if (type === 'text') return idx === 0 ? 'title' : `text${idx}`;
  if (type === 'image') return `image${idx}`;
  return `slot${idx}`;
}

function varyAcrossInstances(elementsAt: Element[][], pos: number): boolean {
  if (elementsAt.length < 2) return false;
  const values: string[] = [];
  for (const arr of elementsAt) {
    const e = arr[pos];
    if (!e) return false;
    if (e.type === 'text') values.push(e.text);
    else if (e.type === 'image') values.push(e.src);
    else if (e.type === 'shape') values.push(e.fill ?? '');
    else values.push(JSON.stringify({ type: e.type }));
  }
  const unique = new Set(values);
  return unique.size > 1;
}
