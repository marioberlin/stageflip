// apps/api/src/routes/audience-quiz-state.test.ts
// T-473 — Tests for the quiz state machine. Covers:
//   - First-vote initialization of `joinedAtQuestionIndex`
//   - Score accumulation across multiple correct answers
//   - Late-joiner reject path (currentQuestionIndex < joinedAtQuestionIndex)
//   - Disconnect/reconnect — voter's prior score survives a fresh recordVote
//   - Unknown questionId rejected with a stable reason
//   - advanceQuestion bumps the activeQuestionIndex

import { describe, expect, it } from 'vitest';

import { InMemoryAudienceResultsStore } from '@stageflip/storage';

import { type QuizQuestion, QuizStateManager } from './audience-quiz-state.js';

const SESSION_ID = '01J0AB3F8R3RTKZQ9X4HMRZQAY';
const PEPPER = 'test-pepper-32-bytes-fixed-value-x';

const QUESTIONS: readonly QuizQuestion[] = [
  { questionId: 'q-0', correctOptionIndex: 0 },
  { questionId: 'q-1', correctOptionIndex: 1 },
  { questionId: 'q-2', correctOptionIndex: 2 },
];

async function seed(): Promise<InMemoryAudienceResultsStore> {
  const store = new InMemoryAudienceResultsStore({ pepper: PEPPER });
  await store.openSession({
    tenantId: 'tenant-a',
    projectId: 'project-a',
    sessionId: SESSION_ID,
    clipKind: 'live-quiz',
    adapterDescriptor: { id: 'audience-native', license: 'MIT' },
    createdAt: '2026-05-11T00:00:00.000Z',
    ttlAt: '2026-05-12T00:00:00.000Z',
  });
  return store;
}

function makeManager(store: InMemoryAudienceResultsStore): QuizStateManager {
  return new QuizStateManager({
    audienceResultsStore: store,
    now: () => 1_000_000,
  });
}

describe('QuizStateManager.recordVote — happy paths', () => {
  it('accepts a correct first-question vote at zero latency (1000 points)', async () => {
    const store = await seed();
    const mgr = makeManager(store);
    const result = await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-hash-a',
      questionId: 'q-0',
      optionIndex: 0,
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 0,
      questions: QUESTIONS,
    });
    expect(result).toEqual({ accepted: true, score: 1000, totalScore: 1000 });
  });

  it('accumulates scores across correct answers (1000 + 750 = 1750)', async () => {
    const store = await seed();
    const mgr = makeManager(store);
    await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-hash-a',
      questionId: 'q-0',
      optionIndex: 0,
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 0,
      questions: QUESTIONS,
    });
    const second = await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-hash-a',
      questionId: 'q-1',
      optionIndex: 1,
      latencyMs: 5_000,
      timerMs: 10_000,
      currentQuestionIndex: 1,
      questions: QUESTIONS,
    });
    expect(second).toEqual({ accepted: true, score: 750, totalScore: 1750 });
  });

  it('records 0 for an incorrect answer but still admits the vote', async () => {
    const store = await seed();
    const mgr = makeManager(store);
    const result = await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-hash-a',
      questionId: 'q-0',
      optionIndex: 1, // wrong (correct = 0)
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 0,
      questions: QUESTIONS,
    });
    expect(result).toEqual({ accepted: true, score: 0, totalScore: 0 });
  });

  it('records 0 for a past-timer answer', async () => {
    const store = await seed();
    const mgr = makeManager(store);
    const result = await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-hash-a',
      questionId: 'q-0',
      optionIndex: 0,
      latencyMs: 11_000,
      timerMs: 10_000,
      currentQuestionIndex: 0,
      questions: QUESTIONS,
    });
    expect(result).toEqual({ accepted: true, score: 0, totalScore: 0 });
  });

  it('initializes joinedAtQuestionIndex from currentQuestionIndex on first vote', async () => {
    const store = await seed();
    const mgr = makeManager(store);
    // Voter's first encounter is question 2 → joined-at=2.
    await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-late',
      questionId: 'q-2',
      optionIndex: 2,
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 2,
      questions: QUESTIONS,
    });
    const snap = await store.readSnapshot(SESSION_ID);
    expect(snap?.quizState?.joinedAt['voter-late']).toBe(2);
  });
});

describe('QuizStateManager.recordVote — late-joiner lock', () => {
  it('rejects a vote when the session has rewound (currentQuestionIndex < joinedAtQuestionIndex)', async () => {
    const store = await seed();
    const mgr = makeManager(store);
    // First vote at question 3 → joined-at=3.
    await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-rewind',
      questionId: 'q-2',
      optionIndex: 2,
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 3,
      questions: QUESTIONS,
    });
    // A subsequent vote at question 1 — invariant violation; reject.
    const reject = await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-rewind',
      questionId: 'q-1',
      optionIndex: 1,
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 1,
      questions: QUESTIONS,
    });
    expect(reject.accepted).toBe(false);
    expect(reject.rejectReason).toBe('late-joiner-lock');
  });

  it('does NOT modify scores when the late-joiner lock rejects', async () => {
    const store = await seed();
    const mgr = makeManager(store);
    await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-rewind',
      questionId: 'q-2',
      optionIndex: 2,
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 3,
      questions: QUESTIONS,
    });
    const before = await store.readSnapshot(SESSION_ID);
    const beforeScore = before?.quizState?.scores['voter-rewind'] ?? 0;
    await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-rewind',
      questionId: 'q-1',
      optionIndex: 1,
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 1,
      questions: QUESTIONS,
    });
    const after = await store.readSnapshot(SESSION_ID);
    expect(after?.quizState?.scores['voter-rewind']).toBe(beforeScore);
  });
});

describe('QuizStateManager.recordVote — disconnect/reconnect preservation', () => {
  it('preserves the voter score across a fresh recordVote call (simulating reconnect)', async () => {
    const store = await seed();
    const mgr1 = makeManager(store);
    await mgr1.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-reconnect',
      questionId: 'q-0',
      optionIndex: 0,
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 0,
      questions: QUESTIONS,
    });
    // Simulate the voter dropping + reconnecting: fresh manager instance,
    // but it reads the same store. The voter's joinedAt + cumulative
    // score must round-trip.
    const mgr2 = makeManager(store);
    const result = await mgr2.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-reconnect',
      questionId: 'q-1',
      optionIndex: 1,
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 1,
      questions: QUESTIONS,
    });
    expect(result).toEqual({ accepted: true, score: 1000, totalScore: 2000 });
  });
});

describe('QuizStateManager.recordVote — unknown question', () => {
  it('rejects a vote on an unknown questionId', async () => {
    const store = await seed();
    const mgr = makeManager(store);
    const result = await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-a',
      questionId: 'not-a-real-question',
      optionIndex: 0,
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 0,
      questions: QUESTIONS,
    });
    expect(result.accepted).toBe(false);
    expect(result.rejectReason).toBe('unknown-question');
  });
});

describe('QuizStateManager.advanceQuestion', () => {
  it('bumps the activeQuestionIndex', async () => {
    const store = await seed();
    const mgr = makeManager(store);
    await mgr.advanceQuestion(SESSION_ID, 1);
    const snap = await store.readSnapshot(SESSION_ID);
    expect(snap?.quizState?.activeQuestionIndex).toBe(1);
  });

  it('initializes empty scores + joinedAt maps on first advance', async () => {
    const store = await seed();
    const mgr = makeManager(store);
    await mgr.advanceQuestion(SESSION_ID, 0);
    const snap = await store.readSnapshot(SESSION_ID);
    expect(snap?.quizState).toEqual({ activeQuestionIndex: 0, scores: {}, joinedAt: {} });
  });

  it('preserves scores + joinedAt across advances', async () => {
    const store = await seed();
    const mgr = makeManager(store);
    await mgr.recordVote({
      sessionId: SESSION_ID,
      voterTokenHash: 'voter-a',
      questionId: 'q-0',
      optionIndex: 0,
      latencyMs: 0,
      timerMs: 10_000,
      currentQuestionIndex: 0,
      questions: QUESTIONS,
    });
    await mgr.advanceQuestion(SESSION_ID, 1);
    const snap = await store.readSnapshot(SESSION_ID);
    expect(snap?.quizState).toEqual({
      activeQuestionIndex: 1,
      scores: { 'voter-a': 1000 },
      joinedAt: { 'voter-a': 0 },
    });
  });
});
