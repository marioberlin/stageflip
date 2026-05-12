// apps/api/src/routes/audience-quiz-state.ts
// T-473 — Server-side quiz state machine. Per-session: tracks
// `activeQuestionIndex` + per-voter cumulative score + per-voter
// `joinedAtQuestionIndex`. Drives Kahoot-canon time-bonus scoring for
// `live-quiz` votes routed through the WS dispatcher.
//
// State persists in the `AudienceResultsStore` under the session doc's
// optional `quizState` field (T-473 storage extension). The in-memory
// store backs tests + dev; the Firestore-backed impl in T-474 inherits
// the same contract. The reconnect-resilience property falls out of
// storing the state at the session level (not in a per-connection
// in-process map): a voter who disconnects + reconnects on a new socket
// rejoins with their cumulative score intact.
//
// `latencyMs` is supplied as an INPUT by the caller. The WS dispatcher
// computes it from `now() - activeQuestionStartedAt` (T-473 convention —
// the more spoof-resistant of the two options; client-supplied
// timestamps are not authoritative). Keeping latency outside this module
// avoids state explosion on the question-started-at tracking.

import { applyLateJoinerLock, computeQuizScore } from '@stageflip/audience-contract';
import type { AudienceQuizState, AudienceResultsStore } from '@stageflip/storage';

/**
 * Per-question correctness map. Supplied by the WS dispatcher (which
 * loads the LiveQuizClip's question array from the session's clip data)
 * — the state machine itself is clip-data-agnostic.
 */
export interface QuizQuestion {
  readonly questionId: string;
  readonly correctOptionIndex: number;
}

export interface RecordVoteInput {
  readonly sessionId: string;
  readonly voterTokenHash: string;
  readonly questionId: string;
  readonly optionIndex: number;
  /** Server-computed: `now() - activeQuestionStartedAt`. */
  readonly latencyMs: number;
  /** Per-question timer in ms (read from the LiveQuizClip's data). */
  readonly timerMs: number;
  /** Server's view of the active question at vote time. */
  readonly currentQuestionIndex: number;
  /** Full question array — used to look up `correctOptionIndex`. */
  readonly questions: readonly QuizQuestion[];
}

/**
 * Result returned by `recordVote`. On rejection, `rejectReason` is one of:
 *   - `'late-joiner-lock'` — the voter joined after the active question;
 *     scoring on prior questions is locked out.
 *   - `'unknown-question'` — the supplied `questionId` is not in the
 *     question array.
 *
 * On acceptance, `score` is the score awarded for THIS vote and
 * `totalScore` is the voter's cumulative score after the bump.
 */
export interface RecordVoteResult {
  readonly accepted: boolean;
  readonly rejectReason?: 'late-joiner-lock' | 'unknown-question';
  readonly score?: number;
  readonly totalScore?: number;
}

export interface QuizStateManagerDeps {
  readonly audienceResultsStore: AudienceResultsStore;
  /** ms-since-epoch clock injection per the T-411a pattern. */
  now(): number;
}

/**
 * Server-side quiz state machine. Backed by
 * `AudienceResultsStore.updateQuizState` so that the persisted state
 * survives connection drops + reconnects (the storage layer is the
 * source of truth, not a per-process map).
 */
export class QuizStateManager {
  private readonly store: AudienceResultsStore;
  // Reserved for future use: an injected clock would back a server-side
  // "questionStartedAt" if we ever pulled latency tracking inside this
  // module. Today, `latencyMs` is computed by the caller (the WS
  // dispatcher) and supplied as a `recordVote` input.
  private readonly now: () => number;

  constructor(deps: QuizStateManagerDeps) {
    this.store = deps.audienceResultsStore;
    this.now = deps.now;
  }

  /**
   * Process one live-quiz vote. Looks up the voter's `joinedAt`
   * (initializing to `currentQuestionIndex` on first sight), applies the
   * late-joiner lock, validates the questionId, scores the answer via
   * `computeQuizScore`, and persists the updated `quizState`.
   */
  async recordVote(input: RecordVoteInput): Promise<RecordVoteResult> {
    void this.now; // currently unused; reserved for future expansion
    const question = input.questions.find((q) => q.questionId === input.questionId);
    if (!question) {
      return { accepted: false, rejectReason: 'unknown-question' };
    }

    const snapshot = await this.store.readSnapshot(input.sessionId);
    const currentState: AudienceQuizState =
      snapshot?.quizState ?? emptyQuizState(input.currentQuestionIndex);
    const knownJoinedAt = currentState.joinedAt[input.voterTokenHash];
    const joinedAtQuestionIndex =
      knownJoinedAt !== undefined ? knownJoinedAt : input.currentQuestionIndex;

    const lock = applyLateJoinerLock({
      voterToken: input.voterTokenHash,
      joinedAtQuestionIndex,
      currentQuestionIndex: input.currentQuestionIndex,
    });
    if (!lock.canVote) {
      return { accepted: false, rejectReason: 'late-joiner-lock' };
    }

    const isCorrect = input.optionIndex === question.correctOptionIndex;
    const score = computeQuizScore({
      isCorrect,
      latencyMs: input.latencyMs,
      timerMs: input.timerMs,
    });

    const nextState = await this.store.updateQuizState(input.sessionId, (current) => {
      const base: AudienceQuizState = current ?? emptyQuizState(input.currentQuestionIndex);
      const priorScore = base.scores[input.voterTokenHash] ?? 0;
      const priorJoinedAt = base.joinedAt[input.voterTokenHash];
      return {
        activeQuestionIndex: Math.max(base.activeQuestionIndex, input.currentQuestionIndex),
        scores: {
          ...base.scores,
          [input.voterTokenHash]: priorScore + score,
        },
        joinedAt:
          priorJoinedAt !== undefined
            ? base.joinedAt
            : { ...base.joinedAt, [input.voterTokenHash]: input.currentQuestionIndex },
      };
    });

    return {
      accepted: true,
      score,
      totalScore: nextState.scores[input.voterTokenHash] ?? score,
    };
  }

  /**
   * Bump the session's `activeQuestionIndex` (presenter admin-command —
   * called from the WS dispatcher's `advance` handler).
   */
  async advanceQuestion(sessionId: string, nextIndex: number): Promise<void> {
    await this.store.updateQuizState(sessionId, (current) => {
      if (!current) {
        return { activeQuestionIndex: nextIndex, scores: {}, joinedAt: {} };
      }
      return {
        activeQuestionIndex: nextIndex,
        scores: current.scores,
        joinedAt: current.joinedAt,
      };
    });
  }
}

function emptyQuizState(activeQuestionIndex: number): AudienceQuizState {
  return { activeQuestionIndex, scores: {}, joinedAt: {} };
}
