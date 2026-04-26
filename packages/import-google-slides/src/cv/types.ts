// packages/import-google-slides/src/cv/types.ts
// CvCandidates shape + Zod validator. Production CV worker (PaddleOCR /
// OpenCV / SAM 2) lives in T-244-cv-worker; T-244 ships only the TS
// interface, the test stub, and the HTTP client. Validator is the contract:
// malformed responses throw `CvProviderError(BAD_RESPONSE)`. AC #12.

import { z } from 'zod';

/** Per-axis pixel coordinate pair `[x, y]`. */
export const polygonPointSchema = z
  .tuple([z.number(), z.number()])
  .or(z.array(z.number()).length(2));

const bboxSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .strict();

const rgbaSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const textLineSchema = z
  .object({
    polygonPx: z.array(z.array(z.number()).length(2)),
    text: z.string(),
    confidence: z.number(),
  })
  .strict();

const contourSchema = z
  .object({
    bboxPx: bboxSchema,
    shapeKind: z.enum(['rect', 'rounded-rect', 'ellipse', 'polygon']),
    fillSample: rgbaSchema,
    confidence: z.number(),
  })
  .strict();

const maskSchema = z
  .object({
    bboxPx: bboxSchema,
    rle: z.string().optional(),
    confidence: z.number(),
  })
  .strict();

export const cvCandidatesSchema = z
  .object({
    textLines: z.array(textLineSchema),
    contours: z.array(contourSchema),
    masks: z.array(maskSchema).optional(),
  })
  .strict();

export type CvCandidates = z.infer<typeof cvCandidatesSchema>;
export type CvTextLine = CvCandidates['textLines'][number];
export type CvContour = CvCandidates['contours'][number];
export type CvMask = NonNullable<CvCandidates['masks']>[number];

/** Per-call options for the CV provider. */
export interface CvDetectOptions {
  /** Slide rendering width in pixels (matches the Thumbnail.width). */
  renderWidth: number;
  /** Slide rendering height in pixels. */
  renderHeight: number;
  /** Optional fixture/path key for the StubCvProvider to look up. */
  fixtureKey?: string;
}

/**
 * Production-or-test contract for the candidate provider. T-244 ships two
 * impls: `StubCvProvider` (test-only) and `HttpCvProvider` (production).
 */
export interface CvCandidateProvider {
  detect(pageImage: Uint8Array, opts: CvDetectOptions): Promise<CvCandidates>;
}
