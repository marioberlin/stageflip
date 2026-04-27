// packages/design-system/src/pipeline/step1-color.ts
// Step 1 — Color extraction + clustering. Walks every element collecting hex
// literals (fills, strokes, text colors, backgrounds, table-cell fills),
// runs seeded k-means in Lab space, returns the cluster set.

import type { Document, Slide } from '@stageflip/schema';
import { type WeightedLab, kMeans } from '../color/kmeans.js';
import { hexToLab, labToRgb, toHex } from '../color/lab-space.js';
import type { HexSample, PaletteCluster, PipelineState, StepDiagnostic } from '../types.js';

/**
 * A `ColorValue` is either a hex literal (#rgb / #rrggbb / #rrggbbaa) or a
 * `theme:foo.bar` ref. Step 1 only tokenizes literals — refs pass through
 * untouched, supporting idempotent re-runs (AC #26).
 */
function isHexLiteral(v: string | undefined): v is string {
  if (!v) return false;
  return v.startsWith('#');
}

function getSlides(doc: Document): Slide[] {
  if (doc.content.mode === 'slide') return doc.content.slides;
  return [];
}

/** Walk a Slide collecting every hex literal with its origin. */
function collectFromSlide(slide: Slide, samples: HexSample[]): void {
  if (slide.background?.kind === 'color' && isHexLiteral(slide.background.value)) {
    samples.push({
      hex: slide.background.value,
      origin: { kind: 'slide-background', slideId: slide.id },
    });
  }
  for (const el of slide.elements) {
    if (el.type === 'shape') {
      if (isHexLiteral(el.fill)) {
        samples.push({
          hex: el.fill,
          origin: { kind: 'shape-fill', slideId: slide.id, elementId: el.id },
        });
      }
      if (el.stroke && isHexLiteral(el.stroke.color)) {
        samples.push({
          hex: el.stroke.color,
          origin: { kind: 'shape-stroke', slideId: slide.id, elementId: el.id },
        });
      }
    } else if (el.type === 'text') {
      if (isHexLiteral(el.color)) {
        samples.push({
          hex: el.color,
          origin: { kind: 'text-color', slideId: slide.id, elementId: el.id },
        });
      }
      if (el.runs) {
        for (let i = 0; i < el.runs.length; i += 1) {
          const run = el.runs[i];
          if (run && isHexLiteral(run.color)) {
            samples.push({
              hex: run.color,
              origin: {
                kind: 'text-run-color',
                slideId: slide.id,
                elementId: el.id,
                runIndex: i,
              },
            });
          }
        }
      }
    } else if (el.type === 'table') {
      for (const cell of el.cells) {
        if (isHexLiteral(cell.background)) {
          samples.push({
            hex: cell.background,
            origin: {
              kind: 'table-cell-fill',
              slideId: slide.id,
              elementId: el.id,
              row: cell.row,
              col: cell.col,
            },
          });
        }
        if (isHexLiteral(cell.color)) {
          samples.push({
            hex: cell.color,
            origin: {
              kind: 'table-cell-fill',
              slideId: slide.id,
              elementId: el.id,
              row: cell.row,
              col: cell.col,
            },
          });
        }
      }
    }
  }
}

/** Public helper for tests: collect every hex literal from a Document. */
export function collectHexSamples(doc: Document): HexSample[] {
  const samples: HexSample[] = [];
  for (const slide of getSlides(doc)) {
    collectFromSlide(slide, samples);
  }
  return samples;
}

/** Build weighted Lab samples by deduplicating identical hex values. */
function aggregate(samples: HexSample[]): WeightedLab[] {
  const byHex = new Map<string, number>();
  for (const s of samples) {
    const lower = s.hex.toLowerCase();
    byHex.set(lower, (byHex.get(lower) ?? 0) + 1);
  }
  const weighted: WeightedLab[] = [];
  const sortedHexes = Array.from(byHex.keys()).sort();
  for (const hex of sortedHexes) {
    const weight = byHex.get(hex);
    if (weight === undefined) continue;
    try {
      const lab = hexToLab(hex);
      weighted.push({ lab, weight, hex });
    } catch {
      // Skip malformed hex literals — collection robustness.
    }
  }
  return weighted;
}

export interface Step1Result {
  paletteClusters: PaletteCluster[];
  hexSamples: HexSample[];
  diagnostic: Extract<StepDiagnostic, { step: 1 }>;
}

/** Run step 1. Pure function. */
export function runStep1(state: PipelineState): Step1Result {
  const hexSamples = collectHexSamples(state.doc);
  const weighted = aggregate(hexSamples);
  const distinctColors = weighted.length;
  const clusterTarget = state.opts.kMeansTargetClusters;
  const clusters = kMeans(weighted, {
    k: clusterTarget,
    seed: state.opts.kMeansSeed,
  });
  const paletteClusters: PaletteCluster[] = clusters.map((c, i) => ({
    id: `c${i}`,
    centroid: toHex(labToRgb(c.centroid)),
    weight: c.weight,
    lab: c.centroid,
  }));
  return {
    paletteClusters,
    hexSamples,
    diagnostic: {
      step: 1,
      kind: 'color',
      clusterCount: paletteClusters.length,
      distinctColors,
    },
  };
}
