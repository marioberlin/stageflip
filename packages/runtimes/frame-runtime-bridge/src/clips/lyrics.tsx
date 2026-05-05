// packages/runtimes/frame-runtime-bridge/src/clips/lyrics.tsx
// T-322 — `lyrics` runtime-clip primitive: line-level music-synced
// lyric panel with three style bundles (`'karaoke-wipe'` —
// left-to-right color front sweeping across the active line driven by
// per-line ms-progress; `'three-line-stack'` — past dimmed at top /
// active highlighted in middle / next preview at bottom; `'highlight-
// current'` — active line only, full-screen). Frame-deterministic line
// visibility (`(currentTimeMs ∈ [line.startMs, line.endMs))`). Stable
// SVG `<clipPath>` + `<filter>` IDs derived from line index (no
// `crypto.randomUUID()`); per-line entrance (`'none'` / `'fade'` /
// `'rise'`); optional `glow?` halo via SVG Gaussian-blur filter on the
// active line. Generic primitive across Cluster F music-video lyric
// presets (T-367 karaoke-progressive-wipe) and reusable for Cluster
// A/G music-show graphics. Cluster-specific palettes + canned lines
// live in `parity-cli` resolver shims, not in this primitive.

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const hex = () => z.string().regex(HEX_COLOR_RE);

const lyricsLineSchema = z
  .object({
    text: z.string().min(1),
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
  })
  .strict();

export const lyricsPropsSchema = z
  .object({
    lines: z.array(lyricsLineSchema).min(1).max(40),
    style: z.enum(['karaoke-wipe', 'three-line-stack', 'highlight-current']),
    font: z
      .object({
        family: z.string(),
        weight: z.number().int().min(100).max(900),
        size: z.number().positive(),
        letterSpacing: z.number().optional(),
      })
      .strict()
      .optional(),
    casing: z.enum(['as-is', 'uppercase', 'lowercase', 'title-case']).optional(),
    background: hex().optional(),
    foreground: hex().optional(),
    highlightColor: hex().optional(),
    muteColor: hex().optional(),
    wipeColor: hex().optional(),
    muteOpacity: z.number().min(0).max(1).optional(),
    position: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        alignment: z.enum(['left', 'center', 'right']),
      })
      .strict(),
    lineGap: z.number().nonnegative().optional(),
    entrance: z.enum(['none', 'fade', 'rise']).optional(),
    glow: z
      .object({
        color: hex(),
        blur: z.number().positive(),
      })
      .strict()
      .optional(),
    maxLinesVisible: z.union([z.literal(1), z.literal(3), z.literal(5)]).optional(),
  })
  .strict();

export type LyricsProps = z.infer<typeof lyricsPropsSchema>;

type CasingMode = NonNullable<LyricsProps['casing']>;
type EntranceMode = NonNullable<LyricsProps['entrance']>;

const SYSTEM_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DEFAULT_FONT = {
  family: `Bebas Neue, Anton, ${SYSTEM_FONT_STACK}`,
  weight: 700,
  size: 96,
} as const;
const DEFAULT_FOREGROUND = '#CCCCCC';
const DEFAULT_HIGHLIGHT = '#F3CE32';
const DEFAULT_BACKGROUND = '#000000';
const DEFAULT_MUTE_OPACITY = 0.5;
const DEFAULT_LINE_GAP = 80;
const ENTRANCE_FRAMES = 12;
const RISE_DISTANCE_PX = 12;

function applyCasing(text: string, casing: CasingMode): string {
  if (casing === 'uppercase') return text.toUpperCase();
  if (casing === 'lowercase') return text.toLowerCase();
  if (casing === 'title-case') return text.replace(/\b\w/g, (c) => c.toUpperCase());
  return text;
}

function alignmentToTextAlign(alignment: 'left' | 'center' | 'right'): CSSProperties['textAlign'] {
  return alignment;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

interface ResolvedLine {
  raw: string;
  text: string;
  startMs: number;
  endMs: number;
}

interface EntranceState {
  opacity: number;
  translateY: number;
}

function computeLineEntrance(
  entrance: EntranceMode,
  frame: number,
  lineStartMs: number,
  fps: number,
): EntranceState {
  if (entrance === 'none') {
    return { opacity: 1, translateY: 0 };
  }
  const entranceStartFrame = (lineStartMs / 1000) * fps;
  const opacity = interpolate(
    frame,
    [entranceStartFrame, entranceStartFrame + ENTRANCE_FRAMES],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  let translateY = 0;
  if (entrance === 'rise') {
    translateY = interpolate(
      frame,
      [entranceStartFrame, entranceStartFrame + ENTRANCE_FRAMES],
      [RISE_DISTANCE_PX, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
  }
  return { opacity, translateY };
}

interface LineRenderInput {
  line: ResolvedLine;
  index: number;
  role: 'past' | 'active' | 'next';
  font: { family: string; weight: number; size: number; letterSpacing?: number | undefined };
  foreground: string;
  highlightColor: string;
  wipeColor: string;
  muteColor: string;
  muteOpacity: number;
  alignment: 'left' | 'center' | 'right';
  width: number;
  isKaraoke: boolean;
  karaokeProgress: number;
  entranceState: EntranceState;
  glow: { color: string; blur: number } | undefined;
  yOffset: number;
}

const KARAOKE_SVG_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  overflow: 'visible',
};

function LineNode(input: LineRenderInput): ReactElement {
  const {
    line,
    index,
    role,
    font,
    foreground,
    highlightColor,
    wipeColor,
    muteColor,
    muteOpacity,
    alignment,
    width,
    isKaraoke,
    karaokeProgress,
    entranceState,
    glow,
    yOffset,
  } = input;

  // Color + opacity selection per role
  let color = foreground;
  let roleOpacity = 1;
  if (role === 'active') {
    color = highlightColor;
    roleOpacity = 1;
  } else if (role === 'past' || role === 'next') {
    color = muteColor;
    roleOpacity = muteOpacity;
  }

  const transform =
    entranceState.translateY !== 0 ? `translateY(${entranceState.translateY}px)` : undefined;
  const baseStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: yOffset,
    width,
    fontFamily: font.family,
    fontWeight: font.weight,
    fontSize: font.size,
    letterSpacing: font.letterSpacing,
    lineHeight: 1.1,
    textAlign: alignmentToTextAlign(alignment),
    opacity: entranceState.opacity * roleOpacity,
    color,
    whiteSpace: 'nowrap',
    overflow: 'visible',
    boxSizing: 'border-box',
  };
  if (transform !== undefined) {
    baseStyle.transform = transform;
  }

  const glowFilterId = `lyrics-glow-${index}`;
  const clipId = `lyrics-line-clip-${index}`;
  const showGlow = glow !== undefined && role === 'active';

  // Active line in karaoke-wipe mode: two layers + clip-path
  if (isKaraoke && role === 'active') {
    const fillColor = wipeColor;
    return (
      <div data-testid={`lyrics-line-${index}`} style={baseStyle}>
        {showGlow ? (
          <svg
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              pointerEvents: 'none',
            }}
          >
            <title>{`lyrics glow ${index}`}</title>
            <defs>
              <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation={glow.blur} />
                <feFlood floodColor={glow.color} />
              </filter>
            </defs>
          </svg>
        ) : null}
        <span style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          {/* base layer */}
          <span style={{ color: foreground }}>{line.text}</span>
          {/* wipe overlay */}
          <svg aria-hidden style={KARAOKE_SVG_STYLE}>
            <title>{`lyrics karaoke fill ${index}`}</title>
            <defs>
              <clipPath id={clipId} data-testid={`lyrics-line-clip-${index}`}>
                <rect
                  data-testid={`lyrics-line-clip-fill-${index}`}
                  x="0"
                  y="0"
                  width={karaokeProgress * 100}
                  height="100"
                />
              </clipPath>
            </defs>
            <foreignObject x="0" y="0" width="100%" height="100%" clipPath={`url(#${clipId})`}>
              <span
                style={{
                  color: fillColor,
                  fontFamily: font.family,
                  fontWeight: font.weight,
                  fontSize: font.size,
                  textAlign: alignmentToTextAlign(alignment),
                  display: 'block',
                  width: '100%',
                  filter: showGlow ? `url(#${glowFilterId})` : undefined,
                }}
              >
                {line.text}
              </span>
            </foreignObject>
          </svg>
        </span>
      </div>
    );
  }

  // Non-karaoke or non-active line: simple text node + optional glow on active.
  return (
    <div data-testid={`lyrics-line-${index}`} style={baseStyle}>
      {showGlow ? (
        <svg
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
        >
          <title>{`lyrics glow ${index}`}</title>
          <defs>
            <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={glow.blur} />
              <feFlood floodColor={glow.color} />
            </filter>
          </defs>
        </svg>
      ) : null}
      <span
        style={{
          display: 'inline-block',
          width: '100%',
          textAlign: alignmentToTextAlign(alignment),
          filter: showGlow ? `url(#${glowFilterId})` : undefined,
        }}
      >
        {line.text}
      </span>
    </div>
  );
}

/**
 * Renders a line-level music-synced lyric panel with one of three
 * visual styles. Frame-derived line visibility (`(currentTimeMs ∈
 * [line.startMs, line.endMs))`); `'karaoke-wipe'` left-to-right color
 * front via SVG `<clipPath>` driven by per-line ms-progress (stable
 * line-index-derived clipPath IDs); `'three-line-stack'` past dimmed /
 * active highlighted / next preview vertical register; `'highlight-
 * current'` active-only mono-line. Optional `glow?` halo via SVG
 * Gaussian-blur filter applied to the active line only. Casing
 * transforms applied at render time (no CSS `text-transform`).
 */
export function Lyrics(props: LyricsProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  const casing = props.casing ?? 'as-is';
  const font = props.font ?? DEFAULT_FONT;
  const foreground = props.foreground ?? DEFAULT_FOREGROUND;
  const highlightColor = props.highlightColor ?? DEFAULT_HIGHLIGHT;
  // wipeColor is an alias for highlightColor when highlightColor absent;
  // when both set, highlightColor wins per D-T322-8.
  const wipeColor = props.highlightColor ?? props.wipeColor ?? DEFAULT_HIGHLIGHT;
  const muteColor = props.muteColor ?? foreground;
  const muteOpacity = props.muteOpacity ?? DEFAULT_MUTE_OPACITY;
  const background = props.background ?? DEFAULT_BACKGROUND;
  const lineGap = props.lineGap ?? DEFAULT_LINE_GAP;
  const entrance = props.entrance ?? 'fade';
  const requestedMaxVisible = props.maxLinesVisible ?? 3;
  const maxLinesVisible = props.style === 'highlight-current' ? 1 : requestedMaxVisible;
  const isKaraoke = props.style === 'karaoke-wipe';

  const resolvedLines: ResolvedLine[] = props.lines.map((l) => ({
    raw: l.text,
    text: applyCasing(l.text, casing),
    startMs: l.startMs,
    endMs: l.endMs,
  }));

  // Find active line index. Take the LAST line whose [startMs, endMs)
  // brackets the current time — ms windows must not overlap, but if
  // they share boundaries, the latest match wins (deterministic).
  let activeIndex = -1;
  for (let i = 0; i < resolvedLines.length; i += 1) {
    const line = resolvedLines[i];
    if (line === undefined) continue;
    if (currentTimeMs >= line.startMs && currentTimeMs < line.endMs) {
      activeIndex = i;
    }
  }

  // Visible window centered on activeIndex.
  // half = (maxLinesVisible - 1) / 2 → 0 / 1 / 2 for 1 / 3 / 5.
  const half = (maxLinesVisible - 1) / 2;

  // Build the visible-line set: each entry is { index, role, slot }
  // where slot is the relative offset (-half..+half) from the active.
  interface VisibleEntry {
    index: number;
    role: 'past' | 'active' | 'next';
    slot: number;
  }
  const visibleEntries: VisibleEntry[] = [];

  if (activeIndex < 0) {
    // No active line — render nothing visible (every line is either
    // before its window or past it). Past lines are not retained as
    // last-active by design.
  } else {
    for (let slot = -half; slot <= half; slot += 1) {
      const idx = activeIndex + slot;
      if (idx < 0 || idx >= resolvedLines.length) continue;
      const role: 'past' | 'active' | 'next' = slot < 0 ? 'past' : slot > 0 ? 'next' : 'active';
      visibleEntries.push({ index: idx, role, slot });
    }
  }

  const containerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    position: 'relative',
    boxSizing: 'border-box',
  };

  const innerStyle: CSSProperties = {
    position: 'absolute',
    left: props.position.x,
    top: props.position.y,
    width: props.position.width,
    boxSizing: 'border-box',
  };

  // For 'highlight-current' style, override background to render full-screen.
  const isHighlightCurrent = props.style === 'highlight-current';
  if (isHighlightCurrent) {
    containerStyle.backgroundColor = background;
  }

  return (
    <div data-testid="lyrics-clip" style={containerStyle}>
      <div data-testid="lyrics-inner" style={innerStyle}>
        {visibleEntries.map((entry) => {
          const line = resolvedLines[entry.index];
          if (line === undefined) return null;
          const entranceState = computeLineEntrance(entrance, frame, line.startMs, fps);
          const karaokeProgress =
            isKaraoke && entry.role === 'active'
              ? clamp01((currentTimeMs - line.startMs) / (line.endMs - line.startMs))
              : 0;
          const yOffset = entry.slot * lineGap;
          return (
            <LineNode
              // biome-ignore lint/suspicious/noArrayIndexKey: positional line slot — slot index is the same line across renders.
              key={entry.index}
              line={line}
              index={entry.index}
              role={entry.role}
              font={font}
              foreground={foreground}
              highlightColor={highlightColor}
              wipeColor={wipeColor}
              muteColor={muteColor}
              muteOpacity={muteOpacity}
              alignment={props.position.alignment}
              width={props.position.width}
              isKaraoke={isKaraoke}
              karaokeProgress={karaokeProgress}
              entranceState={entranceState}
              glow={props.glow}
              yOffset={yOffset}
            />
          );
        })}
      </div>
    </div>
  );
}

export const lyricsClip: ClipDefinition<unknown> = defineFrameClip<LyricsProps>({
  kind: 'lyrics',
  component: Lyrics,
  propsSchema: lyricsPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    foreground: { kind: 'palette', role: 'foreground' },
  },
});
