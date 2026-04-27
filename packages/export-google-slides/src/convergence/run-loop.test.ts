// packages/export-google-slides/src/convergence/run-loop.test.ts
// Pins iteration counting + early-exit + stalled detection at the loop level.
// Underwrites AC #12, #13, #14.

import type { Document, Element } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { buildRecordingClient, makeUniformPng } from '../../test-helpers/index.js';
import { createStubRenderer } from '../renderer/stub.js';
import { DEFAULT_TOLERANCES } from '../types.js';
import { runConvergenceLoop } from './run-loop.js';

const renderer = createStubRenderer({ pngsBySlideId: { slide_1: makeUniformPng(1600, 900) } });
const doc: Document = {
  meta: {
    id: 'doc1',
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    locale: 'en',
    schemaVersion: 1,
  },
  theme: { tokens: {} },
  variables: {},
  components: {},
  layouts: [],
  masters: [],
  content: { mode: 'slide', slides: [{ id: 'slide_1', elements: [] }] },
};

const el: Element = {
  id: 'e1',
  type: 'shape',
  shape: 'rect',
  transform: { x: 100, y: 100, width: 200, height: 50, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
} as Element;

describe('runConvergenceLoop', () => {
  it('AC #12: iterates exactly maxIterations when residuals persist', async () => {
    const apiClient = buildRecordingClient();
    const obs = {
      observed: [{ elementId: 'e1', x: 105, y: 100, width: 200, height: 50 }],
      perceptualDiff: 0.05,
    };
    const r = await runConvergenceLoop({
      doc,
      presentationId: 'p1',
      slideId: 'slide_1',
      slideObjectId: 'slide_1',
      elementsById: { e1: el },
      apiIdByElement: { e1: 'apiObj1' },
      apiClient,
      renderer,
      tolerances: DEFAULT_TOLERANCES,
      maxIterations: 3,
      observationsByIteration: [obs, obs, obs],
    });
    expect(r.iterations).toBe(3);
  });

  it('AC #13: exits early when first iteration converges', async () => {
    const apiClient = buildRecordingClient();
    const r = await runConvergenceLoop({
      doc,
      presentationId: 'p1',
      slideId: 'slide_1',
      slideObjectId: 'slide_1',
      elementsById: { e1: el },
      apiIdByElement: { e1: 'apiObj1' },
      apiClient,
      renderer,
      tolerances: DEFAULT_TOLERANCES,
      maxIterations: 3,
      observationsByIteration: [
        {
          observed: [{ elementId: 'e1', x: 100, y: 100, width: 200, height: 50 }],
          perceptualDiff: 0,
        },
      ],
    });
    expect(r.iterations).toBe(1);
    expect(r.finalDiff.allElementsInTolerance).toBe(true);
    expect(r.stalled).toBe(false);
  });

  it('AC #14: stalled when adjustments planned to zero before tolerance', async () => {
    const apiClient = buildRecordingClient();
    const r = await runConvergenceLoop({
      doc,
      presentationId: 'p1',
      slideId: 'slide_1',
      slideObjectId: 'slide_1',
      elementsById: { e1: el },
      apiIdByElement: { e1: 'apiObj1' },
      apiClient,
      renderer,
      tolerances: DEFAULT_TOLERANCES,
      maxIterations: 3,
      observationsByIteration: [
        {
          // Width drift but x/y match → no nudge possible.
          observed: [{ elementId: 'e1', x: 100, y: 100, width: 210, height: 50 }],
          perceptualDiff: 0.05,
        },
      ],
    });
    expect(r.stalled).toBe(true);
    expect(r.finalDiff.allElementsInTolerance).toBe(false);
  });
});
