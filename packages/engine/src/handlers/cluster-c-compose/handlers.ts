// packages/engine/src/handlers/cluster-c-compose/handlers.ts
// `cluster-c-compose` bundle — 4 read-only composer tools that bind a
// semantic Cluster C (Weather) brief to a ratified preset id + opaque
// props payload. Tools: compose_weather_alert / compose_forecast_map /
// compose_storm_track / compose_temperature_map. Output is
// `(presetId, props)` — the caller mounts the clip via a separate
// write-tier tool (e.g., `add_clip` from `create-mutate`).
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
// Cluster C is 6/6 substantive + RATIFIED 2026-05-09 (T-347c..T-347h);
// this bundle is the agent-facing routing surface.
//
// Cluster invariants (per skills/stageflip/presets/weather/SKILL.md):
//   * Color palettes are public-interest STANDARDS, not brand —
//     Doppler dBZ progression and Meriam temperature gradient are
//     pinned at the primitive layer; the composer MUST NOT accept
//     palette overrides (D-T347-10).
//   * NHC cone disclaimer is mandatory ('Impacts extend beyond the
//     cone'); the `stormTracker` primitive carries this as a default,
//     so the composer is composer-transparent — when caller omits
//     `disclaimerText`, the output `props` does NOT include the key,
//     and the primitive default flows through unchanged (D-T347-11).

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { ToolContext, ToolHandler } from '../../router/types.js';

export const CLUSTER_C_COMPOSE_BUNDLE_NAME = 'cluster-c-compose';

// ---------------------------------------------------------------------------
// Cluster C preset enum + sealed vocabularies
// ---------------------------------------------------------------------------

/** The 6 ratified Cluster C preset ids (T-347c..T-347h). */
export const CLUSTER_C_PRESET_IDS = [
  'bbc-mark-allen-clouds',
  'doppler-dbz-standard',
  'heat-map-cool-to-warm',
  'nhc-cone-of-uncertainty',
  'twc-retrocast-8bit',
  'twc-immersive-mixed-reality',
] as const;
export type ClusterCPresetId = (typeof CLUSTER_C_PRESET_IDS)[number];

/** Single source-of-truth preset-id constants. Each handler returns one. */
const PRESET_IDS = {
  BBC_CLOUDS: 'bbc-mark-allen-clouds',
  DOPPLER: 'doppler-dbz-standard',
  HEAT_MAP: 'heat-map-cool-to-warm',
  NHC_CONE: 'nhc-cone-of-uncertainty',
  TWC_RETROCAST: 'twc-retrocast-8bit',
  TWC_IMR: 'twc-immersive-mixed-reality',
} as const satisfies Record<string, ClusterCPresetId>;

/** Severity tiers spanned by the 6 Cluster C presets (per cluster SKILL §"Cluster conventions"). */
export const WEATHER_SEVERITIES = ['advisory', 'watch', 'warning'] as const;
/** Conditions spanned by the 6 Cluster C presets (per cluster SKILL §"When to invoke"). */
export const WEATHER_CONDITIONS = [
  'hurricane',
  'tropical-storm',
  'severe-thunderstorm',
  'tornado',
  'winter-storm',
  'flood',
  'heat',
  'wildfire-smoke',
] as const;
/** Brand vocab for `compose_weather_alert` — only NHC / TWC / NWS reach Cluster C presets. */
export const ALERT_BRANDS = ['nhc', 'twc', 'nws'] as const;
/** Brand vocab for `compose_forecast_map` — covers BBC clouds + Doppler/NEXRAD/NWS radar + TWC IMR/RetroCast. */
export const FORECAST_BRANDS = ['bbc', 'twc', 'doppler', 'nws', 'nexrad'] as const;
/** Brand vocab for `compose_storm_track` — only NHC/NOAA reach the cone preset. */
export const STORM_BRANDS = ['nhc', 'noaa'] as const;
/** Brand vocab for `compose_temperature_map` — Meriam-palette consumers only. */
export const TEMPERATURE_BRANDS = ['meriam', 'esri', 'nws-meriam'] as const;
/** Temperature unit. */
export const TEMPERATURE_UNITS = ['F', 'C'] as const;
/** Sub-mode disambiguator for `compose_forecast_map`. */
export const FORECAST_REGISTERS = ['radar', 'retrocast', 'multi-day', 'globe'] as const;

// ---------------------------------------------------------------------------
// Per-preset prop defaults (D-T347-12) — sourced from each preset's
// PRESET_ID_BINDINGS entry in packages/parity-cli/src/generate-fixture.ts.
// Sparse on purpose: the binding pins canonical fonts / palette enums
// and the composer mainly forwards. Only the weatherMap `style` discriminator
// needs to be threaded through so the primitive picks the correct render path.
// ---------------------------------------------------------------------------

const PRESET_DEFAULTS: Readonly<Record<ClusterCPresetId, Readonly<Record<string, unknown>>>> = {
  [PRESET_IDS.BBC_CLOUDS]: { style: 'mark-allen-clouds' },
  [PRESET_IDS.DOPPLER]: { style: 'doppler-radar' },
  [PRESET_IDS.HEAT_MAP]: { style: 'heat-map' },
  [PRESET_IDS.NHC_CONE]: {},
  [PRESET_IDS.TWC_RETROCAST]: {},
  [PRESET_IDS.TWC_IMR]: {},
};

function withDefaults(
  presetId: ClusterCPresetId,
  props: Record<string, unknown>,
): Record<string, unknown> {
  return { ...PRESET_DEFAULTS[presetId], ...props };
}

// ---------------------------------------------------------------------------
// 1 — compose_weather_alert
// ---------------------------------------------------------------------------

const composeWeatherAlertInput = z
  .object({
    condition: z.enum(WEATHER_CONDITIONS),
    regions: z.array(z.string().min(1).max(80)).min(1).max(50),
    severity: z.enum(WEATHER_SEVERITIES),
    brand: z.enum(ALERT_BRANDS),
    headline: z.string().max(160).optional(),
  })
  .strict();

const composeWeatherAlertOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum([PRESET_IDS.NHC_CONE, PRESET_IDS.TWC_IMR]),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.literal('no_preset_for_condition_severity_brand'),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeWeatherAlertInput = z.infer<typeof composeWeatherAlertInput>;
type ComposeWeatherAlertOutput = z.infer<typeof composeWeatherAlertOutput>;

const composeWeatherAlert: ToolHandler<
  ComposeWeatherAlertInput,
  ComposeWeatherAlertOutput,
  ToolContext
> = {
  name: 'compose_weather_alert',
  bundle: CLUSTER_C_COMPOSE_BUNDLE_NAME,
  description:
    "Compose a Cluster C (Weather) alert routing plan. Returns `presetId: 'nhc-cone-of-uncertainty'` (NHC × hurricane / tropical-storm warning) or `presetId: 'twc-immersive-mixed-reality'` (TWC × severe-thunderstorm / tornado watch+warning; routes to the static-fallback `imrStaticFallback` primitive per the T-347h binding override). Plus opaque pass-through `props`. Color palettes are public-interest STANDARDS — composer does NOT accept palette overrides; primitives reject them too. NHC cone disclaimer 'Impacts extend beyond the cone' is enforced by the primitive (default text); composer does NOT inject.",
  inputSchema: composeWeatherAlertInput as unknown as z.ZodType<ComposeWeatherAlertInput>,
  outputSchema: composeWeatherAlertOutput,
  handle: (input, _ctx) => {
    type AlertPresetId = typeof PRESET_IDS.NHC_CONE | typeof PRESET_IDS.TWC_IMR;
    let presetId: AlertPresetId | undefined;
    if (
      input.brand === 'nhc' &&
      input.severity === 'warning' &&
      (input.condition === 'hurricane' || input.condition === 'tropical-storm')
    ) {
      presetId = PRESET_IDS.NHC_CONE;
    } else if (
      input.brand === 'twc' &&
      (input.severity === 'warning' || input.severity === 'watch') &&
      (input.condition === 'severe-thunderstorm' || input.condition === 'tornado')
    ) {
      presetId = PRESET_IDS.TWC_IMR;
    }
    if (!presetId) {
      return {
        ok: false,
        reason: 'no_preset_for_condition_severity_brand',
        detail: `Cluster C alerts cover (NHC × hurricane/tropical-storm × warning → NHC cone) and (TWC × severe-thunderstorm/tornado × watch|warning → IMR static-fallback). Got (${input.brand}, ${input.condition}, ${input.severity}).`,
      };
    }
    const props: Record<string, unknown> = {
      condition: input.condition,
      regions: input.regions,
      severity: input.severity,
      brand: input.brand,
    };
    if (input.headline !== undefined) props.headline = input.headline;
    return {
      ok: true,
      presetId,
      props: withDefaults(presetId, props),
    };
  },
};

// ---------------------------------------------------------------------------
// 2 — compose_forecast_map
// ---------------------------------------------------------------------------

const composeForecastMapInput = z
  .object({
    regions: z.array(z.string().min(1).max(80)).min(1).max(50),
    days: z.number().int().min(0).max(14),
    brand: z.enum(FORECAST_BRANDS),
    register: z.enum(FORECAST_REGISTERS).optional(),
  })
  .strict();

const composeForecastMapOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum([
        PRESET_IDS.BBC_CLOUDS,
        PRESET_IDS.DOPPLER,
        PRESET_IDS.TWC_RETROCAST,
        PRESET_IDS.TWC_IMR,
      ]),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.literal('no_preset_for_brand_register'),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeForecastMapInput = z.infer<typeof composeForecastMapInput>;
type ComposeForecastMapOutput = z.infer<typeof composeForecastMapOutput>;

const composeForecastMap: ToolHandler<
  ComposeForecastMapInput,
  ComposeForecastMapOutput,
  ToolContext
> = {
  name: 'compose_forecast_map',
  bundle: CLUSTER_C_COMPOSE_BUNDLE_NAME,
  description:
    "Compose a Cluster C (Weather) forecast-map routing plan. Returns `presetId` of `bbc-mark-allen-clouds` (BBC; rotating 3D globe), `doppler-dbz-standard` (Doppler / NEXRAD / NWS radar; canonical reflectivity dBZ palette), `twc-retrocast-8bit` (TWC + `register: 'retrocast'`; WeatherStar 4000 nostalgia), or `twc-immersive-mixed-reality` (TWC multi-day; routes to static-fallback IMR primitive). For TWC short-range (`days <= 1`), `register` MUST be supplied to disambiguate `radar` vs `multi-day`. Plus opaque pass-through `props`. Color palettes are public-interest STANDARDS — composer does NOT accept palette overrides.",
  inputSchema: composeForecastMapInput as unknown as z.ZodType<ComposeForecastMapInput>,
  outputSchema: composeForecastMapOutput,
  handle: (input, _ctx) => {
    type ForecastPresetId =
      | typeof PRESET_IDS.BBC_CLOUDS
      | typeof PRESET_IDS.DOPPLER
      | typeof PRESET_IDS.TWC_RETROCAST
      | typeof PRESET_IDS.TWC_IMR;
    let presetId: ForecastPresetId | undefined;
    if (input.brand === 'bbc') {
      presetId = PRESET_IDS.BBC_CLOUDS;
    } else if (input.brand === 'doppler' || input.brand === 'nexrad' || input.brand === 'nws') {
      presetId = PRESET_IDS.DOPPLER;
    } else if (input.brand === 'twc') {
      if (input.register === 'retrocast') {
        presetId = PRESET_IDS.TWC_RETROCAST;
      } else if (input.register === 'radar') {
        presetId = PRESET_IDS.DOPPLER;
      } else if (input.register === 'multi-day') {
        presetId = PRESET_IDS.TWC_IMR;
      } else if (input.days >= 2) {
        presetId = PRESET_IDS.TWC_IMR;
      }
      // else: TWC short-range with no `register` → ambiguous, fall through to error
    }
    if (!presetId) {
      return {
        ok: false,
        reason: 'no_preset_for_brand_register',
        detail: `TWC short-range (days <= 1) requires explicit register=radar | retrocast | multi-day; got brand=${input.brand}, days=${input.days}, register=${input.register ?? 'unset'}.`,
      };
    }
    const props: Record<string, unknown> = {
      regions: input.regions,
      days: input.days,
      brand: input.brand,
    };
    if (input.register !== undefined) props.register = input.register;
    return {
      ok: true,
      presetId,
      props: withDefaults(presetId, props),
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — compose_storm_track
// ---------------------------------------------------------------------------

const stormTrackPathPoint = z
  .object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    intensity: z.enum(['D', 'S', 'H', 'M']).optional(),
    timestamp: z.string().optional(),
  })
  .strict();

const composeStormTrackInput = z
  .object({
    storm: z
      .object({
        name: z.string().min(1).max(80),
        advisoryNumber: z.number().int().positive().optional(),
      })
      .strict(),
    path: z.array(stormTrackPathPoint).min(1).max(20).optional(),
    brand: z.enum(STORM_BRANDS),
    disclaimerText: z.string().max(120).optional(),
  })
  .strict();

const composeStormTrackOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.literal(PRESET_IDS.NHC_CONE),
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

type ComposeStormTrackInput = z.infer<typeof composeStormTrackInput>;
type ComposeStormTrackOutput = z.infer<typeof composeStormTrackOutput>;

const composeStormTrack: ToolHandler<ComposeStormTrackInput, ComposeStormTrackOutput, ToolContext> =
  {
    name: 'compose_storm_track',
    bundle: CLUSTER_C_COMPOSE_BUNDLE_NAME,
    description:
      "Compose a Cluster C (Weather) storm-track routing plan. Returns `presetId: 'nhc-cone-of-uncertainty'` (the only Cluster C `stormTracker` consumer; brand ∈ {nhc, noaa}). Plus opaque pass-through `props`. NHC cone disclaimer 'Impacts extend beyond the cone' is enforced by the primitive (default text per cluster SKILL §\"Cluster conventions\"); the composer is composer-transparent — when caller omits `disclaimerText`, the output `props` does NOT include the key, and the primitive default flows through unchanged. When caller supplies `disclaimerText`, it forwards verbatim (legitimate translation / regional override use case).",
    inputSchema: composeStormTrackInput as unknown as z.ZodType<ComposeStormTrackInput>,
    outputSchema: composeStormTrackOutput,
    handle: (input, _ctx) => {
      // brand enum is sealed at {nhc, noaa} via Zod; both route to the same preset.
      // Schema layer rejects any other brand; handler dispatch is total over the enum.
      const presetId = PRESET_IDS.NHC_CONE;
      const props: Record<string, unknown> = {
        storm: input.storm,
        brand: input.brand,
      };
      if (input.path !== undefined) props.path = input.path;
      // D-T347-11: do NOT inject disclaimerText. Pass through only when supplied.
      if (input.disclaimerText !== undefined) props.disclaimerText = input.disclaimerText;
      return {
        ok: true,
        presetId,
        props: withDefaults(presetId, props),
      };
    },
  };

// ---------------------------------------------------------------------------
// 4 — compose_temperature_map
// ---------------------------------------------------------------------------

const composeTemperatureMapInput = z
  .object({
    regions: z.array(z.string().min(1).max(80)).min(1).max(50),
    unit: z.enum(TEMPERATURE_UNITS),
    brand: z.enum(TEMPERATURE_BRANDS),
  })
  .strict();

const composeTemperatureMapOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.literal(PRESET_IDS.HEAT_MAP),
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

type ComposeTemperatureMapInput = z.infer<typeof composeTemperatureMapInput>;
type ComposeTemperatureMapOutput = z.infer<typeof composeTemperatureMapOutput>;

const composeTemperatureMap: ToolHandler<
  ComposeTemperatureMapInput,
  ComposeTemperatureMapOutput,
  ToolContext
> = {
  name: 'compose_temperature_map',
  bundle: CLUSTER_C_COMPOSE_BUNDLE_NAME,
  description:
    'Compose a Cluster C (Weather) temperature-map routing plan. Returns `presetId: \'heat-map-cool-to-warm\'` (Meriam-38-class temperature gradient; brand ∈ {meriam, esri, nws-meriam}). Plus opaque pass-through `props`. The temperature gradient (purple → blue → green → yellow → red → maroon) is a public-interest STANDARD per cluster SKILL §"Cluster conventions" — composer does NOT accept palette overrides; primitives reject them too.',
  inputSchema: composeTemperatureMapInput as unknown as z.ZodType<ComposeTemperatureMapInput>,
  outputSchema: composeTemperatureMapOutput,
  handle: (input, _ctx) => {
    // brand enum is sealed at {meriam, esri, nws-meriam}; all three route
    // to the same preset (Meriam palette is the universal standard).
    const presetId = PRESET_IDS.HEAT_MAP;
    const props: Record<string, unknown> = {
      regions: input.regions,
      unit: input.unit,
      brand: input.brand,
    };
    return {
      ok: true,
      presetId,
      props: withDefaults(presetId, props),
    };
  },
};

// ---------------------------------------------------------------------------
// Barrel — handlers + LLM tool definitions
// ---------------------------------------------------------------------------

export const CLUSTER_C_COMPOSE_HANDLERS: readonly ToolHandler<unknown, unknown, ToolContext>[] = [
  composeWeatherAlert,
  composeForecastMap,
  composeStormTrack,
  composeTemperatureMap,
] as unknown as readonly ToolHandler<unknown, unknown, ToolContext>[];

export const CLUSTER_C_COMPOSE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'compose_weather_alert',
    description: composeWeatherAlert.description,
    input_schema: {
      type: 'object',
      required: ['condition', 'regions', 'severity', 'brand'],
      additionalProperties: false,
      properties: {
        condition: { type: 'string', enum: [...WEATHER_CONDITIONS] },
        regions: {
          type: 'array',
          description: 'Region names / codes (1–80 chars each); 1–50 entries.',
        },
        severity: { type: 'string', enum: [...WEATHER_SEVERITIES] },
        brand: { type: 'string', enum: [...ALERT_BRANDS] },
        headline: { type: 'string' },
      },
    },
  },
  {
    name: 'compose_forecast_map',
    description: composeForecastMap.description,
    input_schema: {
      type: 'object',
      required: ['regions', 'days', 'brand'],
      additionalProperties: false,
      properties: {
        regions: {
          type: 'array',
          description: 'Region names / codes (1–80 chars each); 1–50 entries.',
        },
        days: {
          type: 'number',
          description:
            'Forecast horizon in days; 0 = current/instantaneous (radar nowcast), 14 = two-week outlook.',
        },
        brand: { type: 'string', enum: [...FORECAST_BRANDS] },
        register: {
          type: 'string',
          enum: [...FORECAST_REGISTERS],
          description:
            'Sub-mode disambiguator. REQUIRED for TWC short-range (days <= 1) to pick `radar` vs `multi-day`. Optional for other brands; `retrocast` selects the WeatherStar 4000 register for TWC; `globe` is reserved for future BBC variants.',
        },
      },
    },
  },
  {
    name: 'compose_storm_track',
    description: composeStormTrack.description,
    input_schema: {
      type: 'object',
      required: ['storm', 'brand'],
      additionalProperties: false,
      properties: {
        storm: {
          type: 'object',
          description:
            'Storm identity — `{ name: string (1–80 chars), advisoryNumber?: positive int }`.',
        },
        path: {
          type: 'array',
          description:
            'Optional forecast track points: `{ lat: -90..90, lon: -180..180, intensity?: D|S|H|M, timestamp?: string }`. 1–20 entries.',
        },
        brand: { type: 'string', enum: [...STORM_BRANDS] },
        disclaimerText: {
          type: 'string',
          description:
            "Optional disclaimer override (max 120 chars). When omitted, the primitive's canonical NHC default 'Impacts extend beyond the cone' is used. Use only for legitimate translation / regional override.",
        },
      },
    },
  },
  {
    name: 'compose_temperature_map',
    description: composeTemperatureMap.description,
    input_schema: {
      type: 'object',
      required: ['regions', 'unit', 'brand'],
      additionalProperties: false,
      properties: {
        regions: {
          type: 'array',
          description: 'Region names / codes (1–80 chars each); 1–50 entries.',
        },
        unit: { type: 'string', enum: [...TEMPERATURE_UNITS] },
        brand: { type: 'string', enum: [...TEMPERATURE_BRANDS] },
      },
    },
  },
];
