// packages/audience-contract/src/vote-payload.test.ts
// VotePayload tests — round-trip every discriminant; reject leaderboard;
// reject malformed per-kind shapes.

import { describe, expect, it } from 'vitest';

import { VOTE_PAYLOAD_KINDS, type VotePayload, votePayloadSchema } from './vote-payload.js';

describe('VOTE_PAYLOAD_KINDS', () => {
  it('has ten entries — eleven AudienceClipKinds minus leaderboard', () => {
    expect(VOTE_PAYLOAD_KINDS).toHaveLength(10);
    expect(VOTE_PAYLOAD_KINDS).not.toContain('leaderboard');
  });

  it('matches ADR-010 §D2 verbatim (alphabetical-by-section)', () => {
    expect(VOTE_PAYLOAD_KINDS).toEqual([
      'live-poll-multiple-choice',
      'live-poll-open-text',
      'live-poll-rating',
      'live-qa',
      'live-quiz',
      'word-cloud',
      'survey',
      'heatmap',
      'reaction-stream',
      'audience-ai-prompt',
    ]);
  });
});

describe('votePayloadSchema', () => {
  const samples: Record<(typeof VOTE_PAYLOAD_KINDS)[number], VotePayload> = {
    'live-poll-multiple-choice': { kind: 'live-poll-multiple-choice', optionIndex: 1 },
    'live-poll-open-text': { kind: 'live-poll-open-text', text: 'hello' },
    'live-poll-rating': { kind: 'live-poll-rating', score: 4 },
    'live-qa': { kind: 'live-qa', action: 'submit', text: 'what time is it?' },
    'live-quiz': { kind: 'live-quiz', questionId: 'q-1', optionIndex: 2 },
    'word-cloud': { kind: 'word-cloud', words: ['focus'] },
    survey: {
      kind: 'survey',
      responses: [{ questionId: 'q-1', value: 'green' }],
    },
    heatmap: { kind: 'heatmap', x: 0.5, y: 0.5 },
    'reaction-stream': { kind: 'reaction-stream', emojiId: 'heart' },
    'audience-ai-prompt': {
      kind: 'audience-ai-prompt',
      action: 'submit',
      text: 'a cat in a hat',
    },
  };

  for (const kind of VOTE_PAYLOAD_KINDS) {
    it(`round-trips the ${kind} discriminant`, () => {
      const parsed = votePayloadSchema.parse(samples[kind]);
      expect(parsed.kind).toBe(kind);
    });
  }

  it('admits heatmap with explicit intensity', () => {
    const parsed = votePayloadSchema.parse({
      kind: 'heatmap',
      x: 0.1,
      y: 0.2,
      intensity: 5,
    });
    if (parsed.kind === 'heatmap') {
      expect(parsed.intensity).toBe(5);
    }
  });

  it('admits live-qa upvote shape', () => {
    const parsed = votePayloadSchema.parse({
      kind: 'live-qa',
      action: 'upvote',
      questionId: 'q-42',
    });
    expect(parsed.kind).toBe('live-qa');
  });

  it('admits survey with mixed response value types', () => {
    const parsed = votePayloadSchema.parse({
      kind: 'survey',
      responses: [
        { questionId: 'q-1', value: 'text-answer' },
        { questionId: 'q-2', value: 7 },
        { questionId: 'q-3', value: ['a', 'b'] },
      ],
    });
    if (parsed.kind === 'survey') {
      expect(parsed.responses).toHaveLength(3);
    }
  });

  it('rejects leaderboard discriminant (derived clip per ADR-010 §D2)', () => {
    expect(() => votePayloadSchema.parse({ kind: 'leaderboard', anything: true })).toThrow();
  });

  it('rejects heatmap x out of [0, 1]', () => {
    expect(() => votePayloadSchema.parse({ kind: 'heatmap', x: 1.5, y: 0.2 })).toThrow();
  });

  it('rejects heatmap y out of [0, 1]', () => {
    expect(() => votePayloadSchema.parse({ kind: 'heatmap', x: 0.2, y: -0.1 })).toThrow();
  });

  it('rejects live-poll-multiple-choice with negative optionIndex', () => {
    expect(() =>
      votePayloadSchema.parse({ kind: 'live-poll-multiple-choice', optionIndex: -1 }),
    ).toThrow();
  });

  it('rejects live-poll-rating with non-positive score', () => {
    expect(() => votePayloadSchema.parse({ kind: 'live-poll-rating', score: 0 })).toThrow();
  });

  it('rejects empty word-cloud words array', () => {
    expect(() => votePayloadSchema.parse({ kind: 'word-cloud', words: [] })).toThrow();
  });

  it('rejects unknown top-level fields per kind (strict)', () => {
    expect(() =>
      votePayloadSchema.parse({
        kind: 'live-poll-multiple-choice',
        optionIndex: 0,
        extra: 'nope',
      }),
    ).toThrow();
  });
});
