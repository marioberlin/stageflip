// packages/design-system/src/pipeline/step5-components.ts
// Step 5 — Component extraction. Walks slides, generates structural-hash
// subgroups per slide, finds hashes that recur on 3+ slides, builds a
// `ComponentDefinition` per recurring grouping. Slot identification per
// position via `slot-identification.ts`.

import type { LossFlag } from '@stageflip/loss-flags';
import type { ComponentDefinition, Document, Slide } from '@stageflip/schema';
import { identifySlots } from '../components/slot-identification.js';
import { generateSubgroups } from '../components/structural-hash.js';
import { emitLossFlag } from '../loss-flags.js';
import type { ComponentLibrary, PipelineState, StepDiagnostic } from '../types.js';

const RECURRING_THRESHOLD = 3;

function getSlides(doc: Document): Slide[] {
  if (doc.content.mode === 'slide') return doc.content.slides;
  return [];
}

export interface Step5Result {
  componentLibrary: ComponentLibrary;
  lossFlags: LossFlag[];
  diagnostic: Extract<StepDiagnostic, { step: 5 }>;
}

export function runStep5(state: PipelineState): Step5Result {
  const slides = getSlides(state.doc);
  // hash → instances
  const buckets = new Map<string, Array<{ slideId: string; elementIds: string[] }>>();
  for (const slide of slides) {
    const subs = generateSubgroups(slide);
    for (const sub of subs) {
      // Each slide contributes at most one instance per hash to avoid
      // self-collisions when a slide has 4 identical groupings.
      const bucket = buckets.get(sub.hash);
      if (bucket?.some((inst) => inst.slideId === sub.slideId)) continue;
      const next = bucket ?? [];
      next.push({ slideId: sub.slideId, elementIds: sub.elementIds });
      buckets.set(sub.hash, next);
    }
  }
  const slidesById = new Map(slides.map((s) => [s.id, s]));
  const componentLibrary: ComponentLibrary = {};
  const lossFlags: LossFlag[] = [];
  const perComponentInstanceCount: Record<string, number> = {};
  let recurringCount = 0;
  // Sort hashes for deterministic id assignment.
  const sortedHashes = Array.from(buckets.keys())
    .filter((h) => (buckets.get(h)?.length ?? 0) >= RECURRING_THRESHOLD)
    .sort();
  let componentIdx = 0;
  for (const hash of sortedHashes) {
    const instances = buckets.get(hash);
    if (!instances) continue;
    recurringCount += 1;
    const result = identifySlots({ hash, instances }, slidesById);
    if (!result) {
      lossFlags.push(
        emitLossFlag({
          code: 'LF-DESIGN-SYSTEM-COMPONENT-MERGE-FAILED',
          message: `Recurring grouping ${hash} has inconsistent shapes across instances`,
          location: {},
        }),
      );
      continue;
    }
    const componentId = `c-component${componentIdx}`;
    componentIdx += 1;
    perComponentInstanceCount[componentId] = instances.length;
    const componentDef: ComponentDefinition = {
      id: componentId,
      body: {
        slots: result.slots,
        layout: {
          width: 1,
          height: 1,
          cells: result.slots.map((s, i) => ({
            slotId: s.id,
            x: 0,
            y: i / Math.max(1, result.slots.length),
            width: 1,
            height: 1 / Math.max(1, result.slots.length),
          })),
        },
      },
    };
    componentLibrary[componentId] = componentDef;
  }
  return {
    componentLibrary,
    lossFlags,
    diagnostic: {
      step: 5,
      kind: 'components',
      recurringCount,
      perComponentInstanceCount,
    },
  };
}
