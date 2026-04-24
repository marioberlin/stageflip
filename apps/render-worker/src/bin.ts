// apps/render-worker/src/bin.ts
// T-231 — Cloud Run Job entrypoint. Reads the task payload from the
// CLOUD_RUN_TASK_PAYLOAD env (or falls back to stdin), validates,
// and dispatches to the matching exporter. The exporter call itself
// is a stub in this phase — T-231 ships the harness; end-to-end
// render dispatch lands alongside apps/api's route wiring in a
// follow-up.

import { type RenderJob, parseRenderJob } from './job.js';

async function readPayload(): Promise<unknown> {
  const envPayload = process.env.CLOUD_RUN_TASK_PAYLOAD;
  if (envPayload) return JSON.parse(envPayload);
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) {
    throw new Error('no payload: set CLOUD_RUN_TASK_PAYLOAD env or pipe JSON via stdin');
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function dispatch(job: RenderJob): Promise<void> {
  switch (job.format) {
    case 'html5-zip':
      process.stdout.write(
        `[render-worker] html5-zip job doc=${job.documentId} sizes=${job.sizes.join(',')} budget=${job.budgetKb}kb\n`,
      );
      // TODO(T-231 follow-up): import { exportHtml5Zip } from '@stageflip/export-html5-zip'.
      return;
    case 'video':
      process.stdout.write(
        `[render-worker] video job doc=${job.documentId} aspects=${job.aspects.join(',')} codec=${job.codec} crf=${job.crf}\n`,
      );
      // TODO(T-231 follow-up): import { exportMultiAspectInParallel } from '@stageflip/export-video'.
      return;
  }
}

async function main(): Promise<void> {
  const raw = await readPayload();
  const job = parseRenderJob(raw);
  await dispatch(job);
  process.stdout.write('[render-worker] job complete\n');
}

main().catch((err) => {
  process.stderr.write(
    `[render-worker] job failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
