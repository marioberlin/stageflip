// packages/engine/src/handlers/audience-engagement/handlers.ts
// `audience-engagement` bundle — 11 read-only composer tools that emit a
// per-kind audience clip brief as `(presetId, clipKind, props)`. Tools:
// compose_live_poll_multiple_choice / compose_live_poll_open_text /
// compose_live_poll_rating / compose_live_qa / compose_live_quiz /
// compose_leaderboard / compose_word_cloud / compose_survey /
// compose_heatmap / compose_reaction_stream / compose_audience_ai_prompt.
// The caller mounts the chosen clip via a separate write-tier tool
// (`add_clip` from `create-mutate`).
//
// Per T-379 / D-T379-2: handlers declare `ToolContext` (NOT
// `MutationContext`); they neither read nor mutate the document and
// dispatch is a pure function of input. The determinism gate at
// `CLAUDE.md` §3 covers `packages/runtimes/**` /
// `packages/frame-runtime/**` / `packages/renderer-core/src/clips/**`
// only — composer paths are out of its globs. The handlers are still
// pure (no `Date.now()`, no `Math.random()`, no I/O) by code-review
// discipline.
//
// Per ADR-010 §D2: `LeaderboardVote = never` — the leaderboard clip is
// derived from a referenced `live-quiz` clip's aggregation; the compose
// tool's input must NOT include any vote payload — only
// `{ dataSourceClipId, topN? }`.
//
// Per spec T-457: every handler returns `presetId: undefined` until
// Cluster I (T-486) ratifies the per-kind preset table; downstream
// `add_clip` accepts the triple and the runtime dispatches by
// `clipKind`.

import { AUDIENCE_CLIP_KINDS, type AudienceClipKind } from '@stageflip/audience-contract';
import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { ToolContext, ToolHandler } from '../../router/types.js';

export const AUDIENCE_ENGAGEMENT_BUNDLE_NAME = 'audience-engagement';

// Re-export the canonical eleven discriminants so callers + tests can
// pin against the contract package without an extra import.
export { AUDIENCE_CLIP_KINDS };
export type { AudienceClipKind };

// ---------------------------------------------------------------------------
// Common output shape
// ---------------------------------------------------------------------------

/**
 * Output shape every `compose_audience_*` handler returns. `presetId`
 * is `undefined` until Cluster I (T-486) ratifies presets; downstream
 * `add_clip` accepts the triple and the runtime dispatches by
 * `clipKind`. Discriminated by `clipKind` — every tool fixes its
 * `clipKind` literal.
 */
export interface AudienceComposeResult<TKind extends AudienceClipKind = AudienceClipKind> {
  readonly presetId: string | undefined;
  readonly clipKind: TKind;
  readonly props: Record<string, unknown>;
}

const composeOutputBase = z
  .object({
    presetId: z.string().min(1).optional(),
    clipKind: z.enum(AUDIENCE_CLIP_KINDS),
    props: z.record(z.unknown()),
  })
  .strict();

function buildOutput<TKind extends AudienceClipKind>(
  clipKind: TKind,
  props: Record<string, unknown>,
): AudienceComposeResult<TKind> {
  // presetId intentionally omitted (=== undefined) until T-486.
  return { presetId: undefined, clipKind, props };
}

// ---------------------------------------------------------------------------
// 1 — compose_live_poll_multiple_choice
// ---------------------------------------------------------------------------

const composeLivePollMcInput = z
  .object({
    question: z.string().min(1).max(280),
    options: z.array(z.string().min(1).max(120)).min(2).max(10),
  })
  .strict();

type ComposeLivePollMcInput = z.infer<typeof composeLivePollMcInput>;

/**
 * `compose_live_poll_multiple_choice` — emit a `live-poll-multiple-choice`
 * clip brief from `{ question, options[2..10] }`. Per ADR-010 §D2 the
 * voter casts a single discrete `optionIndex`; the renderer aggregates
 * into per-option counts.
 */
const composeLivePollMc: ToolHandler<
  ComposeLivePollMcInput,
  AudienceComposeResult<'live-poll-multiple-choice'>,
  ToolContext
> = {
  name: 'compose_live_poll_multiple_choice',
  bundle: AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  description:
    'Compose a Live Audience multiple-choice-poll brief: `{ question (1..280 chars), options[2..10] }` → emit `(presetId?, clipKind: live-poll-multiple-choice, props)`. Voters cast a single discrete `optionIndex` (ADR-010 §D2); the runtime aggregates into per-option counts. Read-only: caller mounts the clip via a separate write-tier tool (add_clip from create-mutate). presetId is undefined until Cluster I (T-486) ratifies presets.',
  inputSchema: composeLivePollMcInput as unknown as z.ZodType<ComposeLivePollMcInput>,
  outputSchema: composeOutputBase as unknown as z.ZodType<
    AudienceComposeResult<'live-poll-multiple-choice'>
  >,
  handle: (input, _ctx) =>
    buildOutput('live-poll-multiple-choice', {
      question: input.question,
      options: input.options,
    }),
};

// ---------------------------------------------------------------------------
// 2 — compose_live_poll_open_text
// ---------------------------------------------------------------------------

const composeLivePollOpenTextInput = z
  .object({
    question: z.string().min(1).max(280),
    maxLength: z.number().int().min(1).max(2000).optional(),
  })
  .strict();

type ComposeLivePollOpenTextInput = z.infer<typeof composeLivePollOpenTextInput>;

/**
 * `compose_live_poll_open_text` — emit a `live-poll-open-text` clip
 * brief from `{ question, maxLength? }`. Per ADR-010 §D2 the voter
 * submits a free-text response (max-length-bounded); the runtime shows
 * a moderated stream + (optional) word-cloud-style aggregation.
 */
const composeLivePollOpenText: ToolHandler<
  ComposeLivePollOpenTextInput,
  AudienceComposeResult<'live-poll-open-text'>,
  ToolContext
> = {
  name: 'compose_live_poll_open_text',
  bundle: AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  description:
    'Compose a Live Audience open-text-poll brief: `{ question (1..280 chars), maxLength? (1..2000) }` → emit `(presetId?, clipKind: live-poll-open-text, props)`. Voters submit free-text responses bounded by `maxLength` (default enforced at the runtime layer); the runtime renders a moderated stream (ADR-010 §D2). Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.',
  inputSchema: composeLivePollOpenTextInput as unknown as z.ZodType<ComposeLivePollOpenTextInput>,
  outputSchema: composeOutputBase as unknown as z.ZodType<
    AudienceComposeResult<'live-poll-open-text'>
  >,
  handle: (input, _ctx) =>
    buildOutput('live-poll-open-text', {
      question: input.question,
      ...(input.maxLength !== undefined ? { maxLength: input.maxLength } : {}),
    }),
};

// ---------------------------------------------------------------------------
// 3 — compose_live_poll_rating
// ---------------------------------------------------------------------------

const composeLivePollRatingInput = z
  .object({
    question: z.string().min(1).max(280),
    scaleMin: z.number().int(),
    scaleMax: z.number().int(),
  })
  .strict()
  .refine((v) => v.scaleMax > v.scaleMin, {
    message: 'scaleMax must be greater than scaleMin',
    path: ['scaleMax'],
  });

type ComposeLivePollRatingInput = z.infer<typeof composeLivePollRatingInput>;

/**
 * `compose_live_poll_rating` — emit a `live-poll-rating` clip brief
 * from `{ question, scaleMin, scaleMax }`. Per ADR-010 §D2 the voter
 * casts an integer rating in `[scaleMin, scaleMax]`; the runtime
 * aggregates into mean / histogram.
 */
const composeLivePollRating: ToolHandler<
  ComposeLivePollRatingInput,
  AudienceComposeResult<'live-poll-rating'>,
  ToolContext
> = {
  name: 'compose_live_poll_rating',
  bundle: AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  description:
    'Compose a Live Audience rating-poll brief: `{ question (1..280 chars), scaleMin (int), scaleMax (int > scaleMin) }` → emit `(presetId?, clipKind: live-poll-rating, props)`. Voters cast an integer rating in `[scaleMin, scaleMax]` (ADR-010 §D2); the runtime aggregates into mean + histogram. Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.',
  inputSchema: composeLivePollRatingInput as unknown as z.ZodType<ComposeLivePollRatingInput>,
  outputSchema: composeOutputBase as unknown as z.ZodType<
    AudienceComposeResult<'live-poll-rating'>
  >,
  handle: (input, _ctx) =>
    buildOutput('live-poll-rating', {
      question: input.question,
      scaleMin: input.scaleMin,
      scaleMax: input.scaleMax,
    }),
};

// ---------------------------------------------------------------------------
// 4 — compose_live_qa
// ---------------------------------------------------------------------------

export const QA_MODERATION_MODES = ['none', 'pre-approve', 'post-flag'] as const;
export type QaModerationMode = (typeof QA_MODERATION_MODES)[number];

const composeLiveQaInput = z
  .object({
    topic: z.string().min(1).max(280),
    allowUpvoting: z.boolean().optional(),
    moderationMode: z.enum(QA_MODERATION_MODES).optional(),
  })
  .strict();

type ComposeLiveQaInput = z.infer<typeof composeLiveQaInput>;

/**
 * `compose_live_qa` — emit a `live-qa` clip brief from
 * `{ topic, allowUpvoting?, moderationMode? }`. Per ADR-010 §D2 voters
 * submit questions + (optionally) upvote others; the runtime renders a
 * sorted feed.
 */
const composeLiveQa: ToolHandler<
  ComposeLiveQaInput,
  AudienceComposeResult<'live-qa'>,
  ToolContext
> = {
  name: 'compose_live_qa',
  bundle: AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  description:
    "Compose a Live Audience Q&A brief: `{ topic (1..280 chars), allowUpvoting?, moderationMode?: 'none' | 'pre-approve' | 'post-flag' }` → emit `(presetId?, clipKind: live-qa, props)`. Voters submit questions + (optionally) upvote others; the runtime renders a sorted feed (ADR-010 §D2). Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.",
  inputSchema: composeLiveQaInput as unknown as z.ZodType<ComposeLiveQaInput>,
  outputSchema: composeOutputBase as unknown as z.ZodType<AudienceComposeResult<'live-qa'>>,
  handle: (input, _ctx) =>
    buildOutput('live-qa', {
      topic: input.topic,
      ...(input.allowUpvoting !== undefined ? { allowUpvoting: input.allowUpvoting } : {}),
      ...(input.moderationMode !== undefined ? { moderationMode: input.moderationMode } : {}),
    }),
};

// ---------------------------------------------------------------------------
// 5 — compose_live_quiz
// ---------------------------------------------------------------------------

const composeLiveQuizInput = z
  .object({
    question: z.string().min(1).max(280),
    options: z.array(z.string().min(1).max(120)).min(2).max(10),
    correctIndex: z.number().int().nonnegative(),
    timerSeconds: z.number().int().min(1).max(600).optional(),
  })
  .strict()
  .refine((v) => v.correctIndex < v.options.length, {
    message: 'correctIndex must be in range [0, options.length)',
    path: ['correctIndex'],
  });

type ComposeLiveQuizInput = z.infer<typeof composeLiveQuizInput>;

/**
 * `compose_live_quiz` — emit a `live-quiz` clip brief from
 * `{ question, options[2..10], correctIndex, timerSeconds? }`. Per
 * ADR-010 §D2 voters cast a single `optionIndex` against an authored
 * `correctIndex`; the runtime emits per-question scores + (when a
 * `compose_leaderboard` references this clip) a derived leaderboard
 * aggregation.
 */
const composeLiveQuiz: ToolHandler<
  ComposeLiveQuizInput,
  AudienceComposeResult<'live-quiz'>,
  ToolContext
> = {
  name: 'compose_live_quiz',
  bundle: AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  description:
    'Compose a Live Audience quiz brief: `{ question (1..280 chars), options[2..10], correctIndex (int, in [0, options.length)), timerSeconds? (1..600) }` → emit `(presetId?, clipKind: live-quiz, props)`. Voters cast a single `optionIndex` against the authored `correctIndex`; the runtime emits per-question scores + a derived leaderboard aggregation (referenced via compose_leaderboard) per ADR-010 §D2. Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.',
  inputSchema: composeLiveQuizInput as unknown as z.ZodType<ComposeLiveQuizInput>,
  outputSchema: composeOutputBase as unknown as z.ZodType<AudienceComposeResult<'live-quiz'>>,
  handle: (input, _ctx) =>
    buildOutput('live-quiz', {
      question: input.question,
      options: input.options,
      correctIndex: input.correctIndex,
      ...(input.timerSeconds !== undefined ? { timerSeconds: input.timerSeconds } : {}),
    }),
};

// ---------------------------------------------------------------------------
// 6 — compose_leaderboard
// ---------------------------------------------------------------------------

const composeLeaderboardInput = z
  .object({
    dataSourceClipId: z.string().min(1).max(120),
    topN: z.number().int().min(1).max(100).optional(),
  })
  .strict();

type ComposeLeaderboardInput = z.infer<typeof composeLeaderboardInput>;

/**
 * `compose_leaderboard` — emit a `leaderboard` clip brief from
 * `{ dataSourceClipId, topN? }`. Per ADR-010 §D2 `LeaderboardVote =
 * never`: the leaderboard clip is *derived* from a referenced
 * `live-quiz` clip's aggregation. The input MUST NOT include any vote
 * payload — strict-mode Zod rejects extras.
 */
const composeLeaderboard: ToolHandler<
  ComposeLeaderboardInput,
  AudienceComposeResult<'leaderboard'>,
  ToolContext
> = {
  name: 'compose_leaderboard',
  bundle: AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  description:
    'Compose a Live Audience leaderboard brief: `{ dataSourceClipId (1..120 chars), topN? (1..100) }` → emit `(presetId?, clipKind: leaderboard, props)`. Per ADR-010 §D2 the leaderboard is a DERIVED clip — `LeaderboardVote = never`, voters never cast votes against the leaderboard; aggregation is computed from the referenced `live-quiz` clip via `dataSourceClipId`. The input MUST NOT include vote payloads (strict-mode Zod rejects extras). Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.',
  inputSchema: composeLeaderboardInput as unknown as z.ZodType<ComposeLeaderboardInput>,
  outputSchema: composeOutputBase as unknown as z.ZodType<AudienceComposeResult<'leaderboard'>>,
  handle: (input, _ctx) =>
    buildOutput('leaderboard', {
      dataSourceClipId: input.dataSourceClipId,
      ...(input.topN !== undefined ? { topN: input.topN } : {}),
    }),
};

// ---------------------------------------------------------------------------
// 7 — compose_word_cloud
// ---------------------------------------------------------------------------

const composeWordCloudInput = z
  .object({
    prompt: z.string().min(1).max(280),
    maxWords: z.number().int().min(1).max(500).optional(),
  })
  .strict();

type ComposeWordCloudInput = z.infer<typeof composeWordCloudInput>;

/**
 * `compose_word_cloud` — emit a `word-cloud` clip brief from
 * `{ prompt, maxWords? }`. Per ADR-010 §D2 voters submit short
 * keyword(s); the runtime renders a live-aggregated cloud weighted by
 * frequency.
 */
const composeWordCloud: ToolHandler<
  ComposeWordCloudInput,
  AudienceComposeResult<'word-cloud'>,
  ToolContext
> = {
  name: 'compose_word_cloud',
  bundle: AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  description:
    'Compose a Live Audience word-cloud brief: `{ prompt (1..280 chars), maxWords? (1..500) }` → emit `(presetId?, clipKind: word-cloud, props)`. Voters submit short keyword(s); the runtime renders a live-aggregated cloud weighted by frequency (ADR-010 §D2). Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.',
  inputSchema: composeWordCloudInput as unknown as z.ZodType<ComposeWordCloudInput>,
  outputSchema: composeOutputBase as unknown as z.ZodType<AudienceComposeResult<'word-cloud'>>,
  handle: (input, _ctx) =>
    buildOutput('word-cloud', {
      prompt: input.prompt,
      ...(input.maxWords !== undefined ? { maxWords: input.maxWords } : {}),
    }),
};

// ---------------------------------------------------------------------------
// 8 — compose_survey
// ---------------------------------------------------------------------------

export const SURVEY_QUESTION_KINDS = ['multiple-choice', 'open-text', 'rating'] as const;
export type SurveyQuestionKind = (typeof SURVEY_QUESTION_KINDS)[number];

const surveyQuestionSchema = z
  .object({
    kind: z.enum(SURVEY_QUESTION_KINDS),
    prompt: z.string().min(1).max(280),
    options: z.array(z.string().min(1).max(120)).min(2).max(10).optional(),
    scaleMin: z.number().int().optional(),
    scaleMax: z.number().int().optional(),
    maxLength: z.number().int().min(1).max(2000).optional(),
  })
  .strict()
  .refine(
    (q) => {
      if (q.kind === 'multiple-choice') return q.options !== undefined;
      if (q.kind === 'rating') {
        return q.scaleMin !== undefined && q.scaleMax !== undefined && q.scaleMax > q.scaleMin;
      }
      return true;
    },
    {
      message:
        'multiple-choice requires options[]; rating requires scaleMin + scaleMax (with scaleMax > scaleMin)',
    },
  );

const composeSurveyInput = z
  .object({
    questions: z.array(surveyQuestionSchema).min(1).max(20),
  })
  .strict();

type ComposeSurveyInput = z.infer<typeof composeSurveyInput>;

/**
 * `compose_survey` — emit a `survey` clip brief from `{ questions[1..20] }`.
 * Per ADR-010 §D2 each question is one of `multiple-choice` /
 * `open-text` / `rating`; the runtime renders a sequenced form +
 * aggregates per-question results.
 */
const composeSurvey: ToolHandler<
  ComposeSurveyInput,
  AudienceComposeResult<'survey'>,
  ToolContext
> = {
  name: 'compose_survey',
  bundle: AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  description:
    "Compose a Live Audience survey brief: `{ questions[1..20] }` where each question is `{ kind: 'multiple-choice' | 'open-text' | 'rating', prompt (1..280 chars), options[2..10]? (required for multiple-choice), scaleMin? + scaleMax? (required for rating, scaleMax > scaleMin), maxLength? (1..2000, open-text only) }` → emit `(presetId?, clipKind: survey, props)`. The runtime renders a sequenced form + aggregates per-question results (ADR-010 §D2). Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.",
  inputSchema: composeSurveyInput as unknown as z.ZodType<ComposeSurveyInput>,
  outputSchema: composeOutputBase as unknown as z.ZodType<AudienceComposeResult<'survey'>>,
  handle: (input, _ctx) =>
    buildOutput('survey', {
      questions: input.questions,
    }),
};

// ---------------------------------------------------------------------------
// 9 — compose_heatmap
// ---------------------------------------------------------------------------

const heatmapImageRefSchema = z
  .object({
    assetId: z.string().min(1).max(120).optional(),
    url: z.string().min(1).max(2048).optional(),
  })
  .strict()
  .refine((v) => v.assetId !== undefined || v.url !== undefined, {
    message: 'imageRef must specify either assetId or url',
  });

const composeHeatmapInput = z
  .object({
    prompt: z.string().min(1).max(280),
    imageRef: heatmapImageRefSchema,
  })
  .strict();

type ComposeHeatmapInput = z.infer<typeof composeHeatmapInput>;

/**
 * `compose_heatmap` — emit a `heatmap` clip brief from
 * `{ prompt, imageRef }`. Motion-native differentiator (ADR-009 §D2):
 * voters tap (x, y) on the image; the runtime renders a live-aggregated
 * 2-D density field. `imageRef` admits either an `assetId` (asset-cache
 * key) or a `url` (raw HTTPS reference).
 */
const composeHeatmap: ToolHandler<
  ComposeHeatmapInput,
  AudienceComposeResult<'heatmap'>,
  ToolContext
> = {
  name: 'compose_heatmap',
  bundle: AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  description:
    'Compose a Live Audience heatmap brief: `{ prompt (1..280 chars), imageRef: { assetId? | url? } (one required) }` → emit `(presetId?, clipKind: heatmap, props)`. Motion-native differentiator (ADR-009 §D2); voters tap (x, y) on the image, the runtime renders a live-aggregated 2-D density field. `imageRef.assetId` references the asset-cache; `imageRef.url` is a raw HTTPS reference. Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.',
  inputSchema: composeHeatmapInput as unknown as z.ZodType<ComposeHeatmapInput>,
  outputSchema: composeOutputBase as unknown as z.ZodType<AudienceComposeResult<'heatmap'>>,
  handle: (input, _ctx) =>
    buildOutput('heatmap', {
      prompt: input.prompt,
      imageRef: input.imageRef,
    }),
};

// ---------------------------------------------------------------------------
// 10 — compose_reaction_stream
// ---------------------------------------------------------------------------

const composeReactionStreamInput = z
  .object({
    prompt: z.string().min(1).max(280),
    reactionSet: z.array(z.string().min(1).max(40)).min(1).max(20).optional(),
  })
  .strict();

type ComposeReactionStreamInput = z.infer<typeof composeReactionStreamInput>;

/**
 * `compose_reaction_stream` — emit a `reaction-stream` clip brief from
 * `{ prompt, reactionSet? }`. Motion-native differentiator (ADR-009
 * §D2): voters tap one of the reactionSet entries, the runtime renders
 * a particle-burst stream weighted by submission rate. Default
 * `reactionSet` is supplied at the runtime layer (per ADR-010 §D3 — 5
 * Hz snapshot cadence default).
 */
const composeReactionStream: ToolHandler<
  ComposeReactionStreamInput,
  AudienceComposeResult<'reaction-stream'>,
  ToolContext
> = {
  name: 'compose_reaction_stream',
  bundle: AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  description:
    'Compose a Live Audience reaction-stream brief: `{ prompt (1..280 chars), reactionSet? (1..20 entries, each 1..40 chars) }` → emit `(presetId?, clipKind: reaction-stream, props)`. Motion-native differentiator (ADR-009 §D2); voters tap a reaction entry, the runtime renders a particle-burst stream weighted by submission rate (5 Hz snapshot cadence default per ADR-010 §D3). Default `reactionSet` is supplied at the runtime layer when omitted. Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.',
  inputSchema: composeReactionStreamInput as unknown as z.ZodType<ComposeReactionStreamInput>,
  outputSchema: composeOutputBase as unknown as z.ZodType<AudienceComposeResult<'reaction-stream'>>,
  handle: (input, _ctx) =>
    buildOutput('reaction-stream', {
      prompt: input.prompt,
      ...(input.reactionSet !== undefined ? { reactionSet: input.reactionSet } : {}),
    }),
};

// ---------------------------------------------------------------------------
// 11 — compose_audience_ai_prompt
// ---------------------------------------------------------------------------

const composeAudienceAiPromptInput = z
  .object({
    basePrompt: z.string().min(1).max(2000),
    voterPromptTemplate: z.string().min(1).max(2000),
  })
  .strict();

type ComposeAudienceAiPromptInput = z.infer<typeof composeAudienceAiPromptInput>;

/**
 * `compose_audience_ai_prompt` — emit an `audience-ai-prompt` clip
 * brief from `{ basePrompt, voterPromptTemplate }`. Motion-native
 * differentiator (ADR-009 §D2): the renderer combines `basePrompt` with
 * voter-supplied tokens (per `voterPromptTemplate`) into a single AI
 * generation call; results stream into the rendered clip.
 */
const composeAudienceAiPrompt: ToolHandler<
  ComposeAudienceAiPromptInput,
  AudienceComposeResult<'audience-ai-prompt'>,
  ToolContext
> = {
  name: 'compose_audience_ai_prompt',
  bundle: AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  description:
    'Compose a Live Audience AI-prompt brief: `{ basePrompt (1..2000 chars), voterPromptTemplate (1..2000 chars) }` → emit `(presetId?, clipKind: audience-ai-prompt, props)`. Motion-native differentiator (ADR-009 §D2); the renderer combines `basePrompt` with voter-supplied tokens (per `voterPromptTemplate`) into a single AI generation call; results stream into the rendered clip. Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.',
  inputSchema: composeAudienceAiPromptInput as unknown as z.ZodType<ComposeAudienceAiPromptInput>,
  outputSchema: composeOutputBase as unknown as z.ZodType<
    AudienceComposeResult<'audience-ai-prompt'>
  >,
  handle: (input, _ctx) =>
    buildOutput('audience-ai-prompt', {
      basePrompt: input.basePrompt,
      voterPromptTemplate: input.voterPromptTemplate,
    }),
};

// ---------------------------------------------------------------------------
// Barrel — handlers + LLM tool definitions
// ---------------------------------------------------------------------------

export const AUDIENCE_ENGAGEMENT_HANDLERS: readonly ToolHandler<unknown, unknown, ToolContext>[] = [
  composeLivePollMc,
  composeLivePollOpenText,
  composeLivePollRating,
  composeLiveQa,
  composeLiveQuiz,
  composeLeaderboard,
  composeWordCloud,
  composeSurvey,
  composeHeatmap,
  composeReactionStream,
  composeAudienceAiPrompt,
] as unknown as readonly ToolHandler<unknown, unknown, ToolContext>[];

const optionsArrayJsonSchema = {
  type: 'array' as const,
  description: 'Per-option labels (1..120 chars each); 2..10 entries.',
  items: { type: 'string', minLength: 1, maxLength: 120 },
  minItems: 2,
  maxItems: 10,
};

const surveyQuestionItemJsonSchema = {
  type: 'object' as const,
  description:
    "Survey question atom: `{ kind: 'multiple-choice' | 'open-text' | 'rating', prompt, options? (multiple-choice), scaleMin? + scaleMax? (rating), maxLength? (open-text) }`. Up to 20 entries per survey.",
};

const heatmapImageRefJsonSchema = {
  type: 'object' as const,
  description:
    'Image reference atom: `{ assetId? | url? }` — exactly one of `assetId` (asset-cache key) or `url` (HTTPS reference) is required.',
};

export const AUDIENCE_ENGAGEMENT_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'compose_live_poll_multiple_choice',
    description: composeLivePollMc.description,
    input_schema: {
      type: 'object',
      required: ['question', 'options'],
      additionalProperties: false,
      properties: {
        question: { type: 'string', minLength: 1, maxLength: 280 },
        options: optionsArrayJsonSchema,
      },
    },
  },
  {
    name: 'compose_live_poll_open_text',
    description: composeLivePollOpenText.description,
    input_schema: {
      type: 'object',
      required: ['question'],
      additionalProperties: false,
      properties: {
        question: { type: 'string', minLength: 1, maxLength: 280 },
        maxLength: { type: 'integer', minimum: 1, maximum: 2000 },
      },
    },
  },
  {
    name: 'compose_live_poll_rating',
    description: composeLivePollRating.description,
    input_schema: {
      type: 'object',
      required: ['question', 'scaleMin', 'scaleMax'],
      additionalProperties: false,
      properties: {
        question: { type: 'string', minLength: 1, maxLength: 280 },
        scaleMin: { type: 'integer' },
        scaleMax: { type: 'integer' },
      },
    },
  },
  {
    name: 'compose_live_qa',
    description: composeLiveQa.description,
    input_schema: {
      type: 'object',
      required: ['topic'],
      additionalProperties: false,
      properties: {
        topic: { type: 'string', minLength: 1, maxLength: 280 },
        allowUpvoting: { type: 'boolean' },
        moderationMode: { type: 'string', enum: [...QA_MODERATION_MODES] },
      },
    },
  },
  {
    name: 'compose_live_quiz',
    description: composeLiveQuiz.description,
    input_schema: {
      type: 'object',
      required: ['question', 'options', 'correctIndex'],
      additionalProperties: false,
      properties: {
        question: { type: 'string', minLength: 1, maxLength: 280 },
        options: optionsArrayJsonSchema,
        correctIndex: { type: 'integer', minimum: 0 },
        timerSeconds: { type: 'integer', minimum: 1, maximum: 600 },
      },
    },
  },
  {
    name: 'compose_leaderboard',
    description: composeLeaderboard.description,
    input_schema: {
      type: 'object',
      required: ['dataSourceClipId'],
      additionalProperties: false,
      properties: {
        dataSourceClipId: { type: 'string', minLength: 1, maxLength: 120 },
        topN: { type: 'integer', minimum: 1, maximum: 100 },
      },
    },
  },
  {
    name: 'compose_word_cloud',
    description: composeWordCloud.description,
    input_schema: {
      type: 'object',
      required: ['prompt'],
      additionalProperties: false,
      properties: {
        prompt: { type: 'string', minLength: 1, maxLength: 280 },
        maxWords: { type: 'integer', minimum: 1, maximum: 500 },
      },
    },
  },
  {
    name: 'compose_survey',
    description: composeSurvey.description,
    input_schema: {
      type: 'object',
      required: ['questions'],
      additionalProperties: false,
      properties: {
        questions: {
          type: 'array',
          items: surveyQuestionItemJsonSchema,
          minItems: 1,
          maxItems: 20,
        },
      },
    },
  },
  {
    name: 'compose_heatmap',
    description: composeHeatmap.description,
    input_schema: {
      type: 'object',
      required: ['prompt', 'imageRef'],
      additionalProperties: false,
      properties: {
        prompt: { type: 'string', minLength: 1, maxLength: 280 },
        imageRef: heatmapImageRefJsonSchema,
      },
    },
  },
  {
    name: 'compose_reaction_stream',
    description: composeReactionStream.description,
    input_schema: {
      type: 'object',
      required: ['prompt'],
      additionalProperties: false,
      properties: {
        prompt: { type: 'string', minLength: 1, maxLength: 280 },
        reactionSet: {
          type: 'array',
          items: { type: 'string', minLength: 1, maxLength: 40 },
          minItems: 1,
          maxItems: 20,
        },
      },
    },
  },
  {
    name: 'compose_audience_ai_prompt',
    description: composeAudienceAiPrompt.description,
    input_schema: {
      type: 'object',
      required: ['basePrompt', 'voterPromptTemplate'],
      additionalProperties: false,
      properties: {
        basePrompt: { type: 'string', minLength: 1, maxLength: 2000 },
        voterPromptTemplate: { type: 'string', minLength: 1, maxLength: 2000 },
      },
    },
  },
];
