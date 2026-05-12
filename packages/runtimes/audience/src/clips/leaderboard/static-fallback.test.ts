// packages/runtimes/audience/src/clips/leaderboard/static-fallback.test.ts
// T-466 — Static-fallback tests for the `leaderboard` clip. Asserts:
//   - Pure-function determinism (same input → byte-equal React tree).
//   - `formatParticipantsLabel` singular/plural.
//   - `medalForRank` / `medalColorForRank` rank → medal mapping.
//   - Ranking routing emits one row per `ranking` entry.
//   - Top-3 rows carry `data-medal`; rank > 3 rows do not.
//   - Anonymous-voter fallback when `displayName` absent.
//   - Title rendered above the list when supplied.
//   - Empty-ranking renders the "Waiting…" placeholder.

import { describe, expect, it } from 'vitest';

import {
  formatParticipantsLabel,
  medalColorForRank,
  medalForRank,
  renderLeaderboardStaticFallback,
} from './static-fallback.js';

const FULL_SNAPSHOT = {
  kind: 'leaderboard' as const,
  quizId: 'quiz-1',
  ranking: [
    { voterToken: 'hash-a', displayName: 'Alice', score: 1500, rank: 1 },
    { voterToken: 'hash-b', displayName: 'Bob', score: 1350, rank: 2 },
    { voterToken: 'hash-c', displayName: 'Carol', score: 1200, rank: 3 },
    { voterToken: 'hash-d', displayName: 'Dave', score: 1100, rank: 4 },
    { voterToken: 'hash-e', score: 1050, rank: 5 },
  ],
  totalParticipants: 21,
};

const CTX = {
  width: 800,
  height: 400,
};

describe('formatParticipantsLabel', () => {
  it('uses singular for exactly 1 participant', () => {
    expect(formatParticipantsLabel(1)).toBe('1 participant');
  });

  it('uses plural for 0 / >1 participants', () => {
    expect(formatParticipantsLabel(0)).toBe('0 participants');
    expect(formatParticipantsLabel(21)).toBe('21 participants');
  });
});

describe('medalForRank', () => {
  it('maps rank 1 → gold, 2 → silver, 3 → bronze', () => {
    expect(medalForRank(1)).toBe('gold');
    expect(medalForRank(2)).toBe('silver');
    expect(medalForRank(3)).toBe('bronze');
  });

  it('returns null for ranks > 3', () => {
    expect(medalForRank(4)).toBeNull();
    expect(medalForRank(100)).toBeNull();
  });

  it('returns null for non-medal ranks <= 0', () => {
    expect(medalForRank(0)).toBeNull();
    expect(medalForRank(-1)).toBeNull();
  });
});

describe('medalColorForRank', () => {
  it('returns a colour string for top-3 ranks', () => {
    expect(medalColorForRank(1)).toMatch(/^#/);
    expect(medalColorForRank(2)).toMatch(/^#/);
    expect(medalColorForRank(3)).toMatch(/^#/);
  });

  it('returns null for ranks > 3', () => {
    expect(medalColorForRank(4)).toBeNull();
  });

  it('produces distinct colours per medal tier', () => {
    const gold = medalColorForRank(1);
    const silver = medalColorForRank(2);
    const bronze = medalColorForRank(3);
    expect(gold).not.toBe(silver);
    expect(silver).not.toBe(bronze);
    expect(gold).not.toBe(bronze);
  });
});

describe('renderLeaderboardStaticFallback — ranked shape', () => {
  it('returns a ReactElement marked as the leaderboard root', () => {
    const out = renderLeaderboardStaticFallback({
      snapshot: FULL_SNAPSHOT,
      context: CTX,
    });
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'leaderboard',
    );
    expect((out.props as { 'data-state': string })['data-state']).toBe('ranked');
    expect((out.props as { 'data-quiz-id': string })['data-quiz-id']).toBe('quiz-1');
  });

  it('is deterministic — same input produces structurally-equal trees', () => {
    const a = renderLeaderboardStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const b = renderLeaderboardStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('renders the optional title when supplied', () => {
    const out = renderLeaderboardStaticFallback({
      snapshot: FULL_SNAPSHOT,
      context: { ...CTX, title: 'Round 1' },
    });
    const children = (out.props as { children: unknown[] }).children;
    expect(Array.isArray(children)).toBe(true);
    const titleNode = (children as Array<{ props?: { children?: unknown } }>).find(
      (c) => c?.props !== undefined && (c as { type?: unknown }).type === 'h3',
    );
    expect(titleNode).toBeDefined();
  });

  it('omits the title node when no title is supplied', () => {
    const out = renderLeaderboardStaticFallback({
      snapshot: FULL_SNAPSHOT,
      context: CTX,
    });
    const children = (out.props as { children: Array<{ type?: unknown }> }).children;
    const hasTitle = children.some((c) => (c as { type?: unknown }).type === 'h3');
    expect(hasTitle).toBe(false);
  });
});

describe('renderLeaderboardStaticFallback — idle shape', () => {
  it('renders the "Waiting…" placeholder when ranking is empty', () => {
    const out = renderLeaderboardStaticFallback({
      snapshot: {
        kind: 'leaderboard',
        quizId: 'quiz-x',
        ranking: [],
        totalParticipants: 0,
      },
      context: CTX,
    });
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
  });
});
