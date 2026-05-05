// packages/runtimes/frame-runtime-bridge/src/clips/news-ticker-bar.tsx
// T-356a — `news-ticker-bar` runtime-clip primitive: a horizontal band
// of N (1..24) ticker entries (symbol + price + delta + ▲/▼/▬ arrow)
// translating left at a frame-derived offset, looping continuously via
// the doubled-row marquee pattern. Generic primitive; cluster-specific
// palettes + entry payloads (Bloomberg market chyrons, ESPN BottomLine
// sports score crawls, CNN/Fox breaking-news, crypto dashboards) live
// in `parity-cli` resolver shims, not in this primitive. Frame-derived,
// fully deterministic.

import { useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const newsTickerBarEntrySchema = z
  .object({
    symbol: z.string().min(1),
    price: z.string().min(1),
    delta: z.string().min(1),
    direction: z.enum(['up', 'down', 'flat']),
  })
  .strict();

export const newsTickerBarPropsSchema = z
  .object({
    entries: z.array(newsTickerBarEntrySchema).min(1).max(24),
    /** Scroll speed in px/sec. Defaults to 60 (broadcast-tempo). */
    scrollSpeed: z.number().positive().optional(),
    /** Gap between adjacent chips in px. Defaults to 60. */
    chipGap: z.number().nonnegative().optional(),
    /** Fixed chip width in px (D-T356a-4 — keeps modulo math watertight). Defaults to 220. */
    chipWidth: z.number().positive().optional(),
    /** Band height in px. Defaults to 50. */
    bandHeight: z.number().positive().optional(),
    /** Band edge of the canvas. Defaults to 'bottom'. */
    bandPosition: z.enum(['top', 'bottom']).optional(),
    /** Band background color (hex). Theme slot `palette.background` fills in when absent. */
    background: z.string().regex(HEX_COLOR_RE).optional(),
    /** Symbol + price text color (hex). Theme slot `palette.foreground` fills in when absent. */
    foreground: z.string().regex(HEX_COLOR_RE).optional(),
    /** Color for `direction: 'up'` deltas + arrows. Theme slot `palette.positive`. */
    upColor: z.string().regex(HEX_COLOR_RE).optional(),
    /** Color for `direction: 'down'` deltas + arrows. Theme slot `palette.negative`. */
    downColor: z.string().regex(HEX_COLOR_RE).optional(),
    /** Color for `direction: 'flat'` deltas + arrows. Theme slot `palette.foreground`. */
    flatColor: z.string().regex(HEX_COLOR_RE).optional(),
  })
  .strict();

export type NewsTickerBarProps = z.infer<typeof newsTickerBarPropsSchema>;

const DEFAULT_SCROLL_SPEED = 60;
const DEFAULT_CHIP_GAP = 60;
const DEFAULT_CHIP_WIDTH = 220;
const DEFAULT_BAND_HEIGHT = 50;
const DEFAULT_BACKGROUND = '#0a0a0a';
const DEFAULT_FOREGROUND = '#f5f7fa';
const DEFAULT_UP_COLOR = '#22c55e';
const DEFAULT_DOWN_COLOR = '#ef4444';
const DEFAULT_FLAT_COLOR = '#9ca3af';

const ARROW_GLYPH: Record<NewsTickerBarProps['entries'][number]['direction'], string> = {
  up: '▲',
  down: '▼',
  flat: '▬',
};

/**
 * Renders a horizontal scrolling chyron band of ticker entries. Chips
 * translate left at `(frame * scrollSpeed) / fps` px, wrapping at
 * `rowWidth = entries.length * (chipWidth + chipGap)` via modulo. The
 * row is rendered twice (doubled-row marquee) so the seam at the wrap
 * point is visually invisible — as the first copy exits left, the
 * second copy is already in view and slides into the original first
 * slot when modulo resets.
 *
 * Font posture is permissive `system-ui, sans-serif` (D-T356a-7);
 * presets declare `preferredFont` / `fallbackFont` in frontmatter and
 * the FontManager applies them at render time.
 */
export function NewsTickerBar({
  entries,
  scrollSpeed = DEFAULT_SCROLL_SPEED,
  chipGap = DEFAULT_CHIP_GAP,
  chipWidth = DEFAULT_CHIP_WIDTH,
  bandHeight = DEFAULT_BAND_HEIGHT,
  bandPosition = 'bottom',
  background = DEFAULT_BACKGROUND,
  foreground = DEFAULT_FOREGROUND,
  upColor = DEFAULT_UP_COLOR,
  downColor = DEFAULT_DOWN_COLOR,
  flatColor = DEFAULT_FLAT_COLOR,
}: NewsTickerBarProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slot = chipWidth + chipGap;
  const rowWidth = entries.length * slot;
  const offsetRaw = (frame * scrollSpeed) / fps;
  // Modulo into [0, rowWidth); negative => leftward. The doubled-row
  // marquee below keeps the seam continuous as offsetPx wraps.
  const offsetPx = ((offsetRaw % rowWidth) + rowWidth) % rowWidth;
  const translateX = -offsetPx;

  const bandStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: bandHeight,
    overflow: 'hidden',
    backgroundColor: background,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    ...(bandPosition === 'top' ? { top: 0 } : { bottom: 0 }),
  };

  const marqueeStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: rowWidth * 2,
    transform: `translateX(${translateX}px)`,
    willChange: 'transform',
  };

  const colorFor = (direction: NewsTickerBarProps['entries'][number]['direction']): string => {
    if (direction === 'up') return upColor;
    if (direction === 'down') return downColor;
    return flatColor;
  };

  // Doubled-row marquee — render entries twice for seamless wrap.
  const doubled = [...entries, ...entries];

  return (
    <div data-testid="news-ticker-bar-clip" style={{ width: '100%', height: '100%' }}>
      <div data-testid="news-ticker-bar-band" style={bandStyle}>
        <div data-testid="news-ticker-bar-marquee" style={marqueeStyle}>
          {doubled.map((entry, i) => {
            const x = i * slot;
            const directionColor = colorFor(entry.direction);
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: positional chip slot — slot i in the doubled marquee is stable across frames.
                key={i}
                data-testid={`news-ticker-bar-chip-${i}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: x,
                  width: chipWidth,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  paddingLeft: 16,
                  paddingRight: 16,
                  boxSizing: 'border-box',
                  fontSize: Math.round(bandHeight * 0.42),
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  data-testid={`news-ticker-bar-chip-${i}-symbol`}
                  style={{ color: foreground, fontWeight: 700 }}
                >
                  {entry.symbol}
                </span>
                <span data-testid={`news-ticker-bar-chip-${i}-price`} style={{ color: foreground }}>
                  {entry.price}
                </span>
                <span
                  data-testid={`news-ticker-bar-chip-${i}-delta`}
                  style={{ color: directionColor, fontWeight: 600 }}
                >
                  {ARROW_GLYPH[entry.direction]} {entry.delta}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// D-T356a-6 fallback discipline: the spec proposes `palette.positive` /
// `palette.negative` slots for `upColor` / `downColor`, but the current
// `ThemePalette` (packages/schema/src/theme.ts) exposes only
// `primary | secondary | accent | background | foreground | surface` —
// no `positive` / `negative` roles. Per the spec's own fallback note
// ("likely `palette/accent`"), both `upColor` and `downColor` resolve
// to `palette.accent` until a later schema-source-truth task widens
// `ThemePalette`. `flatColor` stays on `palette.foreground` (neutral
// text colour). Cluster owners (Bloomberg green/red, ESPN team
// palette) override both via explicit hex props, so the theme-slot
// fallback only matters when the host has neither.
export const newsTickerBarClip: ClipDefinition<unknown> = defineFrameClip<NewsTickerBarProps>({
  kind: 'news-ticker-bar',
  component: NewsTickerBar,
  propsSchema: newsTickerBarPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    foreground: { kind: 'palette', role: 'foreground' },
    upColor: { kind: 'palette', role: 'accent' },
    downColor: { kind: 'palette', role: 'accent' },
    flatColor: { kind: 'palette', role: 'foreground' },
  },
});
