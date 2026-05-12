// packages/runtimes/audience/src/clips/survey/export-frame.test.ts
// T-472 — Tests for the survey SVG export-frame emitter.

import type { SurveyAggregation } from '@stageflip/audience-contract';
import type { SurveyClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { formatTotalLabel, renderSurveyExportFrame } from './export-frame.js';

const ELEMENT: SurveyClipElement = {
  id: 'el-8',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'survey',
  permissions: ['audience-network'],
  props: {
    questions: [
      { id: 'q1', type: 'multiple-choice', text: 'MC?', options: ['A', 'B', 'C'] },
      { id: 'q2', type: 'open-text', text: 'OT?', maxLength: 280 },
      {
        id: 'q3',
        type: 'rating',
        text: 'Rate?',
        scaleMin: 1,
        scaleMax: 5,
        labels: ['Low', 'High'],
      },
    ],
  },
};

const SNAPSHOT: SurveyAggregation = {
  kind: 'survey',
  questionAggregations: [
    {
      questionId: 'q1',
      type: 'multiple-choice',
      aggregation: { kind: 'live-poll-multiple-choice', optionCounts: [3, 1, 0], totalVotes: 4 },
    },
    {
      questionId: 'q2',
      type: 'open-text',
      aggregation: {
        kind: 'live-poll-open-text',
        entries: [
          { text: 'foo', count: 3 },
          { text: 'bar', count: 1 },
        ],
        totalVotes: 4,
      },
    },
    {
      questionId: 'q3',
      type: 'rating',
      aggregation: {
        kind: 'live-poll-rating',
        scoreCounts: [0, 1, 2, 1, 0],
        totalVotes: 4,
        mean: 3.0,
      },
    },
  ],
  totalResponses: 4,
};

describe('formatTotalLabel', () => {
  it('singular at 1 / plural otherwise', () => {
    expect(formatTotalLabel(1)).toBe('1 response');
    expect(formatTotalLabel(4)).toBe('4 responses');
  });
});

describe('renderSurveyExportFrame', () => {
  it('emits a well-formed SVG', () => {
    const out = renderSurveyExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg.startsWith('<svg ')).toBe(true);
    expect(out.svg.endsWith('</svg>')).toBe(true);
    expect(out.svg).toContain('viewBox="0 0 1280 720"');
  });

  it('renders the per-question text', () => {
    const out = renderSurveyExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('MC?');
    expect(out.svg).toContain('OT?');
    expect(out.svg).toContain('Rate?');
  });

  it('renders the rating mean label', () => {
    const out = renderSurveyExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('Mean: 3.0');
  });

  it('renders the bottom total label', () => {
    const out = renderSurveyExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('4 responses');
  });

  it('is byte-deterministic', () => {
    const a = renderSurveyExportFrame(SNAPSHOT, ELEMENT);
    const b = renderSurveyExportFrame(SNAPSHOT, ELEMENT);
    expect(a.svg).toBe(b.svg);
  });

  it('handles an empty survey snapshot', () => {
    const out = renderSurveyExportFrame(
      { kind: 'survey', questionAggregations: [], totalResponses: 0 },
      ELEMENT,
    );
    expect(out.svg).toContain('0 responses');
  });
});
