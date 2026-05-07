// packages/engine/src/handlers/cluster-e-compose/handlers.ts
// `cluster-e-compose` bundle — 5 read-only composer tools that bind a
// semantic Cluster E (Data) brief to a ratified preset id + opaque
// props payload. Tools: compose_live_data / compose_market_ticker /
// compose_election_board / compose_big_number / compose_stat_callout.
// Output is `(presetId, props[, dispatchedLayout])` — the caller mounts
// the clip via a separate write-tier tool (e.g., `add_clip` from
// `create-mutate`).
//
// Per T-361 / D-T361-7: handlers declare `ToolContext` (NOT
// `MutationContext`); they neither read nor mutate the document and
// dispatch is a pure function of input. The determinism gate at
// `CLAUDE.md` §3 covers `packages/runtimes/**` /
// `packages/frame-runtime/**` / `packages/renderer-core/src/clips/**`
// only — composer paths are out of its globs. The handlers are still
// pure (no `Date.now()`, no `Math.random()`, no I/O) by code-review
// discipline.
//
// Cluster E is 6/6 substantive + RATIFIED 2026-05-06 (T-355..T-360);
// this bundle is the agent-facing routing surface. `compose_live_data`
// is routing-only per D-T361-9 — the runtime evaluates frontier
// capability at compose time and uses the live or snapshot path.
// Cluster E ships 5 composer tools (vs 4 for sibling cluster-compose
// bundles) to cover the broader sport-stat-overlay scope via the 5th
// tool `compose_stat_callout`.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { ToolContext, ToolHandler } from '../../router/types.js';

export const CLUSTER_E_COMPOSE_BUNDLE_NAME = 'cluster-e-compose';

// ---------------------------------------------------------------------------
// Cluster E preset enum + sealed vocabularies
// ---------------------------------------------------------------------------

/** The 6 ratified Cluster E preset ids (T-355..T-360). */
export const CLUSTER_E_PRESET_IDS = [
  'magic-wall-drilldown',
  'bloomberg-ticker',
  'big-number-stat-impact',
  'f1-sector-purple-green',
  'cricket-ball-by-ball-dots',
  'olympic-medal-tracker',
] as const;
export type ClusterEPresetId = (typeof CLUSTER_E_PRESET_IDS)[number];

/** Single source-of-truth preset-id constants. Each handler returns one. */
const PRESET_IDS = {
  MAGIC_WALL: 'magic-wall-drilldown',
  BLOOMBERG: 'bloomberg-ticker',
  BIG_NUMBER: 'big-number-stat-impact',
  F1_SECTOR: 'f1-sector-purple-green',
  CRICKET: 'cricket-ball-by-ball-dots',
  OLYMPIC: 'olympic-medal-tracker',
} as const satisfies Record<string, ClusterEPresetId>;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// ---------------------------------------------------------------------------
// 1 — compose_live_data
// ---------------------------------------------------------------------------

const LIVE_DATA_DOMAINS = ['politics', 'finance', 'sports', 'olympic'] as const;
const LIVE_DATA_LAYOUTS = ['wall', 'big-number'] as const;

const composeLiveDataInput = z
  .object({
    domain: z.enum(LIVE_DATA_DOMAINS),
    layout: z.enum(LIVE_DATA_LAYOUTS),
    state: z.record(z.unknown()).optional(),
    brand: z.string().optional(),
    locale: z.string().optional(),
  })
  .strict();

const composeLiveDataOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum([PRESET_IDS.MAGIC_WALL, PRESET_IDS.BIG_NUMBER]),
      dispatchedLayout: z.enum(LIVE_DATA_LAYOUTS),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['unsupported_domain', 'unsupported_layout', 'invalid_state']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeLiveDataInput = z.infer<typeof composeLiveDataInput>;
type ComposeLiveDataOutput = z.infer<typeof composeLiveDataOutput>;

const composeLiveData: ToolHandler<ComposeLiveDataInput, ComposeLiveDataOutput, ToolContext> = {
  name: 'compose_live_data',
  bundle: CLUSTER_E_COMPOSE_BUNDLE_NAME,
  description:
    "Compose a live-data routing plan for Cluster E (Data). Returns a `presetId` of `magic-wall-drilldown` (when `layout: 'wall'`) or `big-number-stat-impact` (when `layout: 'big-number'`), plus opaque pass-through `props` for the runtime to materialize the preset. Does NOT fetch live data — the runtime evaluates frontier capability and chooses the live or fallback path. Refuses `unsupported_domain` for Olympic + wall (use `compose_stat_callout` for Olympic data).",
  inputSchema: composeLiveDataInput as unknown as z.ZodType<ComposeLiveDataInput>,
  outputSchema: composeLiveDataOutput,
  handle: (input, _ctx) => {
    if (input.domain === 'olympic' && input.layout === 'wall') {
      return {
        ok: false,
        reason: 'unsupported_domain',
        detail:
          'Magic Wall is electoral; for Olympic data use compose_stat_callout with sport=olympic',
      };
    }
    const presetId = input.layout === 'wall' ? PRESET_IDS.MAGIC_WALL : PRESET_IDS.BIG_NUMBER;
    const props: Record<string, unknown> = {
      domain: input.domain,
      state: input.state ?? {},
    };
    if (input.brand !== undefined) props.brand = input.brand;
    if (input.locale !== undefined) props.locale = input.locale;
    return {
      ok: true,
      presetId,
      dispatchedLayout: input.layout,
      props,
    };
  },
};

// ---------------------------------------------------------------------------
// 2 — compose_market_ticker
// ---------------------------------------------------------------------------

const TICKER_BRANDS = ['bloomberg', 'generic'] as const;

const composeMarketTickerInput = z
  .object({
    symbols: z.array(z.string().min(1).max(8)).min(1).max(64),
    deltas: z.array(z.number()).optional(),
    brand: z.enum(TICKER_BRANDS).optional(),
    locale: z.string().optional(),
  })
  .strict()
  .refine((v) => !v.deltas || v.deltas.length === v.symbols.length, {
    message: 'deltas length must match symbols length',
  });

const composeMarketTickerOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.literal(PRESET_IDS.BLOOMBERG),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['symbols_required', 'symbols_deltas_mismatch']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeMarketTickerInput = z.infer<typeof composeMarketTickerInput>;
type ComposeMarketTickerOutput = z.infer<typeof composeMarketTickerOutput>;

const composeMarketTicker: ToolHandler<
  ComposeMarketTickerInput,
  ComposeMarketTickerOutput,
  ToolContext
> = {
  name: 'compose_market_ticker',
  bundle: CLUSTER_E_COMPOSE_BUNDLE_NAME,
  description:
    "Compose a Bloomberg-register scrolling ticker routing plan. Returns `presetId: 'bloomberg-ticker'` plus opaque pass-through `props`. `symbols.length` ∈ [1, 64]; `deltas` (when supplied) must match `symbols.length`. `brand: 'generic'` parameterizes the preset for non-Bloomberg palette per the preset stub.",
  inputSchema: composeMarketTickerInput as unknown as z.ZodType<ComposeMarketTickerInput>,
  outputSchema: composeMarketTickerOutput,
  handle: (input, _ctx) => {
    const props: Record<string, unknown> = { symbols: input.symbols };
    if (input.deltas !== undefined) props.deltas = input.deltas;
    if (input.brand !== undefined) props.brand = input.brand;
    if (input.locale !== undefined) props.locale = input.locale;
    return {
      ok: true,
      presetId: PRESET_IDS.BLOOMBERG,
      props,
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — compose_election_board
// ---------------------------------------------------------------------------

const composeElectionBoardInput = z
  .object({
    states: z.array(z.string().min(2).max(40)).min(1).max(60),
    leaders: z.record(z.string()).optional(),
    statePalette: z.record(hexColor).optional(),
    brand: z.string().optional(),
  })
  .strict();

const composeElectionBoardOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.literal(PRESET_IDS.MAGIC_WALL),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['states_required', 'invalid_palette']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeElectionBoardInput = z.infer<typeof composeElectionBoardInput>;
type ComposeElectionBoardOutput = z.infer<typeof composeElectionBoardOutput>;

const composeElectionBoard: ToolHandler<
  ComposeElectionBoardInput,
  ComposeElectionBoardOutput,
  ToolContext
> = {
  name: 'compose_election_board',
  bundle: CLUSTER_E_COMPOSE_BUNDLE_NAME,
  description:
    "Compose a Magic Wall election-board routing plan. Returns `presetId: 'magic-wall-drilldown'` plus opaque pass-through `props`. `states.length` ∈ [1, 60]; `statePalette` (when supplied) must use `^#[0-9a-fA-F]{6}$` hex. Cluster owner of `magic-wall-drilldown` materializes the rendered map via the parity-cli resolver.",
  inputSchema: composeElectionBoardInput as unknown as z.ZodType<ComposeElectionBoardInput>,
  outputSchema: composeElectionBoardOutput,
  handle: (input, _ctx) => {
    const props: Record<string, unknown> = { states: input.states };
    if (input.leaders !== undefined) props.leaders = input.leaders;
    if (input.statePalette !== undefined) props.statePalette = input.statePalette;
    if (input.brand !== undefined) props.brand = input.brand;
    return {
      ok: true,
      presetId: PRESET_IDS.MAGIC_WALL,
      props,
    };
  },
};

// ---------------------------------------------------------------------------
// 4 — compose_big_number
// ---------------------------------------------------------------------------

const BIG_NUMBER_MAGNITUDES = ['raw', 'k', 'm', 'b'] as const;
const BIG_NUMBER_SPORTS = ['f1'] as const;

const composeBigNumberInput = z
  .object({
    figure: z.string().min(1),
    label: z.string().max(120).optional(),
    magnitude: z.enum(BIG_NUMBER_MAGNITUDES).optional(),
    sport: z.enum(BIG_NUMBER_SPORTS).nullish(),
    theme: z.string().optional(),
  })
  .strict();

const composeBigNumberOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum([PRESET_IDS.BIG_NUMBER, PRESET_IDS.F1_SECTOR]),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['figure_required', 'unsupported_sport']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeBigNumberInput = z.infer<typeof composeBigNumberInput>;
type ComposeBigNumberOutput = z.infer<typeof composeBigNumberOutput>;

const composeBigNumber: ToolHandler<ComposeBigNumberInput, ComposeBigNumberOutput, ToolContext> = {
  name: 'compose_big_number',
  bundle: CLUSTER_E_COMPOSE_BUNDLE_NAME,
  description:
    "Compose a big-number stat routing plan. Returns `presetId: 'f1-sector-purple-green'` (when `sport: 'f1'`) or `big-number-stat-impact` (else) plus opaque pass-through `props`. `figure` is string-typed (e.g. `'$3.2M'`, `'87%'`, `'12.4M'`); the cluster skill mandates pre-formatted units — the composer does NOT format.",
  inputSchema: composeBigNumberInput as unknown as z.ZodType<ComposeBigNumberInput>,
  outputSchema: composeBigNumberOutput,
  handle: (input, _ctx) => {
    const presetId = input.sport === 'f1' ? PRESET_IDS.F1_SECTOR : PRESET_IDS.BIG_NUMBER;
    const props: Record<string, unknown> = { figure: input.figure };
    if (input.label !== undefined) props.label = input.label;
    if (input.magnitude !== undefined) props.magnitude = input.magnitude;
    if (input.sport !== undefined && input.sport !== null) props.sport = input.sport;
    if (input.theme !== undefined) props.theme = input.theme;
    return {
      ok: true,
      presetId,
      props,
    };
  },
};

// ---------------------------------------------------------------------------
// 5 — compose_stat_callout
// ---------------------------------------------------------------------------

const STAT_CALLOUT_SPORTS = ['cricket', 'f1', 'olympic'] as const;

const composeStatCalloutInput = z
  .object({
    stat: z.string().min(1).max(120),
    sport: z.enum(STAT_CALLOUT_SPORTS).nullish(),
    context: z.string().max(240).optional(),
    brand: z.string().optional(),
  })
  .strict();

const composeStatCalloutOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum([
        PRESET_IDS.CRICKET,
        PRESET_IDS.F1_SECTOR,
        PRESET_IDS.OLYMPIC,
        PRESET_IDS.BIG_NUMBER,
      ]),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['stat_required', 'unsupported_sport']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeStatCalloutInput = z.infer<typeof composeStatCalloutInput>;
type ComposeStatCalloutOutput = z.infer<typeof composeStatCalloutOutput>;

const STAT_CALLOUT_DISPATCH = {
  cricket: PRESET_IDS.CRICKET,
  f1: PRESET_IDS.F1_SECTOR,
  olympic: PRESET_IDS.OLYMPIC,
} as const satisfies Record<
  (typeof STAT_CALLOUT_SPORTS)[number],
  'cricket-ball-by-ball-dots' | 'f1-sector-purple-green' | 'olympic-medal-tracker'
>;

const composeStatCallout: ToolHandler<
  ComposeStatCalloutInput,
  ComposeStatCalloutOutput,
  ToolContext
> = {
  name: 'compose_stat_callout',
  bundle: CLUSTER_E_COMPOSE_BUNDLE_NAME,
  description:
    "Compose an inline-stat-callout routing plan. Returns one of `cricket-ball-by-ball-dots` (when `sport: 'cricket'`), `f1-sector-purple-green` (when `sport: 'f1'`), `olympic-medal-tracker` (when `sport: 'olympic'`), or `big-number-stat-impact` (default). Plus opaque pass-through `props`. `stat` is string-typed (e.g. `'87 runs off 42 balls'`, `'P3 → P1, gap +0.124'`).",
  inputSchema: composeStatCalloutInput as unknown as z.ZodType<ComposeStatCalloutInput>,
  outputSchema: composeStatCalloutOutput,
  handle: (input, _ctx) => {
    const presetId =
      input.sport === undefined || input.sport === null
        ? PRESET_IDS.BIG_NUMBER
        : STAT_CALLOUT_DISPATCH[input.sport];
    const props: Record<string, unknown> = { stat: input.stat };
    if (input.sport !== undefined && input.sport !== null) props.sport = input.sport;
    if (input.context !== undefined) props.context = input.context;
    if (input.brand !== undefined) props.brand = input.brand;
    return {
      ok: true,
      presetId,
      props,
    };
  },
};

// ---------------------------------------------------------------------------
// Barrel — handlers + LLM tool definitions
// ---------------------------------------------------------------------------

export const CLUSTER_E_COMPOSE_HANDLERS: readonly ToolHandler<unknown, unknown, ToolContext>[] = [
  composeLiveData,
  composeMarketTicker,
  composeElectionBoard,
  composeBigNumber,
  composeStatCallout,
] as unknown as readonly ToolHandler<unknown, unknown, ToolContext>[];

export const CLUSTER_E_COMPOSE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'compose_live_data',
    description: composeLiveData.description,
    input_schema: {
      type: 'object',
      required: ['domain', 'layout'],
      additionalProperties: false,
      properties: {
        domain: { type: 'string', enum: [...LIVE_DATA_DOMAINS] },
        layout: { type: 'string', enum: [...LIVE_DATA_LAYOUTS] },
        state: {
          type: 'object',
          description: 'Opaque host-supplied state pass-through (record of unknown).',
        },
        brand: { type: 'string' },
        locale: { type: 'string' },
      },
    },
  },
  {
    name: 'compose_market_ticker',
    description: composeMarketTicker.description,
    input_schema: {
      type: 'object',
      required: ['symbols'],
      additionalProperties: false,
      properties: {
        symbols: {
          type: 'array',
          description: 'Ticker symbol strings (1–8 chars each); 1–64 entries.',
        },
        deltas: {
          type: 'array',
          description: 'Optional numeric deltas; length must match `symbols`.',
        },
        brand: { type: 'string', enum: [...TICKER_BRANDS] },
        locale: { type: 'string' },
      },
    },
  },
  {
    name: 'compose_election_board',
    description: composeElectionBoard.description,
    input_schema: {
      type: 'object',
      required: ['states'],
      additionalProperties: false,
      properties: {
        states: {
          type: 'array',
          description: 'US state codes / region names (2–40 chars each); 1–60 entries.',
        },
        leaders: {
          type: 'object',
          description: 'Optional `{ stateCode: candidateId }` map.',
        },
        statePalette: {
          type: 'object',
          description: 'Optional `{ stateCode: #RRGGBB }` color overrides.',
        },
        brand: { type: 'string' },
      },
    },
  },
  {
    name: 'compose_big_number',
    description: composeBigNumber.description,
    input_schema: {
      type: 'object',
      required: ['figure'],
      additionalProperties: false,
      properties: {
        figure: {
          type: 'string',
          description: "Pre-formatted figure (e.g. '$3.2M', '87%', '12.4M').",
        },
        label: { type: 'string' },
        magnitude: { type: 'string', enum: [...BIG_NUMBER_MAGNITUDES] },
        sport: { type: 'string', enum: [...BIG_NUMBER_SPORTS] },
        theme: { type: 'string' },
      },
    },
  },
  {
    name: 'compose_stat_callout',
    description: composeStatCallout.description,
    input_schema: {
      type: 'object',
      required: ['stat'],
      additionalProperties: false,
      properties: {
        stat: {
          type: 'string',
          description: "Pre-formatted stat (e.g. '87 runs off 42 balls', 'P3 → P1, gap +0.124').",
        },
        sport: { type: 'string', enum: [...STAT_CALLOUT_SPORTS] },
        context: { type: 'string' },
        brand: { type: 'string' },
      },
    },
  },
];
