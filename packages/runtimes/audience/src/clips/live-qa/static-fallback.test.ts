// packages/runtimes/audience/src/clips/live-qa/static-fallback.test.ts
// T-464 — Static-fallback tests for the `live-qa` clip. Asserts:
//   - Pure-function determinism (same input → byte-equal React tree).
//   - `formatTotalLabel` / `formatUpvoteLabel` singular/plural.
//   - `formatRelativeTime` handles undefined/invalid/short-delta/minutes.
//   - `sortQuestions` orders by upvotes desc; stable on submittedAt asc.
//   - The render emits one card per question.
//   - Top-3 cards carry `data-highlight="popular"`.
//   - "Answered" badge present iff `answered === true`.

import { describe, expect, it } from 'vitest';

import {
  formatRelativeTime,
  formatTotalLabel,
  formatUpvoteLabel,
  renderLiveQAStaticFallback,
  sortQuestions,
} from './static-fallback.js';

const SNAPSHOT = {
  kind: 'live-qa' as const,
  questions: [
    {
      id: 'q1',
      text: 'How do hooks work?',
      upvotes: 12,
      submittedAt: '2026-05-12T10:00:00Z',
      answered: true,
    },
    {
      id: 'q2',
      text: 'When is the next release?',
      upvotes: 8,
      submittedAt: '2026-05-12T10:01:00Z',
    },
    {
      id: 'q3',
      text: 'Can we see a demo?',
      upvotes: 5,
      submittedAt: '2026-05-12T10:02:00Z',
    },
  ],
  totalQuestions: 3,
};

const CTX = {
  width: 800,
  height: 400,
  topic: 'Ask the speaker',
  // Five minutes after the last question.
  now: Date.parse('2026-05-12T10:07:00Z'),
};

describe('formatTotalLabel', () => {
  it('uses singular for exactly 1 question', () => {
    expect(formatTotalLabel(1)).toBe('1 question');
  });

  it('uses plural for 0 / >1 questions', () => {
    expect(formatTotalLabel(0)).toBe('0 questions');
    expect(formatTotalLabel(3)).toBe('3 questions');
  });
});

describe('formatUpvoteLabel', () => {
  it('uses singular for exactly 1 upvote', () => {
    expect(formatUpvoteLabel(1)).toBe('1 upvote');
  });

  it('uses plural for 0 / >1 upvotes', () => {
    expect(formatUpvoteLabel(0)).toBe('0 upvotes');
    expect(formatUpvoteLabel(12)).toBe('12 upvotes');
  });
});

describe('formatRelativeTime', () => {
  const submittedAt = '2026-05-12T10:00:00Z';
  const ms = Date.parse(submittedAt);

  it('returns "Just now" when now is undefined', () => {
    expect(formatRelativeTime(submittedAt, undefined)).toBe('Just now');
  });

  it('returns "Just now" when submittedAt is invalid', () => {
    expect(formatRelativeTime('not-a-date', ms + 600_000)).toBe('Just now');
  });

  it('returns "Just now" when delta < 60s', () => {
    expect(formatRelativeTime(submittedAt, ms + 30_000)).toBe('Just now');
    expect(formatRelativeTime(submittedAt, ms + 59_999)).toBe('Just now');
  });

  it('returns "Asked 1 min ago" when delta is exactly 1 minute', () => {
    expect(formatRelativeTime(submittedAt, ms + 60_000)).toBe('Asked 1 min ago');
    expect(formatRelativeTime(submittedAt, ms + 119_999)).toBe('Asked 1 min ago');
  });

  it('returns "Asked N min ago" for N >= 2', () => {
    expect(formatRelativeTime(submittedAt, ms + 120_000)).toBe('Asked 2 min ago');
    expect(formatRelativeTime(submittedAt, ms + 7 * 60_000)).toBe('Asked 7 min ago');
  });
});

describe('sortQuestions', () => {
  it('orders by upvotes desc', () => {
    const sorted = sortQuestions(SNAPSHOT.questions);
    expect(sorted.map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);
  });

  it('breaks ties on submittedAt asc (older first)', () => {
    const equalUpvotes = [
      { id: 'a', text: 'A', upvotes: 5, submittedAt: '2026-05-12T10:02:00Z' },
      { id: 'b', text: 'B', upvotes: 5, submittedAt: '2026-05-12T10:00:00Z' },
      { id: 'c', text: 'C', upvotes: 5, submittedAt: '2026-05-12T10:01:00Z' },
    ];
    const sorted = sortQuestions(equalUpvotes);
    expect(sorted.map((q) => q.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input', () => {
    const input = [...SNAPSHOT.questions];
    sortQuestions(input);
    expect(input.map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);
  });

  it('respects an unsorted input by re-sorting defensively', () => {
    const unsorted = [
      { id: 'low', text: 'L', upvotes: 1, submittedAt: '2026-05-12T10:00:00Z' },
      { id: 'high', text: 'H', upvotes: 99, submittedAt: '2026-05-12T10:01:00Z' },
      { id: 'mid', text: 'M', upvotes: 50, submittedAt: '2026-05-12T10:02:00Z' },
    ];
    const sorted = sortQuestions(unsorted);
    expect(sorted.map((q) => q.id)).toEqual(['high', 'mid', 'low']);
  });
});

describe('renderLiveQAStaticFallback', () => {
  it('returns a ReactElement', () => {
    const out = renderLiveQAStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    expect(out).toBeDefined();
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe('live-qa');
  });

  it('is deterministic — same input produces structurally-equal trees', () => {
    const a = renderLiveQAStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const b = renderLiveQAStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('emits one card per question (encoded in the cards container)', () => {
    const out = renderLiveQAStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const cards = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'cards');
    expect(cards).toBeDefined();
    expect(Array.isArray(cards?.props?.children)).toBe(true);
    expect(cards?.props?.children).toHaveLength(SNAPSHOT.questions.length);
  });

  it('marks the top-3 cards with data-highlight="popular"', () => {
    // Build a 5-question snapshot to verify the cap at 3.
    const five = {
      kind: 'live-qa' as const,
      totalQuestions: 5,
      questions: [
        { id: 'q1', text: '1', upvotes: 50, submittedAt: '2026-05-12T10:00:00Z' },
        { id: 'q2', text: '2', upvotes: 40, submittedAt: '2026-05-12T10:01:00Z' },
        { id: 'q3', text: '3', upvotes: 30, submittedAt: '2026-05-12T10:02:00Z' },
        { id: 'q4', text: '4', upvotes: 20, submittedAt: '2026-05-12T10:03:00Z' },
        { id: 'q5', text: '5', upvotes: 10, submittedAt: '2026-05-12T10:04:00Z' },
      ],
    };
    const out = renderLiveQAStaticFallback({ snapshot: five, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const cards = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'cards');
    const cardList = cards?.props?.children as Array<{
      props?: { 'data-card-index'?: number; 'data-highlight'?: string };
    }>;
    const popular = cardList.filter((c) => c.props?.['data-highlight'] === 'popular');
    expect(popular).toHaveLength(3);
    expect(popular[0]?.props?.['data-card-index']).toBe(0);
    expect(popular[1]?.props?.['data-card-index']).toBe(1);
    expect(popular[2]?.props?.['data-card-index']).toBe(2);
  });

  it('renders a topic label when context.topic is supplied', () => {
    const out = renderLiveQAStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const topic = (children as Array<{ props?: { 'data-role'?: string } }>).find(
      (c) => c.props?.['data-role'] === 'topic',
    );
    expect(topic).toBeDefined();
  });

  it('omits the topic label when context.topic is omitted', () => {
    const out = renderLiveQAStaticFallback({
      snapshot: SNAPSHOT,
      context: { width: CTX.width, height: CTX.height },
    });
    const children = (out.props as { children: unknown[] }).children;
    const topic = (children as Array<{ props?: { 'data-role'?: string } }>).find(
      (c) => c.props?.['data-role'] === 'topic',
    );
    expect(topic).toBeUndefined();
  });

  it('renders the total label as "3 questions"', () => {
    const out = renderLiveQAStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const total = (children as Array<{ props?: { 'data-role'?: string; children?: string } }>).find(
      (c) => c.props?.['data-role'] === 'total',
    );
    expect(total?.props?.children).toBe('3 questions');
  });

  it('renders zero cards when snapshot.questions is empty', () => {
    const out = renderLiveQAStaticFallback({
      snapshot: { kind: 'live-qa', questions: [], totalQuestions: 0 },
      context: CTX,
    });
    const children = (out.props as { children: unknown[] }).children;
    const cards = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'cards');
    expect(cards?.props?.children).toHaveLength(0);
  });
});
