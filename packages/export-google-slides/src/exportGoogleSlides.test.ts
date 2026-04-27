// packages/export-google-slides/src/exportGoogleSlides.test.ts
// Top-level integration tests. Pins the public surface (AC #1-3), the three
// tier modes (AC #4-6), the convergence loop bounds (AC #12-14), and the
// image-fallback / loss-flag emissions (AC #18-21, #24-25).

import type { GoogleAuthProvider } from '@stageflip/import-google-slides';
import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { buildRecordingClient, makeUniformPng } from '../test-helpers/index.js';
import { exportGoogleSlides } from './exportGoogleSlides.js';
import { createStubRenderer } from './renderer/stub.js';

const stubAuth: GoogleAuthProvider = {
  async getAccessToken() {
    return 'test-token';
  },
};

function makeOneSlideShapeDoc(): Document {
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

const goldenPng = makeUniformPng(1600, 900);
const renderer = createStubRenderer({ pngsBySlideId: { slide_1: goldenPng } });

describe('exportGoogleSlides — public surface (AC #1-3)', () => {
  it('AC #1: returns a Promise<ExportGoogleSlidesResult> with the four documented fields', async () => {
    const apiClient = buildRecordingClient();
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    expect(typeof result.presentationId).toBe('string');
    expect(Array.isArray(result.lossFlags)).toBe(true);
    expect(Array.isArray(result.outcomes)).toBe(true);
    expect(typeof result.apiCallsMade).toBe('number');
  });

  it('AC #2 (overwrite): defined presentationId calls batchUpdate, NOT createPresentation', async () => {
    const apiClient = buildRecordingClient();
    await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    expect(apiClient.presentationsCreated).toHaveLength(0);
    expect(apiClient.batchUpdates.length).toBeGreaterThan(0);
    expect(apiClient.batchUpdates[0]?.presentationId).toBe('existing-pres');
  });

  it('AC #2 (create): undefined presentationId calls createPresentation', async () => {
    const apiClient = buildRecordingClient({ presentationId: 'new-pres-id' });
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    expect(apiClient.presentationsCreated).toHaveLength(1);
    expect(result.presentationId).toBe('new-pres-id');
  });

  it('AC #3: tier defaults to "hybrid" when omitted', async () => {
    // hybrid runs the convergence loop; we feed an observation that converges
    // on iteration 1 so the loop exits early.
    const apiClient = buildRecordingClient({
      observations: {
        slide_1: [
          {
            observed: [{ elementId: 'shape1', x: 100, y: 100, width: 200, height: 50 }],
            perceptualDiff: 0,
          },
        ],
      },
    });
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      apiClient,
    });
    // hybrid means iterations >= 1 (the loop ran).
    expect(result.outcomes[0]?.iterations).toBeGreaterThanOrEqual(1);
    expect(result.outcomes[0]?.residualCount).toBe(0);
  });
});

describe('exportGoogleSlides — tier modes (AC #4-6)', () => {
  it('AC #4: fully-editable runs no convergence loop and no fallback', async () => {
    const apiClient = buildRecordingClient();
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    expect(result.outcomes[0]?.iterations).toBe(0);
    expect(result.outcomes[0]?.residualCount).toBe(0);
    expect(apiClient.thumbnailFetches).toHaveLength(0);
    expect(apiClient.driveUploads).toHaveLength(0);
  });

  it('AC #5: hybrid runs the convergence loop and emits image-fallback for residuals', async () => {
    // Set up an observation where the shape's drift exceeds the 1px shape
    // tolerance for every iteration → residual after maxIterations.
    const apiClient = buildRecordingClient({
      observations: {
        slide_1: [
          {
            observed: [{ elementId: 'shape1', x: 110, y: 100, width: 200, height: 50 }],
            perceptualDiff: 0.05,
          },
          {
            observed: [{ elementId: 'shape1', x: 110, y: 100, width: 200, height: 50 }],
            perceptualDiff: 0.05,
          },
          {
            observed: [{ elementId: 'shape1', x: 110, y: 100, width: 200, height: 50 }],
            perceptualDiff: 0.05,
          },
        ],
      },
    });
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'hybrid',
      apiClient,
    });
    expect(result.outcomes[0]?.iterations).toBeGreaterThan(0);
    expect(result.outcomes[0]?.residualCount).toBe(1);
    // image-fallback: drive upload + LF-GSLIDES-EXPORT-FALLBACK.
    expect(apiClient.driveUploads).toHaveLength(1);
    const fallbackFlags = result.lossFlags.filter((f) => f.code === 'LF-GSLIDES-EXPORT-FALLBACK');
    expect(fallbackFlags).toHaveLength(1);
  });

  it('AC #6: pixel-perfect-visual rasterizes EVERY element', async () => {
    const apiClient = buildRecordingClient();
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'pixel-perfect-visual',
      apiClient,
    });
    // 1 element → 1 fallback.
    expect(apiClient.driveUploads).toHaveLength(1);
    const fallbackFlags = result.lossFlags.filter((f) => f.code === 'LF-GSLIDES-EXPORT-FALLBACK');
    expect(fallbackFlags).toHaveLength(1);
    expect(result.outcomes[0]?.residualCount).toBe(1);
  });
});

describe('exportGoogleSlides — convergence loop (AC #12-14)', () => {
  it('AC #12: loop iterates exactly maxIterations when every iteration has residuals', async () => {
    const obs = {
      observed: [{ elementId: 'shape1', x: 110, y: 100, width: 200, height: 50 }],
      perceptualDiff: 0.05,
    };
    const apiClient = buildRecordingClient({
      observations: {
        slide_1: [obs, obs, obs],
      },
    });
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'hybrid',
      maxIterations: 3,
      apiClient,
    });
    expect(result.outcomes[0]?.iterations).toBe(3);
  });

  it('AC #13: loop exits early on first-iteration convergence', async () => {
    const apiClient = buildRecordingClient({
      observations: {
        slide_1: [
          {
            // Exact match — first iteration converges.
            observed: [{ elementId: 'shape1', x: 100, y: 100, width: 200, height: 50 }],
            perceptualDiff: 0,
          },
        ],
      },
    });
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'hybrid',
      maxIterations: 3,
      apiClient,
    });
    expect(result.outcomes[0]?.iterations).toBe(1);
    expect(result.outcomes[0]?.residualCount).toBe(0);
  });

  it('AC #14: convergence-stalled emits BOTH stalled AND fallback flags', async () => {
    // Drift in size (sizeDeltaPx) but observed.x === canonical.x → no nudge
    // possible → stalled. Also out of tolerance → falls into fallback.
    const apiClient = buildRecordingClient({
      observations: {
        slide_1: [
          {
            observed: [{ elementId: 'shape1', x: 100, y: 100, width: 210, height: 50 }],
            perceptualDiff: 0.05,
          },
        ],
      },
    });
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'hybrid',
      maxIterations: 3,
      apiClient,
    });
    const codes = result.lossFlags.map((f) => f.code);
    expect(codes).toContain('LF-GSLIDES-EXPORT-CONVERGENCE-STALLED');
    expect(codes).toContain('LF-GSLIDES-EXPORT-FALLBACK');
    // The same element triggered both — original deleted, image created.
    expect(apiClient.driveUploads).toHaveLength(1);
    // Mutation seq includes deleteObject and createImage.
    const allRequests = apiClient.batchUpdates.flatMap((bu) => bu.requests);
    const types = allRequests.map((r) => Object.keys(r)[0]);
    expect(types).toContain('deleteObject');
    expect(types).toContain('createImage');
  });
});

describe('exportGoogleSlides — image-fallback (AC #18-21)', () => {
  it('AC #18-19: residual triggers Drive upload', async () => {
    const apiClient = buildRecordingClient({
      observations: {
        slide_1: [
          {
            observed: [{ elementId: 'shape1', x: 110, y: 100, width: 200, height: 50 }],
            perceptualDiff: 0.05,
          },
          {
            observed: [{ elementId: 'shape1', x: 110, y: 100, width: 200, height: 50 }],
            perceptualDiff: 0.05,
          },
        ],
      },
    });
    await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'hybrid',
      maxIterations: 2,
      apiClient,
    });
    expect(apiClient.driveUploads).toHaveLength(1);
    expect(apiClient.driveUploads[0]?.mimeType).toBe('image/png');
  });

  it('AC #20: original element is deleted via DeleteObjectRequest; new image via CreateImageRequest', async () => {
    const apiClient = buildRecordingClient({
      observations: {
        slide_1: [
          {
            observed: [{ elementId: 'shape1', x: 110, y: 100, width: 200, height: 50 }],
            perceptualDiff: 0.05,
          },
          {
            observed: [{ elementId: 'shape1', x: 110, y: 100, width: 200, height: 50 }],
            perceptualDiff: 0.05,
          },
        ],
      },
    });
    await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'hybrid',
      maxIterations: 2,
      apiClient,
    });
    const allRequests = apiClient.batchUpdates.flatMap((bu) => bu.requests);
    const types = allRequests.map((r) => Object.keys(r)[0]);
    expect(types).toContain('deleteObject');
    expect(types).toContain('createImage');
  });

  it('AC #21: each residual emits exactly one LF-GSLIDES-EXPORT-FALLBACK', async () => {
    const apiClient = buildRecordingClient({
      observations: {
        slide_1: [
          {
            observed: [{ elementId: 'shape1', x: 110, y: 100, width: 200, height: 50 }],
            perceptualDiff: 0.05,
          },
        ],
      },
    });
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'hybrid',
      maxIterations: 1,
      apiClient,
    });
    const fallbackFlags = result.lossFlags.filter((f) => f.code === 'LF-GSLIDES-EXPORT-FALLBACK');
    expect(fallbackFlags).toHaveLength(1);
    expect(fallbackFlags[0]?.location.elementId).toBe('shape1');
  });
});

describe('exportGoogleSlides — stub renderer error', () => {
  it('throws when no canned PNG is configured for a slideId', async () => {
    const r = createStubRenderer({ pngsBySlideId: {} });
    await expect(r.renderSlide({} as Document, 'no-such', { width: 1, height: 1 })).rejects.toThrow(
      /no canned PNG/,
    );
  });
});

describe('exportGoogleSlides — additional loss-flag paths', () => {
  it('emits LF-GSLIDES-EXPORT-FONT-SUBSTITUTED for unsupported font family', async () => {
    const apiClient = buildRecordingClient();
    const doc = makeOneSlideShapeDoc();
    if (doc.content.mode === 'slide') {
      const slide = doc.content.slides[0];
      if (slide !== undefined) {
        slide.elements.push({
          id: 't1',
          type: 'text',
          text: 'Hi',
          fontFamily: 'Comic Geist Mono', // not in supported list
          transform: { x: 0, y: 0, width: 100, height: 30, rotation: 0, opacity: 1 },
          visible: true,
          locked: false,
          animations: [],
          align: 'left',
        });
      }
    }
    const result = await exportGoogleSlides(doc, {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    const fontFlags = result.lossFlags.filter(
      (f) => f.code === 'LF-GSLIDES-EXPORT-FONT-SUBSTITUTED',
    );
    expect(fontFlags).toHaveLength(1);
    expect(fontFlags[0]?.originalSnippet).toBe('Comic Geist Mono');
  });

  it('emits LF-GSLIDES-EXPORT-CUSTOM-GEOMETRY-DEGRADED for custom-path shapes', async () => {
    const apiClient = buildRecordingClient();
    const doc = makeOneSlideShapeDoc();
    if (doc.content.mode === 'slide') {
      const slide = doc.content.slides[0];
      if (slide !== undefined) {
        slide.elements.push({
          id: 'cp1',
          type: 'shape',
          shape: 'custom-path',
          path: 'M0 0 L10 10',
          transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
          visible: true,
          locked: false,
          animations: [],
        });
      }
    }
    const result = await exportGoogleSlides(doc, {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    const cpFlags = result.lossFlags.filter(
      (f) => f.code === 'LF-GSLIDES-EXPORT-CUSTOM-GEOMETRY-DEGRADED',
    );
    expect(cpFlags).toHaveLength(1);
  });

  it('walks groups when emitting per-slide static flags', async () => {
    const apiClient = buildRecordingClient();
    const doc = makeOneSlideShapeDoc();
    if (doc.content.mode === 'slide') {
      const slide = doc.content.slides[0];
      if (slide !== undefined) {
        // Replace the single shape with a group containing a custom-path shape.
        slide.elements = [
          {
            id: 'g1',
            type: 'group',
            clip: false,
            transform: { x: 0, y: 0, width: 200, height: 200, rotation: 0, opacity: 1 },
            visible: true,
            locked: false,
            animations: [],
            children: [
              {
                id: 'inner',
                type: 'shape',
                shape: 'custom-path',
                path: 'M0 0 L1 1',
                transform: { x: 0, y: 0, width: 50, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
              },
            ],
          },
        ];
      }
    }
    const result = await exportGoogleSlides(doc, {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    const cpFlags = result.lossFlags.filter(
      (f) => f.code === 'LF-GSLIDES-EXPORT-CUSTOM-GEOMETRY-DEGRADED',
    );
    expect(cpFlags).toHaveLength(1);
    expect(cpFlags[0]?.location.elementId).toBe('inner');
  });
});

describe('exportGoogleSlides — presentations.get wiring (M2/M3)', () => {
  it('overwrite path calls presentations.get exactly once', async () => {
    const apiClient = buildRecordingClient();
    await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    expect(apiClient.presentationsFetched).toHaveLength(1);
    expect(apiClient.presentationsFetched[0]?.presentationId).toBe('existing-pres');
  });

  it('create-new path does NOT call presentations.get (no existing state to read)', async () => {
    const apiClient = buildRecordingClient({ presentationId: 'new-pres-id' });
    await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      // presentationId omitted → create new
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    expect(apiClient.presentationsFetched).toHaveLength(0);
  });

  it('presentations.get failure surfaces as LF-GSLIDES-EXPORT-API-ERROR but export continues', async () => {
    const baseClient = buildRecordingClient();
    // Override to throw on getPresentation.
    const apiClient = {
      ...baseClient,
      async getPresentation() {
        throw new Error('500 Internal');
      },
    };
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    const apiErrors = result.lossFlags.filter((f) => f.code === 'LF-GSLIDES-EXPORT-API-ERROR');
    expect(apiErrors.length).toBeGreaterThanOrEqual(1);
    expect(apiErrors.some((f) => f.message.includes('presentations.get failed'))).toBe(true);
    // Export still produced an outcome (didn't abort).
    expect(result.outcomes).toHaveLength(1);
  });
});

describe('exportGoogleSlides — loss flags (AC #24-25)', () => {
  it('AC #24: per-slide animations + notes emit exactly once per slide', async () => {
    const apiClient = buildRecordingClient();
    const doc = makeOneSlideShapeDoc();
    if (doc.content.mode === 'slide') {
      const slide = doc.content.slides[0];
      const el = slide?.elements[0];
      if (slide !== undefined && el !== undefined) {
        slide.notes = 'speaker note';
        // Minimal stub Animation — the orchestrator only checks length>0.
        el.animations = [
          {
            id: 'a1',
            autoplay: true,
          } as unknown as (typeof el.animations)[0],
        ];
      }
    }
    const result = await exportGoogleSlides(doc, {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    const animationFlags = result.lossFlags.filter(
      (f) => f.code === 'LF-GSLIDES-EXPORT-ANIMATIONS-DROPPED',
    );
    const notesFlags = result.lossFlags.filter((f) => f.code === 'LF-GSLIDES-EXPORT-NOTES-DROPPED');
    expect(animationFlags).toHaveLength(1);
    expect(notesFlags).toHaveLength(1);
  });

  it('safeBatchUpdate: thrown HTTP error surfaces as LF-GSLIDES-EXPORT-API-ERROR', async () => {
    const apiClient = buildRecordingClient({ batchUpdateThrowsOn: 0 });
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    const apiErrors = result.lossFlags.filter((f) => f.code === 'LF-GSLIDES-EXPORT-API-ERROR');
    expect(apiErrors.length).toBeGreaterThanOrEqual(1);
    expect(apiErrors[0]?.message).toMatch(/simulated/);
  });

  it('AC #25: API errors emit LF-GSLIDES-EXPORT-API-ERROR with request id + error message', async () => {
    const apiClient = buildRecordingClient({
      batchUpdateErrors: [{ requestIndex: 0, message: 'invalid shapeType' }],
    });
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(), {
      auth: stubAuth,
      presentationId: 'existing-pres',
      renderer,
      tier: 'fully-editable',
      apiClient,
    });
    const apiErrors = result.lossFlags.filter((f) => f.code === 'LF-GSLIDES-EXPORT-API-ERROR');
    expect(apiErrors).toHaveLength(1);
    expect(apiErrors[0]?.message).toBe('invalid shapeType');
    expect(apiErrors[0]?.location.elementId).toBe('shape1');
    expect(apiErrors[0]?.originalSnippet).toBeDefined();
  });
});
