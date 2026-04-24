// packages/export-video/src/multi-aspect.ts
// Multi-aspect export orchestrator (T-186). Takes a video document + a
// list of variant targets (typically produced by the agent's
// `bounce_to_aspect_ratios` tool, T-185) and runs each variant through
// a `VariantRenderer` in parallel, with a configurable concurrency cap.
//
// Error policy: collect-all. One failing variant doesn't cancel the
// others — callers get per-variant outcomes so the UI can show
// "2/3 succeeded" instead of "one failed".

import { mapWithConcurrency } from './concurrency.js';
import type { MultiAspectExportOptions, MultiAspectExportResult, VariantOutcome } from './types.js';

const DEFAULT_CONCURRENCY = 3;

function normaliseError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  return new Error(typeof thrown === 'string' ? thrown : JSON.stringify(thrown));
}

export async function exportMultiAspectInParallel(
  options: MultiAspectExportOptions,
): Promise<MultiAspectExportResult> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const outcomes: VariantOutcome[] = await mapWithConcurrency(
    options.variants,
    concurrency,
    async (variant): Promise<VariantOutcome> => {
      try {
        const output = await options.renderer.render({
          document: options.document,
          variant,
          ...(options.signal ? { signal: options.signal } : {}),
        });
        return { ok: true, output };
      } catch (thrown) {
        return { ok: false, variant, error: normaliseError(thrown) };
      }
    },
  );
  let okCount = 0;
  let errorCount = 0;
  for (const outcome of outcomes) {
    if (outcome.ok) okCount += 1;
    else errorCount += 1;
  }
  return {
    rendererId: options.renderer.id,
    outcomes,
    okCount,
    errorCount,
  };
}
