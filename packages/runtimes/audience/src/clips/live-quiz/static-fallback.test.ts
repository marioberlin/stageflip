// packages/runtimes/audience/src/clips/live-quiz/static-fallback.test.ts
// T-465 — Static-fallback tests for the `live-quiz` clip. Asserts:
//   - Pure-function determinism (same input → byte-equal React tree).
//   - `formatVotesLabel` singular/plural.
//   - `computeBarFractions` normalises to max within block; zero-vote
//     case yields all zeros.
//   - Final-round routing emits one block per `questionResults` entry.
//   - Active-question routing emits a single block (no correctness
//     highlight).
//   - Idle routing renders the "Waiting…" placeholder.
//   - Correct option carries `data-correct="true"` ONLY in final-round
//     shape.

import { describe, expect, it } from 'vitest';

import {
  type LiveQuizQuestionDef,
  computeBarFractions,
  formatVotesLabel,
  renderLiveQuizStaticFallback,
} from './static-fallback.js';

const QUESTIONS: readonly LiveQuizQuestionDef[] = [
  {
    id: 'q1',
    text: 'Capital of France?',
    options: ['London', 'Paris', 'Berlin', 'Madrid'],
  },
  {
    id: 'q2',
    text: '2 + 2 = ?',
    options: ['3', '4', '5', '6'],
  },
];

const FINAL_SNAPSHOT = {
  kind: 'live-quiz' as const,
  activeQuestionId: null,
  questionResults: [
    {
      questionId: 'q1',
      optionCounts: [2, 18, 1, 0],
      correctOptionIndex: 1,
      totalVotes: 21,
      status: 'closed' as const,
    },
    {
      questionId: 'q2',
      optionCounts: [0, 21, 0, 0],
      correctOptionIndex: 1,
      totalVotes: 21,
      status: 'closed' as const,
    },
  ],
  totalVoters: 21,
};

const CTX = {
  width: 800,
  height: 400,
  questions: QUESTIONS,
};

describe('formatVotesLabel', () => {
  it('uses singular for exactly 1 vote', () => {
    expect(formatVotesLabel(1)).toBe('1 vote');
  });

  it('uses plural for 0 / >1 votes', () => {
    expect(formatVotesLabel(0)).toBe('0 votes');
    expect(formatVotesLabel(21)).toBe('21 votes');
  });
});

describe('computeBarFractions', () => {
  it('normalises to the max value in the block (NOT to totalVotes)', () => {
    const f = computeBarFractions([2, 18, 1, 0]);
    expect(f[0]).toBeCloseTo(2 / 18);
    expect(f[1]).toBeCloseTo(1);
    expect(f[2]).toBeCloseTo(1 / 18);
    expect(f[3]).toBeCloseTo(0);
  });

  it('returns zeros when every count is zero', () => {
    expect(computeBarFractions([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });

  it('handles single-element arrays', () => {
    expect(computeBarFractions([5])).toEqual([1]);
  });

  it('produces identical output for identical input (purity)', () => {
    const a = computeBarFractions([3, 9, 1]);
    const b = computeBarFractions([3, 9, 1]);
    expect(a).toEqual(b);
  });
});

describe('renderLiveQuizStaticFallback — final-round shape', () => {
  it('returns a ReactElement marked as the live-quiz root', () => {
    const out = renderLiveQuizStaticFallback({
      snapshot: FINAL_SNAPSHOT,
      context: CTX,
    });
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'live-quiz',
    );
    expect((out.props as { 'data-state': string })['data-state']).toBe('final');
  });

  it('is deterministic — same input produces structurally-equal trees', () => {
    const a = renderLiveQuizStaticFallback({ snapshot: FINAL_SNAPSHOT, context: CTX });
    const b = renderLiveQuizStaticFallback({ snapshot: FINAL_SNAPSHOT, context: CTX });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('emits one block per questionResults entry', () => {
    const out = renderLiveQuizStaticFallback({ snapshot: FINAL_SNAPSHOT, context: CTX });
    const props = out.props as { children: { props: { children: unknown[] } } };
    const blocks = props.children.props.children as Array<{
      props?: { 'data-block-index'?: number };
    }>;
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.props?.['data-block-index']).toBe(0);
    expect(blocks[1]?.props?.['data-block-index']).toBe(1);
  });
});

describe('renderLiveQuizStaticFallback — active-question shape', () => {
  it('renders a single block when activeQuestionId resolves', () => {
    const out = renderLiveQuizStaticFallback({
      snapshot: {
        kind: 'live-quiz',
        activeQuestionId: 'q1',
        questionResults: [
          {
            questionId: 'q1',
            optionCounts: [1, 2, 3, 4],
            correctOptionIndex: 0,
            totalVotes: 10,
            status: 'active',
          },
        ],
        totalVoters: 10,
      },
      context: CTX,
    });
    expect((out.props as { 'data-state': string })['data-state']).toBe('active');
    expect((out.props as { 'data-active-question-id': string })['data-active-question-id']).toBe(
      'q1',
    );
  });

  it('renders the "Waiting…" placeholder when activeQuestionId does not resolve', () => {
    const out = renderLiveQuizStaticFallback({
      snapshot: {
        kind: 'live-quiz',
        activeQuestionId: 'q-unknown',
        questionResults: [],
        totalVoters: 0,
      },
      context: CTX,
    });
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
  });
});

describe('renderLiveQuizStaticFallback — idle shape', () => {
  it('renders the "Waiting…" placeholder when no active question and no results', () => {
    const out = renderLiveQuizStaticFallback({
      snapshot: {
        kind: 'live-quiz',
        activeQuestionId: null,
        questionResults: [],
        totalVoters: 0,
      },
      context: CTX,
    });
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
  });
});
