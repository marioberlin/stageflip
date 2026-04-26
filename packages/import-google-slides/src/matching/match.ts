// packages/import-google-slides/src/matching/match.ts
// Pair an API page element with one or more CV candidates. Returns a typed
// MatchResult with axis-decomposed confidence + the winning candidate. Below
// `matchConfidenceThreshold` the caller emits LF-GSLIDES-LOW-MATCH-CONFIDENCE
// and pushes a residual into `tree.pendingResolution`.
//
// Matching axes (T-244 spec §5):
//   1. Text-content equality (Unicode NFC + whitespace collapse + case-sensitive)
//   2. Center-inside containment (element bbox center inside candidate bbox)
//   3. Z-order plausibility (lower confidence per z-rank delta step)
//
// `overallConfidence = min(content, position) * (1 - zPenalty)` per AC #19.

import type { ApiPageElement, ApiTextContent } from '../api/types.js';
import type { CvCandidates, CvContour, CvMask, CvTextLine } from '../cv/types.js';
import type { BboxPx } from '../geometry/affine.js';
import { textsMatch } from './text-equality.js';

export type CandidateKind = 'textLine' | 'contour' | 'mask';

export interface RankedCandidate {
  candidateKind: CandidateKind;
  candidateIndex: number;
  contentConfidence: number;
  positionConfidence: number;
  zPenalty: number;
  overallConfidence: number;
}

export interface MatchResult {
  /** Top candidate by overallConfidence; `null` when no candidate satisfied the position axis. */
  best: RankedCandidate | null;
  /** All candidates considered, sorted by overallConfidence desc. Useful for the residual record. */
  ranked: RankedCandidate[];
}

/**
 * Concatenate API text content into a single string, joining textRun chunks.
 * Returns `null` when the element has no text content (i.e., a non-text shape).
 */
export function extractApiText(content: ApiTextContent | undefined): string | null {
  if (!content?.textElements) return null;
  let out = '';
  for (const te of content.textElements) {
    if (te.textRun?.content) out += te.textRun.content;
  }
  if (out.length === 0) return null;
  return out;
}

function bboxFromPolygon(polygon: number[][]): BboxPx {
  const xs = polygon.map((p) => p[0] ?? 0);
  const ys = polygon.map((p) => p[1] ?? 0);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function bboxCenter(bbox: BboxPx): { x: number; y: number } {
  return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
}

function pointInsideBbox(p: { x: number; y: number }, bbox: BboxPx): boolean {
  return (
    p.x >= bbox.x && p.x <= bbox.x + bbox.width && p.y >= bbox.y && p.y <= bbox.y + bbox.height
  );
}

/**
 * Position confidence: 1 - normalized center-distance. Returns 0 when the
 * element bbox center is NOT inside the candidate bbox (containment is the
 * gate per AC #17).
 */
function positionConfidence(
  elementBbox: BboxPx,
  candidateBbox: BboxPx,
  slideDim: { width: number; height: number },
): number {
  const eCenter = bboxCenter(elementBbox);
  const cCenter = bboxCenter(candidateBbox);
  if (!pointInsideBbox(eCenter, candidateBbox)) return 0;
  const dx = eCenter.x - cCenter.x;
  const dy = eCenter.y - cCenter.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const norm = Math.max(slideDim.width, slideDim.height);
  return Math.max(0, 1 - dist / norm);
}

/** Z-order penalty: 0.15 per delta step between API z-rank and candidate z-rank. */
function zPenalty(elementZ: number, candidateZ: number): number {
  const delta = Math.abs(elementZ - candidateZ);
  return Math.min(1, delta * 0.15);
}

function aggregate(content: number, position: number, z: number): number {
  return Math.min(content, position) * (1 - z);
}

export interface MatchInputs {
  apiElement: ApiPageElement;
  /** Element's world-space bbox in render-pixel coords. */
  elementBboxPx: BboxPx;
  /** API element's z-rank (its index in the page-elements walked order). */
  elementZRank: number;
  /** Slide rendering dimensions. */
  slideDim: { width: number; height: number };
  /** All CV candidates for this slide. */
  candidates: CvCandidates;
  /**
   * Per-kind z-rank lookup. Caller computes ranks once per slide (e.g., by
   * sorting contours by area desc, textLines by reading order). Maps from
   * candidate index to z-rank.
   */
  candidateZRanks?: {
    textLines?: number[];
    contours?: number[];
    masks?: number[];
  };
}

/**
 * Run the matcher. Returns the best candidate plus all ranked candidates so
 * callers can record residuals. AC #13-20.
 */
export function matchElement(inputs: MatchInputs): MatchResult {
  const { apiElement, elementBboxPx, elementZRank, slideDim, candidates, candidateZRanks } = inputs;
  const apiText = extractApiText(apiElement.shape?.text);

  const ranked: RankedCandidate[] = [];

  // textLines: text-content + position + z-order.
  for (let i = 0; i < candidates.textLines.length; i += 1) {
    const cand = candidates.textLines[i] as CvTextLine;
    const cBbox = bboxFromPolygon(cand.polygonPx);
    const content = apiText !== null ? (textsMatch(apiText, cand.text) ? 1 : 0) : 0;
    const pos = positionConfidence(elementBboxPx, cBbox, slideDim);
    const cz = candidateZRanks?.textLines?.[i] ?? i;
    const z = zPenalty(elementZRank, cz);
    ranked.push({
      candidateKind: 'textLine',
      candidateIndex: i,
      contentConfidence: content,
      positionConfidence: pos,
      zPenalty: z,
      overallConfidence: aggregate(content, pos, z),
    });
  }

  // contours: position-only (no text content). Content axis uses the
  // candidate confidence as an upper bound — the contour detector reports a
  // confidence on its own classification.
  for (let i = 0; i < candidates.contours.length; i += 1) {
    const cand = candidates.contours[i] as CvContour;
    const pos = positionConfidence(elementBboxPx, cand.bboxPx, slideDim);
    const cz = candidateZRanks?.contours?.[i] ?? i;
    const z = zPenalty(elementZRank, cz);
    // For shape elements (no text), content = candidate's own detector confidence.
    const content = apiText === null ? cand.confidence : 0;
    ranked.push({
      candidateKind: 'contour',
      candidateIndex: i,
      contentConfidence: content,
      positionConfidence: pos,
      zPenalty: z,
      overallConfidence: aggregate(content, pos, z),
    });
  }

  // masks: same shape rules as contours, when present.
  if (candidates.masks) {
    for (let i = 0; i < candidates.masks.length; i += 1) {
      const cand = candidates.masks[i] as CvMask;
      const pos = positionConfidence(elementBboxPx, cand.bboxPx, slideDim);
      const cz = candidateZRanks?.masks?.[i] ?? i;
      const z = zPenalty(elementZRank, cz);
      const content = apiText === null ? cand.confidence : 0;
      ranked.push({
        candidateKind: 'mask',
        candidateIndex: i,
        contentConfidence: content,
        positionConfidence: pos,
        zPenalty: z,
        overallConfidence: aggregate(content, pos, z),
      });
    }
  }

  ranked.sort((a, b) => b.overallConfidence - a.overallConfidence);
  const best =
    ranked.length > 0 && (ranked[0]?.overallConfidence ?? 0) > 0
      ? (ranked[0] as RankedCandidate)
      : null;
  return { best, ranked };
}

/** Internal helper: re-export aggregator so AC #19 can pin it directly. */
export const _aggregateConfidence = aggregate;
