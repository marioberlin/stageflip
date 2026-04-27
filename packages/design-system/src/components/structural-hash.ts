// packages/design-system/src/components/structural-hash.ts
// Element-tree hash for recurring-grouping detection. The fingerprint
// captures element types + relative grid positions (modulo absolute
// transform offsets) so two slides with the same "title-block + body"
// pattern produce the same hash regardless of where the pattern lives on
// the canvas.

import { createHash } from 'node:crypto';
import type { Slide } from '@stageflip/schema';

interface NormalizedElement {
  type: string;
  shape?: string;
  /** Quantized relative position (0..gridN). */
  cx: number;
  cy: number;
  cw: number;
  ch: number;
}

const GRID = 16;

/** Convert a slide's elements to a position-normalized fingerprint. */
function normalize(slide: Slide): NormalizedElement[] {
  const els = slide.elements;
  if (els.length === 0) return [];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const e of els) {
    const t = e.transform;
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + t.width);
    maxY = Math.max(maxY, t.y + t.height);
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  return els.map((e): NormalizedElement => {
    const t = e.transform;
    const out: NormalizedElement = {
      type: e.type,
      cx: Math.round(((t.x - minX) / w) * GRID),
      cy: Math.round(((t.y - minY) / h) * GRID),
      cw: Math.round((t.width / w) * GRID),
      ch: Math.round((t.height / h) * GRID),
    };
    if (e.type === 'shape') out.shape = e.shape;
    return out;
  });
}

/** Build a structural hash for a slide. */
export function hashSlide(slide: Slide): string {
  const normalized = normalize(slide);
  // Sort by (cy, cx, type) for order invariance — two slides with the same
  // elements but emitted in different array order should hash identically.
  const sorted = [...normalized].sort((a, b) => {
    if (a.cy !== b.cy) return a.cy - b.cy;
    if (a.cx !== b.cx) return a.cx - b.cx;
    return a.type.localeCompare(b.type);
  });
  const material = sorted
    .map((n) => `${n.type}:${n.shape ?? ''}:${n.cx},${n.cy},${n.cw}x${n.ch}`)
    .join('|');
  return createHash('sha256').update(material).digest('hex').slice(0, 16);
}

/** A subgroup of n consecutive elements (sorted by cy,cx) on a slide. */
export interface Subgroup {
  slideId: string;
  elementIds: string[];
  hash: string;
}

/**
 * Generate depth-1 subgroups of size n=2..3 from a slide's elements. We use
 * sliding windows over the spatially-sorted element list — a coarse but
 * deterministic approximation of "subtree at depth 1-3" mentioned in the
 * spec. Real component detection on richer fixtures could replace this with
 * group-element traversal once the schema's group element ships.
 */
export function generateSubgroups(slide: Slide): Subgroup[] {
  const out: Subgroup[] = [];
  const els = slide.elements;
  if (els.length < 2) return out;
  const normalized = normalize(slide);
  const sortedIdx = els
    .map((_, i) => i)
    .sort((a, b) => {
      const na = normalized[a];
      const nb = normalized[b];
      if (!na || !nb) return 0;
      if (na.cy !== nb.cy) return na.cy - nb.cy;
      if (na.cx !== nb.cx) return na.cx - nb.cx;
      return 0;
    });
  for (const size of [2, 3]) {
    if (size > els.length) continue;
    for (let i = 0; i + size <= sortedIdx.length; i += 1) {
      const indices = sortedIdx.slice(i, i + size);
      const ids: string[] = [];
      const material: string[] = [];
      for (const k of indices) {
        const el = els[k];
        const norm = normalized[k];
        if (!el || !norm) continue;
        ids.push(el.id);
        material.push(
          `${norm.type}:${norm.shape ?? ''}:${norm.cx},${norm.cy},${norm.cw}x${norm.ch}`,
        );
      }
      const hash = createHash('sha256').update(material.join('|')).digest('hex').slice(0, 16);
      out.push({ slideId: slide.id, elementIds: ids, hash });
    }
  }
  return out;
}
