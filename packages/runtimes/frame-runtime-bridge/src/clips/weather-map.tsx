// packages/runtimes/frame-runtime-bridge/src/clips/weather-map.tsx
// T-347a — `weatherMap` runtime-clip primitive: Cluster C three-style
// weather-broadcast register compositor. Sealed
// `style: 'mark-allen-clouds' | 'doppler-radar' | 'heat-map'` discriminator
// with per-style content shape (Zod `discriminatedUnion`); canonical
// palettes baked as static module-level constants (NOT theme-able per
// cluster SKILL "Color palettes are standard, not brand"). Mirrors T-321
// titleSequence's 4-style sealed-bundle architecture.
//
// Per-style branches:
//   - 'mark-allen-clouds': BBC 1975 Mark-Allen symbol set (cloud / sun /
//     raindrop / snow icons positioned per `symbols[]`); region labels
//     rendered in colored discs (per BBC GEL canon).
//   - 'doppler-radar': NEXRAD reflectivity dBZ palette (universal —
//     blue→green→yellow→red→magenta), pinned `loopFrameIndex` (0..31
//     conceptual loop position; v1 ships single-frame static, multi-
//     frame cycling deferred to T-347a-loop-cycle); optional sweep
//     beam phase 0..1 for clockwise rotation; `productMode:
//     'reflectivity' | 'velocity'` with green/red velocity branch
//     palette per stub line 28 (mesocyclone signature preservation).
//   - 'heat-map': Esri/NWS Meriam 38-class temperature gradient (deep
//     purple sub-zero → dark maroon extreme heat); `units: 'F' | 'C'`;
//     optional `oscillation` light-dark across classes (Meriam canon
//     for color-blind differentiation per stub line 30).
//
// Common across styles: `regions[]` (positioned text overlays; data
// values e.g. "72°F" / "85" / "Heavy Rain"), optional `mapPaths[]`
// SVG path data (consumer-supplied region geometry; primitive does NOT
// bundle map data — see D-T347a-7), optional `legend`, theme-slot
// fallback (`background` → `palette.background`, `foreground` →
// `palette.foreground`; palettes themselves NOT theme-bound).
//
// v1 carve-outs (deferred):
//   - 3D rotating globe (BBC `'mark-allen-clouds'`) — T-347a-3d-globe
//     (Track A frontier; ThreeSceneClip per ADR-005). v1 ships flat
//     2D fallback per stub line 38.
//   - Multi-frame radar loop cycling — T-347a-loop-cycle. v1 pins
//     `loopFrameIndex` to a single frame.
//   - Heat-map time-period cycling — T-347a-time-lapse. v1 single-
//     period.
//
// Frame-deterministic — no `Date.now` / `Math.random` / `crypto.*` /
// `setTimeout` / `setInterval` / `fetch` / `requestAnimationFrame` /
// `addEventListener`. Stable region/symbol IDs derived from caller-
// supplied identifiers. Sweep-beam angle (T-347a-loop-cycle) will be
// deterministic from `(frame, fps, sweepDurationMs)`.

import { useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

// ─── canonical palettes (D-T347a-3) ──────────────────────────────────────

/**
 * BBC Mark-Allen temperature-disc palette. Canonical 6-step
 * blue→red gradient applied to the colored discs that wrap each region
 * label under `'mark-allen-clouds'`. Per stub line 26 ("temperature on
 * colored discs (gradient: blue → green → yellow → orange → red)").
 */
export const MARK_ALLEN_TEMPERATURE_DISCS: readonly string[] = Object.freeze([
  '#0000FF',
  '#00B0FF',
  '#00FF00',
  '#FFFF00',
  '#FFA500',
  '#FF0000',
]);

/**
 * NEXRAD reflectivity dBZ palette. Universal canon — do NOT rebrand
 * (cluster SKILL "Color palettes are standard, not brand"). Light precip
 * blue → moderate green → heavy yellow/orange → severe red → hail magenta.
 * Per stub lines 23-27.
 */
export const DOPPLER_DBZ_REFLECTIVITY: readonly string[] = Object.freeze([
  '#00BFFF',
  '#00FF00',
  '#009900',
  '#FFFF00',
  '#FFA500',
  '#FF0000',
  '#FF00FF',
]);

/**
 * NEXRAD velocity-product palette. Bright green (inbound) adjacent to
 * bright red (outbound) — preserves mesocyclone / tornado-rotation
 * signature per stub line 28.
 */
export const DOPPLER_VELOCITY: readonly string[] = Object.freeze(['#00FF00', '#FF0000']);

/**
 * Esri/NWS Meriam 38-class cool-to-warm temperature gradient. Deep purple
 * sub-zero F → dark maroon extreme heat. Light-dark oscillation across
 * classes intentional (Meriam canon for color-blind viewers per stub
 * line 30); preserved in the bundled palette ordering.
 */
export const MERIAM_38_CLASS_HEAT: readonly string[] = Object.freeze([
  '#4B0082',
  '#5C0099',
  '#3000FF',
  '#0080FF',
  '#0000FF',
  '#0099FF',
  '#00BFFF',
  '#00CCCC',
  '#00CC99',
  '#00CC66',
  '#00DD33',
  '#00FF00',
  '#33FF33',
  '#66FF33',
  '#99FF33',
  '#CCFF33',
  '#FFFF00',
  '#FFE500',
  '#FFCC00',
  '#FFB300',
  '#FF9900',
  '#FF8000',
  '#FF6600',
  '#FF4D00',
  '#FF3300',
  '#FF1A00',
  '#FF0000',
  '#E50000',
  '#CC0000',
  '#B30000',
  '#990000',
  '#800000',
  '#660000',
  '#550000',
  '#440000',
  '#330000',
  '#220000',
  '#1A0000',
]);

// ─── schema ──────────────────────────────────────────────────────────────

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const hex = () => z.string().regex(HEX_COLOR_RE);

const positionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive().min(1).max(1920),
    height: z.number().positive().min(1).max(1080),
  })
  .strict();

const screenPositionSchema = z.object({ x: z.number(), y: z.number() }).strict();

const fontSchema = z
  .object({
    family: z.string().min(1),
    weight: z.number().int().min(100).max(900),
    size: z.number().positive(),
    letterSpacing: z.number().optional(),
  })
  .strict();

const regionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    /** Display text rendered as the region's label (e.g. `'72°F'`, `'85'`, `'Heavy Rain'`). */
    dataValue: z.string(),
    screenPosition: screenPositionSchema,
    /**
     * Optional 0-based palette index. Under `'mark-allen-clouds'` selects
     * the disc background color from `MARK_ALLEN_TEMPERATURE_DISCS`;
     * under `'heat-map'` indexes into `MERIAM_38_CLASS_HEAT` for the
     * region's map-fill (when `mapPaths` fill is omitted).
     */
    paletteIndex: z.number().int().nonnegative().optional(),
  })
  .strict();

const mapPathSchema = z
  .object({
    id: z.string().min(1),
    /** SVG path `d` attribute string (e.g. `"M0,0 L100,0 L100,100 Z"`). */
    d: z.string().min(1),
    /** Optional explicit fill; per-style defaults apply when absent. */
    fill: hex().optional(),
  })
  .strict();

const legendSchema = z
  .object({
    enabled: z.boolean(),
    position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
  })
  .strict();

const symbolSchema = z
  .object({
    kind: z.enum(['cloud', 'sun', 'raindrop', 'snow']),
    position: screenPositionSchema,
    scale: z.number().positive().max(8).optional(),
  })
  .strict();

const baseShape = {
  regions: z.array(regionSchema).min(0).max(64),
  mapPaths: z.array(mapPathSchema).max(256).optional(),
  legend: legendSchema.optional(),
  font: fontSchema.optional(),
  background: hex().optional(),
  foreground: hex().optional(),
  position: positionSchema.optional(),
};

const markAllenSchema = z
  .object({
    ...baseShape,
    style: z.literal('mark-allen-clouds'),
    /** Mark-Allen icon-set instances (cloud / sun / raindrop / snow). */
    symbols: z.array(symbolSchema).max(64).optional(),
  })
  .strict();

const dopplerSchema = z
  .object({
    ...baseShape,
    style: z.literal('doppler-radar'),
    productMode: z.enum(['reflectivity', 'velocity']),
    /**
     * Index into the conceptual loop frames. v1 single-frame static —
     * caller pins which frame of the loop to render. 0..31 inclusive
     * covers the canonical 6-12 frame radar loop with headroom.
     */
    loopFrameIndex: z.number().int().nonnegative().max(31),
    /** Optional sweep-beam clockwise rotation phase, 0..1 = full sweep. */
    sweepBeamPhase: z.number().min(0).max(1).optional(),
  })
  .strict();

const heatMapSchema = z
  .object({
    ...baseShape,
    style: z.literal('heat-map'),
    units: z.enum(['F', 'C']),
    /**
     * Light-dark oscillation across palette classes (Meriam canon, stub
     * line 30). When true, alternating classes are darkened by a fixed
     * factor for color-blind differentiation. Default false (raw
     * gradient).
     */
    oscillation: z.boolean().optional(),
  })
  .strict();

export const weatherMapPropsSchema = z.discriminatedUnion('style', [
  markAllenSchema,
  dopplerSchema,
  heatMapSchema,
]);

export type WeatherMapProps = z.infer<typeof weatherMapPropsSchema>;
export type WeatherMapStyle = WeatherMapProps['style'];
export type WeatherMapRegion = z.infer<typeof regionSchema>;
export type WeatherMapMapPath = z.infer<typeof mapPathSchema>;
export type WeatherMapSymbol = z.infer<typeof symbolSchema>;

// ─── constants ───────────────────────────────────────────────────────────

const SYSTEM_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DEFAULT_FONT_BBC = {
  family: `BBC Reith Sans, Source Sans 3, ${SYSTEM_FONT_STACK}`,
  weight: 700,
  size: 22,
} as const;
const DEFAULT_FONT_DOPPLER = {
  family: `Open Sans, ${SYSTEM_FONT_STACK}`,
  weight: 400,
  size: 14,
} as const;
const DEFAULT_FONT_HEAT = {
  family: `Open Sans, ${SYSTEM_FONT_STACK}`,
  weight: 700,
  size: 18,
} as const;

const DEFAULT_BG_BBC = '#3F4F5F';
const DEFAULT_BG_DOPPLER = '#1A1A1A';
const DEFAULT_BG_HEAT = '#E8E8E8';

const DEFAULT_FG = '#FFFFFF';
const DEFAULT_FG_HEAT = '#1A1A1A';

/** Disc radius in px for Mark-Allen temperature discs. Stub canon "high contrast on colored discs"; sized to envelop a 22-28pt label. */
const DISC_RADIUS_PX = 22;

// ─── pure helpers ────────────────────────────────────────────────────────

/**
 * Resolve the disc background color for a Mark-Allen region. Uses
 * `region.paletteIndex` to pick from the canonical 6-step palette; falls
 * back to the mid-class color when the index is omitted or out of range.
 */
export function resolveMarkAllenDisc(paletteIndex: number | undefined): string {
  if (paletteIndex === undefined) return MARK_ALLEN_TEMPERATURE_DISCS[2] ?? '#00FF00';
  const idx = Math.max(0, Math.min(MARK_ALLEN_TEMPERATURE_DISCS.length - 1, paletteIndex));
  return MARK_ALLEN_TEMPERATURE_DISCS[idx] ?? MARK_ALLEN_TEMPERATURE_DISCS[0] ?? '#0000FF';
}

/**
 * Resolve the heat-map fill color for a region. Uses `region.paletteIndex`
 * to pick from the Meriam 38-class palette; applies optional oscillation
 * darkening on alternating classes (per stub line 30).
 */
export function resolveHeatMapFill(paletteIndex: number | undefined, oscillation: boolean): string {
  if (paletteIndex === undefined) return MERIAM_38_CLASS_HEAT[19] ?? '#FFB300';
  const idx = Math.max(0, Math.min(MERIAM_38_CLASS_HEAT.length - 1, paletteIndex));
  const base = MERIAM_38_CLASS_HEAT[idx] ?? MERIAM_38_CLASS_HEAT[0] ?? '#4B0082';
  if (!oscillation || idx % 2 === 0) return base;
  // Darken alternating classes by ~12 % via integer-channel scale. Pure
  // function of the input hex; no Math.random / Date / etc.
  return darkenHex(base, 0.88);
}

function darkenHex(hexColor: string, factor: number): string {
  const r = Math.round(
    Math.max(0, Math.min(255, Number.parseInt(hexColor.slice(1, 3), 16) * factor)),
  );
  const g = Math.round(
    Math.max(0, Math.min(255, Number.parseInt(hexColor.slice(3, 5), 16) * factor)),
  );
  const b = Math.round(
    Math.max(0, Math.min(255, Number.parseInt(hexColor.slice(5, 7), 16) * factor)),
  );
  return `#${r.toString(16).padStart(2, '0').toUpperCase()}${g
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()}${b.toString(16).padStart(2, '0').toUpperCase()}`;
}

/**
 * Resolve the active Doppler palette for the given product mode. Pure
 * function — same `productMode` → same palette reference.
 */
export function resolveDopplerPalette(productMode: 'reflectivity' | 'velocity'): readonly string[] {
  return productMode === 'reflectivity' ? DOPPLER_DBZ_REFLECTIVITY : DOPPLER_VELOCITY;
}

// ─── style-specific renderers ────────────────────────────────────────────

interface MarkAllenSymbolNodeProps {
  symbol: WeatherMapSymbol;
  index: number;
}

function MarkAllenSymbolNode({ symbol, index }: MarkAllenSymbolNodeProps): ReactElement {
  const scale = symbol.scale ?? 1;
  const size = 28 * scale;
  const cx = symbol.position.x;
  const cy = symbol.position.y;
  const id = `weather-map-symbol-${symbol.kind}-${index}`;
  if (symbol.kind === 'cloud') {
    return (
      <g data-testid={id}>
        <ellipse cx={cx} cy={cy} rx={size * 0.7} ry={size * 0.45} fill="#FFFFFF" opacity={0.92} />
        <ellipse
          cx={cx - size * 0.35}
          cy={cy + size * 0.15}
          rx={size * 0.45}
          ry={size * 0.35}
          fill="#FFFFFF"
          opacity={0.92}
        />
        <ellipse
          cx={cx + size * 0.4}
          cy={cy + size * 0.1}
          rx={size * 0.4}
          ry={size * 0.32}
          fill="#FFFFFF"
          opacity={0.92}
        />
      </g>
    );
  }
  if (symbol.kind === 'sun') {
    return (
      <g data-testid={id}>
        <circle cx={cx} cy={cy} r={size * 0.4} fill="#FFCD00" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = cx + Math.cos(rad) * size * 0.55;
          const y1 = cy + Math.sin(rad) * size * 0.55;
          const x2 = cx + Math.cos(rad) * size * 0.85;
          const y2 = cy + Math.sin(rad) * size * 0.85;
          return (
            <line
              key={`ray-${deg}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#FFCD00"
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}
      </g>
    );
  }
  if (symbol.kind === 'raindrop') {
    return (
      <g data-testid={id}>
        <path
          d={`M ${cx},${cy - size * 0.5} Q ${cx + size * 0.35},${cy} ${cx},${cy + size * 0.4} Q ${cx - size * 0.35},${cy} ${cx},${cy - size * 0.5} Z`}
          fill="#00B0FF"
        />
      </g>
    );
  }
  // snow
  return (
    <g data-testid={id}>
      {[0, 60, 120].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x = Math.cos(rad) * size * 0.55;
        const y = Math.sin(rad) * size * 0.55;
        return (
          <line
            key={`flake-${deg}`}
            x1={cx - x}
            y1={cy - y}
            x2={cx + x}
            y2={cy + y}
            stroke="#FFFFFF"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={size * 0.18} fill="#FFFFFF" />
    </g>
  );
}

interface DopplerSweepBeamProps {
  cx: number;
  cy: number;
  radius: number;
  phase: number;
}

/** Sweep-beam clockwise rotation overlay; phase in [0, 1] → 0..360°. */
function DopplerSweepBeam({ cx, cy, radius, phase }: DopplerSweepBeamProps): ReactElement {
  const angle = (phase % 1) * 360 - 90; // -90 so phase=0 points up (12 o'clock)
  const rad = (angle * Math.PI) / 180;
  const x2 = cx + Math.cos(rad) * radius;
  const y2 = cy + Math.sin(rad) * radius;
  return (
    <line
      data-testid="weather-map-doppler-sweep"
      x1={cx}
      y1={cy}
      x2={x2}
      y2={y2}
      stroke="#FFFFFF"
      strokeWidth={2}
      strokeLinecap="round"
      opacity={0.75}
    />
  );
}

interface RegionLabelProps {
  region: WeatherMapRegion;
  style: WeatherMapStyle;
  font: { family: string; weight: number; size: number; letterSpacing?: number | undefined };
  foreground: string;
  index: number;
}

function RegionLabel({ region, style, font, foreground, index }: RegionLabelProps): ReactElement {
  const id = `weather-map-region-${region.id}`;
  if (style === 'mark-allen-clouds') {
    const discColor = resolveMarkAllenDisc(region.paletteIndex);
    const wrapperStyle: CSSProperties = {
      position: 'absolute',
      left: region.screenPosition.x - DISC_RADIUS_PX,
      top: region.screenPosition.y - DISC_RADIUS_PX,
      width: DISC_RADIUS_PX * 2,
      height: DISC_RADIUS_PX * 2,
      borderRadius: '50%',
      backgroundColor: discColor,
      color: foreground,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: font.family,
      fontWeight: font.weight,
      fontSize: font.size,
      letterSpacing: font.letterSpacing,
      pointerEvents: 'none',
    };
    return (
      <div
        data-testid={id}
        data-region-id={region.id}
        data-palette-index={String(region.paletteIndex ?? '')}
        style={wrapperStyle}
      >
        {region.dataValue}
      </div>
    );
  }
  // doppler / heat-map: plain absolutely-positioned label
  const labelStyle: CSSProperties = {
    position: 'absolute',
    left: region.screenPosition.x,
    top: region.screenPosition.y,
    transform: 'translate(-50%, -50%)',
    color: foreground,
    fontFamily: font.family,
    fontWeight: font.weight,
    fontSize: font.size,
    letterSpacing: font.letterSpacing,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    textShadow: style === 'doppler-radar' ? '0 0 4px #000000' : undefined,
  };
  // The `index` prop is reserved for callers that need a positional fallback
  // identifier when the parent maps without using region.id; current parent
  // uses the stable region.id, so index is unused at the JSX boundary.
  void index;
  return (
    <div
      data-testid={id}
      data-region-id={region.id}
      data-palette-index={String(region.paletteIndex ?? '')}
      style={labelStyle}
    >
      {region.dataValue}
    </div>
  );
}

interface LegendProps {
  palette: readonly string[];
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  font: { family: string; weight: number; size: number };
  foreground: string;
  /** Heat-map units suffix; `undefined` for non-heat-map styles (no suffix rendered). */
  units: 'F' | 'C' | undefined;
}

function Legend({ palette, position, font, foreground, units }: LegendProps): ReactElement {
  const placement: CSSProperties = {
    position: 'absolute',
    padding: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 4,
    color: foreground,
    fontFamily: font.family,
    fontWeight: font.weight,
    fontSize: font.size * 0.85,
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  };
  if (position === 'top-left') {
    placement.left = 16;
    placement.top = 16;
  } else if (position === 'top-right') {
    placement.right = 16;
    placement.top = 16;
  } else if (position === 'bottom-left') {
    placement.left = 16;
    placement.bottom = 16;
  } else {
    placement.right = 16;
    placement.bottom = 16;
  }
  return (
    <div data-testid="weather-map-legend" style={placement}>
      {palette.map((c, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: positional palette swatch grid.
          key={`swatch-${i}`}
          style={{ width: 12, height: 12, backgroundColor: c, borderRadius: 2 }}
        />
      ))}
      {units !== undefined ? <span style={{ marginLeft: 6 }}>{`°${units}`}</span> : null}
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────

/**
 * Renders a weather-broadcast map in one of three sealed styles. Per
 * D-T347a-1 / D-T347a-2: single primitive, sealed `style` enum,
 * discriminated union on `style` for per-style content. v1 ships flat
 * 2D maps + single-frame static (3D globe, multi-frame loop, time-lapse
 * cycling deferred per D-T347a-4 / D-T347a-5). Frame-deterministic
 * (D-T347a-9).
 */
export function WeatherMap(props: WeatherMapProps): ReactElement {
  const { width: canvasW, height: canvasH } = useVideoConfig();
  const region = props.position ?? { x: 0, y: 0, width: canvasW, height: canvasH };
  const style = props.style;

  const font =
    props.font ??
    (style === 'mark-allen-clouds'
      ? DEFAULT_FONT_BBC
      : style === 'doppler-radar'
        ? DEFAULT_FONT_DOPPLER
        : DEFAULT_FONT_HEAT);
  const background =
    props.background ??
    (style === 'mark-allen-clouds'
      ? DEFAULT_BG_BBC
      : style === 'doppler-radar'
        ? DEFAULT_BG_DOPPLER
        : DEFAULT_BG_HEAT);
  const foreground = props.foreground ?? (style === 'heat-map' ? DEFAULT_FG_HEAT : DEFAULT_FG);

  // Resolve mapPath fills per style (D-T347a-7).
  const oscillation = style === 'heat-map' ? props.oscillation === true : false;
  const resolvedMapPaths = (props.mapPaths ?? []).map((p) => {
    if (p.fill !== undefined) return p;
    if (style === 'heat-map') {
      // No explicit fill: derive from matching region's paletteIndex by id-equality.
      const matchingRegion = props.regions.find((r) => r.id === p.id);
      return {
        ...p,
        fill: resolveHeatMapFill(matchingRegion?.paletteIndex, oscillation),
      };
    }
    return p;
  });

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: region.x,
    top: region.y,
    width: region.width,
    height: region.height,
    backgroundColor: background,
    overflow: 'hidden',
    pointerEvents: 'none',
  };

  return (
    <div
      data-testid="weather-map"
      data-style={style}
      data-region-count={String(props.regions.length)}
      style={containerStyle}
    >
      <svg
        data-testid="weather-map-svg"
        width={region.width}
        height={region.height}
        viewBox={`0 0 ${region.width} ${region.height}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <title>{`Weather map: ${style}`}</title>
        {resolvedMapPaths.map((p) => (
          <path key={p.id} data-map-path-id={p.id} d={p.d} fill={p.fill ?? '#3F4F5F'} />
        ))}
        {style === 'mark-allen-clouds' && props.symbols !== undefined
          ? props.symbols.map((sym, i) => (
              <MarkAllenSymbolNode key={`sym-${sym.kind}-${i}`} symbol={sym} index={i} />
            ))
          : null}
        {style === 'doppler-radar' && props.sweepBeamPhase !== undefined ? (
          <DopplerSweepBeam
            cx={region.width / 2}
            cy={region.height / 2}
            radius={Math.min(region.width, region.height) * 0.45}
            phase={props.sweepBeamPhase}
          />
        ) : null}
      </svg>
      {props.regions.map((r, i) => (
        <RegionLabel
          key={r.id}
          region={r}
          style={style}
          font={font}
          foreground={foreground}
          index={i}
        />
      ))}
      {props.legend?.enabled === true ? (
        <Legend
          palette={
            style === 'mark-allen-clouds'
              ? MARK_ALLEN_TEMPERATURE_DISCS
              : style === 'doppler-radar'
                ? resolveDopplerPalette(props.productMode)
                : MERIAM_38_CLASS_HEAT
          }
          position={props.legend.position}
          font={font}
          foreground={foreground}
          units={style === 'heat-map' ? props.units : undefined}
        />
      ) : null}
    </div>
  );
}

/**
 * `weatherMapClip` clip definition — registered as `kind: 'weatherMap'`
 * (camelCase per Cluster C frontmatter `clipKind`). Theme slots:
 * `background` → `palette.background`, `foreground` → `palette.foreground`
 * (palettes themselves NOT theme-bound per cluster SKILL).
 */
export const weatherMapClip: ClipDefinition<unknown> = defineFrameClip<WeatherMapProps>({
  kind: 'weatherMap',
  component: WeatherMap,
  propsSchema: weatherMapPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    foreground: { kind: 'palette', role: 'foreground' },
  },
});
