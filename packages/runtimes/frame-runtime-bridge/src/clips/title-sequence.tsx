// packages/runtimes/frame-runtime-bridge/src/clips/title-sequence.tsx
// T-321 — `titleSequence` runtime-clip primitive: multi-shot prestige-TV
// title compositor with four sealed style bundles (`'letterform-assemble'`
// — ALL-CAPS letterforms scaled-to-viewport with per-letter staggered
// entry; `'plate-and-credits'` — title plate + credits block two-card
// register; `'palette-jump-cut'` — hard-cut color panels with optional
// glyph foreground (cut-only enforced regardless of shot transition);
// `'photographic-overlay'` — typography-only pass over a sister
// photographic clip). Five shot kinds (`titlePlate` / `letterAnimation` /
// `creditsBlock` / `colorPanel` / `holdFrame`) dispatched per active
// timeline window. Three transition kinds (`'cut'` / `'fade'` /
// `'dissolve'`) with single-active + 1-shot overlap during fade /
// dissolve; cut-only enforced under `'palette-jump-cut'`. Frame-
// deterministic shot dispatch (active = unique shot whose `[startMs,
// endMs)` brackets the current ms-time); per-letter stable IDs
// (`title-sequence-shot-${shot.id}-letter-${i}`); per-shot stable
// clipPath / filter IDs derived from `shot.id`. Per-shot entrance
// (`'none'` / `'fade'` default / `'rise'`, 12-frame settle); per-letter
// entrance window (default 400 ms with default stagger 200 ms); optional
// `glow?` halo on the active shot via SVG Gaussian-blur filter; casing
// transforms (`as-is` / `uppercase` / `lowercase` / `title-case`) at
// render time (no CSS `text-transform`); theme-slot fallback (background
// → palette.background, foreground → palette.foreground). Generic
// primitive across Cluster D prestige-TV title presets (T-348 stranger-
// things-benguiat, T-349 got-trajan-clockwork, T-350 squid-game-
// geometric, T-351 true-detective-double-exposure, T-352 succession-
// home-video, T-353 severance-surreal-3d). Cluster-specific palettes,
// fonts, shot timings live in `parity-cli` resolver shims.

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const hex = () => z.string().regex(HEX_COLOR_RE);

const transitionKindSchema = z.enum(['cut', 'fade', 'dissolve']);

const baseShotShape = {
  id: z.string().min(1),
  startMs: z.number().nonnegative(),
  endMs: z.number().positive(),
  transitionIn: transitionKindSchema.optional(),
  transitionOut: transitionKindSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
};

const titlePlateContent = z.object({ text: z.string().min(1) }).strict();

const letterAnimationContent = z
  .object({
    text: z.string().min(1).max(36),
    staggerMs: z.number().nonnegative().optional(),
  })
  .strict();

const creditsBlockContent = z.object({ lines: z.array(z.string().min(1)).min(1).max(12) }).strict();

const colorPanelContent = z
  .object({
    color: hex(),
    glyph: z.string().min(1).max(3).optional(),
  })
  .strict();

const holdFrameContent = z.object({ text: z.string().optional() }).strict();

// Each variant of the discriminated union is a strict object on the
// discriminator + base fields + per-variant `content`. The `startMs <
// endMs` invariant is enforced via top-level superRefine on the array
// — `discriminatedUnion` requires each variant to be a `ZodObject`, so
// per-variant `.refine()` is not allowed here.
const shotSchema = z.discriminatedUnion('kind', [
  z
    .object({ ...baseShotShape, kind: z.literal('titlePlate'), content: titlePlateContent })
    .strict(),
  z
    .object({
      ...baseShotShape,
      kind: z.literal('letterAnimation'),
      content: letterAnimationContent,
    })
    .strict(),
  z
    .object({ ...baseShotShape, kind: z.literal('creditsBlock'), content: creditsBlockContent })
    .strict(),
  z
    .object({ ...baseShotShape, kind: z.literal('colorPanel'), content: colorPanelContent })
    .strict(),
  z.object({ ...baseShotShape, kind: z.literal('holdFrame'), content: holdFrameContent }).strict(),
]);

export const titleSequencePropsSchema = z
  .object({
    shots: z.array(shotSchema).min(1).max(16),
    style: z.enum([
      'letterform-assemble',
      'plate-and-credits',
      'palette-jump-cut',
      'photographic-overlay',
    ]),
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
    position: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        alignment: z.enum(['left', 'center', 'right']),
      })
      .strict(),
    entrance: z.enum(['none', 'fade', 'rise']).optional(),
    glow: z
      .object({
        color: hex(),
        blur: z.number().positive(),
      })
      .strict()
      .optional(),
    letterformScale: z.number().min(0.1).max(1.0).optional(),
    transitionDurationMs: z.number().nonnegative().optional(),
    musicCue: z
      .object({
        startMs: z.number().nonnegative(),
        bpm: z.number().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // Per-shot positive-duration invariant (D-T321-4).
    for (let i = 0; i < value.shots.length; i += 1) {
      const s = value.shots[i];
      if (s === undefined) continue;
      if (s.startMs >= s.endMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startMs must be less than endMs',
          path: ['shots', i, 'endMs'],
        });
      }
    }
  });

export type TitleSequenceProps = z.infer<typeof titleSequencePropsSchema>;
export type Shot = TitleSequenceProps['shots'][number];
export type TransitionKind = z.infer<typeof transitionKindSchema>;

type CasingMode = NonNullable<TitleSequenceProps['casing']>;
type EntranceMode = NonNullable<TitleSequenceProps['entrance']>;

const SYSTEM_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DEFAULT_FONT = {
  family: `Inter Display, Anton, ${SYSTEM_FONT_STACK}`,
  weight: 700,
  size: 96,
} as const;
const DEFAULT_FOREGROUND = '#FFFFFF';
const DEFAULT_HIGHLIGHT = '#FF0000';
// T-348a: no `DEFAULT_BACKGROUND` constant — when the caller omits
// `props.background`, the container renders WITHOUT an opaque
// `backgroundColor` so layers below in the z-stack composite through.
// Callers that want a deep-canvas backdrop pass `background:'#000000'`
// explicitly (the 5 Cluster D multi-clip preset bindings do exactly
// this; squid-game-geometric passes `'#0E0E12'`). The
// `palette-jump-cut` style keeps its colorPanel-driven backgroundColor
// override (line 718-731) — that's the style's defining behaviour, not
// a default-fallback.
const DEFAULT_LETTERFORM_SCALE = 0.7;
const DEFAULT_TRANSITION_DURATION_MS = 300;
const DEFAULT_STAGGER_MS = 200;
const LETTER_FADE_DURATION_MS = 400;
const ENTRANCE_FRAMES = 12;
const RISE_DISTANCE_PX = 12;
const DISSOLVE_JITTER_PX = 2;

function applyCasing(text: string, casing: CasingMode): string {
  if (casing === 'uppercase') return text.toUpperCase();
  if (casing === 'lowercase') return text.toLowerCase();
  if (casing === 'title-case') return text.replace(/\b\w/g, (c) => c.toUpperCase());
  return text;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

interface EntranceState {
  opacity: number;
  translateY: number;
}

function computeShotEntrance(
  entrance: EntranceMode,
  frame: number,
  shotStartMs: number,
  fps: number,
): EntranceState {
  if (entrance === 'none') {
    return { opacity: 1, translateY: 0 };
  }
  const entranceStartFrame = (shotStartMs / 1000) * fps;
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

interface TimelineState {
  /** Index of the active shot (or -1 when no shot brackets the time). */
  activeIndex: number;
  /** Optional incoming-shot index when overlapping during fade / dissolve. */
  incomingIndex: number;
  /** 0..1 — outgoing-shot opacity during the overlap window (1 outside). */
  outgoingOpacity: number;
  /** 0..1 — incoming-shot opacity during the overlap window. */
  incomingOpacity: number;
  /** Effective transition kind after style override (palette-jump-cut → 'cut'). */
  effectiveTransition: TransitionKind;
}

function computeTimelineState(
  shots: readonly Shot[],
  currentTimeMs: number,
  transitionDurationMs: number,
  styleForcesCut: boolean,
): TimelineState {
  let activeIndex = -1;
  for (let i = 0; i < shots.length; i += 1) {
    const s = shots[i];
    if (s === undefined) continue;
    if (currentTimeMs >= s.startMs && currentTimeMs < s.endMs) {
      activeIndex = i;
    }
  }

  const empty: TimelineState = {
    activeIndex,
    incomingIndex: -1,
    outgoingOpacity: 1,
    incomingOpacity: 0,
    effectiveTransition: 'cut',
  };

  if (activeIndex < 0) return empty;

  const active = shots[activeIndex];
  if (active === undefined) return empty;

  const declaredOut: TransitionKind = active.transitionOut ?? 'cut';
  const effective: TransitionKind = styleForcesCut ? 'cut' : declaredOut;

  // Cut → no overlap.
  if (effective === 'cut') {
    return { ...empty, effectiveTransition: 'cut' };
  }

  // Within the last `transitionDurationMs` of the active window?
  const overlapStart = active.endMs - transitionDurationMs;
  if (currentTimeMs < overlapStart) {
    return { ...empty, effectiveTransition: effective };
  }
  const next = shots[activeIndex + 1];
  if (next === undefined) {
    return { ...empty, effectiveTransition: effective };
  }

  // Linear opacity interpolation across the overlap window.
  const remaining = active.endMs - currentTimeMs; // (0, transitionDurationMs]
  const outgoingOpacity = clamp01(remaining / transitionDurationMs);
  const incomingOpacity = clamp01(1 - outgoingOpacity);

  if (effective === 'dissolve') {
    return {
      activeIndex,
      incomingIndex: activeIndex + 1,
      outgoingOpacity: 0.5,
      incomingOpacity: 0.5,
      effectiveTransition: 'dissolve',
    };
  }

  // Fade — symmetric crossfade.
  return {
    activeIndex,
    incomingIndex: activeIndex + 1,
    outgoingOpacity,
    incomingOpacity,
    effectiveTransition: 'fade',
  };
}

interface ShotRenderInput {
  shot: Shot;
  index: number;
  shotRole: 'outgoing' | 'incoming';
  style: TitleSequenceProps['style'];
  font: { family: string; weight: number; size: number; letterSpacing?: number | undefined };
  casing: CasingMode;
  foreground: string;
  highlightColor: string;
  background: string | undefined;
  position: TitleSequenceProps['position'];
  entrance: EntranceMode;
  letterformScale: number;
  glow: TitleSequenceProps['glow'];
  frame: number;
  fps: number;
  currentTimeMs: number;
  transitionOpacity: number;
  jitterPx: number;
  viewportHeight: number;
}

function GlowFilter({
  filterId,
  glow,
}: {
  filterId: string;
  glow: { color: string; blur: number };
}): ReactElement {
  return (
    <svg
      aria-hidden
      style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none' }}
    >
      <title>title sequence glow</title>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation={glow.blur} result="blur" />
          <feFlood floodColor={glow.color} result="flood" />
          <feComposite in="flood" in2="blur" operator="in" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

function renderTitlePlate(input: ShotRenderInput): ReactElement {
  const { shot, font, casing, foreground, highlightColor, position, glow } = input;
  // Extract text by shot kind — titlePlate and letterAnimation both carry
  // `text`; other kinds fall back to empty string (only the bundles where
  // titlePlate is the renderer-of-record dispatch here).
  let text = '';
  if (shot.kind === 'titlePlate') {
    text = applyCasing(shot.content.text, casing);
  } else if (shot.kind === 'letterAnimation') {
    text = applyCasing(shot.content.text, casing);
  } else if (shot.kind === 'holdFrame' && shot.content.text !== undefined) {
    text = applyCasing(shot.content.text, casing);
  }
  const filterId = `title-sequence-glow-${shot.id}`;
  const showGlow = glow !== undefined;
  // Title plate uses highlightColor (e.g. neon red) when defined; otherwise
  // foreground.
  const color = highlightColor !== DEFAULT_HIGHLIGHT ? highlightColor : foreground;
  return (
    <>
      {showGlow ? <GlowFilter filterId={filterId} glow={glow} /> : null}
      <div
        style={{
          fontFamily: font.family,
          fontWeight: font.weight,
          fontSize: font.size * 2,
          letterSpacing: font.letterSpacing,
          color,
          textAlign: position.alignment,
          width: position.width,
          filter: showGlow ? `url(#${filterId})` : undefined,
        }}
      >
        {text}
      </div>
    </>
  );
}

function renderLetterAnimation(input: ShotRenderInput): ReactElement {
  const {
    shot,
    index,
    style,
    font,
    casing,
    foreground,
    highlightColor,
    position,
    letterformScale,
    glow,
    currentTimeMs,
    viewportHeight,
  } = input;
  if (shot.kind !== 'letterAnimation') {
    // Fallback: render as a plain plate (per AC #6 fallback for non-letterform bundles).
    return renderTitlePlate(input);
  }
  const text = applyCasing(shot.content.text, casing);
  const staggerMs = shot.content.staggerMs ?? DEFAULT_STAGGER_MS;
  const isLetterform = style === 'letterform-assemble';
  const letterFontSize = isLetterform ? viewportHeight * letterformScale : font.size;
  const filterId = `title-sequence-glow-${shot.id}`;
  const showGlow = glow !== undefined;
  const letters = Array.from(text);
  // Per-letter color: in letterform-assemble bundle the active letter
  // wears highlightColor (e.g. neon red); other bundles render letters
  // in foreground.
  const letterColor = isLetterform
    ? highlightColor !== DEFAULT_HIGHLIGHT
      ? highlightColor
      : foreground
    : foreground;
  return (
    <>
      {showGlow ? <GlowFilter filterId={filterId} glow={glow} /> : null}
      <div
        style={{
          width: position.width,
          textAlign: position.alignment,
          filter: showGlow ? `url(#${filterId})` : undefined,
        }}
      >
        {letters.map((ch, i) => {
          const letterStartMs = shot.startMs + i * staggerMs;
          const letterProgress = clamp01((currentTimeMs - letterStartMs) / LETTER_FADE_DURATION_MS);
          const letterStyle: CSSProperties = {
            display: 'inline-block',
            fontFamily: font.family,
            fontWeight: font.weight,
            fontSize: letterFontSize,
            letterSpacing: font.letterSpacing,
            color: letterColor,
            opacity: letterProgress,
          };
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: letter index is the stable per-shot identity.
              key={i}
              data-testid={`title-sequence-shot-${index}-letter-${i}`}
              style={letterStyle}
            >
              {ch === ' ' ? ' ' : ch}
            </span>
          );
        })}
      </div>
    </>
  );
}

function renderCreditsBlock(input: ShotRenderInput): ReactElement {
  const { shot, font, casing, foreground, position, glow } = input;
  if (shot.kind !== 'creditsBlock') {
    return <div />;
  }
  const filterId = `title-sequence-glow-${shot.id}`;
  const showGlow = glow !== undefined;
  return (
    <>
      {showGlow ? <GlowFilter filterId={filterId} glow={glow} /> : null}
      <div
        style={{
          width: position.width,
          textAlign: position.alignment,
          fontFamily: font.family,
          fontWeight: font.weight,
          fontSize: font.size * 0.5,
          letterSpacing: font.letterSpacing,
          color: foreground,
          filter: showGlow ? `url(#${filterId})` : undefined,
          lineHeight: 1.4,
        }}
      >
        {shot.content.lines.map((raw, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional credits-line slot.
          <div key={i}>{applyCasing(raw, casing)}</div>
        ))}
      </div>
    </>
  );
}

function renderColorPanel(input: ShotRenderInput): ReactElement {
  const { shot, font, foreground, position } = input;
  if (shot.kind !== 'colorPanel') {
    return <div />;
  }
  const glyph = shot.content.glyph ?? '';
  return (
    <div
      style={{
        width: position.width,
        textAlign: position.alignment,
        fontFamily: font.family,
        fontWeight: font.weight,
        fontSize: font.size * 1.5,
        color: foreground,
      }}
    >
      {glyph}
    </div>
  );
}

function renderHoldFrame(input: ShotRenderInput): ReactElement {
  const { shot, font, casing, foreground, position } = input;
  if (shot.kind !== 'holdFrame') {
    return <div />;
  }
  const text = shot.content.text ?? '';
  return (
    <div
      style={{
        width: position.width,
        textAlign: position.alignment,
        fontFamily: font.family,
        fontWeight: font.weight,
        fontSize: font.size,
        color: foreground,
      }}
    >
      {text ? applyCasing(text, casing) : null}
    </div>
  );
}

function ShotNode(input: ShotRenderInput): ReactElement | null {
  const {
    shot,
    index,
    shotRole,
    style,
    position,
    entrance,
    frame,
    fps,
    transitionOpacity,
    jitterPx,
  } = input;

  // Per-style dispatch:
  //  - 'photographic-overlay': only typography shots render
  //  - 'palette-jump-cut': active colorPanel sets the background color; other kinds render foreground glyph
  //  - 'plate-and-credits': dispatch by shot.kind
  //  - 'letterform-assemble': letterAnimation uses per-letter; other kinds render as plain plate
  let body: ReactElement | null = null;
  if (style === 'photographic-overlay') {
    if (shot.kind === 'titlePlate') {
      body = renderTitlePlate(input);
    } else if (shot.kind === 'creditsBlock') {
      body = renderCreditsBlock(input);
    } else {
      body = null;
    }
  } else if (style === 'letterform-assemble') {
    if (shot.kind === 'letterAnimation') {
      body = renderLetterAnimation(input);
    } else if (shot.kind === 'titlePlate') {
      body = renderTitlePlate(input);
    } else if (shot.kind === 'creditsBlock') {
      body = renderCreditsBlock(input);
    } else if (shot.kind === 'colorPanel') {
      body = renderColorPanel(input);
    } else {
      body = renderHoldFrame(input);
    }
  } else if (style === 'palette-jump-cut') {
    if (shot.kind === 'colorPanel') {
      body = renderColorPanel(input);
    } else if (shot.kind === 'titlePlate') {
      body = renderTitlePlate(input);
    } else if (shot.kind === 'letterAnimation') {
      body = renderLetterAnimation(input);
    } else if (shot.kind === 'creditsBlock') {
      body = renderCreditsBlock(input);
    } else {
      body = renderHoldFrame(input);
    }
  } else {
    // 'plate-and-credits'
    if (shot.kind === 'titlePlate') {
      body = renderTitlePlate(input);
    } else if (shot.kind === 'creditsBlock') {
      body = renderCreditsBlock(input);
    } else if (shot.kind === 'letterAnimation') {
      body = renderTitlePlate(input);
    } else if (shot.kind === 'colorPanel') {
      body = renderColorPanel(input);
    } else {
      body = renderHoldFrame(input);
    }
  }

  // Per-shot entrance multiplied with timeline-transition opacity.
  // letterAnimation in 'letterform-assemble' bundle ignores per-shot entrance
  // (per-letter stagger IS the entrance for that kind).
  const ignoresEntrance = style === 'letterform-assemble' && shot.kind === 'letterAnimation';
  const entranceState: EntranceState = ignoresEntrance
    ? { opacity: 1, translateY: 0 }
    : computeShotEntrance(entrance, frame, shot.startMs, fps);

  const compoundOpacity = entranceState.opacity * transitionOpacity;
  const transformParts: string[] = [];
  if (entranceState.translateY !== 0) {
    transformParts.push(`translateY(${entranceState.translateY}px)`);
  }
  if (jitterPx !== 0) {
    transformParts.push(`translateX(${jitterPx}px)`);
  }

  // Background color: palette-jump-cut overrides via active colorPanel.
  let backgroundColor: string | undefined;
  if (style === 'palette-jump-cut' && shot.kind === 'colorPanel') {
    backgroundColor = shot.content.color;
  }

  const wrapperStyle: CSSProperties = {
    position: 'absolute',
    left: position.x - position.width / 2,
    top: position.y,
    width: position.width,
    opacity: compoundOpacity,
    pointerEvents: 'none',
    boxSizing: 'border-box',
  };
  if (transformParts.length > 0) {
    wrapperStyle.transform = transformParts.join(' ');
  }
  if (backgroundColor !== undefined) {
    wrapperStyle.backgroundColor = backgroundColor;
  }

  return (
    <div
      data-testid={`title-sequence-shot-${index}`}
      data-shot-id={shot.id}
      data-shot-role={shotRole}
      style={wrapperStyle}
    >
      {body}
    </div>
  );
}

/**
 * Renders a multi-shot prestige-TV title sequence with one of four
 * sealed style bundles. At every frame, the unique shot whose `[startMs,
 * endMs)` window contains the current ms-time is the active shot; when
 * the active shot's `transitionOut` is `'fade'` or `'dissolve'` and
 * the current ms-time is within the last `transitionDurationMs` of the
 * window, the next shot also renders simultaneously with progressive
 * opacity (single-active + 1-shot overlap). `'palette-jump-cut'`
 * enforces cut-only transitions regardless of shot-level
 * `transitionOut`. `'letterform-assemble'` scales letterforms to
 * `viewport.height * letterformScale` per letter with per-letter
 * staggered entry. Frame-deterministic; stable shot-id-derived
 * clipPath / filter / per-letter IDs (no `crypto.randomUUID()`).
 * Casing transforms applied at render time.
 */
export function TitleSequence(props: TitleSequenceProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, height: viewportHeight } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  const casing = props.casing ?? 'as-is';
  const font = props.font ?? DEFAULT_FONT;
  const foreground = props.foreground ?? DEFAULT_FOREGROUND;
  const highlightColor = props.highlightColor ?? props.foreground ?? DEFAULT_HIGHLIGHT;
  // T-348a: no DEFAULT_BACKGROUND fallback — undefined when caller omits
  // so the container is transparent and layers below composite through.
  const background = props.background;
  const entrance = props.entrance ?? 'fade';
  const letterformScale = props.letterformScale ?? DEFAULT_LETTERFORM_SCALE;
  const transitionDurationMs = props.transitionDurationMs ?? DEFAULT_TRANSITION_DURATION_MS;
  const styleForcesCut = props.style === 'palette-jump-cut';

  const timeline = computeTimelineState(
    props.shots,
    currentTimeMs,
    transitionDurationMs,
    styleForcesCut,
  );

  const containerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    ...(background !== undefined ? { backgroundColor: background } : {}),
  };

  // Determine background override for palette-jump-cut: pick the most-recent
  // colorPanel that's been active up to or at currentTimeMs (active or
  // last-finished); otherwise fall back to top-level background.
  if (props.style === 'palette-jump-cut') {
    let panelColor: string | undefined;
    for (let i = 0; i < props.shots.length; i += 1) {
      const s = props.shots[i];
      if (s === undefined) continue;
      if (s.kind === 'colorPanel' && s.startMs <= currentTimeMs) {
        panelColor = s.content.color;
      }
    }
    if (panelColor !== undefined) {
      containerStyle.backgroundColor = panelColor;
    }
  }

  const renders: ReactElement[] = [];
  if (timeline.activeIndex >= 0) {
    const active = props.shots[timeline.activeIndex];
    if (active !== undefined) {
      renders.push(
        <ShotNode
          key={`active-${timeline.activeIndex}`}
          shot={active}
          index={timeline.activeIndex}
          shotRole="outgoing"
          style={props.style}
          font={font}
          casing={casing}
          foreground={foreground}
          highlightColor={highlightColor}
          background={background}
          position={props.position}
          entrance={entrance}
          letterformScale={letterformScale}
          glow={props.glow}
          frame={frame}
          fps={fps}
          currentTimeMs={currentTimeMs}
          transitionOpacity={timeline.outgoingOpacity}
          jitterPx={timeline.effectiveTransition === 'dissolve' ? DISSOLVE_JITTER_PX : 0}
          viewportHeight={viewportHeight}
        />,
      );
    }
  }
  if (timeline.incomingIndex >= 0) {
    const incoming = props.shots[timeline.incomingIndex];
    if (incoming !== undefined) {
      renders.push(
        <ShotNode
          key={`incoming-${timeline.incomingIndex}`}
          shot={incoming}
          index={timeline.incomingIndex}
          shotRole="incoming"
          style={props.style}
          font={font}
          casing={casing}
          foreground={foreground}
          highlightColor={highlightColor}
          background={background}
          position={props.position}
          entrance={entrance}
          letterformScale={letterformScale}
          glow={props.glow}
          frame={frame}
          fps={fps}
          currentTimeMs={currentTimeMs}
          transitionOpacity={timeline.incomingOpacity}
          jitterPx={0}
          viewportHeight={viewportHeight}
        />,
      );
    }
  }

  return (
    <div data-testid="title-sequence-clip" style={containerStyle}>
      {renders}
    </div>
  );
}

export const titleSequenceClip: ClipDefinition<unknown> = defineFrameClip<TitleSequenceProps>({
  kind: 'titleSequence',
  component: TitleSequence,
  propsSchema: titleSequencePropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    foreground: { kind: 'palette', role: 'foreground' },
  },
});
