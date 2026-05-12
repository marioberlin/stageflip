// packages/runtimes/audience/src/export-frame.ts
// T-472 — Static-fallback consolidation. Defines the
// `AudienceExportFrame` shape + `renderAudienceExportFrame` dispatcher
// over the eleven audience-clip aggregation kinds.
//
// Each clip family ships a per-kind `export-frame.ts` next to its
// `static-fallback.ts`. The dispatcher routes by `snapshot.kind`. The
// emitted SVG approximates the static-fallback DOM at low fidelity
// suitable for PPTX export — every output is a complete, syntactically
// well-formed `<svg viewBox=...>...</svg>` string with no `<script>`
// or `<style>` (PPTX consumers reject those).
//
// Determinism (CLAUDE.md §3): pure function. Given identical `(snapshot,
// element)` bytes the output `AudienceExportFrame.svg` string is
// byte-identical. NO Date / Math.random / fetch / setTimeout.
//
// The function consumes the schema-level `Element` discriminated union
// — the dispatcher narrows on `el.type` to obtain strongly-typed props
// + uses `el.transform.{width,height}` as the default SVG bounding
// box. Callers may pass any audience-clip element variant; non-audience
// element types fall through to the exhaustiveness guard and throw a
// `UnsupportedAudienceClipKindError`.

import type { AggregationValue } from '@stageflip/audience-contract';
import type { Element } from '@stageflip/schema';

import { renderAudienceAiPromptExportFrame } from './clips/audience-ai-prompt/export-frame.js';
import { renderHeatmapExportFrame } from './clips/heatmap/export-frame.js';
import { renderLeaderboardExportFrame } from './clips/leaderboard/export-frame.js';
import { renderLivePollMultipleChoiceExportFrame } from './clips/live-poll-multiple-choice/export-frame.js';
import { renderLivePollOpenTextExportFrame } from './clips/live-poll-open-text/export-frame.js';
import { renderLivePollRatingExportFrame } from './clips/live-poll-rating/export-frame.js';
import { renderLiveQAExportFrame } from './clips/live-qa/export-frame.js';
import { renderLiveQuizExportFrame } from './clips/live-quiz/export-frame.js';
import { renderReactionStreamExportFrame } from './clips/reaction-stream/export-frame.js';
import { renderSurveyExportFrame } from './clips/survey/export-frame.js';
import { renderWordCloudExportFrame } from './clips/word-cloud/export-frame.js';

/**
 * The static export-frame emitted for an audience clip. Carries a
 * complete `<svg>` markup string plus the bounding-box dimensions the
 * SVG declares in its `viewBox`, plus the voter count captured at
 * snapshot time (sourced from the snapshot envelope when present, else
 * derived from the aggregation totals so the figure is never absent).
 *
 * Pure data — the consumer (e.g. the PPTX exporter) embeds the SVG
 * into its container format without further transformation.
 */
export interface AudienceExportFrame {
  /** Complete `<svg viewBox="0 0 W H" ...>...</svg>` markup. */
  readonly svg: string;
  /** SVG bounding-box width in user-coordinate units. */
  readonly width: number;
  /** SVG bounding-box height in user-coordinate units. */
  readonly height: number;
  /**
   * Voter count captured at the snapshot frame. Derived from the per-
   * kind aggregation totals so the figure is always populated even
   * when the caller does not have a `voterCountAtCapture` envelope.
   */
  readonly voterCountAtCapture: number;
}

/** Thrown when the dispatcher is handed an element whose `type` is not an audience clip. */
export class UnsupportedAudienceClipKindError extends Error {
  constructor(public readonly elementType: string) {
    super(`renderAudienceExportFrame: element type "${elementType}" is not an audience clip kind`);
    this.name = 'UnsupportedAudienceClipKindError';
  }
}

/**
 * Default SVG viewport dimensions when the element does not carry a
 * positive `transform.{width,height}` pair. 1920×1080 mirrors the
 * dominant slide aspect ratio across StageFlip's supported export
 * targets.
 */
export const DEFAULT_EXPORT_FRAME_WIDTH = 1920;
export const DEFAULT_EXPORT_FRAME_HEIGHT = 1080;

/**
 * Render the static export-frame for a single audience-clip element.
 *
 * Dispatches on the discriminated `snapshot.kind` value; each branch
 * narrows the snapshot to the matching aggregation variant and forwards
 * to the per-kind emitter alongside the element (the element supplies
 * the per-clip props — option labels, question text, scale labels,
 * etc.).
 *
 * @param snapshot — the aggregation payload to render.
 * @param element — the schema-side audience-clip element carrying
 *                   props + transform.
 * @returns AudienceExportFrame with the SVG markup + dimensions.
 * @throws UnsupportedAudienceClipKindError when `element.type` is not
 *                   one of the eleven audience-clip discriminants.
 */
export function renderAudienceExportFrame(
  snapshot: AggregationValue,
  element: Element,
): AudienceExportFrame {
  switch (snapshot.kind) {
    case 'live-poll-multiple-choice':
      if (element.type !== 'live-poll-multiple-choice') {
        throw new UnsupportedAudienceClipKindError(element.type);
      }
      return renderLivePollMultipleChoiceExportFrame(snapshot, element);
    case 'live-poll-open-text':
      if (element.type !== 'live-poll-open-text') {
        throw new UnsupportedAudienceClipKindError(element.type);
      }
      return renderLivePollOpenTextExportFrame(snapshot, element);
    case 'live-poll-rating':
      if (element.type !== 'live-poll-rating') {
        throw new UnsupportedAudienceClipKindError(element.type);
      }
      return renderLivePollRatingExportFrame(snapshot, element);
    case 'live-qa':
      if (element.type !== 'live-qa') {
        throw new UnsupportedAudienceClipKindError(element.type);
      }
      return renderLiveQAExportFrame(snapshot, element);
    case 'live-quiz':
      if (element.type !== 'live-quiz') {
        throw new UnsupportedAudienceClipKindError(element.type);
      }
      return renderLiveQuizExportFrame(snapshot, element);
    case 'leaderboard':
      if (element.type !== 'leaderboard') {
        throw new UnsupportedAudienceClipKindError(element.type);
      }
      return renderLeaderboardExportFrame(snapshot, element);
    case 'word-cloud':
      if (element.type !== 'word-cloud') {
        throw new UnsupportedAudienceClipKindError(element.type);
      }
      return renderWordCloudExportFrame(snapshot, element);
    case 'survey':
      if (element.type !== 'survey') {
        throw new UnsupportedAudienceClipKindError(element.type);
      }
      return renderSurveyExportFrame(snapshot, element);
    case 'heatmap':
      if (element.type !== 'heatmap') {
        throw new UnsupportedAudienceClipKindError(element.type);
      }
      return renderHeatmapExportFrame(snapshot, element);
    case 'reaction-stream':
      if (element.type !== 'reaction-stream') {
        throw new UnsupportedAudienceClipKindError(element.type);
      }
      return renderReactionStreamExportFrame(snapshot, element);
    case 'audience-ai-prompt':
      if (element.type !== 'audience-ai-prompt') {
        throw new UnsupportedAudienceClipKindError(element.type);
      }
      return renderAudienceAiPromptExportFrame(snapshot, element);
    default: {
      const _exhaustive: never = snapshot;
      return _exhaustive;
    }
  }
}

/**
 * Resolve a positive integer width/height pair from an element's
 * transform. Falls back to the 1920×1080 default when the element's
 * transform is absent / non-positive. Per-kind emitters call this to
 * keep the SVG `viewBox` declaration consistent across families.
 */
export function resolveExportFrameDimensions(element: Element): {
  readonly width: number;
  readonly height: number;
} {
  const tw = element.transform.width;
  const th = element.transform.height;
  const width = Number.isFinite(tw) && tw > 0 ? Math.round(tw) : DEFAULT_EXPORT_FRAME_WIDTH;
  const height = Number.isFinite(th) && th > 0 ? Math.round(th) : DEFAULT_EXPORT_FRAME_HEIGHT;
  return { width, height };
}

/**
 * Escape a string for safe inclusion in SVG text-node content / XML
 * attribute values. Replaces the five XML-significant characters with
 * their entity equivalents. Pure + deterministic.
 */
export function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
