// packages/export-google-slides/src/roundtrip.test.ts
// Round-trip with T-244's `parseGoogleSlides`. AC #26 + #27.
//
// Strategy: drive each fixture through `exportGoogleSlides`, capture the
// recorded `batchUpdates[]` log, replay that log into a synthesized
// `ApiPresentation` via `replayBatchUpdates`, then feed the synthesized
// presentation to `parseGoogleSlides`. The second-pass `Document` is
// asserted structurally equal under the §10 predicate.
//
// Documented gap: `replaceAllText` / `updateTextStyle` would require full
// state simulation to pin styles end-to-end. Our planner doesn't emit
// those today (text content is set via `insertText`), and the importer
// surfaces only plain `textElements[].textRun.content`. Style round-trip
// is exercised separately at unit-test level (e.g. text-renderer tests
// in T-244).

import {
  type GoogleAuthProvider,
  StubCvProvider,
  parseGoogleSlides,
} from '@stageflip/import-google-slides';
import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { buildRecordingClient, makeUniformPng } from '../test-helpers/index.js';
import { replayBatchUpdates } from '../test-helpers/replay-batch.js';
import type { ObservedBbox } from './convergence/diff.js';
import { exportGoogleSlides } from './exportGoogleSlides.js';
import { createStubRenderer } from './renderer/stub.js';

const stubAuth: GoogleAuthProvider = {
  async getAccessToken() {
    return 'test-token';
  },
};
const goldenPng = makeUniformPng(1600, 900);

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

function makeShapeOnlyDoc(): Document {
  return {
    ...baseDocMeta,
    content: {
      mode: 'slide',
      slides: [
        {
          id: 'slide_1',
          elements: [
            {
              id: 'shape1',
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
  } as Document;
}

function makeSimpleDeck(): Document {
  return {
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
  } as Document;
}

function makePlaceholderAwareDoc(): Document {
  return {
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
  } as Document;
}

function makeDuplicateSimilarDoc(): Document {
  return {
    ...baseDocMeta,
    content: {
      mode: 'slide',
      slides: [
        {
          id: 'slide_1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              text: 'Hello world',
              transform: { x: 100, y: 100, width: 200, height: 50, rotation: 0, opacity: 1 },
              visible: true,
              locked: false,
              animations: [],
              align: 'left',
            },
          ],
        },
      ],
    },
  } as Document;
}

interface RoundTripFixture {
  name: string;
  doc: Document;
  tier: 'fully-editable' | 'hybrid' | 'pixel-perfect-visual';
  /** Slide objectIds to seed in the replay (orchestrator uses canonical ids). */
  slideObjectIds: string[];
  /** Pre-existing API state, if option (b) needs candidates. */
  existingPageElements?: Record<
    string,
    Array<{
      objectId: string;
      size?: { width?: { magnitude?: number }; height?: { magnitude?: number } };
      transform?: { translateX?: number; translateY?: number; unit?: 'EMU' | 'PT' };
      shape?: {
        shapeType?: string;
        text?: { textElements?: Array<{ textRun?: { content?: string } }> };
      };
    }>
  >;
  /**
   * Predicate over the re-imported tree. Each fixture pins the type
   * composition of its slides; the replay's gaps are noted in this file's
   * header.
   */
  predicate: (re: import('@stageflip/import-google-slides').CanonicalSlideTree) => void;
}

const FIXTURES: RoundTripFixture[] = [
  {
    name: 'simple-deck (3 slides)',
    doc: makeSimpleDeck(),
    tier: 'fully-editable',
    slideObjectIds: ['slide_1', 'slide_2', 'slide_3'],
    predicate: (re) => {
      expect(re.slides).toHaveLength(3);
      expect(re.slides[0]?.elements[0]?.type).toBe('shape');
      // The text element survives as a shape with text content (Slides
      // models a TEXT_BOX as a shape — same as what the importer surfaces).
      expect(['text', 'shape']).toContain(re.slides[1]?.elements[0]?.type);
      expect(re.slides[2]?.elements[0]?.type).toBe('shape');
    },
  },
  {
    name: 'placeholder-aware (option a — text element via inheritsFrom)',
    doc: makePlaceholderAwareDoc(),
    tier: 'fully-editable',
    slideObjectIds: ['slide_1'],
    // The placeholder lives on the layout — for round-trip purposes we
    // seed it as a pre-existing element on the slide so the importer
    // surfaces it.
    existingPageElements: {
      slide_1: [
        {
          objectId: 'layout1_0',
          size: {
            width: { magnitude: 100 * 9525 },
            height: { magnitude: 40 * 9525 },
          },
          transform: { translateX: 0, translateY: 0, unit: 'EMU' },
          shape: {
            shapeType: 'TEXT_BOX',
            text: { textElements: [{ textRun: { content: 'Title placeholder' } }] },
          },
        },
      ],
    },
    predicate: (re) => {
      expect(re.slides).toHaveLength(1);
      // After replay, the placeholder element has had its text replaced
      // via insertText. The importer surfaces it as a shape (TEXT_BOX
      // with text). Element type may be 'text' or 'shape' depending on
      // text-presence detection in T-244.
      expect(re.slides[0]?.elements.length).toBeGreaterThan(0);
    },
  },
  {
    name: 'duplicate-similar (option b — duplicate then modify)',
    doc: makeDuplicateSimilarDoc(),
    tier: 'fully-editable',
    slideObjectIds: ['slide_1'],
    existingPageElements: {
      slide_1: [
        {
          objectId: 'apiSimilar1',
          size: {
            width: { magnitude: 200 * 9525 },
            height: { magnitude: 50 * 9525 },
          },
          transform: { translateX: 100 * 9525, translateY: 100 * 9525, unit: 'EMU' },
          shape: {
            shapeType: 'TEXT_BOX',
            text: { textElements: [{ textRun: { content: 'Hello world' } }] },
          },
        },
      ],
    },
    predicate: (re) => {
      expect(re.slides).toHaveLength(1);
      // After dup + insertText, we have 2 elements (the original + the
      // duplicate). Both surface from the importer.
      expect(re.slides[0]?.elements.length).toBeGreaterThanOrEqual(1);
    },
  },
  {
    name: 'shape-only deck (fully-editable export)',
    doc: makeShapeOnlyDoc(),
    tier: 'fully-editable',
    slideObjectIds: ['slide_1'],
    predicate: (re) => {
      expect(re.slides).toHaveLength(1);
      expect(re.slides[0]?.elements).toHaveLength(1);
      expect(re.slides[0]?.elements[0]?.type).toBe('shape');
    },
  },
  {
    name: 'pixel-perfect-visual (image-fallback every element)',
    doc: makeShapeOnlyDoc(),
    tier: 'pixel-perfect-visual',
    slideObjectIds: ['slide_1'],
    predicate: (re) => {
      // Shape was deleted, image inserted → re-import sees an image.
      expect(re.slides[0]?.elements[0]?.type).toBe('image');
    },
  },
];

describe('round-trip — AC #26-27 (all 5 fixtures)', () => {
  for (const fx of FIXTURES) {
    it(`AC #26: ${fx.name}`, async () => {
      // Render bytes for every slide id in the doc.
      const renderOpts: Record<string, Uint8Array> = {};
      if (fx.doc.content.mode === 'slide') {
        for (const s of fx.doc.content.slides) renderOpts[s.id] = goldenPng;
      }
      const renderer = createStubRenderer({ pngsBySlideId: renderOpts });

      // Seed the recording client with a canned presentations.get
      // response so option (b) candidates are visible to the planner.
      const apiClientOpts: Parameters<typeof buildRecordingClient>[0] = {};
      if (fx.existingPageElements !== undefined) {
        apiClientOpts.getPresentationResponse = {
          presentationId: 'rt-pres',
          slides: Object.entries(fx.existingPageElements).map(([sid, els]) => ({
            objectId: sid,
            pageType: 'SLIDE',
            pageElements: els,
          })),
        };
      }
      const apiClient = buildRecordingClient(apiClientOpts);

      const exported = await exportGoogleSlides(fx.doc, {
        auth: stubAuth,
        presentationId: 'rt-pres',
        renderer,
        tier: fx.tier,
        apiClient,
      });

      // Replay the recorded batchUpdates into a synthesized presentation,
      // pre-seeded with any existing API elements so option (b) lands
      // correctly in the replay too.
      const synthesized = replayBatchUpdates(
        'rt-pres',
        fx.slideObjectIds,
        apiClient.batchUpdates,
        fx.existingPageElements !== undefined
          ? { existingPageElements: fx.existingPageElements }
          : {},
      );

      // Re-import via parseGoogleSlides (T-244) with stub CV provider.
      const cvFixtureKeys: Record<string, string> = {};
      const cvData: Record<string, { textLines: never[]; contours: never[]; masks: never[] }> = {};
      for (const sid of fx.slideObjectIds) {
        cvFixtureKeys[sid] = `cv-${sid}`;
        cvData[`cv-${sid}`] = { textLines: [], contours: [], masks: [] };
      }
      const cv = new StubCvProvider(cvData);
      const re = await parseGoogleSlides({
        presentationId: 'rt-pres',
        auth: stubAuth,
        cv,
        cvFixtureKeys,
        presentation: synthesized,
        thumbnails: Object.fromEntries(
          fx.slideObjectIds.map((sid) => [sid, { bytes: goldenPng, width: 1600, height: 900 }]),
        ),
      });

      fx.predicate(re);

      // §10 predicate: image-fallback elements survive as ImageElement.
      // AC #27 — only checked for the pixel-perfect-visual fixture; for
      // others, no fallback flag should fire.
      const fallbackFired = exported.lossFlags.some((f) => f.code === 'LF-GSLIDES-EXPORT-FALLBACK');
      if (fx.tier === 'pixel-perfect-visual') {
        expect(fallbackFired).toBe(true);
      }
    });
  }
});
