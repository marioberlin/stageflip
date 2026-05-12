// packages/audience-contract/src/quiz-fairness.ts
// T-473 — Pure scoring + late-joiner-lock primitives for LiveQuizClip
// fairness. Kahoot canon: correct answers score `base + bonus * (1 -
// latency/timer)`, with base=500 + bonus=500 (1000 max); incorrect or
// timer-expired answers score 0. Late-joiner-lock blocks a voter from
// scoring on questions that advanced before they joined the session.
//
// These primitives are consumed by:
//   - The server-side state machine in `apps/api/src/routes/audience-quiz-state.ts`
//     (T-473) — scores each accepted vote + tracks per-voter cumulative.
//   - The clip-tier renderer in `packages/runtimes/audience/src/clips/live-quiz/**`
//     (T-465) — surfaces the same arithmetic when projecting the
//     deterministic static-fallback (consistency across server +
//     fallback).
//
// Deterministic + pure: no I/O, no globals, no `Date.now()`, no random.

/**
 * Compute a Kahoot-canon time-bonus quiz score for a single answer.
 *
 * Formula:
 *   - incorrect → 0
 *   - correct but `latencyMs > timerMs` → 0 (expired-timer guard)
 *   - correct + `timerMs <= 0` → 500 (degenerate timer; base only)
 *   - correct + within timer → `Math.round(500 + 500 * Math.max(0, 1 -
 *     latencyMs / timerMs))`
 *
 * The result is an integer in `[0, 1000]` so leaderboard ordering is
 * stable across floating-point rounding.
 */
export function computeQuizScore(args: {
  readonly isCorrect: boolean;
  readonly latencyMs: number;
  readonly timerMs: number;
}): number {
  if (!args.isCorrect) return 0;
  if (args.latencyMs > args.timerMs && args.timerMs > 0) return 0;
  if (args.timerMs <= 0) return 500;
  const bonusFraction = Math.max(0, 1 - args.latencyMs / args.timerMs);
  return Math.round(500 + 500 * bonusFraction);
}

/**
 * Apply the late-joiner activation lock: a voter who joined the
 * session AFTER the active question advanced cannot vote on prior
 * questions. The check is the simple inequality
 * `currentQuestionIndex >= joinedAtQuestionIndex`.
 *
 * `voterToken` is accepted for API symmetry with the server-side
 * dispatcher (lets future identity-aware logic plug in without a
 * signature churn) but is not currently used in the decision.
 */
export function applyLateJoinerLock(args: {
  readonly voterToken: string;
  readonly joinedAtQuestionIndex: number;
  readonly currentQuestionIndex: number;
}): { readonly canVote: boolean } {
  void args.voterToken;
  return { canVote: args.currentQuestionIndex >= args.joinedAtQuestionIndex };
}
