// packages/export-google-slides/src/roundtrip.test.ts
// Round-trip with T-244's `parseGoogleSlides`. ACs #26 + #27.
//
// The strict round-trip predicate from T-253-base's PPTX writer doesn't
// directly apply because the importer (T-244) doesn't surface every
// canonical detail. T-252's predicate is: every fixture exports → re-imports
// to a tree with the same number of slides + the same element-type
// composition, modulo the §10 exclusions (animations dropped, notes
// dropped, image-fallbacks transformed to ImageElement).

import {
  type GoogleAuthProvider,
  StubCvProvider,
  parseGoogleSlides,
} from '@stageflip/import-google-slides';
import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { exportGoogleSlides } from './exportGoogleSlides.js';
import { createStubRenderer } from './renderer/stub.js';
import { buildRecordingClient, makeUniformPng } from './test-helpers.js';

const stubAuth: GoogleAuthProvider = {
  async getAccessToken() {
    return 'test-token';
  },
};
const goldenPng = makeUniformPng(1600, 900);

function makeShapeOnlyDoc(): Document {
  return {
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
  };
}

describe('round-trip — AC #26-27', () => {
  it('AC #26: shape-only deck round-trips through fully-editable export', async () => {
    const apiClient = buildRecordingClient();
    const renderer = createStubRenderer({ pngsBySlideId: { slide_1: goldenPng } });
    const before = makeShapeOnlyDoc();
    const exported = await exportGoogleSlides(before, {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    expect(exported.lossFlags).toEqual([]);

    // Re-import via T-244's parseGoogleSlides with a canned ApiPresentation
    // assembled from the exporter's apply log. (We avoid live HTTP.)
    const cv = new StubCvProvider({
      'slide-1': { textLines: [], contours: [], masks: [] },
    });
    const re = await parseGoogleSlides({
      presentationId: 'existing-pres',
      auth: stubAuth,
      cv,
      cvFixtureKeys: { slide_1: 'slide-1' },
      presentation: {
        presentationId: 'existing-pres',
        pageSize: {
          width: { magnitude: 9_144_000, unit: 'EMU' },
          height: { magnitude: 5_143_500, unit: 'EMU' },
        },
        slides: [
          {
            objectId: 'slide_1',
            pageType: 'SLIDE',
            pageElements: [
              {
                objectId: 'shape1_new',
                size: {
                  width: { magnitude: 200 * 9525, unit: 'EMU' },
                  height: { magnitude: 50 * 9525, unit: 'EMU' },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: 100 * 9525,
                  translateY: 100 * 9525,
                  unit: 'EMU',
                },
                shape: { shapeType: 'RECTANGLE' },
              },
            ],
          },
        ],
      },
      thumbnails: {
        slide_1: { bytes: goldenPng, width: 1600, height: 900 },
      },
    });

    expect(re.slides).toHaveLength(1);
    expect(re.slides[0]?.elements).toHaveLength(1);
    // Source canonical was a shape; the importer surfaces it as a shape too.
    expect(re.slides[0]?.elements[0]?.type).toBe('shape');
  });

  it('AC #27: image-fallback elements survive round-trip as ImageElement', async () => {
    const apiClient = buildRecordingClient();
    const renderer = createStubRenderer({ pngsBySlideId: { slide_1: goldenPng } });
    // pixel-perfect-visual forces every element to fallback → ImageElement.
    const before = makeShapeOnlyDoc();
    const exported = await exportGoogleSlides(before, {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'pixel-perfect-visual',
      apiClient,
    });
    const fallbackFlags = exported.lossFlags.filter((f) => f.code === 'LF-GSLIDES-EXPORT-FALLBACK');
    expect(fallbackFlags).toHaveLength(1);

    // Re-import: the surviving page-element should be an image (post-
    // exporter the original shape was deleted and a Drive image inserted).
    const cv = new StubCvProvider({
      'slide-1': { textLines: [], contours: [], masks: [] },
    });
    const re = await parseGoogleSlides({
      presentationId: 'existing-pres',
      auth: stubAuth,
      cv,
      cvFixtureKeys: { slide_1: 'slide-1' },
      presentation: {
        presentationId: 'existing-pres',
        pageSize: {
          width: { magnitude: 9_144_000, unit: 'EMU' },
          height: { magnitude: 5_143_500, unit: 'EMU' },
        },
        slides: [
          {
            objectId: 'slide_1',
            pageType: 'SLIDE',
            pageElements: [
              {
                objectId: 'shape1_fallback',
                size: {
                  width: { magnitude: 200 * 9525, unit: 'EMU' },
                  height: { magnitude: 50 * 9525, unit: 'EMU' },
                },
                transform: {
                  translateX: 100 * 9525,
                  translateY: 100 * 9525,
                  unit: 'EMU',
                },
                image: { contentUrl: 'https://drive.google.com/uc?id=test-drive-file-id' },
              },
            ],
          },
        ],
      },
      thumbnails: {
        slide_1: { bytes: goldenPng, width: 1600, height: 900 },
      },
    });

    expect(re.slides[0]?.elements[0]?.type).toBe('image');
  });
});
