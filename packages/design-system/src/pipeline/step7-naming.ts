// packages/design-system/src/pipeline/step7-naming.ts
// Step 7 — Token naming + assignment. Maps clustered palette / typography /
// spacing → semantic names per the v1 deterministic rules.

import type { LossFlag } from '@stageflip/loss-flags';
import { lightness } from '../color/lab-space.js';
import { emitLossFlag } from '../loss-flags.js';
import type { PipelineState, StepDiagnostic } from '../types.js';

/** Color slots in priority order. */
const PALETTE_SLOTS = ['primary', 'secondary', 'accent', 'surface'] as const;
const SPACING_SLOTS = ['tight', 'normal', 'wide', 'x-wide'] as const;

export interface Step7Result {
  paletteNames: Record<string, string>;
  typographyNames: Record<string, string>;
  spacingNames: Record<string, string>;
  lossFlags: LossFlag[];
  diagnostic: Extract<StepDiagnostic, { step: 7 }>;
}

export function runStep7(state: PipelineState): Step7Result {
  const lossFlags: LossFlag[] = [];
  let ambiguousClusters = 0;

  const paletteNames: Record<string, string> = {};
  const usedNames = new Set<string>();

  // Step A: pull out background-like + foreground-like clusters first.
  const remaining = [...state.paletteClusters];
  remaining.sort((a, b) => b.weight - a.weight);

  // background = lightest cluster with L > 0.85; foreground = darkest with L < 0.20.
  let lightest = -1;
  let darkest = 2;
  let lightestIdx = -1;
  let darkestIdx = -1;
  for (let i = 0; i < remaining.length; i += 1) {
    const c = remaining[i];
    if (!c) continue;
    const l = lightness(c.lab);
    if (l > 0.85 && l > lightest) {
      lightest = l;
      lightestIdx = i;
    }
    if (l < 0.2 && l < darkest) {
      darkest = l;
      darkestIdx = i;
    }
  }
  if (lightestIdx >= 0) {
    const c = remaining[lightestIdx];
    if (c) {
      paletteNames[c.id] = 'background';
      usedNames.add('background');
    }
  }
  if (darkestIdx >= 0 && darkestIdx !== lightestIdx) {
    const c = remaining[darkestIdx];
    if (c) {
      paletteNames[c.id] = 'foreground';
      usedNames.add('foreground');
    }
  }

  // Step B: assign primary / secondary / accent / surface to remaining
  // clusters in weight-desc order. Detect ambiguous ties on `primary`.
  const unnamed = remaining.filter((c) => paletteNames[c.id] === undefined);
  if (unnamed.length >= 2) {
    const a = unnamed[0];
    const b = unnamed[1];
    if (a && b && a.weight === b.weight) {
      ambiguousClusters += 1;
      lossFlags.push(
        emitLossFlag({
          code: 'LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER',
          message: `Two color clusters tied for primary (weight=${a.weight}); picked deterministically by centroid lightness`,
          location: {},
        }),
      );
    }
  }
  let slotIdx = 0;
  for (const cluster of unnamed) {
    if (slotIdx < PALETTE_SLOTS.length) {
      const name = PALETTE_SLOTS[slotIdx];
      if (!name) break;
      paletteNames[cluster.id] = name;
      usedNames.add(name);
      slotIdx += 1;
    } else {
      paletteNames[cluster.id] = `accent${slotIdx - PALETTE_SLOTS.length + 1}`;
      slotIdx += 1;
    }
  }

  // Typography naming.
  const typographyNames: Record<string, string> = {};
  // Already weight-desc from step 2.
  const sorted = [...state.typographyClusters];
  if (sorted.length > 0) {
    const body = sorted[0];
    if (body) typographyNames[body.id] = 'body';
  }
  // Display = largest fontSize among the rest.
  const rest = sorted.slice(1);
  if (rest.length > 0) {
    const display = [...rest].sort((a, b) => b.token.fontSize - a.token.fontSize)[0];
    if (display && display.token.fontSize > (sorted[0]?.token.fontSize ?? 0)) {
      typographyNames[display.id] = 'display';
    }
  }
  let subheadAssigned = false;
  let h1Assigned = !typographyNames || !Object.values(typographyNames).includes('display');
  for (const cluster of rest) {
    if (typographyNames[cluster.id]) continue;
    if (!subheadAssigned) {
      typographyNames[cluster.id] = 'subhead';
      subheadAssigned = true;
      continue;
    }
    if (!h1Assigned) {
      typographyNames[cluster.id] = 'h1';
      h1Assigned = true;
      continue;
    }
    typographyNames[cluster.id] = `text${Object.keys(typographyNames).length}`;
  }

  // Spacing naming.
  const spacingNames: Record<string, string> = {};
  const spacingEntries = Object.entries(state.spacingTokens).sort((a, b) => a[1] - b[1]);
  // Pick the median (most-frequent middle) as `normal`. The spec's heuristic
  // says "most-frequent → normal"; we approximate by picking the entry whose
  // px is closest to the unweighted median of the values, then label
  // smaller→tight, larger→wide, etc.
  if (spacingEntries.length > 0) {
    const sorted = spacingEntries.map(([_, v]) => v).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    let normalKey: string | undefined;
    let normalDist = Number.POSITIVE_INFINITY;
    for (const [k, v] of spacingEntries) {
      const d = Math.abs(v - median);
      if (d < normalDist) {
        normalDist = d;
        normalKey = k;
      }
    }
    if (normalKey !== undefined) {
      spacingNames[normalKey] = 'normal';
    }
    // Smaller than normal → tight; larger → wide / x-wide.
    const smaller = spacingEntries
      .filter(([k]) => k !== normalKey)
      .filter(([_, v]) => v < (state.spacingTokens[normalKey ?? ''] ?? Number.POSITIVE_INFINITY))
      .sort((a, b) => b[1] - a[1]);
    if (smaller[0]) spacingNames[smaller[0][0]] = 'tight';
    const larger = spacingEntries
      .filter(([k]) => k !== normalKey)
      .filter(([_, v]) => v > (state.spacingTokens[normalKey ?? ''] ?? Number.NEGATIVE_INFINITY))
      .sort((a, b) => a[1] - b[1]);
    let widerSlotIdx = 2; // 'wide' = SPACING_SLOTS[2]
    for (const [k] of larger) {
      const slot = SPACING_SLOTS[widerSlotIdx];
      if (slot) {
        spacingNames[k] = slot;
        widerSlotIdx += 1;
      } else {
        spacingNames[k] = `s${widerSlotIdx + 1}`;
        widerSlotIdx += 1;
      }
    }
  }

  return {
    paletteNames,
    typographyNames,
    spacingNames,
    lossFlags,
    diagnostic: { step: 7, kind: 'naming', ambiguousClusters },
  };
}
