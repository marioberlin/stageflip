// packages/engine/src/handlers/cluster-h-compose/handlers.ts
// `cluster-h-compose` bundle — 3 read-only composer tools that bind a
// semantic Cluster H (AR overlays) brief to a ratified preset id +
// opaque props payload. Tools: compose_ar_overlay / compose_var_skeletal /
// compose_swim_lane_track. Output is `(presetId, clipKind, props)` —
// the caller mounts the clip via a separate write-tier tool (e.g.,
// `add_clip` from `create-mutate`).
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
// Cluster H is 4/4 substantive + RATIFIED (T-378 closer 2026-05-11);
// this bundle is the agent-layer surface and CLOSES Cluster H. All four
// presets share `clipKind: 'arOverlay'` (sky-sports is the clipKind-
// default arm in PRESET_ID_BINDINGS; the rest are Pattern-C overrides).
//
// **v1 ships static-fallback rendering ONLY** per D-T375a-2 / D-T379-11:
// the `arOverlay` primitive ignores `setupRef` at render time and always
// renders the static-fallback poster. Live-mount via `ThreeSceneClip`
// is gated on Track A T-397+. Each handler's TSDoc documents this so
// callers don't assume live-mount in v1.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { ToolContext, ToolHandler } from '../../router/types.js';

export const CLUSTER_H_COMPOSE_BUNDLE_NAME = 'cluster-h-compose';

// ---------------------------------------------------------------------------
// Cluster H preset enum + sport / brand vocabularies
// ---------------------------------------------------------------------------

/** The 4 ratified Cluster H preset ids (T-375..T-378). */
export const CLUSTER_H_PRESET_IDS = [
  'sky-sports-ar-formations',
  'hawkeye-var-3d-skeletal',
  'olympic-swim-lane-track',
  'nba-ar-replay',
] as const;
export type ClusterHPresetId = (typeof CLUSTER_H_PRESET_IDS)[number];

/**
 * Sealed sport vocabulary covering the dispatch routes for
 * `compose_ar_overlay`. `soccer` + `football` route to sky-sports;
 * `basketball` routes to nba; `swimming` is handled by the dedicated
 * `compose_swim_lane_track` tool; `tennis` + `cycling` are reserved for
 * typed-error responses pointing at escalation per cluster SKILL.
 */
export const SPORTS = [
  'soccer',
  'football',
  'basketball',
  'swimming',
  'tennis',
  'cycling',
] as const;
export type Sport = (typeof SPORTS)[number];

/**
 * Sealed AR-broadcaster brand vocabulary. Only `sky-sports` and `nba`
 * route to ratified Cluster H presets in v1; the rest return typed
 * `no_preset_for_sport_brand` errors to surface the escalation path
 * cleanly to agents.
 */
export const AR_BRANDS = ['sky-sports', 'nba', 'fox-sports', 'espn', 'tnt'] as const;
export type ArBrand = (typeof AR_BRANDS)[number];

/**
 * Sealed VAR-register brand vocabulary — Hawk-Eye + the two competitions
 * that ship Hawk-Eye-driven VAR (Premier League, UEFA Champions League).
 * All three route to `hawkeye-var-3d-skeletal` (the only Cluster H VAR
 * consumer).
 */
export const VAR_BRANDS = ['hawkeye', 'premier-league', 'uefa-cl'] as const;
export type VarBrand = (typeof VAR_BRANDS)[number];

/**
 * Sealed Olympic-swim-register brand vocabulary — Olympic Games +
 * Omega (timing) + FINA + World Aquatics. All four route to
 * `olympic-swim-lane-track` (the only Cluster H swim consumer).
 */
export const SWIM_BRANDS = ['olympic', 'omega', 'fina', 'world-aquatics'] as const;
export type SwimBrand = (typeof SWIM_BRANDS)[number];

/**
 * Sealed AR-content discriminator forwarded into `compose_ar_overlay`
 * props. Informational only — does NOT influence dispatch (sport + brand
 * suffices).
 */
export const AR_CONTENT_KINDS = ['formation', 'shot-arc', 'player-tracking', 'replay'] as const;
export type ArContentKind = (typeof AR_CONTENT_KINDS)[number];

/**
 * Sealed display-tier vocabulary per cluster SKILL line 46 ("AR is
 * broadcast-first, not mobile-first"). Mobile tier auto-reduces
 * complexity at the primitive layer (post-T-397 live-mount); v1 forwards
 * the value into props opaquely.
 */
export const DISPLAY_TIERS = ['broadcast', 'mobile'] as const;
export type DisplayTier = (typeof DISPLAY_TIERS)[number];

/**
 * Per-preset prop defaults. Cluster H bindings are fully self-contained
 * at parity-cli time (`staticFallback.label` / colors / font are pinned
 * in each `PRESET_ID_BINDINGS` entry); the composer mainly forwards
 * caller payload. Intentionally empty for all four presets — kept as a
 * map for symmetry with sibling cluster-compose bundles + future-proof
 * extension.
 */
const PRESET_DEFAULTS: Record<ClusterHPresetId, Record<string, unknown>> = {
  'sky-sports-ar-formations': {},
  'hawkeye-var-3d-skeletal': {},
  'olympic-swim-lane-track': {},
  'nba-ar-replay': {},
};

// ---------------------------------------------------------------------------
// 1 — compose_ar_overlay
// ---------------------------------------------------------------------------

const arCameraTrackSchema = z
  .object({
    feed: z.enum(['live', 'pre-baked']),
    provider: z.string().min(1).max(80).optional(),
  })
  .strict();

const composeArOverlayInput = z
  .object({
    sport: z.enum(SPORTS),
    content: z.enum(AR_CONTENT_KINDS),
    brand: z.enum(AR_BRANDS),
    cameraTrack: arCameraTrackSchema.optional(),
    displayTier: z.enum(DISPLAY_TIERS).optional(),
    label: z.string().max(120).optional(),
  })
  .strict();

const composeArOverlayOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(['sky-sports-ar-formations', 'nba-ar-replay']),
      clipKind: z.literal('arOverlay'),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.literal('no_preset_for_sport_brand'),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeArOverlayInput = z.infer<typeof composeArOverlayInput>;
type ComposeArOverlayOutput = z.infer<typeof composeArOverlayOutput>;

/**
 * `(sport, brand)` → preset-id dispatch table for `compose_ar_overlay`.
 * Spans 2 of 4 Cluster H presets (Hawk-Eye + Olympic-swim have dedicated
 * tools); D-T379-5. The third sport that maps cleanly to Cluster H
 * (swimming via `compose_swim_lane_track`) is intentionally NOT in this
 * table — `compose_ar_overlay` is the sport-and-brand AR-overlay
 * dispatcher; the dedicated tools handle the VAR + swim registers.
 */
const AR_OVERLAY_DISPATCH: Readonly<
  Partial<
    Record<`${Sport}:${ArBrand}`, ClusterHPresetId & ('sky-sports-ar-formations' | 'nba-ar-replay')>
  >
> = {
  'soccer:sky-sports': 'sky-sports-ar-formations',
  'football:sky-sports': 'sky-sports-ar-formations',
  'basketball:nba': 'nba-ar-replay',
};

/**
 * `compose_ar_overlay` — pick a Cluster H AR-overlay preset by
 * `(sport, brand)`. Routes `(soccer | football, sky-sports)` →
 * sky-sports-ar-formations (Premier League / Sky Sports formation
 * lineup register) and `(basketball, nba)` → nba-ar-replay (court-
 * anchored shot-arc / replay register). Other (sport, brand) tuples
 * return `no_preset_for_sport_brand` with a helpful suggestion. Hawk-Eye
 * VAR + Olympic swim have dedicated tools (`compose_var_skeletal` /
 * `compose_swim_lane_track`).
 *
 * **v1 routes through static-fallback rendering** (D-T379-11) — the
 * `arOverlay` primitive ignores `setupRef` at render time. Live-mount
 * via `ThreeSceneClip` is gated on Track A T-397+. Read-only: caller
 * mounts the clip via a separate write-tier tool.
 */
const composeArOverlay: ToolHandler<ComposeArOverlayInput, ComposeArOverlayOutput, ToolContext> = {
  name: 'compose_ar_overlay',
  bundle: CLUSTER_H_COMPOSE_BUNDLE_NAME,
  description:
    'Pick a Cluster H (AR overlays) preset by `(sport, brand)` and emit a ratified preset id + clipKind + opaque props payload. Sealed sport enum (soccer / football / basketball / swimming / tennis / cycling) + AR-brand enum (sky-sports / nba / fox-sports / espn / tnt). Dispatch: (soccer | football, sky-sports) → sky-sports-ar-formations; (basketball, nba) → nba-ar-replay; other (sport, brand) tuples return no_preset_for_sport_brand. Hawk-Eye VAR has a dedicated tool (compose_var_skeletal); Olympic swim has a dedicated tool (compose_swim_lane_track) — do not route those through compose_ar_overlay. v1 ships static-fallback only; live-mount via ThreeSceneClip is gated on Track A T-397+. Read-only: caller mounts the clip via a separate write-tier tool.',
  inputSchema: composeArOverlayInput as unknown as z.ZodType<ComposeArOverlayInput>,
  outputSchema: composeArOverlayOutput,
  handle: (input, _ctx) => {
    const key = `${input.sport}:${input.brand}` as const;
    const presetId = AR_OVERLAY_DISPATCH[key];
    if (!presetId) {
      return {
        ok: false,
        reason: 'no_preset_for_sport_brand',
        detail: buildNoPresetDetail(input.sport, input.brand),
      };
    }
    const defaults = PRESET_DEFAULTS[presetId];
    const payload: Record<string, unknown> = {
      sport: input.sport,
      content: input.content,
      brand: input.brand,
      ...(input.cameraTrack !== undefined ? { cameraTrack: input.cameraTrack } : {}),
      ...(input.displayTier !== undefined ? { displayTier: input.displayTier } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
    };
    return {
      ok: true,
      presetId,
      clipKind: 'arOverlay',
      props: { ...defaults, ...payload },
    };
  },
};

/**
 * Build a helpful suggestion string for the `no_preset_for_sport_brand`
 * error path. Mentions the closest available Cluster H register (or the
 * dedicated tool for VAR / swim) so agents can self-correct without
 * reading the cluster SKILL.
 */
function buildNoPresetDetail(sport: Sport, brand: ArBrand): string {
  if (sport === 'swimming') {
    return 'Olympic swim has a dedicated tool — call compose_swim_lane_track instead.';
  }
  if (sport === 'tennis' || sport === 'cycling') {
    return `Cluster H has no preset for sport='${sport}' in v1; per cluster SKILL escalation, new sports require new presets (not new dispatch routes).`;
  }
  return `Cluster H has no preset for (sport='${sport}', brand='${brand}'); supported tuples: (soccer|football, sky-sports) → sky-sports-ar-formations; (basketball, nba) → nba-ar-replay. For Hawk-Eye VAR call compose_var_skeletal; for Olympic swim call compose_swim_lane_track.`;
}

// ---------------------------------------------------------------------------
// 2 — compose_var_skeletal
// ---------------------------------------------------------------------------

const composeVarSkeletalInput = z
  .object({
    brand: z.enum(VAR_BRANDS),
    freezeFrame: z
      .object({
        timestampMs: z.number().int().nonnegative(),
        advisory: z.string().max(120).optional(),
      })
      .strict()
      .optional(),
    playerTracking: z
      .array(
        z
          .object({
            role: z.enum(['attacker', 'defender']),
            skeletalPoints: z.number().int().min(0).max(40).optional(),
          })
          .strict(),
      )
      .max(22)
      .optional(),
    decision: z.enum(['confirmed', 'overturned', 'pending']).optional(),
  })
  .strict();

const composeVarSkeletalOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.literal('hawkeye-var-3d-skeletal'),
      clipKind: z.literal('arOverlay'),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.literal('no_preset_for_brand'),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeVarSkeletalInput = z.infer<typeof composeVarSkeletalInput>;
type ComposeVarSkeletalOutput = z.infer<typeof composeVarSkeletalOutput>;

/**
 * `compose_var_skeletal` — emit the Cluster H Hawk-Eye VAR preset
 * (`hawkeye-var-3d-skeletal`; arOverlay) for the offside-decision 3D
 * skeletal-wireframe register. Sealed brand enum (hawkeye / premier-
 * league / uefa-cl) — all three route to the same preset (the only
 * Cluster H VAR consumer).
 *
 * Per cluster SKILL line 37: pairs with Cluster B's `compose_var_call`
 * (lower-third decision banner) — `compose_var_skeletal` produces the
 * AR-overlay piece, both can ship in the same composition.
 *
 * Per cluster SKILL line 45 ("Decision reveals use pause + flash"):
 * the Hawk-Eye pause-then-flash beat lives at the primitive layer
 * (post-T-397 live-mount); the v1 composer emits a static-fallback
 * payload only. `decision: 'confirmed' | 'overturned' | 'pending'` is
 * forwarded opaquely.
 *
 * **v1 routes through static-fallback rendering** (D-T379-11). Read-
 * only: caller mounts the clip via a separate write-tier tool.
 */
const composeVarSkeletal: ToolHandler<
  ComposeVarSkeletalInput,
  ComposeVarSkeletalOutput,
  ToolContext
> = {
  name: 'compose_var_skeletal',
  bundle: CLUSTER_H_COMPOSE_BUNDLE_NAME,
  description:
    "Emit the Cluster H Hawk-Eye VAR preset (hawkeye-var-3d-skeletal; arOverlay) for the offside-decision 3D skeletal-wireframe register. Sealed brand enum (hawkeye / premier-league / uefa-cl) — all three route to the same preset (only Cluster H VAR consumer). Optional `freezeFrame` (`timestampMs` + `advisory` text), `playerTracking[]` (per-player skeletal-point counts up to 22 entries), `decision: 'confirmed' | 'overturned' | 'pending'`. Per cluster SKILL line 37, pairs with Cluster B's compose_var_call for the lower-third decision banner; per line 45 the pause-then-flash decision-reveal animation lives at the primitive layer (post-T-397 live-mount). v1 ships static-fallback only.",
  inputSchema: composeVarSkeletalInput as unknown as z.ZodType<ComposeVarSkeletalInput>,
  outputSchema: composeVarSkeletalOutput,
  handle: (input, _ctx) => {
    const presetId = 'hawkeye-var-3d-skeletal' as const;
    const defaults = PRESET_DEFAULTS[presetId];
    const payload: Record<string, unknown> = {
      brand: input.brand,
      ...(input.freezeFrame !== undefined ? { freezeFrame: input.freezeFrame } : {}),
      ...(input.playerTracking !== undefined ? { playerTracking: input.playerTracking } : {}),
      ...(input.decision !== undefined ? { decision: input.decision } : {}),
    };
    return {
      ok: true,
      presetId,
      clipKind: 'arOverlay',
      props: { ...defaults, ...payload },
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — compose_swim_lane_track
// ---------------------------------------------------------------------------

const composeSwimLaneTrackInput = z
  .object({
    brand: z.enum(SWIM_BRANDS),
    laneCount: z.number().int().min(2).max(10),
    recordTime: z
      .object({
        seconds: z.number().nonnegative(),
        holder: z.string().min(1).max(80).optional(),
        eventName: z.string().min(1).max(80).optional(),
      })
      .strict()
      .optional(),
    athletes: z
      .array(
        z
          .object({
            laneNumber: z.number().int().min(1).max(10),
            name: z.string().min(1).max(80),
            countryCode: z.string().length(3).optional(),
          })
          .strict(),
      )
      .max(10)
      .optional(),
  })
  .strict();

const composeSwimLaneTrackOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.literal('olympic-swim-lane-track'),
      clipKind: z.literal('arOverlay'),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.literal('no_preset_for_brand'),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeSwimLaneTrackInput = z.infer<typeof composeSwimLaneTrackInput>;
type ComposeSwimLaneTrackOutput = z.infer<typeof composeSwimLaneTrackOutput>;

/**
 * `compose_swim_lane_track` — emit the Cluster H Olympic swim preset
 * (`olympic-swim-lane-track`; arOverlay) for the lane-anchored timing /
 * world-record-line register. Sealed brand enum (olympic / omega / fina /
 * world-aquatics) — all four route to the same preset (the only Cluster
 * H swim consumer).
 *
 * Per cluster SKILL line 43 ("Virtual-line graphics read as
 * authoritative") — the world-record line is the dramatic differentiator
 * and v1 forwards `recordTime` opaquely into the static-fallback props.
 * `laneCount` ranges 2 (head-to-head heat) to 10 (10-lane outdoor pool).
 * `athletes[]` carries per-lane identity (ISO 3166-1 alpha-3 country
 * codes).
 *
 * Per the T-377 binding's `permissions: ['network']` reservation
 * (Cluster H's first network-bound declaration), live-mount post-T-397
 * will integrate with `LiveDataClip` + the Omega Vionardo timing feed;
 * v1 forwards opaque payload only.
 *
 * **v1 routes through static-fallback rendering** (D-T379-11). Read-
 * only: caller mounts the clip via a separate write-tier tool.
 */
const composeSwimLaneTrack: ToolHandler<
  ComposeSwimLaneTrackInput,
  ComposeSwimLaneTrackOutput,
  ToolContext
> = {
  name: 'compose_swim_lane_track',
  bundle: CLUSTER_H_COMPOSE_BUNDLE_NAME,
  description:
    "Emit the Cluster H Olympic swim preset (olympic-swim-lane-track; arOverlay) for the lane-anchored timing + virtual world-record-line register. Sealed brand enum (olympic / omega / fina / world-aquatics) — all four route to the same preset (only Cluster H swim consumer). Required `laneCount` (2 = head-to-head heat; 10 = 10-lane outdoor pool); optional `recordTime` (seconds + holder + eventName), `athletes[]` (per-lane name + ISO 3166-1 alpha-3 countryCode, up to 10 entries). Per cluster SKILL line 43 the WR line reads as authoritative; per the T-377 binding's network permission reservation, live-mount post-T-397 will integrate with the Omega Vionardo timing feed via LiveDataClip. v1 ships static-fallback only.",
  inputSchema: composeSwimLaneTrackInput as unknown as z.ZodType<ComposeSwimLaneTrackInput>,
  outputSchema: composeSwimLaneTrackOutput,
  handle: (input, _ctx) => {
    const presetId = 'olympic-swim-lane-track' as const;
    const defaults = PRESET_DEFAULTS[presetId];
    const payload: Record<string, unknown> = {
      brand: input.brand,
      laneCount: input.laneCount,
      ...(input.recordTime !== undefined ? { recordTime: input.recordTime } : {}),
      ...(input.athletes !== undefined ? { athletes: input.athletes } : {}),
    };
    return {
      ok: true,
      presetId,
      clipKind: 'arOverlay',
      props: { ...defaults, ...payload },
    };
  },
};

// ---------------------------------------------------------------------------
// Barrel — handlers + LLM tool definitions
// ---------------------------------------------------------------------------

export const CLUSTER_H_COMPOSE_HANDLERS: readonly ToolHandler<unknown, unknown, ToolContext>[] = [
  composeArOverlay,
  composeVarSkeletal,
  composeSwimLaneTrack,
] as unknown as readonly ToolHandler<unknown, unknown, ToolContext>[];

const cameraTrackObject = {
  type: 'object' as const,
  description:
    'Camera-track atom: `{ feed: live | pre-baked, provider? }`. `provider` is informational (e.g. "Zero Density", "Stype"); the v1 primitive ignores it.',
};
const freezeFrameObject = {
  type: 'object' as const,
  description:
    'Freeze-frame atom: `{ timestampMs (>=0), advisory? }`. `advisory` is the on-screen text during the VAR check (e.g. "CHECKING OFFSIDE").',
};
const playerTrackingItemObject = {
  type: 'object' as const,
  description:
    'Player-tracking atom: `{ role: attacker | defender, skeletalPoints? (0..40) }`. Up to 22 entries per array.',
};
const recordTimeObject = {
  type: 'object' as const,
  description:
    'Record-time atom: `{ seconds (>=0), holder?, eventName? }`. Used for the Olympic WR-line dramatic differentiator.',
};
const athleteItemObject = {
  type: 'object' as const,
  description:
    'Athlete atom: `{ laneNumber (1..10), name (1..80 chars), countryCode? (ISO 3166-1 alpha-3) }`. Up to 10 entries per array.',
};

export const CLUSTER_H_COMPOSE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'compose_ar_overlay',
    description: composeArOverlay.description,
    input_schema: {
      type: 'object',
      required: ['sport', 'content', 'brand'],
      additionalProperties: false,
      properties: {
        sport: { type: 'string', enum: [...SPORTS] },
        content: { type: 'string', enum: [...AR_CONTENT_KINDS] },
        brand: { type: 'string', enum: [...AR_BRANDS] },
        cameraTrack: cameraTrackObject,
        displayTier: { type: 'string', enum: [...DISPLAY_TIERS] },
        label: { type: 'string', maxLength: 120 },
      },
    },
  },
  {
    name: 'compose_var_skeletal',
    description: composeVarSkeletal.description,
    input_schema: {
      type: 'object',
      required: ['brand'],
      additionalProperties: false,
      properties: {
        brand: { type: 'string', enum: [...VAR_BRANDS] },
        freezeFrame: freezeFrameObject,
        playerTracking: {
          type: 'array',
          items: playerTrackingItemObject,
          maxItems: 22,
        },
        decision: { type: 'string', enum: ['confirmed', 'overturned', 'pending'] },
      },
    },
  },
  {
    name: 'compose_swim_lane_track',
    description: composeSwimLaneTrack.description,
    input_schema: {
      type: 'object',
      required: ['brand', 'laneCount'],
      additionalProperties: false,
      properties: {
        brand: { type: 'string', enum: [...SWIM_BRANDS] },
        laneCount: { type: 'integer', minimum: 2, maximum: 10 },
        recordTime: recordTimeObject,
        athletes: {
          type: 'array',
          items: athleteItemObject,
          maxItems: 10,
        },
      },
    },
  },
];
