// packages/export-video/src/provenance-aware.ts
// T-440 — provenance-aware video export entry point. Composes the existing
// `exportMultiAspectInParallel` orchestrator with a provenance walk +
// opt-in watermark plan + sidecar manifest emission.
//
// Posture: OPT-IN. `aiWatermark.enabled === true` is required to emit
// any AI-related surface; the default suppresses both `aiContent` and
// `watermarkPlan`. When opted in but no AI elements are supplied, both
// surfaces are suppressed too (nothing to disclose).
//
// Renderer-agnostic: the orchestrator never pixel-composites. Concrete
// `VariantRenderer`s consume `watermarkPlan` (FFmpeg drawtext / canvas /
// CSS overlay — their choice).

import { DEFAULT_AI_WATERMARK, buildWatermarkPlan } from './ai-watermark.js';
import { exportMultiAspectInParallel } from './multi-aspect.js';
import { extractAiContentManifest } from './provenance-walk.js';
import type {
  AiWatermarkConfig,
  ProvenanceAwareExportInput,
  ProvenanceAwareExportResult,
} from './types.js';

/**
 * Provenance-aware video export. Runs the existing multi-aspect
 * orchestrator unchanged, then layers the opt-in AI-content sidecar
 * + watermark plan on top.
 *
 * Back-compat: when the tenant opts out (default) OR no AI elements
 * are supplied, the result is `{ multiAspect }` with both `aiContent`
 * and `watermarkPlan` undefined — caller-visible behavior is identical
 * to invoking `exportMultiAspectInParallel` directly.
 */
export async function exportProvenanceAware(
  input: ProvenanceAwareExportInput,
): Promise<ProvenanceAwareExportResult> {
  const multiAspect = await exportMultiAspectInParallel({
    document: input.document,
    variants: input.variants,
    renderer: input.renderer,
    ...(input.concurrency !== undefined ? { concurrency: input.concurrency } : {}),
    ...(input.signal !== undefined ? { signal: input.signal } : {}),
  });

  // Merge tenant config with defaults. Tenant must explicitly set
  // `enabled: true` to opt in.
  const config: AiWatermarkConfig = { ...DEFAULT_AI_WATERMARK, ...(input.aiWatermark ?? {}) };
  if (!config.enabled) {
    return { multiAspect };
  }

  const aiElements = input.aiElements ?? [];
  if (aiElements.length === 0) {
    return { multiAspect };
  }

  const aiContent = extractAiContentManifest(aiElements, config);
  const watermarkPlan = buildWatermarkPlan(aiElements, config);

  // `extractAiContentManifest` and `buildWatermarkPlan` use the same
  // AI-classification predicate, so both return `undefined` together
  // when no element survives the filter.
  if (aiContent === undefined || watermarkPlan === undefined) {
    return { multiAspect };
  }

  return { multiAspect, aiContent, watermarkPlan };
}
