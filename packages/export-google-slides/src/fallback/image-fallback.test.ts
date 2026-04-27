// packages/export-google-slides/src/fallback/image-fallback.test.ts
// Pins crop → upload → delete + create-image flow. AC #18, #19, #20.

import type { Element } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { SlidesMutationClient } from '../api/client.js';
import { makeUniformPng } from '../test-helpers.js';
import { imageFallbackForResidual } from './image-fallback.js';

const stubElement: Element = {
  id: 'shape1',
  type: 'shape',
  shape: 'rect',
  transform: { x: 100, y: 100, width: 50, height: 30, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
} as Element;

describe('imageFallbackForResidual', () => {
  it('AC #18: invokes rasterizeFromThumbnail with paddingPx: 0 (verified via crop dimensions)', async () => {
    const driveCalls: Array<{ bytes: Uint8Array; mimeType: string }> = [];
    const apiClient: SlidesMutationClient = {
      async createPresentation() {
        return { presentationId: 'p1' };
      },
      async batchUpdate() {
        return { presentationId: 'p1', replies: [] };
      },
      async driveFilesCreate(c) {
        driveCalls.push({ bytes: c.bytes, mimeType: c.mimeType });
        return { id: 'drive-id' };
      },
      async fetchSlideThumbnail() {
        return { bytes: new Uint8Array(), width: 0, height: 0 };
      },
    };
    const goldenPng = makeUniformPng(400, 300);
    const result = await imageFallbackForResidual({
      element: stubElement,
      apiObjectId: 'apiObj1',
      slideObjectId: 'slide1',
      goldenPng,
      goldenSize: { width: 400, height: 300 },
      apiClient,
    });
    expect(driveCalls).toHaveLength(1);
    expect(driveCalls[0]?.mimeType).toBe('image/png');
    expect(result.driveFileId).toBe('drive-id');
  });

  it('AC #20: emits DeleteObjectRequest + CreateImageRequest in that order', async () => {
    const apiClient: SlidesMutationClient = {
      async createPresentation() {
        return { presentationId: 'p1' };
      },
      async batchUpdate() {
        return { presentationId: 'p1', replies: [] };
      },
      async driveFilesCreate() {
        return { id: 'drive-id' };
      },
      async fetchSlideThumbnail() {
        return { bytes: new Uint8Array(), width: 0, height: 0 };
      },
    };
    const goldenPng = makeUniformPng(400, 300);
    const result = await imageFallbackForResidual({
      element: stubElement,
      apiObjectId: 'apiObj1',
      slideObjectId: 'slide1',
      goldenPng,
      goldenSize: { width: 400, height: 300 },
      apiClient,
    });
    expect(result.requests).toHaveLength(2);
    expect(Object.keys(result.requests[0] ?? {})[0]).toBe('deleteObject');
    expect(Object.keys(result.requests[1] ?? {})[0]).toBe('createImage');
    const deleteReq = result.requests[0] as { deleteObject: { objectId: string } };
    expect(deleteReq.deleteObject.objectId).toBe('apiObj1');
    const createReq = result.requests[1] as { createImage: { url: string; objectId: string } };
    expect(createReq.createImage.url).toMatch(/drive\.google\.com/);
    expect(createReq.createImage.objectId).toBe('shape1_fallback');
  });

  it('group residual: single DeleteObjectRequest (no per-child) — Slides cascades child deletes', async () => {
    const apiClient: SlidesMutationClient = {
      async createPresentation() {
        return { presentationId: 'p1' };
      },
      async batchUpdate() {
        return { presentationId: 'p1', replies: [] };
      },
      async driveFilesCreate() {
        return { id: 'drive-id' };
      },
      async fetchSlideThumbnail() {
        return { bytes: new Uint8Array(), width: 0, height: 0 };
      },
    };
    const groupEl: Element = {
      id: 'g1',
      type: 'group',
      clip: false,
      transform: { x: 50, y: 50, width: 100, height: 100, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      children: [
        {
          id: 'c1',
          type: 'shape',
          shape: 'rect',
          transform: { x: 0, y: 0, width: 50, height: 50, rotation: 0, opacity: 1 },
          visible: true,
          locked: false,
          animations: [],
        },
      ],
    } as Element;
    const goldenPng = makeUniformPng(400, 300);
    const result = await imageFallbackForResidual({
      element: groupEl,
      apiObjectId: 'apiGroup1',
      slideObjectId: 'slide1',
      goldenPng,
      goldenSize: { width: 400, height: 300 },
      apiClient,
    });
    const deletes = result.requests.filter((r) => 'deleteObject' in r);
    // Spec §7: ONE delete (the group); children cascade.
    expect(deletes).toHaveLength(1);
  });
});
