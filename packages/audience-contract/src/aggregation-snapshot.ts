// packages/audience-contract/src/aggregation-snapshot.ts
// Per-clip-kind aggregation snapshot types. Verbatim from ADR-010 §D3.
// `AggregationValue` is the discriminated union over the eleven
// `AudienceClipKind` discriminants (every kind has a presenter-side
// aggregation shape, including `leaderboard` which is derived-from-quiz).
//
// `AggregationSnapshot` wraps the discriminated payload with the envelope
// fields ADR-009 §D2 specifies (session id, frame number, server timestamp,
// voter count). `FinalSnapshot extends AggregationSnapshot` per ADR-009 §D2
// — the snapshot persisted on `closeSession` is the authoritative export
// bytes; T-460 inlines it into `AudienceProvenance.aggregation`.

import { z } from 'zod';

// ----------------------------------------------------------------------------
// Per-clip-kind aggregation shapes (ADR-010 §D3)
// ----------------------------------------------------------------------------

/** LivePoll (multiple-choice): per-option count + voter total. */
export interface LivePollMultipleChoiceAggregation {
  readonly kind: 'live-poll-multiple-choice';
  readonly optionCounts: readonly number[]; // length === clip.options.length
  readonly totalVotes: number; // sum(optionCounts)
}

/** LivePoll (open-text): top-N submissions by submission order + count. */
export interface LivePollOpenTextAggregation {
  readonly kind: 'live-poll-open-text';
  readonly entries: readonly {
    readonly text: string;
    readonly count: number; // dedup by canonicalized text (lowercase + whitespace-trim)
  }[]; // length ≤ clip.topN (default 50)
  readonly totalVotes: number;
}

/** LivePoll (rating): per-score count + running mean. */
export interface LivePollRatingAggregation {
  readonly kind: 'live-poll-rating';
  readonly scoreCounts: readonly number[]; // length === clip.scaleMax
  readonly totalVotes: number;
  readonly mean: number; // sum(i * scoreCounts[i-1]) / totalVotes; NaN if totalVotes === 0
}

/** LiveQA: question feed sorted by upvote count; per-question metadata. */
export interface LiveQAAggregation {
  readonly kind: 'live-qa';
  readonly questions: readonly {
    readonly id: string;
    readonly text: string;
    readonly upvotes: number;
    readonly submittedAt: string; // ISO 8601 — server-stamped
    readonly answered?: boolean; // presenter / moderator toggle
  }[]; // length ≤ clip.topN (default 100)
  readonly totalQuestions: number;
}

/** LiveQuiz question status. */
export const LIVE_QUIZ_QUESTION_STATUSES = ['pending', 'active', 'closed'] as const;
export type LiveQuizQuestionStatus = (typeof LIVE_QUIZ_QUESTION_STATUSES)[number];

/** LiveQuiz: per-question result + active-question pointer. */
export interface LiveQuizAggregation {
  readonly kind: 'live-quiz';
  readonly activeQuestionId: string | null;
  readonly questionResults: readonly {
    readonly questionId: string;
    readonly optionCounts: readonly number[];
    readonly correctOptionIndex: number;
    readonly totalVotes: number;
    readonly status: LiveQuizQuestionStatus;
  }[];
  readonly totalVoters: number;
}

/** Leaderboard: derived from LiveQuiz; ranked voter list. */
export interface LeaderboardAggregation {
  readonly kind: 'leaderboard';
  readonly quizId: string; // foreign key — LeaderboardClip references a LiveQuizClip
  readonly ranking: readonly {
    readonly voterToken: string; // hashed (per ADR-009 §D5); display name resolved client-side
    readonly displayName?: string; // voter-supplied screen name if present
    readonly score: number;
    readonly rank: number;
  }[]; // length ≤ clip.topN (default 10)
  readonly totalParticipants: number;
}

/** WordCloud: per-word frequency. */
export interface WordCloudAggregation {
  readonly kind: 'word-cloud';
  readonly words: readonly {
    readonly word: string;
    readonly weight: number; // count of occurrences across all voters
  }[]; // length ≤ clip.topN (default 100)
  readonly totalSubmissions: number;
}

/** Survey question type. */
export const SURVEY_QUESTION_TYPES = ['multiple-choice', 'open-text', 'rating'] as const;
export type SurveyQuestionType = (typeof SURVEY_QUESTION_TYPES)[number];

/** Survey: per-question aggregated responses; shape is question-type-specific. */
export interface SurveyAggregation {
  readonly kind: 'survey';
  readonly questionAggregations: readonly {
    readonly questionId: string;
    readonly type: SurveyQuestionType;
    readonly aggregation:
      | LivePollMultipleChoiceAggregation
      | LivePollOpenTextAggregation
      | LivePollRatingAggregation;
  }[];
  readonly totalResponses: number;
}

/** Heatmap: dense (x, y, intensity) array — rasterized client-side. */
export interface HeatmapAggregation {
  readonly kind: 'heatmap';
  readonly taps: readonly {
    readonly x: number; // 0..1 normalized
    readonly y: number;
    readonly intensity: number;
  }[]; // length unbounded within snapshot (per-snapshot capped by snapshot size policy)
  readonly totalTaps: number;
  readonly gridResolution: { readonly w: number; readonly h: number }; // raster grid for client-side downsampling
}

/** ReactionStream: per-emoji count + recent-burst counts for animation timing. */
export interface ReactionStreamAggregation {
  readonly kind: 'reaction-stream';
  readonly emojiCounts: readonly {
    readonly emojiId: string;
    readonly count: number; // lifetime count this session
    readonly recentBurst: number; // count in last 1 s — drives particle-storm density
  }[];
  readonly totalReactions: number;
}

/** AudienceAiPrompt: prompt feed + winner. */
export interface AudienceAiPromptAggregation {
  readonly kind: 'audience-ai-prompt';
  readonly prompts: readonly {
    readonly id: string;
    readonly text: string;
    readonly upvotes: number;
  }[]; // length ≤ clip.topN (default 20)
  readonly winnerPromptId: string | null;
  readonly generatedAssetCacheKey: string | null; // points to P14 asset-gen cache (ADR-008 §D1 / §D2)
}

/**
 * Discriminated union over the eleven `AudienceClipKind` discriminants.
 * Per ADR-010 §D3. Every kind admits a presenter-side aggregation shape,
 * including `leaderboard` (derived from the parent quiz).
 */
export type AggregationValue =
  | LivePollMultipleChoiceAggregation
  | LivePollOpenTextAggregation
  | LivePollRatingAggregation
  | LiveQAAggregation
  | LiveQuizAggregation
  | LeaderboardAggregation
  | WordCloudAggregation
  | SurveyAggregation
  | HeatmapAggregation
  | ReactionStreamAggregation
  | AudienceAiPromptAggregation;

// ----------------------------------------------------------------------------
// Zod schemas
// ----------------------------------------------------------------------------

const livePollMultipleChoiceAggregationSchema = z
  .object({
    kind: z.literal('live-poll-multiple-choice'),
    optionCounts: z.array(z.number().int().nonnegative()).min(1).readonly(),
    totalVotes: z.number().int().nonnegative(),
  })
  .strict();

const livePollOpenTextAggregationSchema = z
  .object({
    kind: z.literal('live-poll-open-text'),
    entries: z
      .array(
        z
          .object({
            text: z.string().min(1),
            count: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .readonly(),
    totalVotes: z.number().int().nonnegative(),
  })
  .strict();

const livePollRatingAggregationSchema = z
  .object({
    kind: z.literal('live-poll-rating'),
    scoreCounts: z.array(z.number().int().nonnegative()).min(1).readonly(),
    totalVotes: z.number().int().nonnegative(),
    // `mean === NaN` is admitted per ADR-010 §D3: "NaN if totalVotes === 0".
    mean: z.union([z.number(), z.nan()]),
  })
  .strict();

const liveQAAggregationSchema = z
  .object({
    kind: z.literal('live-qa'),
    questions: z
      .array(
        z
          .object({
            id: z.string().min(1),
            text: z.string().min(1),
            upvotes: z.number().int().nonnegative(),
            submittedAt: z.string().min(1),
            answered: z.boolean().optional(),
          })
          .strict(),
      )
      .readonly(),
    totalQuestions: z.number().int().nonnegative(),
  })
  .strict();

const liveQuizAggregationSchema = z
  .object({
    kind: z.literal('live-quiz'),
    activeQuestionId: z.string().min(1).nullable(),
    questionResults: z
      .array(
        z
          .object({
            questionId: z.string().min(1),
            optionCounts: z.array(z.number().int().nonnegative()).min(1).readonly(),
            correctOptionIndex: z.number().int().nonnegative(),
            totalVotes: z.number().int().nonnegative(),
            status: z.enum(LIVE_QUIZ_QUESTION_STATUSES),
          })
          .strict(),
      )
      .readonly(),
    totalVoters: z.number().int().nonnegative(),
  })
  .strict();

const leaderboardAggregationSchema = z
  .object({
    kind: z.literal('leaderboard'),
    quizId: z.string().min(1),
    ranking: z
      .array(
        z
          .object({
            voterToken: z.string().min(1),
            displayName: z.string().min(1).optional(),
            score: z.number(),
            rank: z.number().int().positive(),
          })
          .strict(),
      )
      .readonly(),
    totalParticipants: z.number().int().nonnegative(),
  })
  .strict();

const wordCloudAggregationSchema = z
  .object({
    kind: z.literal('word-cloud'),
    words: z
      .array(
        z
          .object({
            word: z.string().min(1),
            weight: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .readonly(),
    totalSubmissions: z.number().int().nonnegative(),
  })
  .strict();

const surveyInnerAggregationSchema = z.discriminatedUnion('kind', [
  livePollMultipleChoiceAggregationSchema,
  livePollOpenTextAggregationSchema,
  livePollRatingAggregationSchema,
]);

const surveyAggregationSchema = z
  .object({
    kind: z.literal('survey'),
    questionAggregations: z
      .array(
        z
          .object({
            questionId: z.string().min(1),
            type: z.enum(SURVEY_QUESTION_TYPES),
            aggregation: surveyInnerAggregationSchema,
          })
          .strict(),
      )
      .readonly(),
    totalResponses: z.number().int().nonnegative(),
  })
  .strict();

const heatmapAggregationSchema = z
  .object({
    kind: z.literal('heatmap'),
    taps: z
      .array(
        z
          .object({
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            intensity: z.number().positive(),
          })
          .strict(),
      )
      .readonly(),
    totalTaps: z.number().int().nonnegative(),
    gridResolution: z
      .object({
        w: z.number().int().positive(),
        h: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

const reactionStreamAggregationSchema = z
  .object({
    kind: z.literal('reaction-stream'),
    emojiCounts: z
      .array(
        z
          .object({
            emojiId: z.string().min(1),
            count: z.number().int().nonnegative(),
            recentBurst: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .readonly(),
    totalReactions: z.number().int().nonnegative(),
  })
  .strict();

const audienceAiPromptAggregationSchema = z
  .object({
    kind: z.literal('audience-ai-prompt'),
    prompts: z
      .array(
        z
          .object({
            id: z.string().min(1),
            text: z.string().min(1),
            upvotes: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .readonly(),
    winnerPromptId: z.string().min(1).nullable(),
    generatedAssetCacheKey: z.string().min(1).nullable(),
  })
  .strict();

/**
 * Discriminated-union Zod schema for `AggregationValue` per ADR-010 §D3.
 * Covers all eleven `AudienceClipKind` discriminants.
 */
export const aggregationValueSchema = z.discriminatedUnion('kind', [
  livePollMultipleChoiceAggregationSchema,
  livePollOpenTextAggregationSchema,
  livePollRatingAggregationSchema,
  liveQAAggregationSchema,
  liveQuizAggregationSchema,
  leaderboardAggregationSchema,
  wordCloudAggregationSchema,
  surveyAggregationSchema,
  heatmapAggregationSchema,
  reactionStreamAggregationSchema,
  audienceAiPromptAggregationSchema,
]);

// ----------------------------------------------------------------------------
// Snapshot envelope (ADR-009 §D2)
// ----------------------------------------------------------------------------

/**
 * Aggregation snapshot envelope. Per ADR-009 §D2.
 *
 * Wraps the discriminated `aggregation` payload with the session id, frame
 * number, server timestamp, and voter count. The backend emits snapshots on
 * the `subscribe()` stream at the cadence declared by
 * `AudienceCapabilityDescriptor.snapshotCadenceHz`.
 */
export interface AggregationSnapshot {
  readonly sessionId: string;
  readonly frameNo: number;
  readonly serverTimestamp: string; // ISO 8601
  readonly voterCount: number;
  /** Clip-kind-specific aggregation shape; discriminated by `kind`. */
  readonly aggregation: AggregationValue;
}

/**
 * Final snapshot returned by `closeSession`. Per ADR-009 §D2.
 *
 * Extends `AggregationSnapshot` with `closedAt` + `snapshotFrame` — this is
 * the authoritative export bytes the `staticFallback` path consumes and the
 * frame number `AudienceProvenance.snapshotFrame` references.
 */
export interface FinalSnapshot extends AggregationSnapshot {
  readonly closedAt: string; // ISO 8601
  readonly snapshotFrame: number; // surfaces into AudienceProvenance.snapshotFrame per ADR-010 §D5
}

export const aggregationSnapshotSchema = z
  .object({
    sessionId: z.string().min(1),
    frameNo: z.number().int().nonnegative(),
    serverTimestamp: z.string().min(1),
    voterCount: z.number().int().nonnegative(),
    aggregation: aggregationValueSchema,
  })
  .strict();

export const finalSnapshotSchema = z
  .object({
    sessionId: z.string().min(1),
    frameNo: z.number().int().nonnegative(),
    serverTimestamp: z.string().min(1),
    voterCount: z.number().int().nonnegative(),
    aggregation: aggregationValueSchema,
    closedAt: z.string().min(1),
    snapshotFrame: z.number().int().nonnegative(),
  })
  .strict();

/** Aggregation kinds; matches `AudienceClipKind` verbatim. */
export const AGGREGATION_KINDS = [
  'live-poll-multiple-choice',
  'live-poll-open-text',
  'live-poll-rating',
  'live-qa',
  'live-quiz',
  'leaderboard',
  'word-cloud',
  'survey',
  'heatmap',
  'reaction-stream',
  'audience-ai-prompt',
] as const satisfies readonly AggregationValue['kind'][];

export type AggregationKind = (typeof AGGREGATION_KINDS)[number];
