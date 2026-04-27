// packages/export-google-slides/src/fallback/image-fallback.ts
// Residual element → image-fallback. T-252 spec §7. Crops the canonical
// golden via T-245's `rasterizeFromThumbnail`, uploads bytes via Drive
// `files.create`, then emits CreateImageRequest + DeleteObjectRequest.
//
// Group residuals: Slides cascades child deletes — emitting a single
// DeleteObjectRequest against the group's objectId deletes the group AND
// its children. The implementer MUST NOT emit per-child deletes (see
// spec §7 + AC #25).

import { rasterizeFromThumbnail } from '@stageflip/rasterize';
import type { Element } from '@stageflip/schema';
import type { SlidesMutationClient } from '../api/client.js';
import type { BatchUpdateRequest } from '../api/types.js';

const EMU_PER_PX = 9525;

export interface ImageFallbackInput {
  /** Canonical element being replaced. */
  element: Element;
  /** API objectId of the live element on the slide (to delete). */
  apiObjectId: string;
  /** Slide page objectId where the new image lands. */
  slideObjectId: string;
  /** PNG bytes of the canonical-side rendered slide (the "golden"). */
  goldenPng: Uint8Array;
  /** Dimensions the golden was rendered at. */
  goldenSize: { width: number; height: number };
  /** Slides + Drive API mutation client (for the upload). */
  apiClient: SlidesMutationClient;
}

export interface ImageFallbackResult {
  /** Mutation requests to apply: Delete original, Create the image. */
  requests: BatchUpdateRequest[];
  /** New image's API objectId on the slide. */
  newImageObjectId: string;
  /** Drive file id for the uploaded PNG (for caller's audit log). */
  driveFileId: string;
}

/**
 * Crop, upload, and produce the batchUpdate requests that swap a residual
 * native element for an image. Caller is responsible for applying the
 * returned requests via batchUpdate AND for emitting `LF-GSLIDES-EXPORT-FALLBACK`
 * on the residual's elementId.
 */
export async function imageFallbackForResidual(
  input: ImageFallbackInput,
): Promise<ImageFallbackResult> {
  const bbox = {
    x: Math.max(0, Math.floor(input.element.transform.x)),
    y: Math.max(0, Math.floor(input.element.transform.y)),
    width: Math.max(1, Math.floor(input.element.transform.width)),
    height: Math.max(1, Math.floor(input.element.transform.height)),
  };
  // Spec §7: paddingPx: 0 — the rasterized region matches the element's bbox
  // exactly. Anti-aliased edges are accepted as cost of the fallback.
  const cropped = await rasterizeFromThumbnail(input.goldenPng, bbox, { paddingPx: 0 });
  const uploaded = await input.apiClient.driveFilesCreate({
    bytes: cropped.bytes,
    mimeType: 'image/png',
    name: `${input.element.id}-fallback.png`,
  });
  const newImageObjectId = `${input.element.id}_fallback`;
  const contentUrl = uploaded.webContentLink ?? `https://drive.google.com/uc?id=${uploaded.id}`;

  const requests: BatchUpdateRequest[] = [];
  // Spec §7: a group residual deletes via a single DeleteObjectRequest
  // against the group's objectId — the API cascades to children. We never
  // emit per-child deletes for groups.
  requests.push({ deleteObject: { objectId: input.apiObjectId } });
  requests.push({
    createImage: {
      objectId: newImageObjectId,
      url: contentUrl,
      elementProperties: {
        pageObjectId: input.slideObjectId,
        size: {
          width: { magnitude: input.element.transform.width * EMU_PER_PX, unit: 'EMU' },
          height: { magnitude: input.element.transform.height * EMU_PER_PX, unit: 'EMU' },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: input.element.transform.x * EMU_PER_PX,
          translateY: input.element.transform.y * EMU_PER_PX,
          unit: 'EMU',
        },
      },
    },
  });

  return { requests, newImageObjectId, driveFileId: uploaded.id };
}
