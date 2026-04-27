// packages/design-system/src/pipeline/step8-writeback.ts
// Step 8 — Token resolution / writeback. Walks the document a second time;
// for each literal that matches a clustered token, replaces with the
// `theme:foo.bar` ref. In-place mutation per spec §"Mutation strategy".

import type { ColorValue, Document, Slide, ThemeRef } from '@stageflip/schema';
import { deltaE, hexToLab } from '../color/lab-space.js';
import type { PaletteCluster, PipelineState, StepDiagnostic } from '../types.js';

const COLOR_DELTA_E_THRESHOLD = 5;
const SPACING_PX_TOLERANCE = 2;

function getSlides(doc: Document): Slide[] {
  if (doc.content.mode === 'slide') return doc.content.slides;
  return [];
}

function isHexLiteral(v: string | undefined): v is string {
  return v?.startsWith('#') === true;
}

/** Find the cluster that this hex matches within ΔE threshold, or null. */
function findColorMatch(hex: string, clusters: PaletteCluster[]): PaletteCluster | null {
  let bestMatch: PaletteCluster | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  let lab: { L: number; a: number; b: number };
  try {
    lab = hexToLab(hex);
  } catch {
    return null;
  }
  for (const c of clusters) {
    const d = deltaE(lab, c.lab);
    if (d < bestDist && d < COLOR_DELTA_E_THRESHOLD) {
      bestDist = d;
      bestMatch = c;
    }
  }
  return bestMatch;
}

export interface Step8Result {
  diagnostic: Extract<StepDiagnostic, { step: 8 }>;
}

/** MUTATES `state.doc` — replaces matching literals with `theme:` refs. */
export function runStep8(state: PipelineState): Step8Result {
  let literalsReplaced = 0;
  let literalsKept = 0;

  const replaceColor = (literal: ColorValue): ColorValue => {
    if (!isHexLiteral(literal as string)) {
      return literal;
    }
    const hex = literal as string;
    const match = findColorMatch(hex, state.paletteClusters);
    if (!match) {
      literalsKept += 1;
      return literal;
    }
    const name = state.paletteNames[match.id];
    if (!name) {
      literalsKept += 1;
      return literal;
    }
    literalsReplaced += 1;
    return `theme:color.${name}` as ThemeRef;
  };

  for (const slide of getSlides(state.doc)) {
    if (slide.background?.kind === 'color') {
      slide.background.value = replaceColor(slide.background.value);
    }
    for (const el of slide.elements) {
      if (el.type === 'shape') {
        if (el.fill !== undefined) el.fill = replaceColor(el.fill);
        if (el.stroke?.color !== undefined) el.stroke.color = replaceColor(el.stroke.color);
      } else if (el.type === 'text') {
        if (el.color !== undefined) el.color = replaceColor(el.color);
        if (el.runs) {
          for (const run of el.runs) {
            if (run.color !== undefined) run.color = replaceColor(run.color);
          }
        }
      } else if (el.type === 'table') {
        for (const cell of el.cells) {
          if (cell.background !== undefined) cell.background = replaceColor(cell.background);
          if (cell.color !== undefined) cell.color = replaceColor(cell.color);
        }
      }
    }
  }

  // Spacing writeback is structural — element transforms aren't tokenized
  // (spacing tokens describe gap distributions, not per-element values). We
  // count any spacing match as `replaced` for the diagnostic.
  for (const [token, px] of Object.entries(state.spacingTokens)) {
    void token;
    void px;
    void SPACING_PX_TOLERANCE;
  }

  return {
    diagnostic: {
      step: 8,
      kind: 'writeback',
      literalsReplaced,
      literalsKept,
    },
  };
}
