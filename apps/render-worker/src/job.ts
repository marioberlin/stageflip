// apps/render-worker/src/job.ts
// T-231 — render job contract. The Cloud Run Job reads a JSON
// payload from the CLOUD_RUN_TASK_PAYLOAD env (or a mounted
// volume); the payload is validated against this Zod schema and
// dispatched to the matching exporter.

import { z } from 'zod';

export const RenderJobSchema = z.discriminatedUnion('format', [
  z.object({
    format: z.literal('html5-zip'),
    documentId: z.string().min(1),
    sizes: z.array(z.string().regex(/^\d+x\d+$/)).min(1),
    budgetKb: z.number().int().positive().default(150),
    output: z.object({
      bucket: z.string().min(1),
      prefix: z.string().default(''),
    }),
  }),
  z.object({
    format: z.literal('video'),
    documentId: z.string().min(1),
    aspects: z.array(z.enum(['9:16', '1:1', '16:9', '4:5'])).min(1),
    codec: z.enum(['h264', 'h265', 'vp9']).default('h264'),
    crf: z.number().int().min(0).max(51).default(23),
    output: z.object({
      bucket: z.string().min(1),
      prefix: z.string().default(''),
    }),
  }),
]);

export type RenderJob = z.infer<typeof RenderJobSchema>;

export function parseRenderJob(raw: unknown): RenderJob {
  return RenderJobSchema.parse(raw);
}
