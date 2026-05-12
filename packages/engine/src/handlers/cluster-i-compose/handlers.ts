// packages/engine/src/handlers/cluster-i-compose/handlers.ts
// `cluster-i-compose` bundle — 3 read-only composer tools that bind a
// semantic Cluster I (Live audience) brief to a ratified preset id +
// audience clipKind + opaque props payload. Tools:
//   compose_live_poll      → slido-classic-poll | mentimeter-bar-vote
//   compose_audience_qa    → bbc-question-time | conference-qa-upvote
//   compose_quiz_round     → kahoot-competitive | classroom-quiz
//
// Output is `(presetId, clipKind, props)` — the caller mounts the clip
// via a separate write-tier tool (e.g., `add_clip` from `create-mutate`).
//
// Per T-379 / D-T379-2: handlers declare `ToolContext` (NOT
// `MutationContext`); they neither read nor mutate the document and
// dispatch is a pure function of input. Cluster I = 6 audience presets
// ratified in T-486; this bundle is the agent-layer surface and CLOSES
// Cluster I. Per ADR-010 §D7, vendor audience adapters cannot reach
// motion-native clip kinds — those have no Cluster I presets in v1.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';

import type { ToolContext, ToolHandler } from '../../router/types.js';

export const CLUSTER_I_COMPOSE_BUNDLE_NAME = 'cluster-i-compose';

/** The 6 ratified Cluster I preset ids (T-486). */
export const CLUSTER_I_PRESET_IDS = [
  'slido-classic-poll',
  'mentimeter-bar-vote',
  'kahoot-competitive',
  'bbc-question-time',
  'conference-qa-upvote',
  'classroom-quiz',
] as const;
export type ClusterIPresetId = (typeof CLUSTER_I_PRESET_IDS)[number];

const composeOutputSchema = z
  .object({
    ok: z.literal(true),
    presetId: z.enum(CLUSTER_I_PRESET_IDS),
    clipKind: z.string().min(1),
    props: z.record(z.unknown()),
  })
  .strict();
export type ClusterIComposeOutput = z.infer<typeof composeOutputSchema>;

const composeLivePollInputSchema = z
  .object({
    question: z.string().min(1).max(280),
    variant: z.enum(['multiple-choice', 'rating']).default('multiple-choice'),
    options: z.array(z.string().min(1)).min(2).max(10).optional(),
    scaleMax: z.number().int().min(2).max(10).optional(),
  })
  .strict();
type ComposeLivePollInput = z.infer<typeof composeLivePollInputSchema>;

const composeLivePoll: ToolHandler<ComposeLivePollInput, ClusterIComposeOutput, ToolContext> = {
  name: 'compose_live_poll',
  bundle: CLUSTER_I_COMPOSE_BUNDLE_NAME,
  description:
    'Bind a live-poll semantic brief to a Cluster I audience preset. variant="multiple-choice" picks slido-classic-poll; variant="rating" picks mentimeter-bar-vote (Likert 1..scaleMax). Returns (presetId, clipKind, props) for the caller to mount via add_clip. Read-only.',
  inputSchema: composeLivePollInputSchema as unknown as z.ZodType<ComposeLivePollInput>,
  outputSchema: composeOutputSchema,
  handle: (input) => {
    if (input.variant === 'rating') {
      return {
        ok: true,
        presetId: 'mentimeter-bar-vote',
        clipKind: 'live-poll-rating',
        props: {
          question: input.question,
          scaleMin: 1,
          scaleMax: input.scaleMax ?? 5,
        },
      };
    }
    return {
      ok: true,
      presetId: 'slido-classic-poll',
      clipKind: 'live-poll-multiple-choice',
      props: {
        question: input.question,
        options: input.options ?? ['Option A', 'Option B'],
      },
    };
  },
};

const composeAudienceQaInputSchema = z
  .object({
    topic: z.string().min(1).max(280),
    venue: z.enum(['broadcast', 'conference']).default('conference'),
    allowUpvoting: z.boolean().default(true),
  })
  .strict();
type ComposeAudienceQaInput = z.infer<typeof composeAudienceQaInputSchema>;

const composeAudienceQa: ToolHandler<ComposeAudienceQaInput, ClusterIComposeOutput, ToolContext> = {
  name: 'compose_audience_qa',
  bundle: CLUSTER_I_COMPOSE_BUNDLE_NAME,
  description:
    'Bind an audience Q&A semantic brief to a Cluster I audience preset. venue="broadcast" picks bbc-question-time; venue="conference" (default) picks conference-qa-upvote. Returns (presetId, clipKind, props). Read-only.',
  inputSchema: composeAudienceQaInputSchema as unknown as z.ZodType<ComposeAudienceQaInput>,
  outputSchema: composeOutputSchema,
  handle: (input) => ({
    ok: true,
    presetId: input.venue === 'broadcast' ? 'bbc-question-time' : 'conference-qa-upvote',
    clipKind: 'live-qa',
    props: {
      topic: input.topic,
      allowUpvoting: input.allowUpvoting,
      moderationMode: 'open' as const,
    },
  }),
};

const composeQuizRoundQuestionSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1).max(280),
    options: z.array(z.string().min(1)).min(2).max(6),
    correctOptionIndex: z.number().int().nonnegative(),
    timerSeconds: z.number().int().positive().max(120).optional(),
  })
  .strict();

const composeQuizRoundInputSchema = z
  .object({
    questions: z.array(composeQuizRoundQuestionSchema).min(1).max(50),
    audience: z.enum(['competitive', 'classroom']).default('competitive'),
  })
  .strict();
type ComposeQuizRoundInput = z.infer<typeof composeQuizRoundInputSchema>;

const composeQuizRound: ToolHandler<ComposeQuizRoundInput, ClusterIComposeOutput, ToolContext> = {
  name: 'compose_quiz_round',
  bundle: CLUSTER_I_COMPOSE_BUNDLE_NAME,
  description:
    'Bind a multi-question quiz brief to a Cluster I audience preset. audience="competitive" (default) picks kahoot-competitive; audience="classroom" picks classroom-quiz. Returns (presetId, clipKind, props). Read-only.',
  inputSchema: composeQuizRoundInputSchema as unknown as z.ZodType<ComposeQuizRoundInput>,
  outputSchema: composeOutputSchema,
  handle: (input) => ({
    ok: true,
    presetId: input.audience === 'classroom' ? 'classroom-quiz' : 'kahoot-competitive',
    clipKind: 'live-quiz',
    props: {
      questions: input.questions,
    },
  }),
};

export const CLUSTER_I_COMPOSE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'compose_live_poll',
    description: composeLivePoll.description,
    input_schema: {
      type: 'object',
      required: ['question'],
      additionalProperties: false,
      properties: {
        question: { type: 'string', minLength: 1, maxLength: 280 },
        variant: { type: 'string', enum: ['multiple-choice', 'rating'] },
        options: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 2,
          maxItems: 10,
        },
        scaleMax: { type: 'integer', minimum: 2, maximum: 10 },
      },
    },
  },
  {
    name: 'compose_audience_qa',
    description: composeAudienceQa.description,
    input_schema: {
      type: 'object',
      required: ['topic'],
      additionalProperties: false,
      properties: {
        topic: { type: 'string', minLength: 1, maxLength: 280 },
        venue: { type: 'string', enum: ['broadcast', 'conference'] },
        allowUpvoting: { type: 'boolean' },
      },
    },
  },
  {
    name: 'compose_quiz_round',
    description: composeQuizRound.description,
    input_schema: {
      type: 'object',
      required: ['questions'],
      additionalProperties: false,
      properties: {
        questions: {
          type: 'array',
          minItems: 1,
          maxItems: 50,
          items: {
            type: 'object',
            required: ['id', 'text', 'options', 'correctOptionIndex'],
            additionalProperties: false,
            properties: {
              id: { type: 'string', minLength: 1 },
              text: { type: 'string', minLength: 1, maxLength: 280 },
              options: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                minItems: 2,
                maxItems: 6,
              },
              correctOptionIndex: { type: 'integer', minimum: 0 },
              timerSeconds: { type: 'integer', minimum: 1, maximum: 120 },
            },
          },
        },
        audience: { type: 'string', enum: ['competitive', 'classroom'] },
      },
    },
  },
];

export const CLUSTER_I_COMPOSE_HANDLERS: readonly ToolHandler<
  unknown,
  ClusterIComposeOutput,
  ToolContext
>[] = [
  composeLivePoll as unknown as ToolHandler<unknown, ClusterIComposeOutput, ToolContext>,
  composeAudienceQa as unknown as ToolHandler<unknown, ClusterIComposeOutput, ToolContext>,
  composeQuizRound as unknown as ToolHandler<unknown, ClusterIComposeOutput, ToolContext>,
];
