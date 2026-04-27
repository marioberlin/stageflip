// packages/export-google-slides/src/test-helpers.ts
// Mock Slides API client + canned-data plumbing for the integration tests.
// Records every API call so per-test assertions can pin exact request shapes.

import { PNG } from 'pngjs';
import type { SlidesMutationClient } from './api/client.js';
import type {
  BatchUpdateRequest,
  BatchUpdateResponse,
  CreatePresentationResponse,
  DriveFileCreateResponse,
} from './api/types.js';
import type { ObservedBbox } from './convergence/diff.js';

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
  /** Test seam: per-iteration observations (consumed by the convergence loop). */
  __convergenceObservations: Record<
    string,
    Array<{ observed: ObservedBbox[]; perceptualDiff: number }>
  >;
}

export interface BuildClientOptions {
  presentationId?: string;
  thumbnailBytes?: Uint8Array;
  driveFileId?: string;
  /** When set, the next batchUpdate call returns these errors and an empty replies[]. */
  batchUpdateErrors?: Array<{ requestIndex: number; message: string }>;
  /** When set, the batchUpdate call throws (simulates a network/HTTP error). */
  batchUpdateThrowsOn?: number;
  observations?: Record<string, Array<{ observed: ObservedBbox[]; perceptualDiff: number }>>;
}

export function buildRecordingClient(opts: BuildClientOptions = {}): RecordingMutationClient {
  const presentationId = opts.presentationId ?? 'test-presentation-id';
  const thumbnailBytes = opts.thumbnailBytes ?? makePlaceholderPng();
  const driveFileId = opts.driveFileId ?? 'test-drive-file-id';
  const batchUpdates: RecordingMutationClient['batchUpdates'] = [];
  const driveUploads: RecordingMutationClient['driveUploads'] = [];
  const presentationsCreated: RecordingMutationClient['presentationsCreated'] = [];
  const thumbnailFetches: RecordingMutationClient['thumbnailFetches'] = [];

  let batchUpdateCallCount = 0;

  return {
    batchUpdates,
    driveUploads,
    presentationsCreated,
    thumbnailFetches,
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
        width: 1600,
        height: 900,
      };
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
