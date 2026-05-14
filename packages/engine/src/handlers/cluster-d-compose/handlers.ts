// packages/engine/src/handlers/cluster-d-compose/handlers.ts
// `cluster-d-compose` bundle — 3 read-only composer tools that bind a
// semantic Cluster D (Titles) brief to a ratified preset id + opaque
// props payload. Tools: compose_title_sequence / compose_segment_open /
// compose_end_credits. Output is `(presetId, props)` — the caller mounts
// the clip via a separate write-tier tool (e.g., `add_clip` from
// `create-mutate`).
//
// Per T-347 / D-T347-2: handlers declare `ToolContext` (NOT
// `MutationContext`); they neither read nor mutate the document and
// dispatch is a pure function of input. The determinism gate at
// `CLAUDE.md` §3 covers `packages/runtimes/**` /
// `packages/frame-runtime/**` / `packages/renderer-core/src/clips/**`
// only — composer paths are out of its globs. The handlers are still
// pure (no `Date.now()`, no `Math.random()`, no I/O) by code-review
// discipline.
//
// Cluster D = 6/6 substantive + RATIFIED (T-348..T-353); this bundle
// is the agent-facing routing surface and CLOSES Cluster D (T-354).
//
// Cluster posture (per skills/stageflip/presets/titles/SKILL.md):
//   * Caller-required `presetId` — the cluster spans 6 typographically
//     distinct prestige-TV registers (Benguiat, Trajan, Engravers
//     Gothic, double-exposure photographic, home-video sepia, mid-
//     century corporate). No semantic dispatch can collapse those —
//     the caller picks the register; the composer forwards the brief.
//     Same posture as cluster-c-compose for `compose_storm_track` /
//     `compose_temperature_map` (single-preset enums, no auto-route).
//   * Composer-transparent optional props — when caller omits an
//     optional field, the output `props` does NOT include the key
//     (parallel to D-T347-11). The primitive default flows through.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { ToolContext, ToolHandler } from '../../router/types.js';

export const CLUSTER_D_COMPOSE_BUNDLE_NAME = 'cluster-d-compose';

// ---------------------------------------------------------------------------
// Cluster D preset enum
// ---------------------------------------------------------------------------

/** The 6 ratified Cluster D preset ids (T-348..T-353). */
export const CLUSTER_D_PRESET_IDS = [
  'got-trajan-clockwork',
  'severance-surreal-3d',
  'squid-game-geometric',
  'stranger-things-benguiat',
  'succession-home-video',
  'true-detective-double-exposure',
] as const;
export type ClusterDPresetId = (typeof CLUSTER_D_PRESET_IDS)[number];

/** Scroll-speed vocab for `compose_end_credits`. */
export const END_CREDITS_SCROLL_SPEEDS = ['slow', 'medium', 'fast'] as const;

// ---------------------------------------------------------------------------
// 1 — compose_title_sequence
// ---------------------------------------------------------------------------

const composeTitleSequenceInput = z
  .object({
    presetId: z.enum(CLUSTER_D_PRESET_IDS),
    title: z.string().min(1).max(160),
    subtitle: z.string().min(1).max(200).optional(),
    durationSeconds: z.number().positive().max(300).optional(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{3}$/, 'accentColor must be a CSS hex color')
      .optional(),
  })
  .strict();

const composeTitleSequenceOutput = z
  .object({
    ok: z.literal(true),
    presetId: z.enum(CLUSTER_D_PRESET_IDS),
    props: z.record(z.unknown()),
  })
  .strict();

type ComposeTitleSequenceInput = z.infer<typeof composeTitleSequenceInput>;
type ComposeTitleSequenceOutput = z.infer<typeof composeTitleSequenceOutput>;

const composeTitleSequence: ToolHandler<
  ComposeTitleSequenceInput,
  ComposeTitleSequenceOutput,
  ToolContext
> = {
  name: 'compose_title_sequence',
  bundle: CLUSTER_D_COMPOSE_BUNDLE_NAME,
  description:
    "Compose a Cluster D (Titles) main title-sequence routing plan. Returns the caller-supplied `presetId` (one of the 6 ratified Cluster D registers — got-trajan-clockwork / severance-surreal-3d / squid-game-geometric / stranger-things-benguiat / succession-home-video / true-detective-double-exposure) plus opaque pass-through `props` carrying `title`, optional `subtitle`, optional `durationSeconds`, optional `accentColor`. Composer-transparent: omitted optional fields do NOT appear in the output `props` — the primitive's per-preset default flows through. Per cluster SKILL: typography carries emotional weight; the bespoke typeface signals the register, so the caller picks the preset (no auto-route).",
  inputSchema: composeTitleSequenceInput as unknown as z.ZodType<ComposeTitleSequenceInput>,
  outputSchema: composeTitleSequenceOutput,
  handle: (input, _ctx) => {
    const props: Record<string, unknown> = {
      title: input.title,
    };
    if (input.subtitle !== undefined) props.subtitle = input.subtitle;
    if (input.durationSeconds !== undefined) props.durationSeconds = input.durationSeconds;
    if (input.accentColor !== undefined) props.accentColor = input.accentColor;
    return {
      ok: true,
      presetId: input.presetId,
      props,
    };
  },
};

// ---------------------------------------------------------------------------
// 2 — compose_segment_open
// ---------------------------------------------------------------------------

const composeSegmentOpenInput = z
  .object({
    presetId: z.enum(CLUSTER_D_PRESET_IDS),
    segmentNumber: z.number().int().positive().max(999).optional(),
    segmentTitle: z.string().min(1).max(160),
    durationSeconds: z.number().positive().max(120).optional(),
  })
  .strict();

const composeSegmentOpenOutput = z
  .object({
    ok: z.literal(true),
    presetId: z.enum(CLUSTER_D_PRESET_IDS),
    props: z.record(z.unknown()),
  })
  .strict();

type ComposeSegmentOpenInput = z.infer<typeof composeSegmentOpenInput>;
type ComposeSegmentOpenOutput = z.infer<typeof composeSegmentOpenOutput>;

const composeSegmentOpen: ToolHandler<
  ComposeSegmentOpenInput,
  ComposeSegmentOpenOutput,
  ToolContext
> = {
  name: 'compose_segment_open',
  bundle: CLUSTER_D_COMPOSE_BUNDLE_NAME,
  description:
    "Compose a Cluster D (Titles) shorter-form segment-open / chapter-break routing plan. Returns the caller-supplied `presetId` (one of the 6 ratified Cluster D registers) plus opaque pass-through `props` carrying `segmentTitle`, optional `segmentNumber`, optional `durationSeconds`. Same caller-picks-preset posture as `compose_title_sequence` — not all 6 presets are typographically appropriate for short opens (e.g., got-trajan-clockwork's full clockwork scene is overkill for a 5-second chapter break), but the cluster compose contract leaves register selection to the caller. Composer-transparent: omitted optional fields do NOT appear in the output `props`.",
  inputSchema: composeSegmentOpenInput as unknown as z.ZodType<ComposeSegmentOpenInput>,
  outputSchema: composeSegmentOpenOutput,
  handle: (input, _ctx) => {
    const props: Record<string, unknown> = {
      segmentTitle: input.segmentTitle,
    };
    if (input.segmentNumber !== undefined) props.segmentNumber = input.segmentNumber;
    if (input.durationSeconds !== undefined) props.durationSeconds = input.durationSeconds;
    return {
      ok: true,
      presetId: input.presetId,
      props,
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — compose_end_credits
// ---------------------------------------------------------------------------

const creditEntry = z
  .object({
    role: z.string().min(1).max(120),
    name: z.string().min(1).max(160),
  })
  .strict();

const composeEndCreditsInput = z
  .object({
    presetId: z.enum(CLUSTER_D_PRESET_IDS),
    credits: z.array(creditEntry).min(1).max(64),
    scrollSpeed: z.enum(END_CREDITS_SCROLL_SPEEDS).optional(),
  })
  .strict();

const composeEndCreditsOutput = z
  .object({
    ok: z.literal(true),
    presetId: z.enum(CLUSTER_D_PRESET_IDS),
    props: z.record(z.unknown()),
  })
  .strict();

type ComposeEndCreditsInput = z.infer<typeof composeEndCreditsInput>;
type ComposeEndCreditsOutput = z.infer<typeof composeEndCreditsOutput>;

const composeEndCredits: ToolHandler<ComposeEndCreditsInput, ComposeEndCreditsOutput, ToolContext> =
  {
    name: 'compose_end_credits',
    bundle: CLUSTER_D_COMPOSE_BUNDLE_NAME,
    description:
      "Compose a Cluster D (Titles) end-credits / cast-list routing plan. Returns the caller-supplied `presetId` (one of the 6 ratified Cluster D registers) plus opaque pass-through `props` carrying `credits` (1–64 `{ role, name }` entries) and optional `scrollSpeed` (slow / medium / fast). Composer-transparent: when caller omits `scrollSpeed`, the output `props` does NOT include the key, and the primitive's preset-matched default flows through.",
    inputSchema: composeEndCreditsInput as unknown as z.ZodType<ComposeEndCreditsInput>,
    outputSchema: composeEndCreditsOutput,
    handle: (input, _ctx) => {
      const props: Record<string, unknown> = {
        credits: input.credits,
      };
      if (input.scrollSpeed !== undefined) props.scrollSpeed = input.scrollSpeed;
      return {
        ok: true,
        presetId: input.presetId,
        props,
      };
    },
  };

// ---------------------------------------------------------------------------
// Barrel — handlers + LLM tool definitions
// ---------------------------------------------------------------------------

export const CLUSTER_D_COMPOSE_HANDLERS: readonly ToolHandler<unknown, unknown, ToolContext>[] = [
  composeTitleSequence,
  composeSegmentOpen,
  composeEndCredits,
] as unknown as readonly ToolHandler<unknown, unknown, ToolContext>[];

export const CLUSTER_D_COMPOSE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'compose_title_sequence',
    description: composeTitleSequence.description,
    input_schema: {
      type: 'object',
      required: ['presetId', 'title'],
      additionalProperties: false,
      properties: {
        presetId: { type: 'string', enum: [...CLUSTER_D_PRESET_IDS] },
        title: {
          type: 'string',
          description: 'Show / film / brand title (1–160 chars).',
        },
        subtitle: {
          type: 'string',
          description: 'Optional subtitle / tagline (1–200 chars).',
        },
        durationSeconds: {
          type: 'number',
          description:
            'Optional sequence duration in seconds (max 300). When omitted, the preset default flows through.',
        },
        accentColor: {
          type: 'string',
          description:
            'Optional CSS hex color (e.g. #ff0033 or #f03) for the preset accent layer. When omitted, the preset default flows through.',
        },
      },
    },
  },
  {
    name: 'compose_segment_open',
    description: composeSegmentOpen.description,
    input_schema: {
      type: 'object',
      required: ['presetId', 'segmentTitle'],
      additionalProperties: false,
      properties: {
        presetId: { type: 'string', enum: [...CLUSTER_D_PRESET_IDS] },
        segmentNumber: {
          type: 'number',
          description:
            'Optional 1-based segment number (1..999). When omitted, the preset renders title-only.',
        },
        segmentTitle: {
          type: 'string',
          description: 'Segment / chapter title (1–160 chars).',
        },
        durationSeconds: {
          type: 'number',
          description:
            'Optional segment-open duration in seconds (max 120). When omitted, the preset default flows through.',
        },
      },
    },
  },
  {
    name: 'compose_end_credits',
    description: composeEndCredits.description,
    input_schema: {
      type: 'object',
      required: ['presetId', 'credits'],
      additionalProperties: false,
      properties: {
        presetId: { type: 'string', enum: [...CLUSTER_D_PRESET_IDS] },
        credits: {
          type: 'array',
          description:
            'Credits roll entries: 1–64 `{ role: string (1–120 chars), name: string (1–160 chars) }`.',
        },
        scrollSpeed: {
          type: 'string',
          enum: [...END_CREDITS_SCROLL_SPEEDS],
          description:
            "Optional scroll-speed register. When omitted, the preset's matched default flows through.",
        },
      },
    },
  },
];
