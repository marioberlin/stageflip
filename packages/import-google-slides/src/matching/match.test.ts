// packages/import-google-slides/src/matching/match.test.ts
// Pin AC #13, 17, 18, 19, 20: matching axes + threshold semantics + residual
// shape contributions. AC #14-16 are covered in text-equality.test.ts.

import { describe, expect, it } from 'vitest';
import type { ApiPageElement } from '../api/types.js';
import type { CvCandidates } from '../cv/types.js';
import type { BboxPx } from '../geometry/affine.js';
import { _aggregateConfidence, extractApiText, matchElement } from './match.js';

const slideDim = { width: 1600, height: 900 };

function shapeWithText(text: string): ApiPageElement {
  return {
    objectId: 'el-1',
    shape: {
      shapeType: 'TEXT_BOX',
      text: { textElements: [{ textRun: { content: text } }] },
    },
  };
}

function rectShape(): ApiPageElement {
  return {
    objectId: 'rect-1',
    shape: { shapeType: 'RECTANGLE' },
  };
}

const polyAround = (bbox: BboxPx): number[][] => [
  [bbox.x, bbox.y],
  [bbox.x + bbox.width, bbox.y],
  [bbox.x + bbox.width, bbox.y + bbox.height],
  [bbox.x, bbox.y + bbox.height],
];

describe('matchElement — text-content axis', () => {
  it('AC #13: identical text + center-inside containment → contentConf=1, posConf>0, overall=high', () => {
    const elBbox: BboxPx = { x: 100, y: 100, width: 200, height: 50 };
    const candidates: CvCandidates = {
      textLines: [{ polygonPx: polyAround(elBbox), text: 'Quarterly Revenue', confidence: 1 }],
      contours: [],
    };
    const result = matchElement({
      apiElement: shapeWithText('Quarterly Revenue'),
      elementBboxPx: elBbox,
      elementZRank: 0,
      slideDim,
      candidates,
    });
    expect(result.best).not.toBeNull();
    expect(result.best?.candidateKind).toBe('textLine');
    expect(result.best?.contentConfidence).toBe(1);
    expect(result.best?.overallConfidence).toBeGreaterThan(0.78);
  });
});

describe('matchElement — center-inside containment (AC #17)', () => {
  it('candidate adjacent-but-not-containing → positionConfidence = 0; overall = 0', () => {
    const elBbox: BboxPx = { x: 100, y: 100, width: 200, height: 50 };
    // Candidate shifted entirely to the right; element center at (200,125) is OUTSIDE the candidate.
    const candBbox: BboxPx = { x: 350, y: 100, width: 200, height: 50 };
    const candidates: CvCandidates = {
      textLines: [{ polygonPx: polyAround(candBbox), text: 'Quarterly Revenue', confidence: 1 }],
      contours: [],
    };
    const result = matchElement({
      apiElement: shapeWithText('Quarterly Revenue'),
      elementBboxPx: elBbox,
      elementZRank: 0,
      slideDim,
      candidates,
    });
    // Best is null (no positive overall) OR best has overall=0.
    if (result.best) {
      expect(result.best.positionConfidence).toBe(0);
      expect(result.best.overallConfidence).toBe(0);
    } else {
      expect(result.ranked[0]?.positionConfidence).toBe(0);
    }
  });
});

describe('matchElement — z-order plausibility (AC #18)', () => {
  it('one z-step delta costs 0.15; two steps cost 0.30', () => {
    const elBbox: BboxPx = { x: 100, y: 100, width: 200, height: 50 };
    // Two candidates, both contain element center; differ in z-rank.
    const candidates: CvCandidates = {
      textLines: [],
      contours: [
        { bboxPx: elBbox, shapeKind: 'rect', fillSample: [255, 0, 0, 255], confidence: 1 },
        { bboxPx: elBbox, shapeKind: 'rect', fillSample: [0, 255, 0, 255], confidence: 1 },
        { bboxPx: elBbox, shapeKind: 'rect', fillSample: [0, 0, 255, 255], confidence: 1 },
      ],
    };
    const result = matchElement({
      apiElement: rectShape(),
      elementBboxPx: elBbox,
      elementZRank: 0,
      slideDim,
      candidates,
      candidateZRanks: { contours: [0, 1, 2] },
    });
    const byIndex = new Map(result.ranked.map((r) => [r.candidateIndex, r]));
    expect(byIndex.get(0)?.zPenalty).toBe(0);
    expect(byIndex.get(1)?.zPenalty).toBeCloseTo(0.15, 10);
    expect(byIndex.get(2)?.zPenalty).toBeCloseTo(0.3, 10);
  });
});

describe('aggregateConfidence (AC #19)', () => {
  it('min(1.0, 0.9) * (1 - 0.15) = 0.765', () => {
    expect(_aggregateConfidence(1, 0.9, 0.15)).toBeCloseTo(0.765, 10);
  });

  it('content=0 floors overall to 0', () => {
    expect(_aggregateConfidence(0, 1, 0)).toBe(0);
  });

  it('zPenalty=1 floors overall to 0', () => {
    expect(_aggregateConfidence(1, 1, 1)).toBe(0);
  });
});

describe('extractApiText', () => {
  it('joins multiple textRun chunks in order', () => {
    expect(
      extractApiText({
        textElements: [{ textRun: { content: 'Hello ' } }, { textRun: { content: 'World' } }],
      }),
    ).toBe('Hello World');
  });

  it('returns null for non-text shapes', () => {
    expect(extractApiText(undefined)).toBeNull();
    expect(extractApiText({ textElements: [] })).toBeNull();
    expect(extractApiText({ textElements: [{ paragraphMarker: {} }] })).toBeNull();
  });
});

describe('threshold semantics (AC #20)', () => {
  it('match below 0.78 → caller emits residual; we pin the math here', () => {
    // Element with low-confidence contour candidate at 0.6 → overall ≈ 0.6.
    const elBbox: BboxPx = { x: 100, y: 100, width: 200, height: 50 };
    const candidates: CvCandidates = {
      textLines: [],
      contours: [
        { bboxPx: elBbox, shapeKind: 'rect', fillSample: [255, 0, 0, 255], confidence: 0.6 },
      ],
    };
    const result = matchElement({
      apiElement: rectShape(),
      elementBboxPx: elBbox,
      elementZRank: 0,
      slideDim,
      candidates,
    });
    expect(result.best?.overallConfidence).toBeCloseTo(0.6, 1);
    expect(result.best?.overallConfidence).toBeLessThan(0.78);
  });
});
