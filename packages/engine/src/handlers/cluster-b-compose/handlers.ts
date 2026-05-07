// packages/engine/src/handlers/cluster-b-compose/handlers.ts
// `cluster-b-compose` bundle — 4 read-only composer tools that bind a
// semantic Cluster B (Sports) brief to a ratified preset id + props
// payload. Tools: compose_sports_score / compose_standings_table /
// compose_var_call / compose_player_intro. Output is opaque
// `(presetId, props)` — the caller mounts the clip via a separate
// write-tier tool (e.g., `add_clip` from `create-mutate`).
//
// Per T-340 / D-T340-2: handlers declare `ToolContext` (NOT
// `MutationContext`); they neither read nor mutate the document and
// dispatch is a pure function of input. The determinism gate at
// `CLAUDE.md` §3 covers `packages/runtimes/**` /
// `packages/frame-runtime/**` / `packages/renderer-core/src/clips/**`
// only — composer paths are out of its globs. The handlers are still
// pure (no `Date.now()`, no `Math.random()`, no I/O) by code-review
// discipline.
//
// Cluster B is 9/9 substantive + signed (T-339 merged 2026-05-06); this
// bundle is the first downstream consumer surface. `compose_var_call`
// and `compose_player_intro` are reserved surfaces returning
// `not_yet_implemented` for all inputs in v1 — T-320 (`VARBanner`) +
// the eventual Cluster B `playerIntro` preset will fill the dispatch
// bodies additively without touching the schemas.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { ToolContext, ToolHandler } from '../../router/types.js';

export const CLUSTER_B_COMPOSE_BUNDLE_NAME = 'cluster-b-compose';

// ---------------------------------------------------------------------------
// Cluster B preset enum + sport / brand vocabularies
// ---------------------------------------------------------------------------

/** The 9 ratified Cluster B preset ids (T-332..T-339 + T-339a). */
export const CLUSTER_B_PRESET_IDS = [
  'premier-league-field-of-play',
  'fox-nfl-no-chrome',
  'nbc-snf-possession-illuminated',
  'f1-timing-tower',
  'cricket-scorebug',
  'wimbledon-green-purple',
  'espn-bottomline-flipper',
  'masters-red-under-par',
  'uefa-starball-refraction',
] as const;
export type ClusterBPresetId = (typeof CLUSTER_B_PRESET_IDS)[number];

/** Sealed sport vocabulary covering the 9 ratified Cluster B presets. */
export const SPORTS = ['football', 'racing', 'cricket', 'tennis', 'soccer', 'golf'] as const;
export type Sport = (typeof SPORTS)[number];

/** Sealed brand / league / network vocabulary. */
export const BRANDS = [
  'premier-league',
  'fox-nfl',
  'nbc-snf',
  'espn',
  'f1',
  'icc',
  'wimbledon',
  'masters',
  'uefa-cl',
] as const;
export type Brand = (typeof BRANDS)[number];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// ---------------------------------------------------------------------------
// 1 — compose_sports_score
// ---------------------------------------------------------------------------

const teamScoreSchema = z
  .object({
    code: z.string().min(1).max(8),
    color: hexColor,
    score: z.string(),
  })
  .strict();

const composeSportsScoreInput = z
  .object({
    sport: z.enum(SPORTS),
    brand: z.enum(BRANDS),
    home: teamScoreSchema,
    away: teamScoreSchema,
    clock: z.string().min(1),
    period: z.string().min(1),
    possession: z.enum(['home', 'away']).optional(),
    down: z.string().optional(),
    direction: z.enum(['left-to-right', 'right-to-left']).optional(),
    centerCircle: z.boolean().optional(),
    backdropGradient: z
      .object({
        centerOpacity: z.number().min(0).max(1),
        edgeOpacity: z.number().min(0).max(1),
      })
      .strict()
      .optional(),
  })
  .strict();

const composeSportsScoreOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(CLUSTER_B_PRESET_IDS),
      clipKind: z.enum(['scoreBug', 'newsTicker']),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'no_preset_for_sport_brand',
        'sport_not_supported_by_compose_sports_score',
        'invalid_brand_for_sport',
      ]),
      detail: z.string().optional(),
      candidatePresets: z.array(z.enum(CLUSTER_B_PRESET_IDS)).optional(),
    })
    .strict(),
]);

type ComposeSportsScoreInput = z.infer<typeof composeSportsScoreInput>;
type ComposeSportsScoreOutput = z.infer<typeof composeSportsScoreOutput>;

/**
 * (sport, brand) → preset-id dispatch table for `compose_sports_score`.
 * Entries spanning all 7 of 9 Cluster B presets that bind `scoreBug` or
 * `newsTicker` (the bottom-line use). Golf routes to
 * `compose_standings_table`; UEFA fullScreen routes to var-call /
 * player-intro per D-T340-12.
 */
const SCORE_BUG_DISPATCH: Readonly<Partial<Record<`${Sport}:${Brand}`, ClusterBPresetId>>> = {
  // Football presets (3) + soccer synonym
  'football:premier-league': 'premier-league-field-of-play',
  'soccer:premier-league': 'premier-league-field-of-play',
  'football:fox-nfl': 'fox-nfl-no-chrome',
  'football:nbc-snf': 'nbc-snf-possession-illuminated',
  // Racing
  'racing:f1': 'f1-timing-tower',
  // Cricket
  'cricket:icc': 'cricket-scorebug',
  // Tennis
  'tennis:wimbledon': 'wimbledon-green-purple',
  // ESPN bottom-line newsTicker (sport-agnostic; brand picks)
  'football:espn': 'espn-bottomline-flipper',
  'soccer:espn': 'espn-bottomline-flipper',
  'racing:espn': 'espn-bottomline-flipper',
  'cricket:espn': 'espn-bottomline-flipper',
  'tennis:espn': 'espn-bottomline-flipper',
};

/** Per-preset clipKind binding (canonical from each preset's frontmatter). */
const PRESET_CLIP_KIND: Record<
  ClusterBPresetId,
  'scoreBug' | 'newsTicker' | 'standings' | 'fullScreen'
> = {
  'premier-league-field-of-play': 'scoreBug',
  'fox-nfl-no-chrome': 'scoreBug',
  'nbc-snf-possession-illuminated': 'scoreBug',
  'f1-timing-tower': 'scoreBug',
  'cricket-scorebug': 'scoreBug',
  'wimbledon-green-purple': 'scoreBug',
  'espn-bottomline-flipper': 'newsTicker',
  'masters-red-under-par': 'standings',
  'uefa-starball-refraction': 'fullScreen',
};

/**
 * Per-preset prop defaults forwarded into the `props` payload when the
 * caller omits the relevant fields. Sourced from each preset's snapshot
 * canon; documented inline so the dispatch is auditable next to its
 * defaults table.
 */
const PRESET_DEFAULTS: Partial<Record<ClusterBPresetId, Record<string, unknown>>> = {
  // NBC SNF: possession-illumination is the marquee identity; centerCircle
  // chevrons are the canonical default per T-335 frontmatter.
  'nbc-snf-possession-illuminated': { centerCircle: true },
  // Fox NFL: no-chrome backdrop gradient is the marquee identity.
  'fox-nfl-no-chrome': {
    backdropGradient: { centerOpacity: 0.7, edgeOpacity: 0 },
  },
};

const composeSportsScore: ToolHandler<
  ComposeSportsScoreInput,
  ComposeSportsScoreOutput,
  ToolContext
> = {
  name: 'compose_sports_score',
  bundle: CLUSTER_B_COMPOSE_BUNDLE_NAME,
  description:
    'Pick a Cluster B (Sports) score-bug or news-ticker preset by `sport` + `brand` and emit a ratified preset id + opaque props payload. Dispatches across the 7 Cluster B presets that bind `scoreBug` or bottom-line `newsTicker`. Golf maps to `compose_standings_table`; UEFA fullScreen / VAR routes to `compose_var_call`. Caller mounts the clip via a separate write-tier tool.',
  inputSchema: composeSportsScoreInput as unknown as z.ZodType<ComposeSportsScoreInput>,
  outputSchema: composeSportsScoreOutput,
  handle: (input, _ctx) => {
    if (input.sport === 'golf') {
      return {
        ok: false,
        reason: 'sport_not_supported_by_compose_sports_score',
        detail: 'golf maps to compose_standings_table',
      };
    }
    const key = `${input.sport}:${input.brand}` as const;
    const presetId = SCORE_BUG_DISPATCH[key];
    if (!presetId) {
      // Build candidate list scoped to this sport for a useful error.
      const candidates: ClusterBPresetId[] = [];
      for (const [k, v] of Object.entries(SCORE_BUG_DISPATCH)) {
        if (!v) continue;
        if (k.startsWith(`${input.sport}:`)) candidates.push(v);
      }
      return {
        ok: false,
        reason: 'no_preset_for_sport_brand',
        detail: `(${input.sport}, ${input.brand}) has no Cluster B scoreBug binding`,
        ...(candidates.length > 0 ? { candidatePresets: Array.from(new Set(candidates)) } : {}),
      };
    }
    const defaults = PRESET_DEFAULTS[presetId] ?? {};
    const { sport: _s, brand: _b, ...payload } = input;
    const props: Record<string, unknown> = { ...defaults, ...payload };
    return {
      ok: true,
      presetId,
      clipKind: PRESET_CLIP_KIND[presetId] as 'scoreBug' | 'newsTicker',
      props,
    };
  },
};

// ---------------------------------------------------------------------------
// 2 — compose_standings_table
// ---------------------------------------------------------------------------

const standingsRowSchema = z
  .object({
    rank: z.number().int().positive(),
    label: z.string().min(1),
    primary: z.string(),
    delta: z.string().optional(),
    highlight: z.boolean().optional(),
  })
  .strict();

const composeStandingsTableInput = z
  .object({
    sport: z.enum(SPORTS),
    brand: z.enum(BRANDS),
    rows: z.array(standingsRowSchema).min(1).max(20),
    title: z.string().optional(),
    subtitle: z.string().optional(),
  })
  .strict();

const composeStandingsTableOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(CLUSTER_B_PRESET_IDS),
      clipKind: z.literal('standings'),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'no_preset_for_sport_brand',
        'sport_not_supported',
        'not_applicable_in_cluster_b',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeStandingsTableInput = z.infer<typeof composeStandingsTableInput>;
type ComposeStandingsTableOutput = z.infer<typeof composeStandingsTableOutput>;

const composeStandingsTable: ToolHandler<
  ComposeStandingsTableInput,
  ComposeStandingsTableOutput,
  ToolContext
> = {
  name: 'compose_standings_table',
  bundle: CLUSTER_B_COMPOSE_BUNDLE_NAME,
  description:
    'Pick a Cluster B (Sports) standings / leaderboard preset by `sport` + `brand` and emit a ratified preset id + opaque props payload. v1 routes only `(golf, masters)` → `masters-red-under-par`; non-golf standings (Olympic medal tables, league tables) route through Cluster E.',
  inputSchema: composeStandingsTableInput as unknown as z.ZodType<ComposeStandingsTableInput>,
  outputSchema: composeStandingsTableOutput,
  handle: (input, _ctx) => {
    if (input.sport === 'golf' && input.brand === 'masters') {
      const { sport: _s, brand: _b, ...payload } = input;
      return {
        ok: true,
        presetId: 'masters-red-under-par',
        clipKind: 'standings',
        props: payload,
      };
    }
    return {
      ok: false,
      reason: 'not_applicable_in_cluster_b',
      detail:
        'standings tables for non-golf sports route through Cluster E (e.g., olympic-medal-tracker via T-357)',
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — compose_var_call (reserved surface; v1 always not_yet_implemented)
// ---------------------------------------------------------------------------

const composeVarCallInput = z
  .object({
    sport: z.enum(['football', 'soccer']),
    brand: z.enum(['premier-league', 'uefa-cl']),
    decision: z.enum([
      'goal',
      'no-goal',
      'penalty',
      'no-penalty',
      'red-card',
      'no-red-card',
      'offside',
      'no-offside',
    ]),
    reason: z.string().min(1).max(200).optional(),
  })
  .strict();

const composeVarCallOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(CLUSTER_B_PRESET_IDS),
      clipKind: z.literal('breaking'),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['not_yet_implemented', 'invalid_brand_for_sport', 'invalid_sport_for_var']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeVarCallInput = z.infer<typeof composeVarCallInput>;
type ComposeVarCallOutput = z.infer<typeof composeVarCallOutput>;

const composeVarCall: ToolHandler<ComposeVarCallInput, ComposeVarCallOutput, ToolContext> = {
  name: 'compose_var_call',
  bundle: CLUSTER_B_COMPOSE_BUNDLE_NAME,
  description:
    'Reserved surface for VAR call-out compositions (PL / UCL register only). The bound clip `VARBanner` is gap-task T-320; this tool always returns `not_yet_implemented` in v1. Schema is full-fidelity so the consumer-facing contract is forward-compatible — when T-320 lands, only the dispatch body fills in.',
  inputSchema: composeVarCallInput as unknown as z.ZodType<ComposeVarCallInput>,
  outputSchema: composeVarCallOutput,
  handle: (_input, _ctx) => {
    return {
      ok: false,
      reason: 'not_yet_implemented',
      detail:
        'VARBanner clip is gap-task T-320; this composer surface is reserved for forward compatibility.',
    };
  },
};

// ---------------------------------------------------------------------------
// 4 — compose_player_intro (reserved surface; v1 always not_yet_implemented)
// ---------------------------------------------------------------------------

const composePlayerIntroInput = z
  .object({
    sport: z.enum(SPORTS),
    brand: z.enum(BRANDS),
    player: z
      .object({
        name: z.string().min(1),
        code: z.string().min(1).max(8).optional(),
        countryCode: z.string().length(3).optional(),
        teamCode: z.string().min(1).max(8).optional(),
        teamColor: hexColor.optional(),
        seed: z.number().int().positive().optional(),
        headshotAssetId: z.string().min(1).optional(),
      })
      .strict(),
    stats: z
      .array(
        z
          .object({
            label: z.string().min(1),
            value: z.string().min(1),
          })
          .strict(),
      )
      .max(6)
      .optional(),
  })
  .strict();

const composePlayerIntroOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(CLUSTER_B_PRESET_IDS),
      clipKind: z.literal('playerIntro'),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['not_yet_implemented', 'no_preset_for_sport_brand']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposePlayerIntroInput = z.infer<typeof composePlayerIntroInput>;
type ComposePlayerIntroOutput = z.infer<typeof composePlayerIntroOutput>;

const composePlayerIntro: ToolHandler<
  ComposePlayerIntroInput,
  ComposePlayerIntroOutput,
  ToolContext
> = {
  name: 'compose_player_intro',
  bundle: CLUSTER_B_COMPOSE_BUNDLE_NAME,
  description:
    'Reserved surface for Cluster B player-intro compositions. No Cluster B preset binds the `playerIntro` clipKind in v1; this tool always returns `not_yet_implemented`. When the eventual Cluster B player-intro preset lands, only the dispatch body fills in — schema + registration + tool name stay intact.',
  inputSchema: composePlayerIntroInput as unknown as z.ZodType<ComposePlayerIntroInput>,
  outputSchema: composePlayerIntroOutput,
  handle: (_input, _ctx) => {
    return {
      ok: false,
      reason: 'not_yet_implemented',
      detail:
        'No Cluster B preset binds the playerIntro clipKind yet; this composer surface is reserved for forward compatibility.',
    };
  },
};

// ---------------------------------------------------------------------------
// Barrel — handlers + LLM tool definitions
// ---------------------------------------------------------------------------

export const CLUSTER_B_COMPOSE_HANDLERS: readonly ToolHandler<unknown, unknown, ToolContext>[] = [
  composeSportsScore,
  composeStandingsTable,
  composeVarCall,
  composePlayerIntro,
] as unknown as readonly ToolHandler<unknown, unknown, ToolContext>[];

const teamScoreObject = {
  type: 'object' as const,
  description:
    "Team-score atom: `{ code, color (#RRGGBB), score }`. `code` is 1–8 chars (e.g. 'ARS' / 'KC'). Validated server-side against `teamScoreSchema`.",
};
const standingsRowObject = {
  type: 'object' as const,
  description:
    'Standings row: `{ rank (1+), label, primary, delta?, highlight? }`. Validated server-side against `standingsRowSchema`.',
};
const playerObject = {
  type: 'object' as const,
  description:
    'Player atom: `{ name, code?, countryCode (ISO-3)?, teamCode?, teamColor (#RRGGBB)?, seed?, headshotAssetId? }`.',
};
const statRowObject = {
  type: 'object' as const,
  description: 'Stat row: `{ label, value }`. Both required, both non-empty.',
};
const backdropGradientObject = {
  type: 'object' as const,
  description: '`{ centerOpacity (0–1), edgeOpacity (0–1) }` — Fox NFL no-chrome backdrop.',
};

export const CLUSTER_B_COMPOSE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'compose_sports_score',
    description: composeSportsScore.description,
    input_schema: {
      type: 'object',
      required: ['sport', 'brand', 'home', 'away', 'clock', 'period'],
      additionalProperties: false,
      properties: {
        sport: { type: 'string', enum: [...SPORTS] },
        brand: { type: 'string', enum: [...BRANDS] },
        home: teamScoreObject,
        away: teamScoreObject,
        clock: { type: 'string', minLength: 1 },
        period: { type: 'string', minLength: 1 },
        possession: { type: 'string', enum: ['home', 'away'] },
        down: { type: 'string' },
        direction: { type: 'string', enum: ['left-to-right', 'right-to-left'] },
        centerCircle: { type: 'boolean' },
        backdropGradient: backdropGradientObject,
      },
    },
  },
  {
    name: 'compose_standings_table',
    description: composeStandingsTable.description,
    input_schema: {
      type: 'object',
      required: ['sport', 'brand', 'rows'],
      additionalProperties: false,
      properties: {
        sport: { type: 'string', enum: [...SPORTS] },
        brand: { type: 'string', enum: [...BRANDS] },
        rows: { type: 'array', items: standingsRowObject, minItems: 1, maxItems: 20 },
        title: { type: 'string' },
        subtitle: { type: 'string' },
      },
    },
  },
  {
    name: 'compose_var_call',
    description: composeVarCall.description,
    input_schema: {
      type: 'object',
      required: ['sport', 'brand', 'decision'],
      additionalProperties: false,
      properties: {
        sport: { type: 'string', enum: ['football', 'soccer'] },
        brand: { type: 'string', enum: ['premier-league', 'uefa-cl'] },
        decision: {
          type: 'string',
          enum: [
            'goal',
            'no-goal',
            'penalty',
            'no-penalty',
            'red-card',
            'no-red-card',
            'offside',
            'no-offside',
          ],
        },
        reason: { type: 'string', minLength: 1, maxLength: 200 },
      },
    },
  },
  {
    name: 'compose_player_intro',
    description: composePlayerIntro.description,
    input_schema: {
      type: 'object',
      required: ['sport', 'brand', 'player'],
      additionalProperties: false,
      properties: {
        sport: { type: 'string', enum: [...SPORTS] },
        brand: { type: 'string', enum: [...BRANDS] },
        player: playerObject,
        stats: { type: 'array', items: statRowObject, maxItems: 6 },
      },
    },
  },
];
