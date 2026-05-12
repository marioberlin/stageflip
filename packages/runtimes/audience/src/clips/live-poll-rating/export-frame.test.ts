// packages/runtimes/audience/src/clips/live-poll-rating/export-frame.test.ts
// T-472 — Tests for the live-poll-rating SVG export-frame emitter.

import type { LivePollRatingAggregation } from '@stageflip/audience-contract';
import type { LivePollRatingClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  formatMeanLabel,
  formatTotalLabel,
  meanHighlightIndex,
  renderLivePollRatingExportFrame,
} from './export-frame.js';

const ELEMENT: LivePollRatingClipElement = {
  id: 'el-3',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'live-poll-rating',
  permissions: ['audience-network'],
  props: {
    question: 'How was the keynote?',
    scaleMin: 1,
    scaleMax: 5,
    labels: ['Bad', 'OK', 'Great'],
  },
};

const SNAPSHOT: LivePollRatingAggregation = {
  kind: 'live-poll-rating',
  scoreCounts: [1, 2, 5, 3, 1],
  totalVotes: 12,
  mean: 3.08,
};

describe('formatMeanLabel', () => {
  it('emits an em-dash for NaN / zero totalVotes', () => {
    expect(formatMeanLabel(Number.NaN, 0)).toBe('Mean: —');
    expect(formatMeanLabel(3, 0)).toBe('Mean: —');
  });
  it('emits a one-decimal value for positive totalVotes', () => {
    expect(formatMeanLabel(3.08, 12)).toBe('Mean: 3.1');
  });
});

describe('formatTotalLabel', () => {
  it('singular at 1 / plural otherwise', () => {
    expect(formatTotalLabel(1)).toBe('1 vote');
    expect(formatTotalLabel(0)).toBe('0 votes');
  });
});

describe('meanHighlightIndex', () => {
  it('returns null for NaN', () => {
    expect(meanHighlightIndex(Number.NaN, 5)).toBeNull();
  });
  it('returns rounded(mean) - 1 in range', () => {
    expect(meanHighlightIndex(3.4, 5)).toBe(2);
    expect(meanHighlightIndex(3.6, 5)).toBe(3);
  });
  it('returns null when out of range', () => {
    expect(meanHighlightIndex(7, 5)).toBeNull();
    expect(meanHighlightIndex(0, 5)).toBeNull();
  });
});

describe('renderLivePollRatingExportFrame', () => {
  it('emits a well-formed SVG with viewBox matching the element transform', () => {
    const out = renderLivePollRatingExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg.startsWith('<svg ')).toBe(true);
    expect(out.svg).toContain('viewBox="0 0 1280 720"');
    expect(out.svg.endsWith('</svg>')).toBe(true);
  });

  it('renders the question, mean, and total labels', () => {
    const out = renderLivePollRatingExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('How was the keynote?');
    expect(out.svg).toContain('Mean: 3.1');
    expect(out.svg).toContain('12 votes');
  });

  it('renders one bar per score', () => {
    const out = renderLivePollRatingExportFrame(SNAPSHOT, ELEMENT);
    for (const score of [1, 2, 3, 4, 5]) {
      expect(out.svg).toContain(`>${score}</text>`);
    }
  });

  it('renders end-of-scale labels (first + last only)', () => {
    const out = renderLivePollRatingExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('Bad');
    expect(out.svg).toContain('Great');
    // Middle entry not surfaced
    expect(out.svg).not.toContain('OK');
  });

  it('renders an em-dash mean when totalVotes is 0', () => {
    const out = renderLivePollRatingExportFrame(
      { kind: 'live-poll-rating', scoreCounts: [0, 0, 0, 0, 0], totalVotes: 0, mean: Number.NaN },
      ELEMENT,
    );
    expect(out.svg).toContain('Mean: —');
    expect(out.svg).toContain('0 votes');
  });

  it('is byte-deterministic', () => {
    const a = renderLivePollRatingExportFrame(SNAPSHOT, ELEMENT);
    const b = renderLivePollRatingExportFrame(SNAPSHOT, ELEMENT);
    expect(a.svg).toBe(b.svg);
  });
});
