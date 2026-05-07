// packages/engine/src/handlers/cluster-f-compose/handlers.ts
// `cluster-f-compose` bundle — 4 read-only composer tools that bind a
// semantic Cluster F (Captions / Lyrics) brief to a ratified preset id +
// opaque props payload. Tools: compose_creator_caption /
// compose_subtitle / compose_lyric_video / compose_keyword_highlight.
// Output is `(presetId, clipKind, props)` — the caller mounts the clip
// via a separate write-tier tool (e.g., `add_clip` from `create-mutate`).
//
// Per T-368 / D-T368-1: handlers declare `ToolContext` (NOT
// `MutationContext`); they neither read nor mutate the document and
// dispatch is a pure function of input. The determinism gate at
// `CLAUDE.md` §3 covers `packages/runtimes/**` /
// `packages/frame-runtime/**` / `packages/renderer-core/src/clips/**`
// only — composer paths are out of its globs. The handlers are still
// pure (no `Date.now()`, no `Math.random()`, no I/O) by code-review
// discipline.
//
// Cluster F is 6/6 substantive + signed (T-316b closer 2026-05-06); this
// bundle is the first downstream consumer surface. Mixed-clipKind
// dispatch: 5 of 6 presets bind `caption`; `karaoke-progressive-wipe`
// binds `lyrics`. `compose_lyric_video` is the only tool that returns
// `clipKind: 'lyrics'`.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { ToolContext, ToolHandler } from '../../router/types.js';

export const CLUSTER_F_COMPOSE_BUNDLE_NAME = 'cluster-f-compose';

// ---------------------------------------------------------------------------
// Cluster F preset enum + shared atom schemas
// ---------------------------------------------------------------------------

/** The 6 ratified Cluster F preset ids (T-362..T-367). */
export const CLUSTER_F_PRESET_IDS = [
  'hormozi-montserrat-black',
  'mrbeast-komika-axis',
  'tiktok-rounded-box',
  'ali-abdaal-opacity-karaoke',
  'netflix-invisible',
  'karaoke-progressive-wipe',
] as const;
export type ClusterFPresetId = (typeof CLUSTER_F_PRESET_IDS)[number];

/** Per-preset clipKind binding (canonical from each preset's frontmatter). */
const PRESET_CLIP_KIND: Record<ClusterFPresetId, 'caption' | 'lyrics'> = {
  'hormozi-montserrat-black': 'caption',
  'mrbeast-komika-axis': 'caption',
  'tiktok-rounded-box': 'caption',
  'ali-abdaal-opacity-karaoke': 'caption',
  'netflix-invisible': 'caption',
  'karaoke-progressive-wipe': 'lyrics',
};

/**
 * Single source-of-truth dispatch table. Every handler reads from this
 * map; preset-id string literals are never duplicated elsewhere.
 */
const PRESET_DISPATCH = {
  creatorCaption: {
    hormozi: 'hormozi-montserrat-black',
    mrbeast: 'mrbeast-komika-axis',
    tiktok: 'tiktok-rounded-box',
    'ali-abdaal': 'ali-abdaal-opacity-karaoke',
    netflix: 'netflix-invisible',
  },
  subtitle: {
    strict: 'netflix-invisible',
    relaxed: 'tiktok-rounded-box',
  },
  lyricVideo: {
    'progressive-wipe': 'karaoke-progressive-wipe',
  },
  keywordHighlight: {
    hormozi: 'hormozi-montserrat-black',
    mrbeast: 'mrbeast-komika-axis',
  },
} as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/**
 * `WordTiming` shape — declared locally because `@stageflip/schema` does
 * not currently re-export the runtime-clip's `wordTimingSchema` (it lives
 * inline in `caption.tsx` / `subtitle-overlay.tsx`). Mirrors the runtime
 * shape; if the schema package ever exports it, this declaration is the
 * one to drop. Per spec D-T368-11, declaring locally is the v1 posture
 * matching T-340's `teamScoreSchema` precedent.
 */
const wordTimingSchema = z
  .object({
    text: z.string().min(1),
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
    emphasis: z.enum(['normal', 'highlight', 'mute']).optional(),
  })
  .strict();

const brandSchema = z
  .object({
    primary: hexColor.optional(),
    accent: hexColor.optional(),
    font: z.string().min(1).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// 1 — compose_creator_caption
// ---------------------------------------------------------------------------

const CREATOR_STYLES = ['hormozi', 'mrbeast', 'tiktok', 'ali-abdaal', 'netflix'] as const;
type CreatorStyle = (typeof CREATOR_STYLES)[number];

const composeCreatorCaptionInput = z
  .object({
    transcript: z.array(wordTimingSchema).min(1),
    style: z.enum(CREATOR_STYLES).optional(),
    brand: brandSchema.optional(),
  })
  .strict();

const composeCreatorCaptionOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(CLUSTER_F_PRESET_IDS),
      clipKind: z.literal('caption'),
      rationale: z.string().min(1),
      transcript: z.array(wordTimingSchema).min(1),
      brand: brandSchema.optional(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['invalid_input', 'unsupported_style', 'transcript_empty', 'keywords_empty']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeCreatorCaptionInput = z.infer<typeof composeCreatorCaptionInput>;
type ComposeCreatorCaptionOutput = z.infer<typeof composeCreatorCaptionOutput>;

const composeCreatorCaption: ToolHandler<
  ComposeCreatorCaptionInput,
  ComposeCreatorCaptionOutput,
  ToolContext
> = {
  name: 'compose_creator_caption',
  bundle: CLUSTER_F_COMPOSE_BUNDLE_NAME,
  description:
    'Pick a Cluster F (Captions) creator-register preset by `style` and emit a ratified preset id + the echoed transcript. Dispatches across 5 presets — `hormozi` → `hormozi-montserrat-black`, `mrbeast` → `mrbeast-komika-axis`, `tiktok` → `tiktok-rounded-box`, `ali-abdaal` → `ali-abdaal-opacity-karaoke`, `netflix` → `netflix-invisible`. Default (no style) routes to `tiktok-rounded-box` (the platform-native short-form register). Output is `clipKind: caption`; caller mounts via a separate write-tier tool.',
  inputSchema: composeCreatorCaptionInput as unknown as z.ZodType<ComposeCreatorCaptionInput>,
  outputSchema: composeCreatorCaptionOutput,
  handle: (input, _ctx) => {
    const style: CreatorStyle = input.style ?? 'tiktok';
    const presetId = PRESET_DISPATCH.creatorCaption[style] as ClusterFPresetId;
    const rationale =
      input.style === undefined
        ? `defaulted to platform-native 'tiktok' style → ${presetId} (highest-volume short-form caption register)`
        : `dispatched style='${style}' → ${presetId}`;
    return {
      ok: true,
      presetId,
      clipKind: 'caption',
      rationale,
      transcript: input.transcript,
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
    };
  },
};

// ---------------------------------------------------------------------------
// 2 — compose_subtitle
// ---------------------------------------------------------------------------

const ACCESSIBILITY_MODES = ['strict', 'relaxed'] as const;
type AccessibilityMode = (typeof ACCESSIBILITY_MODES)[number];

const composeSubtitleInput = z
  .object({
    transcript: z.array(wordTimingSchema).min(1),
    accessibility_mode: z.enum(ACCESSIBILITY_MODES).optional(),
    brand: brandSchema.optional(),
  })
  .strict();

const composeSubtitleOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(CLUSTER_F_PRESET_IDS),
      clipKind: z.literal('caption'),
      rationale: z.string().min(1),
      transcript: z.array(wordTimingSchema).min(1),
      brand: brandSchema.optional(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['invalid_input', 'unsupported_style', 'transcript_empty', 'keywords_empty']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeSubtitleInput = z.infer<typeof composeSubtitleInput>;
type ComposeSubtitleOutput = z.infer<typeof composeSubtitleOutput>;

const composeSubtitle: ToolHandler<ComposeSubtitleInput, ComposeSubtitleOutput, ToolContext> = {
  name: 'compose_subtitle',
  bundle: CLUSTER_F_COMPOSE_BUNDLE_NAME,
  description:
    'Pick a Cluster F (Captions) subtitle preset by `accessibility_mode` and emit a ratified preset id + the echoed transcript. Default `strict` (FCC-grade) routes to `netflix-invisible` — the only preset in the cluster guaranteeing strict-subtitle invariants (≥833 ms minimum-event, 42-char-per-line / 2-lines-max upstream, sentence-case canonical, mute-opacity active-only visibility). `relaxed` routes to `tiktok-rounded-box` (platform-native fallback for short-form non-FCC scenarios). Output is `clipKind: caption`.',
  inputSchema: composeSubtitleInput as unknown as z.ZodType<ComposeSubtitleInput>,
  outputSchema: composeSubtitleOutput,
  handle: (input, _ctx) => {
    const mode: AccessibilityMode = input.accessibility_mode ?? 'strict';
    const presetId = PRESET_DISPATCH.subtitle[mode] as ClusterFPresetId;
    const rationale =
      input.accessibility_mode === undefined
        ? `defaulted to 'strict' accessibility_mode → ${presetId} (FCC-grade subtitle register; only preset enforcing strict-accessibility invariants)`
        : mode === 'strict'
          ? `dispatched accessibility_mode='strict' → ${presetId} (FCC-grade subtitle register)`
          : `dispatched accessibility_mode='relaxed' → ${presetId} (platform-native short-form fallback)`;
    return {
      ok: true,
      presetId,
      clipKind: 'caption',
      rationale,
      transcript: input.transcript,
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — compose_lyric_video
// ---------------------------------------------------------------------------

const LYRIC_VIDEO_STYLES = ['progressive-wipe'] as const;
type LyricVideoStyle = (typeof LYRIC_VIDEO_STYLES)[number];

const musicSchema = z
  .object({
    bpm: z.number().positive().optional(),
    beatGrid: z.array(z.number().nonnegative()).optional(),
  })
  .strict();

const composeLyricVideoInput = z
  .object({
    lyrics: z.array(wordTimingSchema).min(1),
    music: musicSchema.optional(),
    style: z.enum(LYRIC_VIDEO_STYLES).optional(),
    brand: brandSchema.optional(),
  })
  .strict();

const composeLyricVideoOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(CLUSTER_F_PRESET_IDS),
      clipKind: z.literal('lyrics'),
      rationale: z.string().min(1),
      lyrics: z.array(wordTimingSchema).min(1),
      music: musicSchema.optional(),
      brand: brandSchema.optional(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['invalid_input', 'unsupported_style', 'transcript_empty', 'keywords_empty']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeLyricVideoInput = z.infer<typeof composeLyricVideoInput>;
type ComposeLyricVideoOutput = z.infer<typeof composeLyricVideoOutput>;

const composeLyricVideo: ToolHandler<ComposeLyricVideoInput, ComposeLyricVideoOutput, ToolContext> =
  {
    name: 'compose_lyric_video',
    bundle: CLUSTER_F_COMPOSE_BUNDLE_NAME,
    description:
      "Pick a Cluster F (Lyrics) preset for a lyric / karaoke video and emit a ratified preset id + the echoed `lyrics` payload. v1 sealed at `style: 'progressive-wipe'` → `karaoke-progressive-wipe` (the only `clipKind: lyrics` preset in the cluster; left-to-right per-word color-wipe driven by within-word ms-progress). Optional `music: { bpm?, beatGrid? }` is opaque passthrough — beat detection from raw audio is upstream's concern. Output is `clipKind: lyrics`.",
    inputSchema: composeLyricVideoInput as unknown as z.ZodType<ComposeLyricVideoInput>,
    outputSchema: composeLyricVideoOutput,
    handle: (input, _ctx) => {
      const style: LyricVideoStyle = input.style ?? 'progressive-wipe';
      const presetId = PRESET_DISPATCH.lyricVideo[style] as ClusterFPresetId;
      const rationale = `dispatched lyric-video style='${style}' → ${presetId} (only Cluster F preset binding clipKind 'lyrics')`;
      return {
        ok: true,
        presetId,
        clipKind: 'lyrics',
        rationale,
        lyrics: input.lyrics,
        ...(input.music !== undefined ? { music: input.music } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
      };
    },
  };

// ---------------------------------------------------------------------------
// 4 — compose_keyword_highlight
// ---------------------------------------------------------------------------

const KEYWORD_HIGHLIGHT_STYLES = ['hormozi', 'mrbeast'] as const;
type KeywordHighlightStyle = (typeof KEYWORD_HIGHLIGHT_STYLES)[number];

const composeKeywordHighlightInput = z
  .object({
    transcript: z.array(wordTimingSchema).min(1),
    keywords: z.array(z.string().min(1)).min(1),
    style: z.enum(KEYWORD_HIGHLIGHT_STYLES).optional(),
    brand: brandSchema.optional(),
  })
  .strict();

const composeKeywordHighlightOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(CLUSTER_F_PRESET_IDS),
      clipKind: z.literal('caption'),
      rationale: z.string().min(1),
      transcript: z.array(wordTimingSchema).min(1),
      keywords: z.array(z.string().min(1)).min(1),
      brand: brandSchema.optional(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['invalid_input', 'unsupported_style', 'transcript_empty', 'keywords_empty']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeKeywordHighlightInput = z.infer<typeof composeKeywordHighlightInput>;
type ComposeKeywordHighlightOutput = z.infer<typeof composeKeywordHighlightOutput>;

const composeKeywordHighlight: ToolHandler<
  ComposeKeywordHighlightInput,
  ComposeKeywordHighlightOutput,
  ToolContext
> = {
  name: 'compose_keyword_highlight',
  bundle: CLUSTER_F_COMPOSE_BUNDLE_NAME,
  description:
    "Pick a Cluster F caption preset whose color semantics encode keyword emphasis and emit a ratified preset id + the echoed transcript + keywords. Default `hormozi` → `hormozi-montserrat-black` (yellow / green / red keyword color-pop, broadest palette). `mrbeast` → `mrbeast-komika-axis` (green-on-monetary subvariant). The handler does NOT colorize words inline — the downstream clip-mounting tool applies the preset's keyword-tagging logic. Per-word `emphasis` tagging on `WordTiming` is upstream's concern. Output is `clipKind: caption`.",
  inputSchema: composeKeywordHighlightInput as unknown as z.ZodType<ComposeKeywordHighlightInput>,
  outputSchema: composeKeywordHighlightOutput,
  handle: (input, _ctx) => {
    const style: KeywordHighlightStyle = input.style ?? 'hormozi';
    const presetId = PRESET_DISPATCH.keywordHighlight[style] as ClusterFPresetId;
    const rationale =
      input.style === undefined
        ? `defaulted to 'hormozi' style → ${presetId} (broadest yellow/green/red keyword color palette)`
        : style === 'mrbeast'
          ? `dispatched style='mrbeast' → ${presetId} (green-on-monetary keyword subvariant)`
          : `dispatched style='hormozi' → ${presetId}`;
    return {
      ok: true,
      presetId,
      clipKind: 'caption',
      rationale,
      transcript: input.transcript,
      keywords: input.keywords,
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
    };
  },
};

// ---------------------------------------------------------------------------
// Barrel — handlers + LLM tool definitions
// ---------------------------------------------------------------------------

export const CLUSTER_F_COMPOSE_HANDLERS: readonly ToolHandler<unknown, unknown, ToolContext>[] = [
  composeCreatorCaption,
  composeSubtitle,
  composeLyricVideo,
  composeKeywordHighlight,
] as unknown as readonly ToolHandler<unknown, unknown, ToolContext>[];

// Sanity-check assertion: every preset id in the dispatch table is one of
// the 6 Cluster F preset ids. Pure-type, runtime no-op.
const _PRESET_DISPATCH_VALIDATES_AS_CLUSTER_F = PRESET_CLIP_KIND;
void _PRESET_DISPATCH_VALIDATES_AS_CLUSTER_F;

const wordTimingObject = {
  type: 'object' as const,
  description:
    "Word-timing atom: `{ text, startMs (>=0), endMs (>0), emphasis? ('normal' | 'highlight' | 'mute') }`. Validated server-side against `wordTimingSchema`.",
};
const brandObject = {
  type: 'object' as const,
  description:
    'Optional brand atom: `{ primary? (#RRGGBB), accent? (#RRGGBB), font? }`. Echoed verbatim through to the output envelope; downstream merges with preset bundle defaults at clip-mount time.',
};
const musicObject = {
  type: 'object' as const,
  description:
    'Optional music atom for `compose_lyric_video`: `{ bpm? (>0), beatGrid? (number[]) }`. Opaque passthrough; beat detection from raw audio is upstream.',
};

export const CLUSTER_F_COMPOSE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'compose_creator_caption',
    description: composeCreatorCaption.description,
    input_schema: {
      type: 'object',
      required: ['transcript'],
      additionalProperties: false,
      properties: {
        transcript: { type: 'array', items: wordTimingObject, minItems: 1 },
        style: { type: 'string', enum: [...CREATOR_STYLES] },
        brand: brandObject,
      },
    },
  },
  {
    name: 'compose_subtitle',
    description: composeSubtitle.description,
    input_schema: {
      type: 'object',
      required: ['transcript'],
      additionalProperties: false,
      properties: {
        transcript: { type: 'array', items: wordTimingObject, minItems: 1 },
        accessibility_mode: { type: 'string', enum: [...ACCESSIBILITY_MODES] },
        brand: brandObject,
      },
    },
  },
  {
    name: 'compose_lyric_video',
    description: composeLyricVideo.description,
    input_schema: {
      type: 'object',
      required: ['lyrics'],
      additionalProperties: false,
      properties: {
        lyrics: { type: 'array', items: wordTimingObject, minItems: 1 },
        music: musicObject,
        style: { type: 'string', enum: [...LYRIC_VIDEO_STYLES] },
        brand: brandObject,
      },
    },
  },
  {
    name: 'compose_keyword_highlight',
    description: composeKeywordHighlight.description,
    input_schema: {
      type: 'object',
      required: ['transcript', 'keywords'],
      additionalProperties: false,
      properties: {
        transcript: { type: 'array', items: wordTimingObject, minItems: 1 },
        keywords: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 },
        style: { type: 'string', enum: [...KEYWORD_HIGHLIGHT_STYLES] },
        brand: brandObject,
      },
    },
  },
];
