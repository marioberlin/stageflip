// packages/fonts/src/aggregate.ts
// Aggregate + normalize FontRequirement[] from any source (registered
// runtime clips, RIR-compiled document, manual composition scripting).
// Deduplicates by (family, weight, style) and unions the optional
// subsets / features lists.

import type { FontRequirement } from '@stageflip/runtimes-contract';

/**
 * Canonical (family, weight, style) key string. Case-insensitive on family,
 * normalises `undefined` weight/style to `'normal'` / `'400'`.
 */
function canonicalKey(req: FontRequirement): string {
  const family = req.family.trim().toLowerCase();
  const weight = req.weight === undefined ? '400' : String(req.weight).toLowerCase();
  const style = (req.style ?? 'normal').toLowerCase();
  return `${family}|${weight}|${style}`;
}

/** Build a CSS font shorthand string suitable for `document.fonts.check` / `.load`. */
export function formatFontShorthand(req: FontRequirement, pxSize = 16): string {
  const style = req.style ?? 'normal';
  const weight = req.weight === undefined ? '400' : String(req.weight);
  // `16px "Family Name"` — wrap family in quotes in case it contains spaces.
  return `${style} ${weight} ${pxSize}px "${req.family.trim()}"`;
}

/**
 * Produce a canonical, deduplicated, sorted list of FontRequirement from any
 * iterable input. Two input requirements that agree on (family, weight,
 * style) collapse into one output with unioned subsets + features.
 *
 * Sort order: by family (case-insensitive) then weight (ascending) then
 * style ('normal' < 'italic' < 'oblique').
 */
export function aggregateFontRequirements(inputs: Iterable<FontRequirement>): FontRequirement[] {
  const buckets = new Map<string, FontRequirement>();
  for (const raw of inputs) {
    if (typeof raw?.family !== 'string' || raw.family.trim().length === 0) {
      throw new Error('aggregateFontRequirements: every requirement must have a non-empty family');
    }
    const key = canonicalKey(raw);
    const existing = buckets.get(key);
    if (existing === undefined) {
      buckets.set(key, normalize(raw));
      continue;
    }
    buckets.set(key, mergePair(existing, raw));
  }
  return Array.from(buckets.values()).sort(compareCanonical);
}

function normalize(req: FontRequirement): FontRequirement {
  const out: FontRequirement = {
    family: req.family.trim(),
    weight: req.weight ?? 400,
    style: req.style ?? 'normal',
  };
  if (req.subsets !== undefined) {
    out.subsets = dedupSorted(req.subsets);
  }
  if (req.features !== undefined) {
    out.features = dedupSorted(req.features);
  }
  return out;
}

function mergePair(a: FontRequirement, b: FontRequirement): FontRequirement {
  const merged: FontRequirement = { family: a.family };
  if (a.weight !== undefined) merged.weight = a.weight;
  if (a.style !== undefined) merged.style = a.style;
  const subsets = unionSorted(a.subsets, b.subsets);
  if (subsets !== undefined) merged.subsets = subsets;
  const features = unionSorted(a.features, b.features);
  if (features !== undefined) merged.features = features;
  return merged;
}

function dedupSorted(items: readonly string[]): readonly string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter((s) => s.length > 0))).sort();
}

function unionSorted(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): readonly string[] | undefined {
  if (a === undefined && b === undefined) return undefined;
  const set = new Set<string>();
  for (const s of a ?? []) {
    const t = s.trim();
    if (t.length > 0) set.add(t);
  }
  for (const s of b ?? []) {
    const t = s.trim();
    if (t.length > 0) set.add(t);
  }
  if (set.size === 0) return undefined;
  return Array.from(set).sort();
}

const STYLE_RANK: Readonly<Record<string, number>> = {
  normal: 0,
  italic: 1,
  oblique: 2,
};

function compareCanonical(a: FontRequirement, b: FontRequirement): number {
  const fa = a.family.toLowerCase();
  const fb = b.family.toLowerCase();
  if (fa !== fb) return fa < fb ? -1 : 1;
  const wa = Number(a.weight ?? 400);
  const wb = Number(b.weight ?? 400);
  if (!Number.isNaN(wa) && !Number.isNaN(wb) && wa !== wb) return wa - wb;
  const sa = STYLE_RANK[a.style ?? 'normal'] ?? 99;
  const sb = STYLE_RANK[b.style ?? 'normal'] ?? 99;
  return sa - sb;
}
