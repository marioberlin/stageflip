// packages/export-google-slides/src/convergence/adjust.test.ts
// Pins the inverse-delta adjustment math. AC #14 (stalled — empty array
// when nothing to nudge).

import type { Element } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { planAdjustments } from './adjust.js';
import type { ElementDiff } from './diff.js';

const EMU_PER_PX = 9525;

function el(): Element {
  return {
    id: 'e1',
    type: 'shape',
    shape: 'rect',
    transform: { x: 100, y: 100, width: 200, height: 50, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
  } as Element;
}

describe('planAdjustments', () => {
  it('emits an inverse-delta UpdatePageElementTransformRequest for out-of-tolerance', () => {
    const diff: { perElement: ElementDiff[] } = {
      perElement: [
        {
          elementId: 'e1',
          kind: 'shape',
          positionDeltaPx: 5,
          sizeDeltaPx: 0,
          inTolerance: false,
        },
      ],
    };
    const out = planAdjustments({
      diff,
      apiIdByElement: { e1: 'apiObj1' },
      elementsById: { e1: el() },
      observedById: { e1: { x: 105, y: 100, width: 200, height: 50 } },
    });
    expect(out).toHaveLength(1);
    const req = out[0] as {
      updatePageElementTransform: {
        transform: { translateX: number; translateY: number; unit: string };
      };
    };
    expect(req.updatePageElementTransform.transform.translateX).toBe(-5 * EMU_PER_PX);
    expect(req.updatePageElementTransform.transform.translateY).toBe(0);
    expect(req.updatePageElementTransform.transform.unit).toBe('EMU');
  });

  it('AC #14: returns empty when every out-of-tolerance element has zero delta (stalled)', () => {
    const diff: { perElement: ElementDiff[] } = {
      perElement: [
        {
          elementId: 'e1',
          kind: 'shape',
          // drift exists but observedById matches canonical exactly — no
          // nudge to apply (oscillation case in the spec).
          positionDeltaPx: 0,
          sizeDeltaPx: 1,
          inTolerance: false,
        },
      ],
    };
    const out = planAdjustments({
      diff,
      apiIdByElement: { e1: 'apiObj1' },
      elementsById: { e1: el() },
      observedById: { e1: { x: 100, y: 100, width: 200, height: 50 } },
    });
    expect(out).toHaveLength(0);
  });

  it('skips in-tolerance elements', () => {
    const diff: { perElement: ElementDiff[] } = {
      perElement: [
        {
          elementId: 'e1',
          kind: 'shape',
          positionDeltaPx: 5,
          sizeDeltaPx: 0,
          inTolerance: true,
        },
      ],
    };
    const out = planAdjustments({
      diff,
      apiIdByElement: { e1: 'apiObj1' },
      elementsById: { e1: el() },
      observedById: { e1: { x: 105, y: 100, width: 200, height: 50 } },
    });
    expect(out).toHaveLength(0);
  });
});
