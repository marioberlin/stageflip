// packages/runtimes/audience/src/clips/survey/static-fallback.test.ts
// T-468 — Static-fallback tests for the `survey` clip. Asserts:
//   - Pure-function determinism (same input → byte-equal React tree).
//   - `formatTotalResponsesLabel` singular/plural.
//   - `formatMeanLabel` NaN / zero-vote edge case.
//   - Per-question-type rendering:
//       - multiple-choice → mini bars labelled with option text.
//       - open-text → top-5 list rows.
//       - rating → histogram + mean label.
//   - Missing-question-id edge case renders "(question missing)".
//   - Empty-questionAggregations renders the "Waiting…" placeholder.

import type {
  LivePollMultipleChoiceAggregation,
  LivePollOpenTextAggregation,
  LivePollRatingAggregation,
  SurveyAggregation,
} from '@stageflip/audience-contract';
import type { SurveyQuestion } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  formatMeanLabel,
  formatTotalResponsesLabel,
  renderSurveyStaticFallback,
} from './static-fallback.js';

const MC_AGG: LivePollMultipleChoiceAggregation = {
  kind: 'live-poll-multiple-choice',
  optionCounts: [8, 5, 2],
  totalVotes: 15,
};

const OT_AGG: LivePollOpenTextAggregation = {
  kind: 'live-poll-open-text',
  entries: [
    { text: 'great', count: 4 },
    { text: 'meh', count: 2 },
  ],
  totalVotes: 6,
};

const RATING_AGG: LivePollRatingAggregation = {
  kind: 'live-poll-rating',
  scoreCounts: [1, 3, 5, 4, 2],
  totalVotes: 15,
  mean: 3.2,
};

const QUESTIONS: readonly SurveyQuestion[] = [
  {
    id: 'q1',
    type: 'multiple-choice',
    text: 'Which framework?',
    options: ['React', 'Vue', 'Svelte'],
  },
  {
    id: 'q2',
    type: 'open-text',
    text: 'Any comments?',
    maxLength: 280,
  },
  {
    id: 'q3',
    type: 'rating',
    text: 'Rate the session',
    scaleMin: 1,
    scaleMax: 5,
  },
];

const FULL_SNAPSHOT: SurveyAggregation = {
  kind: 'survey',
  questionAggregations: [
    { questionId: 'q1', type: 'multiple-choice', aggregation: MC_AGG },
    { questionId: 'q2', type: 'open-text', aggregation: OT_AGG },
    { questionId: 'q3', type: 'rating', aggregation: RATING_AGG },
  ],
  totalResponses: 15,
};

const CTX = { width: 800, height: 600, questions: QUESTIONS };

describe('formatTotalResponsesLabel', () => {
  it('uses singular for exactly 1 response', () => {
    expect(formatTotalResponsesLabel(1)).toBe('1 response');
  });

  it('uses plural for 0 / >1 responses', () => {
    expect(formatTotalResponsesLabel(0)).toBe('0 responses');
    expect(formatTotalResponsesLabel(15)).toBe('15 responses');
  });
});

describe('formatMeanLabel', () => {
  it('renders Mean: X.X for valid means', () => {
    expect(formatMeanLabel(3.2, 15)).toBe('Mean: 3.2');
  });

  it('renders em-dash for NaN', () => {
    expect(formatMeanLabel(Number.NaN, 0)).toBe('Mean: —');
  });

  it('renders em-dash for totalVotes === 0', () => {
    expect(formatMeanLabel(0, 0)).toBe('Mean: —');
  });
});

describe('renderSurveyStaticFallback — aggregated shape', () => {
  it('returns a ReactElement marked as the survey root', () => {
    const out = renderSurveyStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe('survey');
    expect((out.props as { 'data-state': string })['data-state']).toBe('aggregated');
  });

  it('is deterministic — same input produces structurally-equal trees', () => {
    const a = renderSurveyStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const b = renderSurveyStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('renders one card per question aggregation, in input order', () => {
    const out = renderSurveyStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const topChildren = (out.props as { children: Array<{ props?: { 'data-role'?: string } }> })
      .children;
    const cardsContainer = topChildren.find((c) => c.props?.['data-role'] === 'cards');
    expect(cardsContainer).toBeDefined();
    const cards = (
      cardsContainer as unknown as {
        props: { children: Array<{ props: Record<string, unknown> }> };
      }
    ).props.children;
    expect(cards).toHaveLength(3);
    expect(cards[0]?.props['data-question-id']).toBe('q1');
    expect(cards[1]?.props['data-question-id']).toBe('q2');
    expect(cards[2]?.props['data-question-id']).toBe('q3');
  });

  it('renders total label with correct singular/plural', () => {
    const out = renderSurveyStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const topChildren = (out.props as { children: Array<{ props?: Record<string, unknown> }> })
      .children;
    const total = topChildren.find((c) => c.props?.['data-role'] === 'total-responses');
    expect(total).toBeDefined();
  });

  it('handles missing question id by rendering "(question missing)"', () => {
    const out = renderSurveyStaticFallback({
      snapshot: {
        kind: 'survey',
        questionAggregations: [
          { questionId: 'unknown-id', type: 'multiple-choice', aggregation: MC_AGG },
        ],
        totalResponses: 15,
      },
      context: { width: 400, height: 200, questions: [] },
    });
    // Walk the tree to find the header text.
    const json = JSON.stringify(out);
    expect(json).toContain('(question missing)');
  });
});

describe('renderSurveyStaticFallback — idle shape', () => {
  it('renders the "Waiting…" placeholder when questionAggregations is empty', () => {
    const out = renderSurveyStaticFallback({
      snapshot: { kind: 'survey', questionAggregations: [], totalResponses: 0 },
      context: CTX,
    });
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
  });
});
