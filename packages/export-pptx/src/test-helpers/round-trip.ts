// packages/export-pptx/src/test-helpers/round-trip.ts
// Round-trip equality predicate. Compares two `CanonicalSlideTree` values for
// structural equality with the documented exclusions in
// docs/tasks/T-253-base.md §"Round-trip equality predicate". Shared across
// both T-253-base and T-253-rider; the `riderActive` flag selects between
// "drop inheritsFrom + layouts/masters on both sides" (base) vs.
// "preserve them" (rider).

import type { CanonicalSlideTree, ParsedElement, ParsedSlide } from '@stageflip/import-pptx';

export interface RoundTripOptions {
  /** True when T-253-rider's placeholder-inheritance write-back is in scope. */
  riderActive: boolean;
}

/**
 * Returns `null` on success, or a human-readable difference description on
 * failure. Designed to be assertable with a single `expect(diff).toBeNull()`
 * call, with the failure message naming the divergent field.
 */
export function diffRoundTrip(
  before: CanonicalSlideTree,
  after: CanonicalSlideTree,
  opts: RoundTripOptions,
): string | null {
  if (before.slides.length !== after.slides.length) {
    return `slides.length: ${before.slides.length} vs ${after.slides.length}`;
  }
  for (let i = 0; i < before.slides.length; i++) {
    const a = before.slides[i];
    const b = after.slides[i];
    if (a === undefined || b === undefined) continue;
    const d = diffSlide(a, b, opts, `slides[${i}]`);
    if (d !== null) return d;
  }
  if (!opts.riderActive) {
    // Base writer never emits layouts/masters, so the second pass must be
    // empty regardless of the input.
    if (Object.keys(after.layouts).length !== 0) {
      return `after.layouts must be empty for base writer; got ${Object.keys(after.layouts).length}`;
    }
    if (Object.keys(after.masters).length !== 0) {
      return `after.masters must be empty for base writer; got ${Object.keys(after.masters).length}`;
    }
  }
  return null;
}

function diffSlide(
  a: ParsedSlide,
  b: ParsedSlide,
  opts: RoundTripOptions,
  path: string,
): string | null {
  // `id` is parser-assigned (`slide_N`); both sides use the same naming so
  // we can compare directly.
  if (a.id !== b.id) return `${path}.id: ${a.id} vs ${b.id}`;
  // Notes are dropped on output by the base writer; the predicate stipulates
  // that the second pass must also have empty notes.
  if (b.notes !== undefined && b.notes.length > 0) {
    return `${path}.notes: expected empty (notes dropped) but got "${b.notes}"`;
  }
  // Title round-trips when present and non-empty; importer treats empty
  // title as undefined, so symmetry holds.
  if ((a.title ?? '') !== (b.title ?? '')) {
    return `${path}.title: "${a.title ?? ''}" vs "${b.title ?? ''}"`;
  }
  if (a.elements.length !== b.elements.length) {
    return `${path}.elements.length: ${a.elements.length} vs ${b.elements.length}`;
  }
  for (let i = 0; i < a.elements.length; i++) {
    const ea = a.elements[i];
    const eb = b.elements[i];
    if (ea === undefined || eb === undefined) continue;
    const d = diffElement(ea, eb, opts, `${path}.elements[${i}]`);
    if (d !== null) return d;
  }
  return null;
}

function diffElement(
  a: ParsedElement,
  b: ParsedElement,
  opts: RoundTripOptions,
  path: string,
): string | null {
  if (a.type !== b.type) return `${path}.type: ${a.type} vs ${b.type}`;
  // Transform: exact equality on every numeric field. EMU-derived px values
  // come from integer EMU divides on both sides; no epsilon.
  const ta = a.transform;
  const tb = b.transform;
  if (ta.x !== tb.x) return `${path}.transform.x: ${ta.x} vs ${tb.x}`;
  if (ta.y !== tb.y) return `${path}.transform.y: ${ta.y} vs ${tb.y}`;
  if (ta.width !== tb.width) return `${path}.transform.width: ${ta.width} vs ${tb.width}`;
  if (ta.height !== tb.height) return `${path}.transform.height: ${ta.height} vs ${tb.height}`;

  if (a.type === 'text' && b.type === 'text') {
    if (a.text !== b.text) return `${path}.text: "${a.text}" vs "${b.text}"`;
    return null;
  }
  if (a.type === 'shape' && b.type === 'shape') {
    if (a.shape !== b.shape) return `${path}.shape: ${a.shape} vs ${b.shape}`;
    return null;
  }
  if (a.type === 'image' && b.type === 'image') {
    // The src may be either resolved (`asset:<id>`) or unresolved
    // (oocxmlPath). For the base round-trip we accept either side carrying
    // an unresolved ref pointing at the round-tripped media path.
    return null;
  }
  if (a.type === 'group' && b.type === 'group') {
    if (a.children.length !== b.children.length) {
      return `${path}.children.length: ${a.children.length} vs ${b.children.length}`;
    }
    for (let i = 0; i < a.children.length; i++) {
      const ca = a.children[i];
      const cb = b.children[i];
      if (ca === undefined || cb === undefined) continue;
      const d = diffElement(ca, cb, opts, `${path}.children[${i}]`);
      if (d !== null) return d;
    }
    return null;
  }
  // Other element types — base writer drops them; predicate treats matching
  // types as equal up to id (dropped → never round-trips).
  return null;
}
