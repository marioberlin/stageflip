// packages/export-pptx/src/elements/audience-clip.ts
// T-472 — Audience-clip element emitter. Replaces the prior
// `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` fallthrough for the eleven
// `audience-*` element types with a real per-kind SVG export-frame
// emitted via `@stageflip/runtimes-audience/export-frame`.
//
// For v1, the SVG markup is embedded inside the `<p:sp>` shape as a
// raw text run inside a `<![CDATA[...]]>` block. This embedding is
// non-standard PPTX (downstream consumers may surface the SVG as
// plain-text inside the shape rather than rendering it visually), but
// it PRESERVES THE DATA — a future task can rasterize the SVG into a
// PNG `<p:pic>` for proper PowerPoint compatibility. The priority
// closing T-472 is replacing the unconditional loss-flag emission
// with a deterministic per-kind output.

import type { AggregationValue } from '@stageflip/audience-contract';
import {
  type AudienceExportFrame,
  renderAudienceExportFrame,
} from '@stageflip/runtimes-audience/export-frame';
import type { Element } from '@stageflip/schema';

import { type SlideEmitContext, renderXfrm } from './shared.js';

/**
 * Element types this emitter supports. Mirrors the eleven
 * `AudienceClipKind` discriminants on the schema-side `Element` union.
 */
export type AudienceClipElementType =
  | 'live-poll-multiple-choice'
  | 'live-poll-open-text'
  | 'live-poll-rating'
  | 'live-qa'
  | 'live-quiz'
  | 'leaderboard'
  | 'word-cloud'
  | 'survey'
  | 'heatmap'
  | 'reaction-stream'
  | 'audience-ai-prompt';

/** Narrowing helper — true when `el.type` is an audience-clip discriminant. */
export function isAudienceClipElement(
  el: Element,
): el is Extract<Element, { type: AudienceClipElementType }> {
  switch (el.type) {
    case 'live-poll-multiple-choice':
    case 'live-poll-open-text':
    case 'live-poll-rating':
    case 'live-qa':
    case 'live-quiz':
    case 'leaderboard':
    case 'word-cloud':
    case 'survey':
    case 'heatmap':
    case 'reaction-stream':
    case 'audience-ai-prompt':
      return true;
    default:
      return false;
  }
}

/**
 * Synthesise an empty aggregation snapshot for an audience-clip
 * element. Used at template-tier emission (where no live snapshot is
 * carried) and as a fallback when the element's `provenance` field is
 * absent. Matches the per-kind aggregation shape from
 * `@stageflip/audience-contract`.
 */
export function emptySnapshotFor(elType: AudienceClipElementType): AggregationValue {
  switch (elType) {
    case 'live-poll-multiple-choice':
      return { kind: 'live-poll-multiple-choice', optionCounts: [0], totalVotes: 0 };
    case 'live-poll-open-text':
      return { kind: 'live-poll-open-text', entries: [], totalVotes: 0 };
    case 'live-poll-rating':
      return {
        kind: 'live-poll-rating',
        scoreCounts: [0],
        totalVotes: 0,
        mean: Number.NaN,
      };
    case 'live-qa':
      return { kind: 'live-qa', questions: [], totalQuestions: 0 };
    case 'live-quiz':
      return {
        kind: 'live-quiz',
        activeQuestionId: null,
        questionResults: [],
        totalVoters: 0,
      };
    case 'leaderboard':
      return {
        kind: 'leaderboard',
        quizId: 'unknown',
        ranking: [],
        totalParticipants: 0,
      };
    case 'word-cloud':
      return { kind: 'word-cloud', words: [], totalSubmissions: 0 };
    case 'survey':
      return { kind: 'survey', questionAggregations: [], totalResponses: 0 };
    case 'heatmap':
      return {
        kind: 'heatmap',
        taps: [],
        totalTaps: 0,
        gridResolution: { w: 64, h: 36 },
      };
    case 'reaction-stream':
      return { kind: 'reaction-stream', emojiCounts: [], totalReactions: 0 };
    case 'audience-ai-prompt':
      return {
        kind: 'audience-ai-prompt',
        prompts: [],
        winnerPromptId: null,
        generatedAssetCacheKey: null,
      };
  }
}

/**
 * Resolve the aggregation snapshot to render for an audience-clip
 * element. Returns the inlined `provenance.aggregation` per ADR-010
 * §D5 when present; otherwise synthesises an empty snapshot per
 * `emptySnapshotFor`.
 */
export function resolveSnapshotFor(
  el: Extract<Element, { type: AudienceClipElementType }>,
): AggregationValue {
  const provenance = (el as { provenance?: { aggregation?: AggregationValue } }).provenance;
  if (provenance?.aggregation !== undefined) return provenance.aggregation;
  return emptySnapshotFor(el.type);
}

/**
 * Render the export-frame for an audience-clip element. Pure: same
 * `(el)` → byte-identical `AudienceExportFrame` (modulo the input's
 * `provenance` field).
 */
export function renderAudienceClipExportFrame(
  el: Extract<Element, { type: AudienceClipElementType }>,
): AudienceExportFrame {
  return renderAudienceExportFrame(resolveSnapshotFor(el), el);
}

/**
 * Escape a string for safe inclusion in an XML attribute value. Used
 * for the `<p:cNvPr id="..." name="..."/>` attrs.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escape a string for inclusion inside a `<![CDATA[...]]>` block.
 * CDATA cannot contain the closing `]]>` sequence; we split-and-rejoin
 * it across two CDATA blocks. All other characters pass through
 * unchanged.
 */
function escapeCdata(svg: string): string {
  return svg.replace(/]]>/g, ']]]]><![CDATA[>');
}

/**
 * Emit the PPTX shape XML for an audience-clip element. Replaces the
 * prior fallthrough emitter for these eleven element types. The shape
 * carries the SVG markup inside a `<p:txBody>` text run via a CDATA
 * block (see file-header note on the embedding strategy).
 *
 * Slide-tier emission (the `emitMode === 'slide'` branch) includes the
 * element's transform on `<p:spPr>`. Template-tier emission skips the
 * transform — the placeholder geometry is owned by the layout/master.
 */
export function emitAudienceClipElement(
  el: Extract<Element, { type: AudienceClipElementType }>,
  ctx: SlideEmitContext,
): string {
  const frame = renderAudienceClipExportFrame(el);
  const idAttr = escapeAttr(el.id);
  const nameAttr = escapeAttr(el.name ?? el.id);
  const isSlideTier = (ctx.emitMode ?? 'slide') === 'slide';
  const spPr = isSlideTier ? `<p:spPr>${renderXfrm(el.transform)}</p:spPr>` : '<p:spPr/>';
  const cdata = escapeCdata(frame.svg);

  // Embed the SVG inside the txBody as a CDATA-wrapped text run with
  // a marker attribute (`data-stageflip-audience-svg`) so downstream
  // tooling can recognise the embedded payload.
  return [
    '<p:sp>',
    `<p:nvSpPr><p:cNvPr id="${idAttr}" name="${nameAttr}" descr="stageflip-audience-clip:${escapeAttr(el.type)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`,
    spPr,
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t><![CDATA[${cdata}]]></a:t></a:r></a:p></p:txBody>`,
    '</p:sp>',
  ].join('');
}
