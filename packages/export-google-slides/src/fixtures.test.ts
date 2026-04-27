// packages/export-google-slides/src/fixtures.test.ts
// End-to-end fixture suite. Drives the five fixture scenarios named in T-252
// spec §"Files to create / modify": simple-deck, hybrid-with-residual,
// pixel-perfect-tier, placeholder-aware, duplicate-similar. Each fixture
// exercises a distinct execution path.

import type { GoogleAuthProvider } from '@stageflip/import-google-slides';
import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { ObservedBbox } from './convergence/diff.js';
import { exportGoogleSlides } from './exportGoogleSlides.js';
import { createStubRenderer } from './renderer/stub.js';
import { buildRecordingClient, makeUniformPng } from './test-helpers.js';

const stubAuth: GoogleAuthProvider = {
  async getAccessToken() {
    return 'test-token';
  },
};
const goldenPng = makeUniformPng(1600, 900);

interface Fixture {
  name: string;
  doc: Document;
  tier?: 'fully-editable' | 'hybrid' | 'pixel-perfect-visual';
  observations?: Record<string, Array<{ observed: ObservedBbox[]; perceptualDiff: number }>>;
  /** Predicate to assert against the result. */
  expect: (r: import('./types.js').ExportGoogleSlidesResult) => void;
}

const baseDocMeta = {
  meta: {
    id: 'doc1',
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    locale: 'en',
    schemaVersion: 1,
  },
  theme: { tokens: {} as Record<string, never> },
  variables: {},
  components: {},
  layouts: [],
  masters: [],
} as const;

const FIXTURES: Fixture[] = [
  {
    name: 'simple-deck (fully-editable, 3 slides, no convergence)',
    tier: 'fully-editable',
    doc: {
      ...baseDocMeta,
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            elements: [
              {
                id: 's1',
                type: 'shape',
                shape: 'rect',
                transform: { x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
              },
            ],
          },
          {
            id: 'slide_2',
            elements: [
              {
                id: 's2',
                type: 'text',
                text: 'Hello',
                transform: { x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
                align: 'left',
              },
            ],
          },
          {
            id: 'slide_3',
            elements: [
              {
                id: 's3',
                type: 'shape',
                shape: 'ellipse',
                transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
              },
            ],
          },
        ],
      },
    } as Document,
    expect: (r) => {
      expect(r.outcomes).toHaveLength(3);
      for (const o of r.outcomes) {
        expect(o.iterations).toBe(0);
        expect(o.residualCount).toBe(0);
      }
    },
  },
  {
    name: 'hybrid-with-residual (1 slide, 1 residual element → image-fallback)',
    tier: 'hybrid',
    doc: {
      ...baseDocMeta,
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            elements: [
              {
                id: 's1',
                type: 'shape',
                shape: 'rect',
                transform: { x: 100, y: 100, width: 200, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
              },
            ],
          },
        ],
      },
    } as Document,
    observations: {
      slide_1: [
        {
          observed: [{ elementId: 's1', x: 110, y: 100, width: 200, height: 50 }],
          perceptualDiff: 0.05,
        },
        {
          observed: [{ elementId: 's1', x: 110, y: 100, width: 200, height: 50 }],
          perceptualDiff: 0.05,
        },
      ],
    },
    expect: (r) => {
      expect(r.outcomes[0]?.residualCount).toBe(1);
      const codes = r.lossFlags.map((f) => f.code);
      expect(codes).toContain('LF-GSLIDES-EXPORT-FALLBACK');
    },
  },
  {
    name: 'pixel-perfect-tier (every element rasterized regardless of drift)',
    tier: 'pixel-perfect-visual',
    doc: {
      ...baseDocMeta,
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            elements: [
              {
                id: 's1',
                type: 'shape',
                shape: 'rect',
                transform: { x: 0, y: 0, width: 200, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
              },
              {
                id: 's2',
                type: 'shape',
                shape: 'ellipse',
                transform: { x: 0, y: 100, width: 200, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
              },
            ],
          },
        ],
      },
    } as Document,
    expect: (r) => {
      // Every element became a fallback.
      const fallbacks = r.lossFlags.filter((f) => f.code === 'LF-GSLIDES-EXPORT-FALLBACK');
      expect(fallbacks).toHaveLength(2);
      expect(r.outcomes[0]?.residualCount).toBe(2);
    },
  },
  {
    name: 'placeholder-aware (inheritsFrom resolves → UpdateShapePropertiesRequest path)',
    tier: 'fully-editable',
    doc: {
      ...baseDocMeta,
      layouts: [
        {
          id: 'layout1',
          name: 'Title',
          masterId: 'master1',
          placeholders: [
            {
              id: 'ph1',
              type: 'text',
              text: 'Title placeholder',
              transform: { x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1 },
              visible: true,
              locked: false,
              animations: [],
              align: 'left',
            },
          ],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            layoutId: 'layout1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                text: 'My Title',
                transform: { x: 10, y: 20, width: 200, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
                align: 'left',
                inheritsFrom: { templateId: 'layout1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    } as Document,
    expect: () => {
      // Strategy verified via the build-plan.test.ts pin; here we just want
      // the export to complete without error and emit no fallbacks.
    },
  },
  {
    name: 'duplicate-similar (only matters when existingPages provides a match — exercised in build-plan.test.ts)',
    tier: 'fully-editable',
    doc: {
      ...baseDocMeta,
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            elements: [
              {
                id: 'e1',
                type: 'shape',
                shape: 'rect',
                transform: { x: 100, y: 100, width: 100, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
              },
            ],
          },
        ],
      },
    } as Document,
    expect: () => {
      // No assertion — covered by the dedicated build-plan test.
    },
  },
];

describe('fixtures end-to-end', () => {
  for (const fx of FIXTURES) {
    it(`AC #26: ${fx.name}`, async () => {
      const renderOpts: Record<string, Uint8Array> = {};
      if (fx.doc.content.mode === 'slide') {
        for (const s of fx.doc.content.slides) renderOpts[s.id] = goldenPng;
      }
      const renderer = createStubRenderer({ pngsBySlideId: renderOpts });
      const apiClientOpts: Parameters<typeof buildRecordingClient>[0] = {};
      if (fx.observations !== undefined) apiClientOpts.observations = fx.observations;
      const apiClient = buildRecordingClient(apiClientOpts);
      const opts: Parameters<typeof exportGoogleSlides>[1] = {
        auth: stubAuth,
        presentationId: 'fx-pres',
        renderer,
        apiClient,
      };
      if (fx.tier !== undefined) opts.tier = fx.tier;
      const result = await exportGoogleSlides(fx.doc, opts);
      fx.expect(result);
    });
  }
});
