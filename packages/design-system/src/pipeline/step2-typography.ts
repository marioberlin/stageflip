// packages/design-system/src/pipeline/step2-typography.ts
// Step 2 — Typography extraction. Walks every text element + run, collects
// (font-family, font-size, font-weight, italic) tuples, clusters by
// family+size with weight-aggregated frequency. Naming happens in step 7;
// step 2 emits cluster ids only.

import type { Document, Slide } from '@stageflip/schema';
import type {
  PipelineState,
  StepDiagnostic,
  TypographyCluster,
  TypographySample,
} from '../types.js';

function getSlides(doc: Document): Slide[] {
  if (doc.content.mode === 'slide') return doc.content.slides;
  return [];
}

/** Collect typography samples from a Document. Pure. */
export function collectTypographySamples(doc: Document): TypographySample[] {
  const samples: TypographySample[] = [];
  for (const slide of getSlides(doc)) {
    for (const el of slide.elements) {
      if (el.type !== 'text') continue;
      const family = el.fontFamily;
      const size = el.fontSize;
      // The base text element only contributes if both family and size are set.
      if (family !== undefined && size !== undefined) {
        const sample: TypographySample = {
          fontFamily: family,
          fontSize: size,
          fontWeight: 400,
          italic: false,
          weight: 1,
          origins: [{ slideId: slide.id, elementId: el.id }],
        };
        if (el.lineHeight !== undefined) sample.lineHeight = el.lineHeight;
        samples.push(sample);
      }
      if (el.runs) {
        for (let i = 0; i < el.runs.length; i += 1) {
          const run = el.runs[i];
          if (!run) continue;
          // Runs inherit family/size from the element when unset.
          const runFamily = family;
          const runSize = size;
          if (runFamily === undefined || runSize === undefined) continue;
          const sample: TypographySample = {
            fontFamily: runFamily,
            fontSize: runSize,
            fontWeight: run.weight ?? 400,
            italic: run.italic ?? false,
            weight: 1,
            origins: [{ slideId: slide.id, elementId: el.id, runIndex: i }],
          };
          if (el.lineHeight !== undefined) sample.lineHeight = el.lineHeight;
          samples.push(sample);
        }
      }
    }
  }
  return samples;
}

/** Bucket samples by (family, size, weight, italic). Stable order. */
function clusterSamples(samples: TypographySample[]): TypographyCluster[] {
  const byKey = new Map<string, TypographyCluster>();
  for (const s of samples) {
    const key = `${s.fontFamily}|${s.fontSize}|${s.fontWeight}|${s.italic ? 1 : 0}|${s.lineHeight ?? ''}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.weight += s.weight;
    } else {
      const token: TypographyCluster['token'] = {
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        italic: s.italic,
      };
      if (s.lineHeight !== undefined) token.lineHeight = s.lineHeight;
      byKey.set(key, {
        id: `t${byKey.size}`,
        token,
        weight: s.weight,
      });
    }
  }
  // Stable sort: weight DESC, then size DESC, then family ASC.
  const out = Array.from(byKey.values());
  out.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (b.token.fontSize !== a.token.fontSize) return b.token.fontSize - a.token.fontSize;
    return a.token.fontFamily.localeCompare(b.token.fontFamily);
  });
  // Re-id after sort so id order matches output order.
  return out.map((c, i) => ({ ...c, id: `t${i}` }));
}

export interface Step2Result {
  typographySamples: TypographySample[];
  typographyClusters: TypographyCluster[];
  diagnostic: Extract<StepDiagnostic, { step: 2 }>;
}

export function runStep2(state: PipelineState): Step2Result {
  const samples = collectTypographySamples(state.doc);
  const clusters = clusterSamples(samples);
  const familySet = new Set(clusters.map((c) => c.token.fontFamily));
  // Size variance: population variance over distinct sizes.
  const sizes = clusters.map((c) => c.token.fontSize);
  let sizeVariance = 0;
  if (sizes.length > 0) {
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    sizeVariance = sizes.reduce((acc, s) => acc + (s - mean) ** 2, 0) / sizes.length;
  }
  return {
    typographySamples: samples,
    typographyClusters: clusters,
    diagnostic: {
      step: 2,
      kind: 'typography',
      familyCount: familySet.size,
      sizeVariance,
    },
  };
}
