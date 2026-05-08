// packages/runtimes/frame-runtime-bridge/src/clips/storm-tracker.tsx
// T-347b — `stormTracker` runtime-clip primitive: Cluster C NHC 5-day
// cone-of-uncertainty register. Single-style v1 (no `discriminatedUnion`
// — only consumer is `nhc-cone-of-uncertainty`); future "inland
// warnings" 2026 NHC update or regional alternatives (JMA / NHK)
// introduce a style enum then. Mirrors qr-code-bounce / grain
// single-object-schema precedent rather than weatherMap / titleSequence's
// discriminatedUnion architecture.
//
// **Mandatory disclaimer (D-T347b-2)**: every render contains the
// "Impacts extend beyond the cone" disclaimer text rendered via a
// `data-testid="storm-tracker-disclaimer"` element. The cluster SKILL
// declares this NON-NEGOTIABLE — the cone-of-uncertainty
// misinterpretation (viewers assuming "outside cone = safe") is a
// documented public-safety failure mode. Caller MAY override the exact
// wording via `disclaimerText?` prop but CANNOT suppress rendering.
//
// **Canonical NHC palette (D-T347b-3)**: coastal-warning colors baked
// as static module-level constants — `NHC_HURRICANE_WARNING_RED`
// (#DC143C), `NHC_HURRICANE_WATCH_MAGENTA` (#FF00FF),
// `NHC_TROPICAL_STORM_FIREBRICK` (#B22222),
// `NHC_STORM_SURGE_PURPLE` (#B524F7). NWS-mandated intensity-letter
// shorthand `NHC_INTENSITY_LETTERS = ['D', 'S', 'H', 'M']`. NOT
// theme-able — public-safety standards.
//
// **Geometry surfaces** (consumer-supplied per D-T347b-4 / -6 / -8):
//   - `cone: { d, fill?, opacity? }` — single SVG path describing the
//     cone polygon widening over 5 days.
//   - `trackDots[]` — forecast-position circles with sealed `intensity:
//     'D' | 'S' | 'H' | 'M'` letter labels.
//   - `coastalWarnings[]?` — warning regions with sealed `warningType`
//     mapping through `resolveCoastalWarningColor()` to the canonical
//     palette.
//   - `mapPaths[]?` — base coastal map geometry (mirrors T-347a
//     weatherMap precedent; primitive does NOT bundle map data).
//
// Theme slots: `background` → `palette.background`, `foreground` →
// `palette.foreground` (palettes themselves NOT theme-bound).
//
// v1 carve-outs (deferred):
//   - Multi-advisory animated time-lapse (cone expanding frame-by-frame;
//     map zoom from wide Atlantic to regional close-up) — T-347b-
//     advisory-cycle.
//   - `LiveDataClip` integration for real-time NHC advisory feed —
//     T-347b-live-data (Track A frontier per ADR-005).
//   - 2026 NHC update with inland warnings — T-347b-2026-inland-
//     warnings (would introduce a `style` enum at that point).
//
// Frame-deterministic (D-T347b-10) — no `Date.now` / `Math.random` /
// `crypto.*` / `setTimeout` / `setInterval` / `fetch` /
// `requestAnimationFrame` / `addEventListener`. Stable IDs derived
// from caller-supplied `trackDot.id` / `mapPath.id` /
// `coastalWarning.id`.

import { useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

// ─── canonical NHC palette (D-T347b-3) ───────────────────────────────────

/** Hurricane Warning — Crimson red. NHC standard, do NOT rebrand. */
export const NHC_HURRICANE_WARNING_RED = '#DC143C';
/** Hurricane Watch — Magenta. NHC standard, do NOT rebrand. */
export const NHC_HURRICANE_WATCH_MAGENTA = '#FF00FF';
/** Tropical Storm Warning — Firebrick red. NHC standard, do NOT rebrand. */
export const NHC_TROPICAL_STORM_FIREBRICK = '#B22222';
/** Storm Surge Warning — Dark Purple. NHC standard, do NOT rebrand. */
export const NHC_STORM_SURGE_PURPLE = '#B524F7';

/**
 * NWS-mandated intensity-letter shorthand for storm-track forecast
 * positions: Depression / Storm / Hurricane / Major (Major = Cat 3+).
 * Sealed enum — not customizable per stub line 48.
 */
export const NHC_INTENSITY_LETTERS = Object.freeze(['D', 'S', 'H', 'M'] as const);

/** Sealed coastal-warning type discriminator. */
export type CoastalWarningType =
  | 'hurricane-warning'
  | 'hurricane-watch'
  | 'tropical-storm-warning'
  | 'storm-surge-warning';

/**
 * Resolve a `warningType` value to its canonical NHC palette color.
 * Pure function — same input → same output. Exported for parity-cli
 * resolver-shim use.
 */
export function resolveCoastalWarningColor(warningType: CoastalWarningType): string {
  switch (warningType) {
    case 'hurricane-warning':
      return NHC_HURRICANE_WARNING_RED;
    case 'hurricane-watch':
      return NHC_HURRICANE_WATCH_MAGENTA;
    case 'tropical-storm-warning':
      return NHC_TROPICAL_STORM_FIREBRICK;
    case 'storm-surge-warning':
      return NHC_STORM_SURGE_PURPLE;
  }
}

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

const stormSchema = z
  .object({
    /** Storm name — rendered ALL CAPS bold top banner per stub line 35. */
    name: z.string().min(1).max(48),
    /** Optional advisory timestamp (e.g. `'Advisory 12 — 5 PM EDT Mon'`). */
    advisoryTimestamp: z.string().max(64).optional(),
  })
  .strict();

const coneSchema = z
  .object({
    /** SVG path `d` describing the cone polygon (consumer-supplied per D-T347b-4). */
    d: z.string().min(1),
    /** Optional explicit fill; default is semi-transparent white. */
    fill: hex().optional(),
    /** Optional opacity override; default 0.4. */
    opacity: z.number().min(0).max(1).optional(),
  })
  .strict();

const trackDotSchema = z
  .object({
    id: z.string().min(1),
    position: screenPositionSchema,
    /** Sealed enum — D/S/H/M per NWS mandate. */
    intensity: z.enum(['D', 'S', 'H', 'M']),
    /** Optional small-label timestamp below the dot. */
    timestamp: z.string().max(32).optional(),
  })
  .strict();

const coastalWarningSchema = z
  .object({
    id: z.string().min(1),
    /**
     * One or more SVG path strings describing the warning region(s). The
     * primitive renders each path filled with the canonical color
     * resolved from `warningType` per D-T347b-6.
     */
    regionPaths: z.array(z.string().min(1)).min(1).max(64),
    warningType: z.enum([
      'hurricane-warning',
      'hurricane-watch',
      'tropical-storm-warning',
      'storm-surge-warning',
    ]),
  })
  .strict();

const mapPathSchema = z
  .object({
    id: z.string().min(1),
    d: z.string().min(1),
    fill: hex().optional(),
  })
  .strict();

export const stormTrackerPropsSchema = z
  .object({
    storm: stormSchema,
    cone: coneSchema,
    trackDots: z.array(trackDotSchema).min(1).max(48),
    coastalWarnings: z.array(coastalWarningSchema).max(32).optional(),
    mapPaths: z.array(mapPathSchema).max(256).optional(),
    /**
     * Disclaimer text. Default `'Impacts extend beyond the cone'`. Caller
     * may override the wording but CANNOT suppress rendering — the
     * primitive always emits the disclaimer element per D-T347b-2.
     */
    disclaimerText: z.string().min(1).max(96).optional(),
    font: fontSchema.optional(),
    background: hex().optional(),
    foreground: hex().optional(),
    position: positionSchema.optional(),
  })
  .strict();

export type StormTrackerProps = z.infer<typeof stormTrackerPropsSchema>;
export type StormTrackerStorm = z.infer<typeof stormSchema>;
export type StormTrackerCone = z.infer<typeof coneSchema>;
export type StormTrackerTrackDot = z.infer<typeof trackDotSchema>;
export type StormTrackerCoastalWarning = z.infer<typeof coastalWarningSchema>;
export type StormTrackerMapPath = z.infer<typeof mapPathSchema>;
export type StormTrackerIntensity = StormTrackerTrackDot['intensity'];

// ─── constants ───────────────────────────────────────────────────────────

const SYSTEM_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DEFAULT_FONT = {
  family: `Open Sans, ${SYSTEM_FONT_STACK}`,
  weight: 700,
  size: 28,
} as const;
const DEFAULT_BACKGROUND = '#1A2A3F'; // dark navy — typical NHC map base
const DEFAULT_FOREGROUND = '#FFFFFF';
const DEFAULT_DISCLAIMER_TEXT = 'Impacts extend beyond the cone';
const DEFAULT_CONE_FILL = '#FFFFFF';
const DEFAULT_CONE_OPACITY = 0.4;
/** Track-dot circle radius. Sized to envelop a centered ~18-22pt letter. */
const TRACK_DOT_RADIUS_PX = 14;

// ─── component ───────────────────────────────────────────────────────────

interface TrackDotNodeProps {
  dot: StormTrackerTrackDot;
  font: { family: string; weight: number; size: number };
  foreground: string;
}

function TrackDotNode({ dot, font, foreground }: TrackDotNodeProps): ReactElement {
  return (
    <g data-testid={`storm-tracker-track-dot-${dot.id}`} data-intensity={dot.intensity}>
      <circle
        cx={dot.position.x}
        cy={dot.position.y}
        r={TRACK_DOT_RADIUS_PX}
        fill="#FFFFFF"
        stroke="#000000"
        strokeWidth={2}
      />
      <text
        x={dot.position.x}
        y={dot.position.y}
        fontFamily={font.family}
        fontWeight={font.weight}
        fontSize={20}
        fill="#000000"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {dot.intensity}
      </text>
      {dot.timestamp !== undefined ? (
        <text
          x={dot.position.x}
          y={dot.position.y + TRACK_DOT_RADIUS_PX + 14}
          fontFamily={font.family}
          fontWeight={400}
          fontSize={14}
          fill={foreground}
          textAnchor="middle"
        >
          {dot.timestamp}
        </text>
      ) : null}
    </g>
  );
}

interface CoastalWarningNodeProps {
  warning: StormTrackerCoastalWarning;
}

function CoastalWarningNode({ warning }: CoastalWarningNodeProps): ReactElement {
  const fill = resolveCoastalWarningColor(warning.warningType);
  return (
    <g
      data-testid={`storm-tracker-coastal-warning-${warning.id}`}
      data-warning-type={warning.warningType}
    >
      {warning.regionPaths.map((d, i) => (
        <path
          key={`${warning.id}-region-${i}`}
          d={d}
          fill={fill}
          fillOpacity={0.65}
          stroke={fill}
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

/**
 * Renders the NHC 5-day cone-of-uncertainty register. Per D-T347b-1:
 * single-style v1 (no `discriminatedUnion`); future style enum
 * introduces when a second register lands. Per D-T347b-2: mandatory
 * disclaimer renders on every invocation. Frame-deterministic
 * (D-T347b-10).
 */
export function StormTracker(props: StormTrackerProps): ReactElement {
  const { width: canvasW, height: canvasH } = useVideoConfig();
  const region = props.position ?? { x: 0, y: 0, width: canvasW, height: canvasH };
  const font = props.font ?? DEFAULT_FONT;
  const background = props.background ?? DEFAULT_BACKGROUND;
  const foreground = props.foreground ?? DEFAULT_FOREGROUND;
  const disclaimerText = props.disclaimerText ?? DEFAULT_DISCLAIMER_TEXT;
  const coneFill = props.cone.fill ?? DEFAULT_CONE_FILL;
  const coneOpacity = props.cone.opacity ?? DEFAULT_CONE_OPACITY;

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
  const stormBannerStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 24,
    textAlign: 'center',
    color: foreground,
    fontFamily: font.family,
    fontWeight: font.weight,
    fontSize: font.size,
    letterSpacing: 1,
    pointerEvents: 'none',
  };
  const advisoryStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 24 + font.size + 4,
    textAlign: 'center',
    color: foreground,
    fontFamily: font.family,
    fontWeight: 400,
    fontSize: 14,
    pointerEvents: 'none',
  };
  // Disclaimer is bottom-anchored, high-contrast, always-rendered. Per
  // D-T347b-2 the public-safety mandate requires this to remain readable
  // regardless of caller styling — the primitive owns the contrast floor.
  const disclaimerStyle: CSSProperties = {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    padding: '6px 10px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#FFFFFF',
    fontFamily: font.family,
    fontWeight: 600,
    fontSize: 16,
    textAlign: 'center',
    borderRadius: 4,
    pointerEvents: 'none',
  };

  return (
    <div data-testid="storm-tracker" data-storm-name={props.storm.name} style={containerStyle}>
      <svg
        data-testid="storm-tracker-svg"
        width={region.width}
        height={region.height}
        viewBox={`0 0 ${region.width} ${region.height}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <title>{`Storm tracker: ${props.storm.name}`}</title>
        {/* base map (under everything) */}
        {(props.mapPaths ?? []).map((p) => (
          <path key={p.id} data-map-path-id={p.id} d={p.d} fill={p.fill ?? '#22354F'} />
        ))}
        {/* coastal warnings (over base map, under cone) */}
        {(props.coastalWarnings ?? []).map((w) => (
          <CoastalWarningNode key={w.id} warning={w} />
        ))}
        {/* cone polygon (over warnings, under track dots) */}
        <path
          data-testid="storm-tracker-cone"
          d={props.cone.d}
          fill={coneFill}
          fillOpacity={coneOpacity}
          stroke={coneFill}
          strokeOpacity={Math.min(1, coneOpacity + 0.3)}
          strokeWidth={2}
        />
        {/* track dots (top of SVG z-order) */}
        {props.trackDots.map((dot) => (
          <TrackDotNode key={dot.id} dot={dot} font={font} foreground={foreground} />
        ))}
      </svg>
      <div data-testid="storm-tracker-storm-name" style={stormBannerStyle}>
        {props.storm.name.toUpperCase()}
      </div>
      {props.storm.advisoryTimestamp !== undefined ? (
        <div data-testid="storm-tracker-advisory-timestamp" style={advisoryStyle}>
          {props.storm.advisoryTimestamp}
        </div>
      ) : null}
      <div data-testid="storm-tracker-disclaimer" style={disclaimerStyle}>
        {disclaimerText}
      </div>
    </div>
  );
}

/**
 * `stormTrackerClip` — registered as `kind: 'stormTracker'` (camelCase
 * matching the Cluster C frontmatter `clipKind`). Theme slots:
 * `background` → `palette.background`, `foreground` →
 * `palette.foreground` (palettes themselves NOT theme-bound per cluster
 * SKILL "Color palettes are standard, not brand").
 */
export const stormTrackerClip: ClipDefinition<unknown> = defineFrameClip<StormTrackerProps>({
  kind: 'stormTracker',
  component: StormTracker,
  propsSchema: stormTrackerPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    foreground: { kind: 'palette', role: 'foreground' },
  },
});
