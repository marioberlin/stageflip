// packages/export-google-slides/test-helpers/index.ts
// Mock Slides API client + canned-data plumbing for the integration tests.
// Records every API call so per-test assertions can pin exact request shapes.
//
// Lives outside `src/` so the source-level determinism scan
// (`src/determinism.test.ts`) doesn't have to skip it by filename. The grep
// only inspects files under `src/**`; this file's `setTimeout` / etc. usage
// is allowed in the test layer.

import { PNG } from 'pngjs';
import type { SlidesMutationClient } from '../src/api/client.js';
import type {
  ApiPresentation,
  BatchUpdateRequest,
  BatchUpdateResponse,
  CreatePresentationResponse,
  DriveFileCreateResponse,
} from '../src/api/types.js';
import type { ObservedBbox } from '../src/convergence/diff.js';

export interface RecordingMutationClient extends SlidesMutationClient {
  /** Every batchUpdate call's request payload. */
  batchUpdates: Array<{ presentationId: string; requests: BatchUpdateRequest[] }>;
  /** Every drive upload. */
  driveUploads: Array<{
    bytes: Uint8Array;
    mimeType: 'image/png';
    name?: string;
  }>;
  /** Every createPresentation call. */
  presentationsCreated: Array<{ title?: string }>;
  /** Every fetchSlideThumbnail call (counted by the convergence loop). */
  thumbnailFetches: Array<{ presentationId: string; slideObjectId: string }>;
  /** Every getPresentation call. */
  presentationsFetched: Array<{ presentationId: string }>;
  /**
   * Test seam: per-iteration observations (consumed by the convergence loop).
   * The orchestrator passes these through `ExportGoogleSlidesOptions.testObservations`,
   * NOT by duck-typing the apiClient. Stored here for test-level convenience.
   */
  __convergenceObservations: Record<
    string,
    Array<{ observed: ObservedBbox[]; perceptualDiff: number }>
  >;
}

export interface BuildClientOptions {
  presentationId?: string;
  thumbnailBytes?: Uint8Array;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  driveFileId?: string;
  /** When set, the next batchUpdate call returns these errors and an empty replies[]. */
  batchUpdateErrors?: Array<{ requestIndex: number; message: string }>;
  /** When set, the batchUpdate call throws (simulates a network/HTTP error). */
  batchUpdateThrowsOn?: number;
  observations?: Record<string, Array<{ observed: ObservedBbox[]; perceptualDiff: number }>>;
  /** Canned response for `getPresentation`. */
  getPresentationResponse?: ApiPresentation;
}

export function buildRecordingClient(opts: BuildClientOptions = {}): RecordingMutationClient {
  const presentationId = opts.presentationId ?? 'test-presentation-id';
  const thumbnailBytes = opts.thumbnailBytes ?? makePlaceholderPng();
  const thumbnailWidth = opts.thumbnailWidth ?? 1600;
  const thumbnailHeight = opts.thumbnailHeight ?? 900;
  const driveFileId = opts.driveFileId ?? 'test-drive-file-id';
  const batchUpdates: RecordingMutationClient['batchUpdates'] = [];
  const driveUploads: RecordingMutationClient['driveUploads'] = [];
  const presentationsCreated: RecordingMutationClient['presentationsCreated'] = [];
  const thumbnailFetches: RecordingMutationClient['thumbnailFetches'] = [];
  const presentationsFetched: RecordingMutationClient['presentationsFetched'] = [];

  let batchUpdateCallCount = 0;

  return {
    batchUpdates,
    driveUploads,
    presentationsCreated,
    thumbnailFetches,
    presentationsFetched,
    __convergenceObservations: opts.observations ?? {},
    async createPresentation(c) {
      const entry: { title?: string } = {};
      if (c.title !== undefined) entry.title = c.title;
      presentationsCreated.push(entry);
      const resp: CreatePresentationResponse = {
        presentationId,
      };
      return resp;
    },
    async batchUpdate(c) {
      batchUpdates.push({
        presentationId: c.presentationId,
        requests: c.requests.map((r) => structuredClone(r)),
      });
      const idx = batchUpdateCallCount;
      batchUpdateCallCount += 1;
      if (opts.batchUpdateThrowsOn === idx) {
        throw new Error('simulated HTTP 500');
      }
      const resp: BatchUpdateResponse = {
        presentationId: c.presentationId,
        replies: c.requests.map(() => ({})),
      };
      if (opts.batchUpdateErrors !== undefined && idx === 0) {
        resp.errors = opts.batchUpdateErrors;
      }
      return resp;
    },
    async driveFilesCreate(c) {
      driveUploads.push({
        bytes: c.bytes,
        mimeType: c.mimeType,
        ...(c.name !== undefined ? { name: c.name } : {}),
      });
      const resp: DriveFileCreateResponse = { id: driveFileId };
      return resp;
    },
    async fetchSlideThumbnail(c) {
      thumbnailFetches.push(c);
      return {
        bytes: thumbnailBytes,
        width: thumbnailWidth,
        height: thumbnailHeight,
      };
    },
    async getPresentation(c) {
      presentationsFetched.push(c);
      return (
        opts.getPresentationResponse ?? {
          presentationId: c.presentationId,
          slides: [],
        }
      );
    },
  };
}

/**
 * Build a minimal valid PNG (1×1 transparent). pngjs accepts this as the
 * crop source for image-fallback tests; the cropped output is bytes-shaped
 * (the actual pixels don't matter for AC pinning).
 */
export function makePlaceholderPng(): Uint8Array {
  // Pre-baked 1×1 transparent PNG.
  // Source: standard tiny.png (89504E47…). Generated once and committed
  // here as a base64 literal.
  const b64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/**
 * Build a small PNG sized for the fallback path. T-245's `rasterizeFromThumbnail`
 * needs the bbox to intersect the source dimensions; this helper produces a
 * uniform-color PNG of the requested width × height so any in-bounds bbox
 * crops successfully.
 */
export function makeUniformPng(width: number, height: number): Uint8Array {
  const png = new PNG({ width, height, colorType: 6 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 200;
    png.data[i + 1] = 200;
    png.data[i + 2] = 200;
    png.data[i + 3] = 255;
  }
  return new Uint8Array(PNG.sync.write(png));
}

/**
 * Build a PNG with a filled rectangle of color2 on a background of color1.
 * Used by the diff/connected-components tests to generate predictable diff
 * regions between two images.
 */
export function makePngWithRect(opts: {
  width: number;
  height: number;
  bgColor: [number, number, number];
  rect?: { x: number; y: number; width: number; height: number; color: [number, number, number] };
}): Uint8Array {
  const png = new PNG({ width: opts.width, height: opts.height, colorType: 6 });
  for (let y = 0; y < opts.height; y++) {
    for (let x = 0; x < opts.width; x++) {
      const idx = (y * opts.width + x) * 4;
      png.data[idx] = opts.bgColor[0];
      png.data[idx + 1] = opts.bgColor[1];
      png.data[idx + 2] = opts.bgColor[2];
      png.data[idx + 3] = 255;
    }
  }
  if (opts.rect !== undefined) {
    const { x: rx, y: ry, width: rw, height: rh, color } = opts.rect;
    const xEnd = Math.min(opts.width, rx + rw);
    const yEnd = Math.min(opts.height, ry + rh);
    for (let y = Math.max(0, ry); y < yEnd; y++) {
      for (let x = Math.max(0, rx); x < xEnd; x++) {
        const idx = (y * opts.width + x) * 4;
        png.data[idx] = color[0];
        png.data[idx + 1] = color[1];
        png.data[idx + 2] = color[2];
        png.data[idx + 3] = 255;
      }
    }
  }
  return new Uint8Array(PNG.sync.write(png));
}
