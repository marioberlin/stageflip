// packages/runtimes/frame-runtime-bridge/src/clips/caption.tsx
// T-316 — `caption` runtime-clip primitive: word-level timed caption
// with six built-in visual styles (`hormozi`, `mrbeast`, `tiktok`,
// `ali-abdaal`, `netflix`, `karaoke-wipe`). Frame-deterministic word
// visibility (`(currentTimeMs ∈ [word.startMs, word.endMs))`),
// per-word entrance stagger (rise/bounce/slide), SVG-stroke text
// rendering (paint-order: stroke fill), per-word pill / single rect
// backdrops, karaoke-wipe per-word `<clipPath>` fill driven by
// within-word ms-progress, and casing transforms. Generic primitive
// across Cluster F captions (T-362..T-367) and Cluster A/B/G word-
// emphasis use cases. Cluster-specific palettes + canned `words[]`
// live in `parity-cli` resolver shims, not in this primitive.

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const hex = () => z.string().regex(HEX_COLOR_RE);

const wordTimingSchema = z
  .object({
    text: z.string().min(1),
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
    emphasis: z.enum(['normal', 'highlight', 'mute']).optional(),
  })
  .strict();

export const captionPropsSchema = z
  .object({
    words: z.array(wordTimingSchema).min(1).max(200),
    style: z.enum(['hormozi', 'mrbeast', 'tiktok', 'ali-abdaal', 'netflix', 'karaoke-wipe']),
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
    highlightColor: z.union([hex(), z.array(hex()).min(1)]).optional(),
    muteColor: hex().optional(),
    muteOpacity: z.number().min(0).max(1).optional(),
    strokeColor: hex().optional(),
    strokeWidth: z.number().nonnegative().optional(),
    position: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        alignment: z.enum(['left', 'center', 'right']),
      })
      .strict(),
    backdrop: z.enum(['none', 'pill', 'rect']).optional(),
    backdropPadding: z
      .object({ x: z.number().nonnegative(), y: z.number().nonnegative() })
      .strict()
      .optional(),
    backdropRadius: z.number().nonnegative().optional(),
    backdropOpacity: z.number().min(0).max(1).optional(),
    entrance: z.enum(['none', 'bounce', 'rise', 'slide-from-top', 'slide-from-bottom']).optional(),
    staggerMs: z.number().nonnegative().optional(),
  })
  .strict();

export type CaptionProps = z.infer<typeof captionPropsSchema>;

type StyleName = CaptionProps['style'];
type CasingMode = NonNullable<CaptionProps['casing']>;
type EntranceMode = NonNullable<CaptionProps['entrance']>;
type BackdropMode = NonNullable<CaptionProps['backdrop']>;

interface FontSpec {
  family: string;
  weight: number;
  size: number;
  letterSpacing?: number | undefined;
}

interface StyleBundle {
  font: FontSpec;
  casing: CasingMode;
  foreground: string;
  highlightColor: string | readonly string[];
  muteColor: string;
  muteOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  background: string;
  backdrop: BackdropMode;
  backdropOpacity: number;
  entrance: EntranceMode;
  staggerMs: number;
}

const SYSTEM_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const ENTRANCE_FRAMES = 12;
const BOUNCE_OVERSHOOT = 1.15;
const SLIDE_DISTANCE_PX = 40;

// D-T316-2 — six built-in default-props bundles. User overrides win
// over bundle defaults; bundle defaults win over theme slots. Each
// bundle: [font, casing, fg, highlight, muteColor, muteOpacity,
// strokeColor, strokeWidth, bg, backdrop, backdropOpacity, entrance,
// staggerMs]. The order matches the StyleBundle interface above.
const HORMOZI_FONT: FontSpec = {
  family: `Montserrat, ${SYSTEM_FONT_STACK}`,
  weight: 800,
  size: 96,
};
const MRBEAST_FONT: FontSpec = {
  family: `Komika Axis, ${SYSTEM_FONT_STACK}`,
  weight: 400,
  size: 108,
};
const TIKTOK_FONT: FontSpec = { family: SYSTEM_FONT_STACK, weight: 700, size: 72 };
const ALI_FONT: FontSpec = { family: `Inter, ${SYSTEM_FONT_STACK}`, weight: 600, size: 64 };
const NETFLIX_FONT: FontSpec = {
  family: `Netflix Sans, Inter, ${SYSTEM_FONT_STACK}`,
  weight: 500,
  size: 56,
};
const KARAOKE_FONT: FontSpec = { family: `Inter, ${SYSTEM_FONT_STACK}`, weight: 700, size: 80 };

const STYLE_BUNDLES: Record<StyleName, StyleBundle> = {
  hormozi: {
    font: HORMOZI_FONT,
    casing: 'uppercase',
    foreground: '#FFFFFF',
    highlightColor: '#FFD60A',
    muteColor: '#FFFFFF',
    muteOpacity: 1,
    strokeColor: '#000000',
    strokeWidth: 6,
    background: '#000000',
    backdrop: 'none',
    backdropOpacity: 0,
    entrance: 'rise',
    staggerMs: 80,
  },
  mrbeast: {
    font: MRBEAST_FONT,
    casing: 'uppercase',
    foreground: '#FFFFFF',
    highlightColor: ['#FF3B30', '#FFD60A', '#34C759'],
    muteColor: '#FFFFFF',
    muteOpacity: 1,
    strokeColor: '#000000',
    strokeWidth: 5,
    background: '#000000',
    backdrop: 'none',
    backdropOpacity: 0,
    entrance: 'bounce',
    staggerMs: 80,
  },
  tiktok: {
    font: TIKTOK_FONT,
    casing: 'as-is',
    foreground: '#FFFFFF',
    highlightColor: '#FFFFFF',
    muteColor: '#FFFFFF',
    muteOpacity: 1,
    strokeColor: '#000000',
    strokeWidth: 0,
    background: '#000000',
    backdrop: 'pill',
    backdropOpacity: 0.9,
    entrance: 'slide-from-bottom',
    staggerMs: 80,
  },
  'ali-abdaal': {
    font: ALI_FONT,
    casing: 'as-is',
    foreground: '#1F1F1F',
    highlightColor: '#1F1F1F',
    muteColor: '#1F1F1F',
    muteOpacity: 0.6,
    strokeColor: '#000000',
    strokeWidth: 0,
    background: '#FFFFFF',
    backdrop: 'none',
    backdropOpacity: 0,
    entrance: 'none',
    staggerMs: 0,
  },
  netflix: {
    font: NETFLIX_FONT,
    casing: 'as-is',
    foreground: '#FFFFFF',
    highlightColor: '#FFFFFF',
    muteColor: '#FFFFFF',
    muteOpacity: 0,
    strokeColor: '#000000',
    strokeWidth: 1,
    background: '#000000',
    backdrop: 'rect',
    backdropOpacity: 0.7,
    entrance: 'none',
    staggerMs: 0,
  },
  'karaoke-wipe': {
    font: KARAOKE_FONT,
    casing: 'as-is',
    foreground: '#FFFFFF',
    highlightColor: '#FFD60A',
    muteColor: '#FFFFFF',
    muteOpacity: 1,
    strokeColor: '#000000',
    strokeWidth: 0,
    background: '#000000',
    backdrop: 'none',
    backdropOpacity: 0,
    entrance: 'none',
    staggerMs: 0,
  },
};

function applyCasing(text: string, casing: CasingMode): string {
  if (casing === 'uppercase') return text.toUpperCase();
  if (casing === 'lowercase') return text.toLowerCase();
  if (casing === 'title-case') return text.replace(/\b\w/g, (c) => c.toUpperCase());
  return text;
}

function alignmentToJustify(
  alignment: 'left' | 'center' | 'right',
): CSSProperties['justifyContent'] {
  if (alignment === 'left') return 'flex-start';
  if (alignment === 'right') return 'flex-end';
  return 'center';
}

function pickHighlightColor(
  highlightColor: string | readonly string[],
  highlightedIndex: number,
): string {
  if (typeof highlightColor === 'string') return highlightColor;
  const len = highlightColor.length;
  // len ≥ 1 enforced by schema (`array(hex()).min(1)`).
  return highlightColor[highlightedIndex % len] ?? highlightColor[0] ?? '#FFFFFF';
}

interface EntranceState {
  opacity: number;
  translateY: number;
  scale: number;
}

function computeEntrance(
  entrance: EntranceMode,
  frame: number,
  wordStartMs: number,
  wordIndex: number,
  staggerMs: number,
  fps: number,
): EntranceState {
  if (entrance === 'none') {
    return { opacity: 1, translateY: 0, scale: 1 };
  }
  // Entrance window starts `staggerMs * i` ms BEFORE the word's startMs
  // (so by the time the word is "active", entrance has settled).
  const entranceStartFrame = (wordStartMs / 1000 - (wordIndex * staggerMs) / 1000) * fps;
  const opacity = interpolate(
    frame,
    [entranceStartFrame, entranceStartFrame + ENTRANCE_FRAMES],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  let translateY = 0;
  let scale = 1;
  switch (entrance) {
    case 'rise':
    case 'slide-from-bottom':
      translateY = interpolate(
        frame,
        [entranceStartFrame, entranceStartFrame + ENTRANCE_FRAMES],
        [SLIDE_DISTANCE_PX, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );
      break;
    case 'slide-from-top':
      translateY = interpolate(
        frame,
        [entranceStartFrame, entranceStartFrame + ENTRANCE_FRAMES],
        [-SLIDE_DISTANCE_PX, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );
      break;
    case 'bounce': {
      // Two-phase: 0..0.6 ramp to overshoot, 0.6..1 settle to 1.0.
      const t = interpolate(
        frame,
        [entranceStartFrame, entranceStartFrame + ENTRANCE_FRAMES],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );
      scale =
        t < 0.6
          ? interpolate(t, [0, 0.6], [0, BOUNCE_OVERSHOOT], { extrapolateRight: 'clamp' })
          : interpolate(t, [0.6, 1], [BOUNCE_OVERSHOOT, 1], { extrapolateRight: 'clamp' });
      break;
    }
  }
  return { opacity, translateY, scale };
}

interface ResolvedWord {
  raw: string;
  text: string;
  startMs: number;
  endMs: number;
  emphasis: 'normal' | 'highlight' | 'mute';
  // The 0-based count of `emphasis === 'highlight'` words at or before
  // this word; used for highlightColor[] cycling.
  highlightedIndex: number;
}

function resolveColor(
  word: ResolvedWord,
  isActive: boolean,
  resolved: {
    foreground: string;
    highlightColor: string | readonly string[];
    muteColor: string;
    muteOpacity: number;
  },
): { color: string; opacity: number } {
  // T-316a — two activation paths for `muteOpacity`:
  //   (a) explicit per-word `emphasis: 'mute'` → full mute color + opacity
  //       (color shift + dim).
  //   (b) bundle-level `muteOpacity < 1` (e.g. ali-abdaal opacity-karaoke) →
  //       past/future visible non-tagged words dimmed via opacity only,
  //       foreground fill preserved. The active word always wins; the
  //       active branch sits above this one and never picks up dim.
  if (word.emphasis === 'mute') {
    return { color: resolved.muteColor, opacity: resolved.muteOpacity };
  }
  if (word.emphasis === 'highlight' || isActive) {
    return {
      color: pickHighlightColor(resolved.highlightColor, word.highlightedIndex),
      opacity: 1,
    };
  }
  if (resolved.muteOpacity < 1) {
    return { color: resolved.foreground, opacity: resolved.muteOpacity };
  }
  return { color: resolved.foreground, opacity: 1 };
}

interface ResolvedColors {
  foreground: string;
  highlightColor: string | readonly string[];
  muteColor: string;
  muteOpacity: number;
}

interface WordRenderProps {
  word: ResolvedWord;
  index: number;
  isActive: boolean;
  resolved: ResolvedColors;
  font: FontSpec;
  strokeColor: string;
  strokeWidth: number;
  entranceState: EntranceState;
  isKaraoke: boolean;
  karaokeProgress: number;
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

function WordSpan({
  word,
  index,
  isActive,
  resolved,
  font,
  strokeColor,
  strokeWidth,
  entranceState,
  isKaraoke,
  karaokeProgress,
}: WordRenderProps): ReactElement {
  const { color, opacity: emphasisOpacity } = resolveColor(word, isActive, resolved);
  const transform = `translateY(${entranceState.translateY}px) scale(${entranceState.scale})`;
  const baseStyle: CSSProperties = {
    fontFamily: font.family,
    fontWeight: font.weight,
    fontSize: font.size,
    letterSpacing: font.letterSpacing,
    lineHeight: 1.1,
    opacity: entranceState.opacity * emphasisOpacity,
    transform,
    transformOrigin: 'center',
    display: 'inline-block',
    whiteSpace: 'pre',
    color,
  };

  if (isKaraoke) {
    // Two-layer SVG: base text in foreground color, fill text in
    // highlightColor clipped via <clipPath rect width=progress%>.
    const fillColor = pickHighlightColor(resolved.highlightColor, word.highlightedIndex);
    // Approximate text bounds; SVG sizes itself via viewBox-less
    // intrinsic em sizing. We use a relative SVG (display:inline-block)
    // with an em-sized viewBox so the overlay aligns with the base.
    const clipId = `caption-clip-${index}`;
    return (
      <span data-testid={`caption-word-${index}`} style={{ ...baseStyle, position: 'relative' }}>
        <span style={{ color: resolved.foreground }}>{word.text}</span>
        <svg aria-hidden style={KARAOKE_SVG_STYLE}>
          <title>{`karaoke fill ${index}`}</title>
          <defs>
            <clipPath id={clipId}>
              <rect
                data-testid={`caption-karaoke-fill-${index}`}
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
              }}
            >
              {word.text}
            </span>
          </foreignObject>
        </svg>
      </span>
    );
  }

  if (strokeWidth > 0) {
    // SVG <text> with stroke + paint-order (D-T316-7). Use a relative
    // SVG sized via em so it composes with the surrounding flex row.
    return (
      <svg
        data-testid={`caption-word-${index}`}
        aria-hidden
        style={{
          ...baseStyle,
          overflow: 'visible',
          height: `${font.size * 1.2}px`,
          width: 'auto',
        }}
        viewBox={`0 0 ${word.text.length * font.size * 0.7} ${font.size * 1.2}`}
        preserveAspectRatio="xMinYMid meet"
      >
        <title>{word.text}</title>
        <text
          x="0"
          y={font.size}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          paintOrder="stroke fill"
          fill={color}
          fontFamily={font.family}
          fontWeight={font.weight}
          fontSize={font.size}
          opacity={emphasisOpacity}
        >
          {word.text}
        </text>
      </svg>
    );
  }

  return (
    <span data-testid={`caption-word-${index}`} style={baseStyle}>
      {word.text}
    </span>
  );
}

/**
 * Renders a word-level timed caption with one of six visual styles.
 * Frame-derived word visibility (`(currentTimeMs ∈ [word.startMs,
 * word.endMs))`); per-word entrance stagger anchored on each word's
 * `startMs` minus `i * staggerMs`; karaoke-wipe style fills each word
 * left-to-right via SVG `<clipPath>` driven by within-word progress;
 * heavy strokes render as SVG `<text>` with `paint-order: stroke
 * fill`. Style enum picks a built-in default-props bundle; user
 * overrides win on individual props.
 */
export function Caption(props: CaptionProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  const bundle = STYLE_BUNDLES[props.style];
  const casing = props.casing ?? bundle.casing;
  const font = props.font ?? bundle.font;
  const foreground = props.foreground ?? bundle.foreground;
  const highlightColor = props.highlightColor ?? bundle.highlightColor;
  const muteColor = props.muteColor ?? bundle.muteColor;
  const muteOpacity = props.muteOpacity ?? bundle.muteOpacity;
  const strokeColor = props.strokeColor ?? bundle.strokeColor;
  const strokeWidth = props.strokeWidth ?? bundle.strokeWidth;
  const background = props.background ?? bundle.background;
  const backdrop = props.backdrop ?? bundle.backdrop;
  const backdropOpacity = props.backdropOpacity ?? bundle.backdropOpacity;
  const backdropPadding = props.backdropPadding ?? { x: 12, y: 6 };
  const backdropRadius = props.backdropRadius;
  const entrance = props.entrance ?? bundle.entrance;
  const staggerMs = props.staggerMs ?? bundle.staggerMs;
  const isKaraoke = props.style === 'karaoke-wipe';

  // Pre-compute resolved words: cased text + highlightedIndex (rolling
  // count of `emphasis === 'highlight'` words for cycling color).
  let highlightedSeen = 0;
  const resolvedWords: ResolvedWord[] = props.words.map((w) => {
    const emphasis = w.emphasis ?? 'normal';
    const highlightedIndex = highlightedSeen;
    if (emphasis === 'highlight') highlightedSeen += 1;
    return {
      raw: w.text,
      text: applyCasing(w.text, casing),
      startMs: w.startMs,
      endMs: w.endMs,
      emphasis,
      highlightedIndex,
    };
  });

  const resolvedColors: ResolvedColors = {
    foreground,
    highlightColor,
    muteColor,
    muteOpacity,
  };

  const wordIsVisible = (word: ResolvedWord): boolean => {
    // Past words remain visible by default; future words gated by entrance.
    if (currentTimeMs >= word.startMs) return true;
    return entrance !== 'none';
  };

  const wordIsActive = (word: ResolvedWord): boolean =>
    currentTimeMs >= word.startMs && currentTimeMs < word.endMs;

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
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '0.4em',
    justifyContent: alignmentToJustify(props.position.alignment),
    alignItems: 'baseline',
    boxSizing: 'border-box',
  };

  // Backdrop measurement: in test/render context we don't measure
  // glyphs; we approximate per-word width from text length + font.size
  // for the SVG <rect> backing. The caption author tunes via
  // `backdropPadding` if rounding visibly drifts.
  const approxWordWidth = (text: string): number => text.length * font.size * 0.55;
  const wordHeight = font.size * 1.2;
  const totalWidth = resolvedWords.reduce(
    (acc, w, i) => acc + approxWordWidth(w.text) + (i > 0 ? font.size * 0.4 : 0),
    0,
  );
  const pillRadius = backdropRadius ?? wordHeight / 2 + backdropPadding.y;
  const rectRadius = backdropRadius ?? 8;

  // T-316b — Multi-line aware rect backdrop sizing. When the caption block's
  // approximate `totalWidth` exceeds the container `position.width`, content
  // flex-wraps to 2+ lines; the rect must extend to cover the wrapped lines or
  // the active word renders below the rect (regression caught during product-
  // owner ratification of `netflix-invisible` 2026-05-06; see
  // docs/handover-phase13-late.md §7).
  const containerWidth = props.position.width;
  const lineCount = Math.max(1, Math.ceil(totalWidth / containerWidth));
  const rectWidth =
    lineCount > 1 ? containerWidth + backdropPadding.x * 2 : totalWidth + backdropPadding.x * 2;
  const rectHeight = lineCount * wordHeight + backdropPadding.y * 2;

  return (
    <div data-testid="caption-clip" style={containerStyle}>
      {/* Backdrop layer (rect only — pill backdrops are inlined per
          word via per-word <svg> overlays). The rect backdrop sits
          behind the caption's bounding box. T-316b: rect spans the
          actual rendered content bounding box, including wrapped lines. */}
      {backdrop === 'rect' ? (
        <svg
          aria-hidden
          style={{
            position: 'absolute',
            left: props.position.x - backdropPadding.x,
            top: props.position.y - backdropPadding.y,
            width: rectWidth,
            height: rectHeight,
            pointerEvents: 'none',
          }}
        >
          <title>caption backdrop</title>
          <rect
            data-testid="caption-backdrop"
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx={rectRadius}
            ry={rectRadius}
            fill={background}
            fillOpacity={backdropOpacity}
          />
        </svg>
      ) : null}

      <div data-testid="caption-inner" style={innerStyle}>
        {resolvedWords.map((word, i) => {
          if (!wordIsVisible(word)) return null;
          const isActive = wordIsActive(word);
          const entranceState = computeEntrance(entrance, frame, word.startMs, i, staggerMs, fps);
          const karaokeProgress = isKaraoke
            ? Math.max(0, Math.min(1, (currentTimeMs - word.startMs) / (word.endMs - word.startMs)))
            : 0;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: positional word slot — slot i is the same word across renders.
              key={i}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'baseline',
                paddingLeft: backdrop === 'pill' ? backdropPadding.x : 0,
                paddingRight: backdrop === 'pill' ? backdropPadding.x : 0,
              }}
            >
              {backdrop === 'pill' ? (
                <svg
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: -backdropPadding.y,
                    width: '100%',
                    height: wordHeight + backdropPadding.y * 2,
                    pointerEvents: 'none',
                    zIndex: -1,
                  }}
                >
                  <title>{`caption pill ${i}`}</title>
                  <rect
                    data-testid={`caption-backdrop-${i}`}
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    rx={pillRadius}
                    ry={pillRadius}
                    fill={background}
                    fillOpacity={backdropOpacity}
                  />
                </svg>
              ) : null}
              <WordSpan
                word={word}
                index={i}
                isActive={isActive}
                resolved={resolvedColors}
                font={font}
                strokeColor={strokeColor}
                strokeWidth={strokeWidth}
                entranceState={entranceState}
                isKaraoke={isKaraoke}
                karaokeProgress={karaokeProgress}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const captionClip: ClipDefinition<unknown> = defineFrameClip<CaptionProps>({
  kind: 'caption',
  component: Caption,
  propsSchema: captionPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    foreground: { kind: 'palette', role: 'foreground' },
    highlightColor: { kind: 'palette', role: 'accent' },
    muteColor: { kind: 'palette', role: 'foreground' },
    strokeColor: { kind: 'palette', role: 'background' },
  },
});
