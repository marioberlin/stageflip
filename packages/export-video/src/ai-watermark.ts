// packages/export-video/src/ai-watermark.ts
// T-440 — watermark plan + sidecar serialization for the provenance-aware
// video exporter. Pure functions; no I/O; deterministic.
//
// The orchestrator produces a RENDERER-AGNOSTIC plan: frame ranges + the
// tenant's style config. Concrete `VariantRenderer` implementations
// consume the plan (FFmpeg drawtext for the bake tier; canvas / CSS
// overlay for the live preview). T-440 owns the plan, not the pixels.

import { classifyAiKind } from './provenance-walk.js';
import type {
  AiContentManifest,
  AiVideoElementInputRow,
  AiWatermarkConfig,
  AiWatermarkPlan,
  FrameRange,
} from './types.js';

/**
 * Default watermark config. `enabled: false` is the opt-in master
 * switch — tenants must explicitly opt in via
 * `ProvenanceAwareExportInput.aiWatermark.enabled = true`. This is the
 * opposite of T-439's IAB display exporter (auto-mark for ad-tech
 * compliance) and is documented in `docs/tasks/T-440.md` "Opt-in posture".
 */
export const DEFAULT_AI_WATERMARK: AiWatermarkConfig = {
  enabled: false,
  text: 'Made with AI',
  position: 'bottom-right',
  opacity: 0.1,
  color: '#fff',
  fontSize: 12,
};

/**
 * Merge a list of frame ranges into a sorted, non-overlapping list.
 * Touching ranges (`endFrame_a === startFrame_b`) join — the half-open
 * interval contract preserves the property that adjacent half-open
 * ranges form a contiguous range when joined.
 *
 * Pure function. Stable for empty input.
 */
export function mergeFrameRanges(ranges: readonly FrameRange[]): FrameRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.startFrame - b.startFrame);
  const first = sorted[0];
  if (first === undefined) return [];
  const out: FrameRange[] = [];
  let current: FrameRange = { startFrame: first.startFrame, endFrame: first.endFrame };
  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i];
    if (next === undefined) continue;
    if (next.startFrame <= current.endFrame) {
      // Overlap or touch — extend the current range.
      if (next.endFrame > current.endFrame) {
        current = { startFrame: current.startFrame, endFrame: next.endFrame };
      }
    } else {
      out.push(current);
      current = { startFrame: next.startFrame, endFrame: next.endFrame };
    }
  }
  out.push(current);
  return out;
}

/**
 * Build the renderer-facing watermark plan. Returns `undefined` when:
 *
 *   - `config.enabled === false` (tenant opted out — most common path), OR
 *   - `inputs` is empty / contains no AI-generated elements.
 *
 * When non-undefined, `frameRanges` is sorted ascending and
 * non-overlapping. Rows whose `frameRange` is absent collapse to
 * `{0..MAX_SAFE_INTEGER}` (always-on for the entire timeline).
 *
 * Pure function.
 */
export function buildWatermarkPlan(
  inputs: readonly AiVideoElementInputRow[],
  config: AiWatermarkConfig,
): AiWatermarkPlan | undefined {
  if (!config.enabled) return undefined;
  const ranges: FrameRange[] = [];
  for (const row of inputs) {
    if (row.provenance === undefined) continue;
    if (!classifyAiKind(row.provenance.kind)) continue;
    if (row.frameRange !== undefined) {
      ranges.push(row.frameRange);
    } else {
      ranges.push({ startFrame: 0, endFrame: Number.MAX_SAFE_INTEGER });
    }
  }
  if (ranges.length === 0) return undefined;
  return {
    config,
    frameRanges: mergeFrameRanges(ranges),
  };
}

/**
 * Stable key ordering for the sidecar JSON so two runs with the same
 * manifest produce byte-identical bytes. JSON.stringify is deterministic
 * over object-property insertion order in JS engines; we control the
 * order by rebuilding the manifest object before serialization.
 */
function canonicalize(manifest: AiContentManifest): unknown {
  return {
    elements: manifest.elements.map((el) => {
      const out: Record<string, unknown> = {
        elementId: el.elementId,
        provider: el.provider,
        modality: el.modality,
      };
      if (el.cacheKey !== undefined) out.cacheKey = el.cacheKey;
      if (el.prompt !== undefined) out.prompt = el.prompt;
      if (el.frameRange !== undefined) {
        out.frameRange = {
          startFrame: el.frameRange.startFrame,
          endFrame: el.frameRange.endFrame,
        };
      }
      return out;
    }),
    watermark: {
      enabled: manifest.watermark.enabled,
      text: manifest.watermark.text,
      position: manifest.watermark.position,
      opacity: manifest.watermark.opacity,
    },
  };
}

/**
 * Serialize an `AiContentManifest` to the `ai-content.json` sidecar's
 * UTF-8 byte representation. Two calls with the same manifest produce
 * byte-identical output (canonical key ordering, two-space indent,
 * trailing newline).
 *
 * Pure function — no `Date.now()` / `Math.random()`.
 */
export function serializeAiContentSidecar(manifest: AiContentManifest): Uint8Array {
  const json = `${JSON.stringify(canonicalize(manifest), null, 2)}\n`;
  return new TextEncoder().encode(json);
}
