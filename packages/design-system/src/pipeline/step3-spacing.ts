// packages/design-system/src/pipeline/step3-spacing.ts
// Step 3 — Spacing extraction. Walks every slide's elements, computes
// pairwise gaps between sibling element bounding-box edges, clusters the
// resulting distribution into a small spacing scale.

import type { Document, Slide } from '@stageflip/schema';
import type { PipelineState, SpacingSample, StepDiagnostic } from '../types.js';

function getSlides(doc: Document): Slide[] {
  if (doc.content.mode === 'slide') return doc.content.slides;
  return [];
}

/**
 * Compute axis-aligned non-overlapping edge gaps between sibling elements
 * on a slide. We project each element to its bounding box and look for the
 * shortest center-to-center distance minus widths/heights — i.e., the
 * smallest non-overlapping gap on each axis.
 */
function gapsBetween(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number[] {
  const out: number[] = [];
  // Horizontal gap: min distance between right-of-a and left-of-b (or vice versa).
  if (a.x + a.width <= b.x) out.push(b.x - (a.x + a.width));
  else if (b.x + b.width <= a.x) out.push(a.x - (b.x + b.width));
  // Vertical gap.
  if (a.y + a.height <= b.y) out.push(b.y - (a.y + a.height));
  else if (b.y + b.height <= a.y) out.push(a.y - (b.y + b.height));
  return out;
}

export function collectSpacingSamples(doc: Document): SpacingSample[] {
  const samples: SpacingSample[] = [];
  for (const slide of getSlides(doc)) {
    const els = slide.elements;
    for (let i = 0; i < els.length; i += 1) {
      for (let j = i + 1; j < els.length; j += 1) {
        const a = els[i];
        const b = els[j];
        if (!a || !b) continue;
        const gaps = gapsBetween(a.transform, b.transform);
        for (const g of gaps) {
          if (g > 0 && g < 1000) {
            samples.push({ px: Math.round(g), slideId: slide.id });
          }
        }
      }
    }
  }
  return samples;
}

/**
 * Cluster spacing samples by 1D 1-D-pass with a tolerance window. The tokens
 * are named in step 7 — step 3 emits unnamed numeric clusters keyed by the
 * cluster centroid (rounded to 1 px). Histogram returns raw px → count.
 */
function buildHistogram(samples: SpacingSample[]): Record<number, number> {
  const hist: Record<number, number> = {};
  for (const s of samples) {
    hist[s.px] = (hist[s.px] ?? 0) + 1;
  }
  return hist;
}

/**
 * 1D agglomerative clustering: merge adjacent values within ±2 px of each
 * other into a single bucket (centroid = weighted mean, rounded to 1 px).
 * Output keyed by `s<idx>` in DESC-frequency order.
 */
function clusterSpacing(samples: SpacingSample[]): Record<string, number> {
  if (samples.length === 0) return {};
  const sorted = [...samples].map((s) => s.px).sort((a, b) => a - b);
  const buckets: Array<{ center: number; weight: number; sum: number }> = [];
  for (const px of sorted) {
    const last = buckets[buckets.length - 1];
    if (last && Math.abs(px - last.center) <= 2) {
      last.sum += px;
      last.weight += 1;
      last.center = Math.round(last.sum / last.weight);
    } else {
      buckets.push({ center: px, weight: 1, sum: px });
    }
  }
  // Sort by weight DESC, then by px ASC for ties.
  buckets.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.center - b.center;
  });
  // Cap to 8 buckets — nobody needs more spacing tokens.
  const top = buckets.slice(0, 8);
  const out: Record<string, number> = {};
  for (let i = 0; i < top.length; i += 1) {
    const b = top[i];
    if (b) out[`s${i}`] = b.center;
  }
  return out;
}

export interface Step3Result {
  spacingTokens: Record<string, number>;
  diagnostic: Extract<StepDiagnostic, { step: 3 }>;
}

export function runStep3(state: PipelineState): Step3Result {
  const samples = collectSpacingSamples(state.doc);
  const tokens = clusterSpacing(samples);
  return {
    spacingTokens: tokens,
    diagnostic: {
      step: 3,
      kind: 'spacing',
      histogram: buildHistogram(samples),
    },
  };
}
