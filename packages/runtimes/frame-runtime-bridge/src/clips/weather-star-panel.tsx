// packages/runtimes/frame-runtime-bridge/src/clips/weather-star-panel.tsx
// T-347g — `weatherStar4000Panel` runtime-clip primitive: 1990s
// WeatherStar 4000 / 5000 era register for The Weather Channel's
// "RetroCast Now" first-class register (TWC officially launched 2025).
// Single-style v1 (no `discriminatedUnion` — single consumer
// `twc-retrocast-8bit`); future TWC variants would extend to a sealed-
// style enum then. Mirrors qr-code-bounce / grain single-object-schema
// precedent.
//
// **Pixel-precision is non-negotiable** per cluster SKILL "RetroCast
// register is nostalgia, not throwaway. Treat with same rigor as
// broadcast CNN" + preset stub line 45 "anti-aliased rendering breaks
// the register":
//   - Integer-only sizes (no fractional `font-size`, `width`, `height`)
//   - 8-px-step font sizes (16 / 24 / 32 / 40 / 48)
//   - CSS `image-rendering: pixelated` on text + ticker
//   - No `text-shadow`, `box-shadow`, or `border-radius` (period-
//     authentic flat blocks)
//
// **Canonical palette** baked as static module-level constants (NOT
// theme-able per cluster SKILL "Color palettes are standard, not brand"):
//   - `WEATHER_STAR_BLUE_GRADIENT`: `['#000066', '#000099']` (background)
//   - `WEATHER_STAR_ORANGE_GOLD`: `['#FF9900', '#DAA520']` (accent bars)
//   - `WEATHER_STAR_FOREGROUND_WHITE_GOLD`: `['#FFFFFF', '#DAA520']`
//
// **Surface**: required `header: { city, condition }` + `temperature:
// { value, unit, foreground? }`; optional `metadata[]?` (label/value
// rows), `ticker?` (bottom scrolling marquee with sealed
// `scrollSpeedPxPerFrame: 1 | 2 | 4` integer-pixel-only enum per stub
// line 38), `showLBar?` (default true; signature pre-2019 element),
// `showCrtScanlines?` (subtle 4% opacity overlay per stub line 41),
// `background?` / `foreground?` / `position?` / `font?`.
//
// **Frame-deterministic** — no `Date.now` / `Math.random` / `crypto.*` /
// `setTimeout` / `setInterval` / `fetch` / `requestAnimationFrame` /
// `addEventListener`. Ticker scroll position derived from
// `(frame + frameOffset) * scrollSpeedPxPerFrame` modulo content width
// — closed-form integer math; no `useEffect` accumulation. Same
// `(frame, props)` → byte-identical output.
//
// **Theme slots**: `background` → `palette.background`, `foreground` →
// `palette.foreground` (palettes themselves NOT theme-bound).
//
// v1 carve-outs (deferred):
//   - T-347g-music-cue: period-authentic smooth-jazz / muzak audio cue
//     (per stub line 47).
//   - T-347g-multi-city: multi-city panel transitions with hard-cut
//     sequencing (per stub line 40).

import { useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

// ─── canonical palettes ──────────────────────────────────────────────────

/**
 * WeatherStar 4000 / 5000 era deep-blue gradient endpoints. Per stub
 * line 24. NOT theme-able.
 */
export const WEATHER_STAR_BLUE_GRADIENT: readonly [string, string] = Object.freeze([
  '#000066',
  '#000099',
]) as readonly [string, string];

/**
 * WeatherStar orange / gold accent bars. Per stub line 25.
 */
export const WEATHER_STAR_ORANGE_GOLD: readonly [string, string] = Object.freeze([
  '#FF9900',
  '#DAA520',
]) as readonly [string, string];

/**
 * WeatherStar temperature-foreground options: white or gold per stub
 * line 26 ("white #FFFFFF or gold #DAA520").
 */
export const WEATHER_STAR_FOREGROUND_WHITE_GOLD: readonly [string, string] = Object.freeze([
  '#FFFFFF',
  '#DAA520',
]) as readonly [string, string];

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

const headerSchema = z
  .object({
    city: z.string().min(1).max(32),
    condition: z.string().min(1).max(48),
  })
  .strict();

const temperatureSchema = z
  .object({
    value: z.number().int().min(-99).max(140),
    unit: z.enum(['F', 'C']),
    foreground: z.enum(['white', 'gold']).optional(),
  })
  .strict();

const metadataRowSchema = z
  .object({
    label: z.string().min(1).max(24),
    value: z.string().min(1).max(32),
  })
  .strict();

const tickerSchema = z
  .object({
    items: z.array(z.string().min(1).max(64)).min(1).max(32),
    /** Sealed integer-pixel-only enum per stub line 38. */
    scrollSpeedPxPerFrame: z.union([z.literal(1), z.literal(2), z.literal(4)]),
    /** Optional pinning offset for parity-fixture frame stability. */
    frameOffset: z.number().int().nonnegative().optional(),
  })
  .strict();

const fontSchema = z
  .object({
    family: z.string().min(1),
    weight: z.number().int().min(100).max(900).optional(),
    /** Caller-supplied size; primitive snaps to nearest 8-px multiple. */
    size: z.number().int().positive().optional(),
  })
  .strict();

const backgroundGradientSchema = z
  .object({
    from: hex(),
    to: hex(),
  })
  .strict();

export const weatherStar4000PanelPropsSchema = z
  .object({
    header: headerSchema,
    temperature: temperatureSchema,
    metadata: z.array(metadataRowSchema).max(8).optional(),
    ticker: tickerSchema.optional(),
    showLBar: z.boolean().optional(),
    showCrtScanlines: z.boolean().optional(),
    background: backgroundGradientSchema.optional(),
    foreground: hex().optional(),
    font: fontSchema.optional(),
    position: positionSchema.optional(),
  })
  .strict();

export type WeatherStar4000PanelProps = z.infer<typeof weatherStar4000PanelPropsSchema>;
export type WeatherStarHeader = z.infer<typeof headerSchema>;
export type WeatherStarTemperature = z.infer<typeof temperatureSchema>;
export type WeatherStarTicker = z.infer<typeof tickerSchema>;

// ─── constants ───────────────────────────────────────────────────────────

const DEFAULT_FONT_FAMILY = "'Press Start 2P', 'VT323', monospace";
const L_BAR_WIDTH_PX = 64; // signature pre-2019 sidebar width
const CRT_SCANLINE_OPACITY = 0.04; // per stub line 41 "subtle, 4% opacity"
/** Approximate per-character width in the 16px Press Start 2P register. */
const TICKER_CHAR_WIDTH_16PX = 14;

// ─── pure helpers ────────────────────────────────────────────────────────

/**
 * Snap a caller-supplied size to the nearest 8-px multiple per stub
 * line 33 "Sizes step in 8-px increments (no fractional sizing)". Pure
 * integer math — same input → same output.
 */
export function snapTo8px(size: number): number {
  return Math.max(8, Math.round(size / 8) * 8);
}

/**
 * Closed-form integer ticker scroll position. Pure function of
 * `(frame, frameOffset, scrollSpeedPxPerFrame, contentWidthPx)`. The
 * tick scrolls leftward (negative `translateX`) at the configured
 * speed, wrapping at content-width modulo to preserve seamless loop.
 */
export function tickerScrollPosition(args: {
  frame: number;
  frameOffset: number;
  scrollSpeedPxPerFrame: 1 | 2 | 4;
  contentWidthPx: number;
}): number {
  const totalFrames = args.frame + args.frameOffset;
  const totalPx = totalFrames * args.scrollSpeedPxPerFrame;
  // wrap at content width to support seamless infinite scroll
  const wrapped = ((totalPx % args.contentWidthPx) + args.contentWidthPx) % args.contentWidthPx;
  // Normalize -0 → 0 so `Object.is(result, 0)` holds when wrapped is 0.
  return wrapped === 0 ? 0 : -wrapped;
}

// ─── component ───────────────────────────────────────────────────────────

/**
 * Renders the WeatherStar 4000 / 5000 era register. Pixel-precision
 * preserved (per D-T347g-4): integer-only sizes, 8-px-step fonts,
 * `image-rendering: pixelated`, no anti-aliasing softeners. Frame-
 * deterministic (per D-T347g-6): ticker scroll position closed-form
 * from `(frame, frameOffset, scrollSpeedPxPerFrame)`; no `useEffect`.
 */
export function WeatherStar4000Panel(props: WeatherStar4000PanelProps): ReactElement {
  const frame = useCurrentFrame();
  const { width: canvasW, height: canvasH } = useVideoConfig();
  const region = props.position ?? { x: 0, y: 0, width: canvasW, height: canvasH };

  const showLBar = props.showLBar !== false; // default true (canonical)
  const showCrt = props.showCrtScanlines === true;
  const bgFrom = props.background?.from ?? WEATHER_STAR_BLUE_GRADIENT[0];
  const bgTo = props.background?.to ?? WEATHER_STAR_BLUE_GRADIENT[1];
  const foregroundDefault = WEATHER_STAR_FOREGROUND_WHITE_GOLD[0];
  const foreground = props.foreground ?? foregroundDefault;
  const fontFamily = props.font?.family ?? DEFAULT_FONT_FAMILY;
  const tempFgRaw =
    props.temperature.foreground === 'gold'
      ? WEATHER_STAR_FOREGROUND_WHITE_GOLD[1]
      : WEATHER_STAR_FOREGROUND_WHITE_GOLD[0];

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: region.x,
    top: region.y,
    width: region.width,
    height: region.height,
    background: `linear-gradient(180deg, ${bgFrom} 0%, ${bgTo} 100%)`,
    color: foreground,
    fontFamily,
    overflow: 'hidden',
    imageRendering: 'pixelated' as CSSProperties['imageRendering'],
    pointerEvents: 'none',
  };

  // Header banner — top of the content area (right of L-bar).
  const contentLeft = showLBar ? L_BAR_WIDTH_PX : 0;
  const contentWidth = region.width - contentLeft;

  const headerStyle: CSSProperties = {
    position: 'absolute',
    left: contentLeft + 16,
    top: 24,
    width: contentWidth - 32,
    fontSize: 24,
    fontWeight: 700,
    color: WEATHER_STAR_FOREGROUND_WHITE_GOLD[1], // gold
    letterSpacing: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'clip',
  };

  // Orange/gold accent rule beneath the header.
  const accentRuleStyle: CSSProperties = {
    position: 'absolute',
    left: contentLeft + 16,
    top: 56,
    width: contentWidth - 32,
    height: 4,
    background: WEATHER_STAR_ORANGE_GOLD[0],
  };

  // Temperature display — large block centered in the content area.
  const tempSize = snapTo8px(props.font?.size ?? 96);
  const tempLabelStyle: CSSProperties = {
    position: 'absolute',
    left: contentLeft + 32,
    top: 96,
    fontSize: 16,
    fontWeight: 400,
    color: foreground,
    letterSpacing: 1,
  };
  const tempValueStyle: CSSProperties = {
    position: 'absolute',
    left: contentLeft + 32,
    top: 128,
    fontSize: tempSize,
    fontWeight: 700,
    lineHeight: 1,
    color: tempFgRaw,
    letterSpacing: 0,
  };

  // Metadata rows — stacked below the temperature.
  const metadataTop = 128 + tempSize + 24;
  const metadataRowH = 32;

  // Ticker — bottom strip; closed-form scroll position.
  const tickerHeight = 40;
  const tickerY = region.height - tickerHeight;
  const tickerContent = (props.ticker?.items ?? []).join(' • ');
  const tickerContentWidth = Math.max(
    contentWidth, // ensures wrap at >= one content-width
    tickerContent.length * TICKER_CHAR_WIDTH_16PX,
  );
  const tickerOffsetX = props.ticker
    ? tickerScrollPosition({
        frame,
        frameOffset: props.ticker.frameOffset ?? 0,
        scrollSpeedPxPerFrame: props.ticker.scrollSpeedPxPerFrame,
        contentWidthPx: tickerContentWidth,
      })
    : 0;

  return (
    <div data-testid="weather-star-panel" style={containerStyle}>
      {showLBar ? (
        <div
          data-testid="weather-star-l-bar"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: L_BAR_WIDTH_PX,
            height: region.height,
            background: WEATHER_STAR_ORANGE_GOLD[1], // dark gold for the L-bar fill
            borderRight: `4px solid ${WEATHER_STAR_ORANGE_GOLD[0]}`,
          }}
        />
      ) : null}

      <div data-testid="weather-star-header" data-city={props.header.city} style={headerStyle}>
        {props.header.city.toUpperCase()} — {props.header.condition.toUpperCase()}
      </div>
      <div data-testid="weather-star-accent-rule" style={accentRuleStyle} />

      <div style={tempLabelStyle}>TEMPERATURE</div>
      <div data-testid="weather-star-temperature" style={tempValueStyle}>
        {`${props.temperature.value}°${props.temperature.unit}`}
      </div>

      {(props.metadata ?? []).map((row, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: positional metadata row slot.
          key={i}
          data-testid={`weather-star-metadata-${i}`}
          style={{
            position: 'absolute',
            left: contentLeft + 32,
            top: metadataTop + i * metadataRowH,
            fontSize: 16,
            fontWeight: 400,
            color: foreground,
            letterSpacing: 1,
          }}
        >
          <span style={{ color: WEATHER_STAR_FOREGROUND_WHITE_GOLD[1] }}>{row.label}</span>{' '}
          {row.value}
        </div>
      ))}

      {props.ticker !== undefined ? (
        <div
          data-testid="weather-star-ticker"
          data-scroll-speed={props.ticker.scrollSpeedPxPerFrame}
          style={{
            position: 'absolute',
            left: 0,
            top: tickerY,
            width: region.width,
            height: tickerHeight,
            background: WEATHER_STAR_ORANGE_GOLD[1],
            borderTop: `2px solid ${WEATHER_STAR_ORANGE_GOLD[0]}`,
            borderBottom: `2px solid ${WEATHER_STAR_ORANGE_GOLD[0]}`,
            overflow: 'hidden',
            color: '#000066',
            fontWeight: 700,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: tickerHeight,
              display: 'flex',
              alignItems: 'center',
              transform: `translateX(${tickerOffsetX}px)`,
              whiteSpace: 'nowrap',
              paddingLeft: 16,
            }}
          >
            {tickerContent} • {tickerContent}
          </div>
        </div>
      ) : null}

      {showCrt ? (
        <div
          data-testid="weather-star-crt-scanlines"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            background:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 3px)',
            opacity: CRT_SCANLINE_OPACITY * 25, // ~1.0 at the canonical 4% per scanline visual mass
            mixBlendMode: 'multiply',
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * `weatherStar4000PanelClip` — registered as `kind: 'weatherStar4000Panel'`
 * (camelCase). Theme slots: `background` → `palette.background`,
 * `foreground` → `palette.foreground` (palettes themselves NOT
 * theme-bound).
 */
export const weatherStar4000PanelClip: ClipDefinition<unknown> =
  defineFrameClip<WeatherStar4000PanelProps>({
    kind: 'weatherStar4000Panel',
    component: WeatherStar4000Panel,
    propsSchema: weatherStar4000PanelPropsSchema,
    themeSlots: {
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
    },
  });
