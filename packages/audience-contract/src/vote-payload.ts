// packages/audience-contract/src/vote-payload.ts
// Per-clip-kind `VotePayload` discriminated union. Verbatim from ADR-010 §D2.
// Discriminated by `kind: AudienceClipKind`; each variant declares its
// `value` shape. The `leaderboard` discriminant has no member here: per
// ADR-010 §D2 a LeaderboardClip is derived from a LiveQuizClip, voters do
// not submit directly. Consumers (T-453) refuse `submitVote` calls with
// `payload.kind === 'leaderboard'`.

import { z } from 'zod';

// ----------------------------------------------------------------------------
// Per-clip-kind vote shapes (ADR-010 §D2)
// ----------------------------------------------------------------------------

/** LivePoll (multiple-choice): voter selects one of N options. */
export interface LivePollMultipleChoiceVote {
  readonly kind: 'live-poll-multiple-choice';
  readonly optionIndex: number; // 0..(options.length - 1)
}

/** LivePoll (open-text): voter submits a free-text string. */
export interface LivePollOpenTextVote {
  readonly kind: 'live-poll-open-text';
  readonly text: string; // length ≤ clip.maxLength (default 280)
}

/** LivePoll (rating): voter submits a Likert score. */
export interface LivePollRatingVote {
  readonly kind: 'live-poll-rating';
  readonly score: number; // 1..clip.scaleMax (default 5)
}

/** LiveQA: voter submits a question or upvotes an existing one. */
export interface LiveQAVote {
  readonly kind: 'live-qa';
  readonly action: 'submit' | 'upvote';
  readonly text?: string; // present when action === 'submit'; length ≤ 500
  readonly questionId?: string; // present when action === 'upvote'
}

/** LiveQuiz: voter selects an answer; server records latency for time-bonus scoring (T-473). */
export interface LiveQuizVote {
  readonly kind: 'live-quiz';
  readonly questionId: string;
  readonly optionIndex: number; // 0..(question.options.length - 1)
}

/** WordCloud: voter submits one or more words. */
export interface WordCloudVote {
  readonly kind: 'word-cloud';
  readonly words: readonly string[]; // length ≤ clip.maxWordsPerVoter (default 3); per-word length ≤ 32
}

/** Per-question survey response value. */
export type SurveyVoteResponseValue = string | number | readonly string[];

/** Survey: voter submits a multi-question response. */
export interface SurveyVote {
  readonly kind: 'survey';
  readonly responses: readonly {
    readonly questionId: string;
    readonly value: SurveyVoteResponseValue;
  }[];
}

/** Heatmap: voter taps an (x, y) coordinate; intensity defaults to 1 (single tap). */
export interface HeatmapVote {
  readonly kind: 'heatmap';
  readonly x: number; // 0..1 normalized to underlying image
  readonly y: number; // 0..1 normalized to underlying image
  readonly intensity?: number; // 1..clip.maxIntensity (default 1; multi-tap accumulates)
}

/** ReactionStream: voter selects an emoji (per the clip's curated palette). */
export interface ReactionStreamVote {
  readonly kind: 'reaction-stream';
  readonly emojiId: string; // e.g., 'heart', 'thumbs-up', 'fire' — from clip.palette
}

/** AudienceAiPrompt: voter submits a prompt (or votes on a shortlisted prompt). */
export interface AudienceAiPromptVote {
  readonly kind: 'audience-ai-prompt';
  readonly action: 'submit' | 'upvote';
  readonly text?: string; // present when action === 'submit'; length ≤ 200
  readonly promptId?: string; // present when action === 'upvote'
}

/**
 * Discriminated union of voter-side payloads per ADR-010 §D2.
 *
 * Note: there is intentionally NO `leaderboard` variant. LeaderboardClip is
 * server-derived from the parent LiveQuizClip's aggregation stream — voters
 * do not submit directly. The routing engine refuses
 * `submitVote({ payload: { kind: 'leaderboard', ... } })`. Type-level: the
 * union excludes the discriminant; the audience clip kind enum still
 * includes it (the kind is observable on aggregation snapshots).
 */
export type VotePayload =
  | LivePollMultipleChoiceVote
  | LivePollOpenTextVote
  | LivePollRatingVote
  | LiveQAVote
  | LiveQuizVote
  | WordCloudVote
  | SurveyVote
  | HeatmapVote
  | ReactionStreamVote
  | AudienceAiPromptVote;

// ----------------------------------------------------------------------------
// Zod schemas
// ----------------------------------------------------------------------------

const livePollMultipleChoiceVoteSchema = z
  .object({
    kind: z.literal('live-poll-multiple-choice'),
    optionIndex: z.number().int().nonnegative(),
  })
  .strict();

const livePollOpenTextVoteSchema = z
  .object({
    kind: z.literal('live-poll-open-text'),
    text: z.string().min(1),
  })
  .strict();

const livePollRatingVoteSchema = z
  .object({
    kind: z.literal('live-poll-rating'),
    score: z.number().int().positive(),
  })
  .strict();

const liveQAVoteSchema = z
  .object({
    kind: z.literal('live-qa'),
    action: z.enum(['submit', 'upvote']),
    text: z.string().min(1).optional(),
    questionId: z.string().min(1).optional(),
  })
  .strict();

const liveQuizVoteSchema = z
  .object({
    kind: z.literal('live-quiz'),
    questionId: z.string().min(1),
    optionIndex: z.number().int().nonnegative(),
  })
  .strict();

const wordCloudVoteSchema = z
  .object({
    kind: z.literal('word-cloud'),
    words: z.array(z.string().min(1)).min(1).readonly(),
  })
  .strict();

const surveyVoteResponseValueSchema: z.ZodType<SurveyVoteResponseValue> = z.union([
  z.string(),
  z.number(),
  z.array(z.string()).readonly(),
]);

const surveyVoteSchema = z
  .object({
    kind: z.literal('survey'),
    responses: z
      .array(
        z
          .object({
            questionId: z.string().min(1),
            value: surveyVoteResponseValueSchema,
          })
          .strict(),
      )
      .min(1)
      .readonly(),
  })
  .strict();

const heatmapVoteSchema = z
  .object({
    kind: z.literal('heatmap'),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    intensity: z.number().positive().optional(),
  })
  .strict();

const reactionStreamVoteSchema = z
  .object({
    kind: z.literal('reaction-stream'),
    emojiId: z.string().min(1),
  })
  .strict();

const audienceAiPromptVoteSchema = z
  .object({
    kind: z.literal('audience-ai-prompt'),
    action: z.enum(['submit', 'upvote']),
    text: z.string().min(1).optional(),
    promptId: z.string().min(1).optional(),
  })
  .strict();

/**
 * Discriminated-union Zod schema for `VotePayload` per ADR-010 §D2.
 * Excludes the `leaderboard` discriminant (derived clip; see TSDoc on
 * `VotePayload`).
 */
export const votePayloadSchema = z.discriminatedUnion('kind', [
  livePollMultipleChoiceVoteSchema,
  livePollOpenTextVoteSchema,
  livePollRatingVoteSchema,
  liveQAVoteSchema,
  liveQuizVoteSchema,
  wordCloudVoteSchema,
  surveyVoteSchema,
  heatmapVoteSchema,
  reactionStreamVoteSchema,
  audienceAiPromptVoteSchema,
]);

/**
 * Discriminator kinds that admit a `VotePayload`. Used by routing-side guards.
 * Excludes `leaderboard` per the §D2 derived-clip invariant.
 */
export const VOTE_PAYLOAD_KINDS = [
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
] as const satisfies readonly VotePayload['kind'][];

export type VotePayloadKind = (typeof VOTE_PAYLOAD_KINDS)[number];
