// packages/runtimes/frame-runtime-bridge/src/clips/animated-map.tsx
// T-131d.4 port of reference/slidemotion/.../clips/animated-map.tsx —
// FALLBACK-ONLY. The reference clip conditionally initialises `mapbox-gl`
// when a `mapboxToken` prop is passed; the bridge deliberately does NOT ship
// that path. Real tile rendering requires a `fetch` per tile + canvas-
// imperative `useEffect` DOM mutations, both of which are non-starters under
// frame-runtime determinism. The SVG "simulation" — which the reference
// itself renders whenever no token is supplied — is the sole implementation
// here. A future bake-tier `animated-map-real` clip that pre-renders tiles
// during export is the correct home for real Mapbox, not a frame-
// determinism-scoped preview clip.

import {
  cubicBezier,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const latLngTuple = z.tuple([z.number(), z.number()]);

export const animatedMapPropsSchema = z
  .object({
    startCenter: latLngTuple.optional(),
    endCenter: latLngTuple.optional(),
    startZoom: z.number().positive().optional(),
    endZoom: z.number().positive().optional(),
    title: z.string().optional(),
    style: z.enum(['dark', 'light', 'satellite']).optional(),
    // Palette-overridable colours. Reference baked these off the `style`
    // enum — defaults preserved, overrides enable `themeSlots` integration.
    backgroundColor: z.string().optional(),
    gridColor: z.string().optional(),
    accentColor: z.string().optional(),
    textColor: z.string().optional(),
  })
  .strict();

export type AnimatedMapProps = z.infer<typeof animatedMapPropsSchema>;
export type AnimatedMapStyle = NonNullable<AnimatedMapProps['style']>;

// `Easing.inOut(Easing.cubic)` (reference) → symmetric cubic ease-in-out.
// The standard CSS-spec bezier approximation is `cubic-bezier(0.645, 0.045,
// 0.355, 1)`. Used for the camera pan (center / zoom over the first 70% of
// the clip).
const EASE_IN_OUT_CUBIC = cubicBezier(0.645, 0.045, 0.355, 1);
// `Easing.bezier(0.16, 1, 0.3, 1)` — ease-out-expo; used for the route
// line draw (the same easing every other bridge clip uses for "draw-in"
// sweeps — see line-chart-draw, logo-intro, counter, etc.).
const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

const STYLE_DEFAULTS: Record<
  AnimatedMapStyle,
  { bg: string; grid: string; accent: string; text: string }
> = {
  dark: { bg: '#0a1628', grid: '#152238', accent: '#5af8fb', text: '#ebf1fa' },
  satellite: { bg: '#1a3a2a', grid: '#2a4a3a', accent: '#4ade80', text: '#ebf1fa' },
  light: { bg: '#e8e4d8', grid: '#d0ccc0', accent: '#2563eb', text: '#1a1a1a' },
};

const CANVAS_W = 1920;
const CANVAS_H = 1080;
// Route anchor points mirror the reference's baked coordinates. These are
// SVG-space (not geographic); the simulated route is purely decorative.
const ROUTE_START = { x: 300, y: 700 };
const ROUTE_END = { x: 1620, y: 300 };

export function AnimatedMap({
  startCenter = [48.8566, 2.3522],
  endCenter = [40.7128, -74.006],
  startZoom = 4,
  endZoom = 12,
  title = 'Route',
  style = 'dark',
  backgroundColor,
  gridColor,
  accentColor,
  textColor,
}: AnimatedMapProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames * 0.7], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_IN_OUT_CUBIC,
  });

  const [startLat, startLng] = startCenter;
  const [endLat, endLng] = endCenter;
  const currentLat = startLat + (endLat - startLat) * progress;
  const currentLng = startLng + (endLng - startLng) * progress;
  const currentZoom = startZoom + (endZoom - startZoom) * progress;

  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const routeProgress = interpolate(
    frame,
    [durationInFrames * 0.1, durationInFrames * 0.8],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT_EXPO },
  );

  const defaults = STYLE_DEFAULTS[style];
  const bg = backgroundColor ?? defaults.bg;
  const grid = gridColor ?? defaults.grid;
  const accent = accentColor ?? defaults.accent;
  const text = textColor ?? defaults.text;

  const gridSize = Math.max(20, 200 / currentZoom);
  const verticalLineCount = Math.ceil(CANVAS_W / gridSize) + 1;
  const horizontalLineCount = Math.ceil(CANVAS_H / gridSize) + 1;

  const currentRouteX = ROUTE_START.x + (ROUTE_END.x - ROUTE_START.x) * routeProgress;
  const currentRouteY = ROUTE_START.y + (ROUTE_END.y - ROUTE_START.y) * routeProgress;
  // `0.3 + sin(frame * 0.3) * 0.3` — deterministic pulse ring around the
  // advancing dot. Function of frame alone → frame-exact across runs.
  const pulseOpacity = 0.3 + Math.sin(frame * 0.3) * 0.3;

  const hasTitle = title.length > 0;

  return (
    <div
      data-testid="animated-map-clip"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: bg,
        position: 'relative',
        opacity: fadeIn,
        overflow: 'hidden',
      }}
    >
      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{ position: 'absolute', inset: 0 }}
        role="img"
      >
        <title>{hasTitle ? title : 'Animated map'}</title>
        {Array.from({ length: verticalLineCount }, (_, i) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: positional grid line aligned with zoom-derived pitch.
            key={`v${i}`}
            x1={i * gridSize}
            y1={0}
            x2={i * gridSize}
            y2={CANVAS_H}
            stroke={grid}
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: horizontalLineCount }, (_, i) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: positional grid line aligned with zoom-derived pitch.
            key={`h${i}`}
            x1={0}
            y1={i * gridSize}
            x2={CANVAS_W}
            y2={i * gridSize}
            stroke={grid}
            strokeWidth={0.5}
          />
        ))}
        <line
          data-testid="animated-map-route"
          x1={ROUTE_START.x}
          y1={ROUTE_START.y}
          x2={currentRouteX}
          y2={currentRouteY}
          stroke={accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="8 4"
        />
        <circle cx={ROUTE_START.x} cy={ROUTE_START.y} r={8} fill={accent} opacity={0.8} />
        {routeProgress > 0.9 && (
          <circle
            data-testid="animated-map-end-dot"
            cx={ROUTE_END.x}
            cy={ROUTE_END.y}
            r={8}
            fill="#ef4444"
            opacity={0.8}
          />
        )}
        <circle
          data-testid="animated-map-pulse"
          cx={currentRouteX}
          cy={currentRouteY}
          r={12}
          fill="none"
          stroke={accent}
          strokeWidth={2}
          opacity={pulseOpacity}
        />
      </svg>

      {hasTitle && (
        <div
          data-testid="animated-map-title"
          style={{
            position: 'absolute',
            top: 40,
            left: 60,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: text,
          }}
        >
          {title}
        </div>
      )}
      <div
        data-testid="animated-map-coords"
        style={{
          position: 'absolute',
          bottom: 40,
          right: 60,
          fontFamily: 'Plus Jakarta Sans, monospace',
          fontSize: 14,
          color: accent,
          opacity: 0.7,
        }}
      >
        {currentLat.toFixed(4)}, {currentLng.toFixed(4)} | zoom: {currentZoom.toFixed(1)}
      </div>
    </div>
  );
}

export const animatedMapClip: ClipDefinition<unknown> = defineFrameClip<AnimatedMapProps>({
  kind: 'animated-map',
  component: AnimatedMap,
  propsSchema: animatedMapPropsSchema,
  themeSlots: {
    backgroundColor: { kind: 'palette', role: 'background' },
    accentColor: { kind: 'palette', role: 'primary' },
    textColor: { kind: 'palette', role: 'foreground' },
    // gridColor deliberately omitted: it's a hand-tuned tonal shift off the
    // style's background (one palette step darker/lighter). Mapping it to
    // `muted` or `surface` across arbitrary themes produces visually wrong
    // contrast. Authors who need to override it can set `gridColor`
    // explicitly.
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 700 }],
});
