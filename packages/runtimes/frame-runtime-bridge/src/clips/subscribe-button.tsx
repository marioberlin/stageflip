// packages/runtimes/frame-runtime-bridge/src/clips/subscribe-button.tsx
// T-317 — `subscribe-button` runtime-clip primitive: serves Cluster G
// creator-platform subscribe / follow CTA buttons across four sealed
// platform bundles via Zod discriminated-union dispatch (`'youtube'` —
// rounded red pill / `'tiktok'` — pink pill with optional plus glyph /
// `'instagram'` — gradient rectangle / `'generic'` — theme-driven
// neutral pill). Three sealed animation phases (`'idle'` — entrance
// bounce overshoot 0 → 1.10 → 1.00; `'pressing'` — scale dip 1.00 →
// 0.95 → 1.00; `'subscribed'` — static post-press settled state).
// Frame-deterministic; brand canon dominates theme on branded
// platforms; theme-slot fallback only for `'generic'`. No `Date.now` /
// `Math.random` / `crypto.randomUUID` / `setTimeout` / `setInterval` /
// `fetch` / `requestAnimationFrame`. Carve-outs: bell-glyph wiggle
// (T-317a), animated cursor slide-in (T-317b), infinite-breathing
// idle pulse (T-317c).

import {
  cubicBezier,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const positionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  })
  .strict();

const fontSchema = z
  .object({
    family: z.string().min(1),
    weight: z.number().int().min(100).max(900).optional(),
  })
  .strict();

const casingSchema = z.enum(['as-is', 'uppercase', 'lowercase', 'title-case']);
const phaseSchema = z.enum(['idle', 'pressing', 'subscribed']);

// Common props that appear in every platform branch. Spread into each
// branch's shape since `discriminatedUnion` requires plain `ZodObject`
// branches.
const baseShape = {
  position: positionSchema,
  /** Optional explicit background hex; theme-slot fallback when absent (generic only). */
  background: z.string().regex(HEX_COLOR_RE).optional(),
  /** Optional explicit foreground (text) hex; theme-slot fallback when absent (generic only). */
  foreground: z.string().regex(HEX_COLOR_RE).optional(),
  /** Optional explicit accent (post-press background; bell-glyph color). */
  accent: z.string().regex(HEX_COLOR_RE).optional(),
  /** Font override; per-platform default applied when absent. */
  font: fontSchema.optional(),
  /** Casing transform applied to the rendered label only. Default 'as-is'. */
  casing: casingSchema.optional(),
  /** Border radius (px). Per-platform default applied when absent. */
  borderRadius: z.number().nonnegative().optional(),
  /**
   * Animation phase. 'idle' (default) renders the entrance bounce;
   * 'pressing' renders the press-down state; 'subscribed' renders the
   * post-press settled state. The consumer drives transitions by
   * mounting the primitive with the desired `phase` per scene segment;
   * v1 does NOT auto-transition between phases.
   */
  phase: phaseSchema.optional(),
  /** Optional cursor glyph slot (right-edge static cursor in 'pressing' phase). */
  showCursor: z.boolean().optional(),
  /** Optional drop shadow. Default per-platform (YouTube emits a shadow; others none). */
  dropShadow: z.boolean().optional(),
};

const youtubeSchema = z
  .object({
    platform: z.literal('youtube'),
    ...baseShape,
    /** Pre-press label. YouTube canon: 'SUBSCRIBE'. */
    label: z.string().min(1),
    /** Post-press label. YouTube canon: 'SUBSCRIBED'. */
    subscribedLabel: z.string().min(1).optional(),
    /** Show bell glyph in 'subscribed' phase. Default true. */
    showBell: z.boolean().optional(),
  })
  .strict();

const tiktokSchema = z
  .object({
    platform: z.literal('tiktok'),
    ...baseShape,
    label: z.string().min(1),
    followingLabel: z.string().min(1).optional(),
    /** Show '+' plus glyph in 'idle' phase. Default true. */
    showPlus: z.boolean().optional(),
  })
  .strict();

const instagramSchema = z
  .object({
    platform: z.literal('instagram'),
    ...baseShape,
    label: z.string().min(1),
    followingLabel: z.string().min(1).optional(),
    /** Override gradient stops. Default per-platform. */
    gradient: z
      .object({
        start: z.string().regex(HEX_COLOR_RE),
        mid: z.string().regex(HEX_COLOR_RE),
        end: z.string().regex(HEX_COLOR_RE),
      })
      .strict()
      .optional(),
  })
  .strict();

const genericSchema = z
  .object({
    platform: z.literal('generic'),
    ...baseShape,
    label: z.string().min(1),
    postPressLabel: z.string().min(1).optional(),
  })
  .strict();

export const subscribeButtonPropsSchema = z.discriminatedUnion('platform', [
  youtubeSchema,
  tiktokSchema,
  instagramSchema,
  genericSchema,
]);

export type SubscribeButtonProps = z.infer<typeof subscribeButtonPropsSchema>;

type YoutubeProps = z.infer<typeof youtubeSchema>;
type TiktokProps = z.infer<typeof tiktokSchema>;
type InstagramProps = z.infer<typeof instagramSchema>;
type GenericProps = z.infer<typeof genericSchema>;

// ─── platform constants ──────────────────────────────────────────────────

const YOUTUBE_RED = '#FF0000';
const YOUTUBE_GRAY = '#AAAAAA';
const YOUTUBE_BORDER_RADIUS = 8;
const YOUTUBE_FONT_FAMILY = 'Roboto, sans-serif';
const YOUTUBE_FONT_WEIGHT = 500;
const YOUTUBE_FONT_SIZE = 18;
/** Unicode bell glyph (BELL, U+1F514). */
const BELL_GLYPH = '\u{1F514}';

const TIKTOK_PINK = '#FE2C55';
const TIKTOK_BORDER_RADIUS = 8;
const TIKTOK_FONT_FAMILY = 'TikTok Sans, sans-serif';
const TIKTOK_FONT_WEIGHT = 700;
const TIKTOK_FONT_SIZE = 18;

const INSTAGRAM_GRADIENT_START = '#F58529';
const INSTAGRAM_GRADIENT_MID = '#DD2A7B';
const INSTAGRAM_GRADIENT_END = '#8134AF';
const INSTAGRAM_BORDER_RADIUS = 4;
const INSTAGRAM_FONT_FAMILY = 'Helvetica Neue, Arial, sans-serif';
const INSTAGRAM_FONT_WEIGHT = 600;
const INSTAGRAM_FONT_SIZE = 18;

const GENERIC_BORDER_RADIUS = 8;
const GENERIC_FONT_FAMILY = 'Plus Jakarta Sans, sans-serif';
const GENERIC_FONT_WEIGHT = 700;
const GENERIC_FONT_SIZE = 18;
const GENERIC_DEFAULT_BACKGROUND = '#0d0d0f';
const GENERIC_DEFAULT_FOREGROUND = '#f5f7fa';

const YOUTUBE_DROP_SHADOW = '0 4px 8px rgba(0, 0, 0, 0.20)';

// "Back" easing (overshoot) — same canonical curve `youtube-subscribe-bounce.md`
// pins for the 0 → 1.10 → 1.00 entrance bounce.
const BOUNCE_EASING = cubicBezier(0.34, 1.56, 0.64, 1);
const PRESS_EASING = cubicBezier(0.4, 0, 0.6, 1);

// ─── shared helpers ──────────────────────────────────────────────────────

/**
 * Apply casing transform via JS string transform (NOT CSS
 * `text-transform`) for parity-golden byte-stability. Title case is
 * naive ASCII (capitalize first letter of each whitespace-separated
 * token); locale-aware title casing is v2.
 */
function applyCasing(text: string, casing: SubscribeButtonProps['casing']): string {
  if (!casing || casing === 'as-is') return text;
  switch (casing) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'title-case':
      return text.replace(/\S+/g, (token) => {
        const first = token.charAt(0);
        return first === '' ? token : first.toUpperCase() + token.slice(1).toLowerCase();
      });
    default:
      return text;
  }
}

/**
 * Frame-derived scale multiplier for the current animation phase.
 * `'idle'` runs the 0 → 1.10 → 1.00 entrance bounce overshoot driven
 * by `useCurrentFrame()` at the host fps; `'pressing'` runs a brief
 * 1.00 → 0.95 → 1.00 dip; `'subscribed'` is static at 1.00.
 */
function computeScale(
  frame: number,
  fps: number,
  phase: NonNullable<SubscribeButtonProps['phase']>,
): number {
  if (phase === 'subscribed') return 1;
  if (phase === 'pressing') {
    const dipPeak = Math.ceil(fps * 0.083);
    const dipEnd = dipPeak * 2;
    return interpolate(frame, [0, dipPeak, dipEnd], [1, 0.95, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: PRESS_EASING,
    });
  }
  // 'idle' — entrance bounce overshoot.
  const peak = Math.ceil(fps * 0.3);
  const settle = Math.ceil(fps * 0.5);
  return interpolate(frame, [0, peak, settle], [0, 1.1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: BOUNCE_EASING,
  });
}

interface CursorOverlayInput {
  show: boolean;
  size: number;
  color: string;
}

/**
 * Static cursor glyph rendered at the button's right edge in the
 * `'pressing'` phase when `showCursor: true`. The cursor slide-in
 * animation is deferred to T-317b.
 */
function renderCursor({ show, size, color }: CursorOverlayInput): ReactElement | null {
  if (!show) return null;
  return (
    <span
      data-testid="subscribe-button-cursor"
      style={{
        position: 'absolute',
        right: -size,
        top: '50%',
        transform: 'translateY(-25%)',
        width: size,
        height: size,
        color,
        fontSize: size,
        lineHeight: 1,
        pointerEvents: 'none',
      }}
    >
      {/* Black-arrow upper-left pointer (Unicode U+2BB0). */}
      {'\u{2BB0}'}
    </span>
  );
}

/**
 * `<SubscribeButton>` — the public component. Discriminates on
 * `props.platform` and delegates to a per-platform sub-renderer.
 * Frame-derived; v1 ships a sealed three-phase animation lexicon
 * (`'idle'` / `'pressing'` / `'subscribed'`) driven by the consumer's
 * scene timing.
 */
export function SubscribeButton(props: SubscribeButtonProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phase = props.phase ?? 'idle';
  const scale = computeScale(frame, fps, phase);

  switch (props.platform) {
    case 'youtube':
      return renderYoutube(props, scale, phase);
    case 'tiktok':
      return renderTiktok(props, scale, phase);
    case 'instagram':
      return renderInstagram(props, scale, phase);
    case 'generic':
      return renderGeneric(props, scale, phase);
    default: {
      const _exhaustive: never = props;
      return _exhaustive;
    }
  }
}

interface RootStyleInput {
  position: SubscribeButtonProps['position'];
  scale: number;
  borderRadius: number;
  backgroundColor?: string;
  backgroundImage?: string;
  color: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  border?: string;
  boxShadow?: string;
}

function rootStyle(input: RootStyleInput): CSSProperties {
  const style: CSSProperties = {
    position: 'absolute',
    left: input.position.x,
    top: input.position.y,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 18px',
    color: input.color,
    fontFamily: input.fontFamily,
    fontWeight: input.fontWeight,
    fontSize: input.fontSize,
    borderRadius: input.borderRadius,
    transform: `scale(${scaleString(input.scale)})`,
    transformOrigin: 'center center',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };
  if (input.position.width !== undefined) style.width = input.position.width;
  if (input.position.height !== undefined) style.height = input.position.height;
  if (input.backgroundColor !== undefined) style.backgroundColor = input.backgroundColor;
  if (input.backgroundImage !== undefined) style.backgroundImage = input.backgroundImage;
  if (input.border !== undefined) style.border = input.border;
  if (input.boxShadow !== undefined) style.boxShadow = input.boxShadow;
  return style;
}

/**
 * Format the scale value with up to four decimals to make HTML byte-
 * stable across renders. Trailing zeros are stripped so settled scale
 * values (1.0000 → "1") match the browser-default scale serialization.
 */
function scaleString(value: number): string {
  if (!Number.isFinite(value)) return '1';
  const fixed = value.toFixed(4);
  // Strip trailing zeros and a possible trailing dot.
  return fixed.replace(/\.?0+$/, '') || '0';
}

// ─── youtube ─────────────────────────────────────────────────────────────

function renderYoutube(
  props: YoutubeProps,
  scale: number,
  phase: NonNullable<SubscribeButtonProps['phase']>,
): ReactElement {
  const isSubscribed = phase === 'subscribed';
  // Brand canon dominates theme on YouTube — `background` /
  // `foreground` props are no-op (per D-T317-6); `accent` MAY tint the
  // bell glyph in the post-press state.
  const backgroundColor = isSubscribed ? YOUTUBE_GRAY : YOUTUBE_RED;
  const foreground = '#FFFFFF';
  const fontFamily = props.font?.family ?? YOUTUBE_FONT_FAMILY;
  const fontWeight = props.font?.weight ?? YOUTUBE_FONT_WEIGHT;
  const borderRadius = props.borderRadius ?? YOUTUBE_BORDER_RADIUS;
  const dropShadow = props.dropShadow !== false;
  const showBell = props.showBell !== false;
  const bellTint = props.accent ?? '#FFFFFF';

  // YouTube force-uppercases the label regardless of `casing` (per
  // D-T317-8 / canonical posture).
  const rawLabel = isSubscribed ? (props.subscribedLabel ?? 'SUBSCRIBED') : props.label;
  const cased = applyCasing(rawLabel, props.casing);
  const label = cased.toUpperCase();

  const styleInput: RootStyleInput = {
    position: props.position,
    scale,
    borderRadius,
    backgroundColor,
    color: foreground,
    fontFamily,
    fontWeight,
    fontSize: YOUTUBE_FONT_SIZE,
  };
  if (dropShadow) styleInput.boxShadow = YOUTUBE_DROP_SHADOW;

  return (
    <div
      data-testid="subscribe-button-youtube"
      style={{ ...rootStyle(styleInput), position: 'absolute' }}
    >
      <span data-testid="subscribe-button-youtube-label">{label}</span>
      {isSubscribed && showBell ? (
        <span
          data-testid="subscribe-button-youtube-bell"
          aria-hidden
          style={{ color: bellTint, fontSize: YOUTUBE_FONT_SIZE }}
        >
          {BELL_GLYPH}
        </span>
      ) : null}
      {renderCursor({
        show: phase === 'pressing' && props.showCursor === true,
        size: 24,
        color: foreground,
      })}
    </div>
  );
}

// ─── tiktok ──────────────────────────────────────────────────────────────

function renderTiktok(
  props: TiktokProps,
  scale: number,
  phase: NonNullable<SubscribeButtonProps['phase']>,
): ReactElement {
  const isSubscribed = phase === 'subscribed';
  const fontFamily = props.font?.family ?? TIKTOK_FONT_FAMILY;
  const fontWeight = props.font?.weight ?? TIKTOK_FONT_WEIGHT;
  const borderRadius = props.borderRadius ?? TIKTOK_BORDER_RADIUS;
  const showPlus = props.showPlus !== false;

  const rawLabel = isSubscribed ? (props.followingLabel ?? 'Following') : props.label;
  const label = applyCasing(rawLabel, props.casing);

  const styleInput: RootStyleInput = isSubscribed
    ? {
        position: props.position,
        scale,
        borderRadius,
        backgroundColor: 'transparent',
        color: TIKTOK_PINK,
        fontFamily,
        fontWeight,
        fontSize: TIKTOK_FONT_SIZE,
        border: `1px solid ${TIKTOK_PINK}`,
      }
    : {
        position: props.position,
        scale,
        borderRadius,
        backgroundColor: TIKTOK_PINK,
        color: '#FFFFFF',
        fontFamily,
        fontWeight,
        fontSize: TIKTOK_FONT_SIZE,
      };

  return (
    <div
      data-testid="subscribe-button-tiktok"
      style={{ ...rootStyle(styleInput), position: 'absolute' }}
    >
      {!isSubscribed && showPlus ? (
        <span data-testid="subscribe-button-tiktok-plus" aria-hidden>
          +
        </span>
      ) : null}
      <span data-testid="subscribe-button-tiktok-label">{label}</span>
      {renderCursor({
        show: phase === 'pressing' && props.showCursor === true,
        size: 24,
        color: isSubscribed ? TIKTOK_PINK : '#FFFFFF',
      })}
    </div>
  );
}

// ─── instagram ───────────────────────────────────────────────────────────

function renderInstagram(
  props: InstagramProps,
  scale: number,
  phase: NonNullable<SubscribeButtonProps['phase']>,
): ReactElement {
  const isSubscribed = phase === 'subscribed';
  const fontFamily = props.font?.family ?? INSTAGRAM_FONT_FAMILY;
  const fontWeight = props.font?.weight ?? INSTAGRAM_FONT_WEIGHT;
  const borderRadius = props.borderRadius ?? INSTAGRAM_BORDER_RADIUS;
  const start = props.gradient?.start ?? INSTAGRAM_GRADIENT_START;
  const mid = props.gradient?.mid ?? INSTAGRAM_GRADIENT_MID;
  const end = props.gradient?.end ?? INSTAGRAM_GRADIENT_END;
  const gradient = `linear-gradient(135deg, ${start} 0%, ${mid} 50%, ${end} 100%)`;

  const rawLabel = isSubscribed ? (props.followingLabel ?? 'Following') : props.label;
  const label = applyCasing(rawLabel, props.casing);

  // Subscribed renders a 1px white outline over a dimmed gradient
  // backdrop; idle renders the full-saturation gradient.
  const styleInput: RootStyleInput = isSubscribed
    ? {
        position: props.position,
        scale,
        borderRadius,
        backgroundImage: gradient,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        color: '#FFFFFF',
        fontFamily,
        fontWeight,
        fontSize: INSTAGRAM_FONT_SIZE,
        border: '1px solid #FFFFFF',
      }
    : {
        position: props.position,
        scale,
        borderRadius,
        backgroundImage: gradient,
        color: '#FFFFFF',
        fontFamily,
        fontWeight,
        fontSize: INSTAGRAM_FONT_SIZE,
      };

  return (
    <div
      data-testid="subscribe-button-instagram"
      style={{ ...rootStyle(styleInput), position: 'absolute' }}
    >
      <span data-testid="subscribe-button-instagram-label">{label}</span>
      {renderCursor({
        show: phase === 'pressing' && props.showCursor === true,
        size: 24,
        color: '#FFFFFF',
      })}
    </div>
  );
}

// ─── generic ─────────────────────────────────────────────────────────────

function renderGeneric(
  props: GenericProps,
  scale: number,
  phase: NonNullable<SubscribeButtonProps['phase']>,
): ReactElement {
  const isSubscribed = phase === 'subscribed';
  // Generic respects theme-slot fallback (background → palette/background,
  // foreground → palette/foreground). The frame-runtime bridge applies
  // the theme defaults via `themeSlots` before the component sees the
  // props; if both are still absent at render time we fall back to the
  // hard-coded bridge defaults.
  const backgroundColor = props.background ?? GENERIC_DEFAULT_BACKGROUND;
  const foreground = props.foreground ?? GENERIC_DEFAULT_FOREGROUND;
  const fontFamily = props.font?.family ?? GENERIC_FONT_FAMILY;
  const fontWeight = props.font?.weight ?? GENERIC_FONT_WEIGHT;
  const borderRadius = props.borderRadius ?? GENERIC_BORDER_RADIUS;

  const rawLabel = isSubscribed ? (props.postPressLabel ?? props.label) : props.label;
  const label = applyCasing(rawLabel, props.casing);

  const styleInput: RootStyleInput = {
    position: props.position,
    scale,
    borderRadius,
    backgroundColor,
    color: foreground,
    fontFamily,
    fontWeight,
    fontSize: GENERIC_FONT_SIZE,
  };
  if (props.dropShadow === true) styleInput.boxShadow = YOUTUBE_DROP_SHADOW;

  return (
    <div
      data-testid="subscribe-button-generic"
      style={{ ...rootStyle(styleInput), position: 'absolute' }}
    >
      <span data-testid="subscribe-button-generic-label">{label}</span>
      {renderCursor({
        show: phase === 'pressing' && props.showCursor === true,
        size: 24,
        color: foreground,
      })}
    </div>
  );
}

/**
 * `subscribeButton` clip definition — registered as
 * `kind: 'subscribe-button'` in the frame-runtime bridge. Theme slots
 * map `background` / `foreground` / `accent` to the standard palette
 * roles (consumed by `'generic'` only — branded platforms override
 * with brand-canonical colors per D-T317-6).
 */
export const subscribeButtonClip: ClipDefinition<unknown> = defineFrameClip<SubscribeButtonProps>({
  kind: 'subscribe-button',
  component: SubscribeButton,
  propsSchema: subscribeButtonPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    foreground: { kind: 'palette', role: 'foreground' },
    accent: { kind: 'palette', role: 'accent' },
  },
  fontRequirements: () => [
    { family: 'Roboto', weight: 500 },
    { family: 'TikTok Sans', weight: 700 },
    { family: 'Plus Jakarta Sans', weight: 700 },
  ],
});
