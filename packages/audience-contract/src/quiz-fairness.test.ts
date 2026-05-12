// packages/audience-contract/src/quiz-fairness.test.ts
// T-473 — Unit tests for the pure quiz-fairness primitives:
// `computeQuizScore` (Kahoot-canon time-bonus scoring) +
// `applyLateJoinerLock` (per-voter activation lock). Exhaustive coverage
// of boundary cases per the spec acceptance criteria.

import { describe, expect, it } from 'vitest';

import { applyLateJoinerLock, computeQuizScore } from './quiz-fairness.js';

describe('computeQuizScore', () => {
  it('returns 0 for an incorrect answer regardless of latency', () => {
    expect(computeQuizScore({ isCorrect: false, latencyMs: 0, timerMs: 10_000 })).toBe(0);
    expect(computeQuizScore({ isCorrect: false, latencyMs: 5_000, timerMs: 10_000 })).toBe(0);
    expect(computeQuizScore({ isCorrect: false, latencyMs: 100_000, timerMs: 10_000 })).toBe(0);
  });

  it('returns 1000 for a correct answer at zero latency (maximum bonus)', () => {
    expect(computeQuizScore({ isCorrect: true, latencyMs: 0, timerMs: 10_000 })).toBe(1000);
  });

  it('returns 750 for a correct answer at half the timer (mid bonus)', () => {
    expect(computeQuizScore({ isCorrect: true, latencyMs: 5_000, timerMs: 10_000 })).toBe(750);
  });

  it('returns 500 for a correct answer exactly at timer expiry (base only)', () => {
    expect(computeQuizScore({ isCorrect: true, latencyMs: 10_000, timerMs: 10_000 })).toBe(500);
  });

  it('returns 0 for a correct answer past timer expiry', () => {
    expect(computeQuizScore({ isCorrect: true, latencyMs: 10_001, timerMs: 10_000 })).toBe(0);
    expect(computeQuizScore({ isCorrect: true, latencyMs: 20_000, timerMs: 10_000 })).toBe(0);
  });

  it('returns 500 for a correct answer when timerMs is 0 (degenerate timer — base only)', () => {
    expect(computeQuizScore({ isCorrect: true, latencyMs: 0, timerMs: 0 })).toBe(500);
  });

  it('returns 500 for a correct answer when timerMs is negative (degenerate timer — base only)', () => {
    expect(computeQuizScore({ isCorrect: true, latencyMs: 0, timerMs: -1 })).toBe(500);
    expect(computeQuizScore({ isCorrect: true, latencyMs: 100, timerMs: -1 })).toBe(500);
  });

  it('returns 0 for an incorrect answer when timerMs is 0', () => {
    expect(computeQuizScore({ isCorrect: false, latencyMs: 0, timerMs: 0 })).toBe(0);
  });

  it('rounds to integer for stable leaderboard ordering', () => {
    // latency 3333 / timer 10000 = 0.3333 fraction; bonusFraction = 0.6667
    // 500 + 500 * 0.6667 = 833.35 → rounds to 833
    expect(computeQuizScore({ isCorrect: true, latencyMs: 3_333, timerMs: 10_000 })).toBe(833);
    // latency 1, timer 3 → 1/3 = 0.3333..., bonusFraction = 0.6666..., 500+333.33 = 833 (rounds)
    expect(computeQuizScore({ isCorrect: true, latencyMs: 1, timerMs: 3 })).toBe(833);
  });
});

describe('applyLateJoinerLock', () => {
  it('blocks a voter who joined after the current question advanced', () => {
    expect(
      applyLateJoinerLock({
        voterToken: 'voter-1',
        joinedAtQuestionIndex: 3,
        currentQuestionIndex: 1,
      }),
    ).toEqual({ canVote: false });
  });

  it('admits a voter at the same question they joined on', () => {
    expect(
      applyLateJoinerLock({
        voterToken: 'voter-1',
        joinedAtQuestionIndex: 3,
        currentQuestionIndex: 3,
      }),
    ).toEqual({ canVote: true });
  });

  it('admits a voter on a later question than they joined on', () => {
    expect(
      applyLateJoinerLock({
        voterToken: 'voter-1',
        joinedAtQuestionIndex: 3,
        currentQuestionIndex: 5,
      }),
    ).toEqual({ canVote: true });
  });

  it('admits a voter who joined at question 0 on the very first question', () => {
    expect(
      applyLateJoinerLock({
        voterToken: 'voter-1',
        joinedAtQuestionIndex: 0,
        currentQuestionIndex: 0,
      }),
    ).toEqual({ canVote: true });
  });
});
