// packages/runtimes/frame-runtime-bridge/src/clips/follow-prompt.tsx
// T-318 — `follow-prompt` runtime-clip primitive: serves Cluster G
// vertical-video right-thumb-zone follow CTAs across four sealed
// platform bundles via Zod discriminated-union dispatch (`'tiktok'` —
// circular avatar with TikTok Pink `#FE2C55` "+" badge / `'instagram'`
// — circular avatar with magenta `#DD2A7B` badge + optional canonical
// gradient story-ring / `'youtube'` — circular avatar with YouTube Red
// `#FF0000` badge / `'generic'` — brand-neutral theme-driven avatar).
// Three sealed animation phases (`'idle'` — static avatar visible /
// `'pulsing'` — bounded sustained scale-pulse 1.00 → 1.05 → 1.00 over
// 1500 ms (`pulseRepeat` 1..10) with optional 30%-alpha expanding ring
// / `'followed'` — "+" → checkmark glyph swap with 1.00 → 1.20 → 1.00
// scale-pop on the badge over 300 ms). Frame-deterministic; brand
// canon dominates theme on branded platforms; theme-slot fallback only
// for `'generic'`. No `Date.now` / `Math.random` / `crypto.randomUUID`
// / `setTimeout` / `setInterval` / `fetch` / `requestAnimationFrame`.
// Carve-outs: algorithmic toast (T-318a), continuous-breathing pulse
// (T-318b), Instagram story-ring trim (T-318c).

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
  })
  .strict();

const fontSchema = z
  .object({
    family: z.string().min(1),
    weight: z.number().int().min(100).max(900).optional(),
  })
  .strict();

const phaseSchema = z.enum(['idle', 'pulsing', 'followed']);

// Common props that appear in every platform branch. Spread into each
// branch's shape since `discriminatedUnion` requires plain `ZodObject`
// branches.
const baseShape = {
  position: positionSchema,
  /** Avatar-circle diameter (px). Default 40. */
  size: z.number().positive().optional(),
  /** Avatar surface color hex. Theme-slot fallback when absent (generic only). */
  avatarColor: z.string().regex(HEX_COLOR_RE).optional(),
  /** 1–2 character monogram inside the avatar circle. */
  avatarText: z.string().min(1).max(2).optional(),
  /** Avatar-text color hex. Default white on branded platforms; theme fallback for generic. */
  avatarTextColor: z.string().regex(HEX_COLOR_RE).optional(),
  /** Badge background color hex; per-platform default applied when absent. */
  badgeColor: z.string().regex(HEX_COLOR_RE).optional(),
  /** Badge glyph color hex; default white. */
  badgeGlyphColor: z.string().regex(HEX_COLOR_RE).optional(),
  /** Font override for `avatarText`; per-platform default applied when absent. */
  font: fontSchema.optional(),
  /**
   * Animation phase. 'idle' (default) renders the static avatar + badge;
   * 'pulsing' renders the bounded scale-pulse + optional alpha-ring;
   * 'followed' renders the "+" → checkmark morph + scale pop.
   */
  phase: phaseSchema.optional(),
  /** Show the expanding 30%-alpha pulse-ring in 'pulsing' phase. Default true. */
  showPulseRing: z.boolean().optional(),
  /** Bounded count of pulse cycles when phase: 'pulsing'. Default 1, max 10. */
  pulseRepeat: z.number().int().min(1).max(10).optional(),
};

const tiktokSchema = z
  .object({
    platform: z.literal('tiktok'),
    ...baseShape,
  })
  .strict();

const instagramSchema = z
  .object({
    platform: z.literal('instagram'),
    ...baseShape,
    /** Show Instagram-canonical gradient story-ring around the avatar. Default false. */
    showRing: z.boolean().optional(),
    /** Override gradient stops on the story-ring. Default per-platform. */
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

const youtubeSchema = z
  .object({
    platform: z.literal('youtube'),
    ...baseShape,
  })
  .strict();

const genericSchema = z
  .object({
    platform: z.literal('generic'),
    ...baseShape,
  })
  .strict();

export const followPromptPropsSchema = z.discriminatedUnion('platform', [
  tiktokSchema,
  instagramSchema,
  youtubeSchema,
  genericSchema,
]);

export type FollowPromptProps = z.infer<typeof followPromptPropsSchema>;

type TiktokProps = z.infer<typeof tiktokSchema>;
type InstagramProps = z.infer<typeof instagramSchema>;
type YoutubeProps = z.infer<typeof youtubeSchema>;
type GenericProps = z.infer<typeof genericSchema>;

type Phase = NonNullable<FollowPromptProps['phase']>;

// ─── platform constants ──────────────────────────────────────────────────

const DEFAULT_SIZE = 40;

const TIKTOK_PINK = '#FE2C55';
const TIKTOK_FONT_FAMILY = 'TikTok Sans, sans-serif';
const TIKTOK_FONT_WEIGHT = 700;

const INSTAGRAM_MAGENTA = '#DD2A7B';
const INSTAGRAM_GRADIENT_START = '#F58529';
const INSTAGRAM_GRADIENT_MID = '#DD2A7B';
const INSTAGRAM_GRADIENT_END = '#8134AF';
const INSTAGRAM_FONT_FAMILY = 'Helvetica Neue, Arial, sans-serif';
const INSTAGRAM_FONT_WEIGHT = 600;

const YOUTUBE_RED = '#FF0000';
const YOUTUBE_FONT_FAMILY = 'Roboto, sans-serif';
const YOUTUBE_FONT_WEIGHT = 500;

const GENERIC_FONT_FAMILY = 'Plus Jakarta Sans, sans-serif';
const GENERIC_FONT_WEIGHT = 700;
const GENERIC_DEFAULT_AVATAR = '#FFFFFF';
const GENERIC_DEFAULT_BADGE = '#0d0d0f';
const GENERIC_DEFAULT_TEXT = '#0d0d0f';

const BRANDED_AVATAR_DEFAULT = '#FFFFFF';
const BRANDED_TEXT_DEFAULT = '#FFFFFF';
const BRANDED_GLYPH_DEFAULT = '#FFFFFF';

/** Unicode CHECK MARK (U+2713). */
const CHECK_GLYPH = '\u{2713}';
const PLUS_GLYPH = '+';

// Smooth ease for the bounded pulse cycle and checkmark scale-pop.
const PULSE_EASING = cubicBezier(0.4, 0, 0.2, 1);

// ─── shared helpers ──────────────────────────────────────────────────────

/**
 * Format the scale value with up to four decimals to make HTML byte-
 * stable across renders. Trailing zeros are stripped so settled scale
 * values (1.0000 → "1") match the browser-default scale serialization.
 */
function scaleString(value: number): string {
  if (!Number.isFinite(value)) return '1';
  const fixed = value.toFixed(4);
  return fixed.replace(/\.?0+$/, '') || '0';
}

/**
 * Frame-derived avatar scale for the current phase.
 * `'idle'` → 1.00. `'pulsing'` → bounded sustained-pulse over
 * `pulseRepeat` cycles, settling at 1.00 thereafter. `'followed'` →
 * 1.00 (the badge alone pops; the avatar surface stays put).
 */
function computeAvatarScale(frame: number, fps: number, phase: Phase, pulseRepeat: number): number {
  if (phase !== 'pulsing') return 1;
  const cycleFrames = Math.ceil(fps * 1.5);
  const peakFrame = Math.ceil(fps * 0.5);
  if (cycleFrames <= 0) return 1;
  const totalFrames = cycleFrames * pulseRepeat;
  if (frame >= totalFrames) return 1;
  const phaseFrame = frame % cycleFrames;
  return interpolate(phaseFrame, [0, peakFrame, cycleFrames], [1, 1.05, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: PULSE_EASING,
  });
}

/**
 * Frame-derived badge scale for the `'followed'` phase scale-pop. In
 * `'idle'` / `'pulsing'` the badge stays at 1.00 (the avatar carries the
 * pulse instead).
 */
function computeBadgeScale(frame: number, fps: number, phase: Phase): number {
  if (phase !== 'followed') return 1;
  const peakFrame = Math.ceil(fps * 0.15);
  const endFrame = Math.ceil(fps * 0.3);
  return interpolate(frame, [0, peakFrame, endFrame], [1, 1.2, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: PULSE_EASING,
  });
}

/**
 * Frame-derived ring opacity + radius factor for the `'pulsing'` phase
 * 30%-alpha expanding ring. Returns `null` when the ring should not
 * render (suppressed via `showPulseRing: false`, wrong phase, or after
 * the bounded `pulseRepeat` cycles complete).
 */
function computePulseRing(
  frame: number,
  fps: number,
  phase: Phase,
  pulseRepeat: number,
  showPulseRing: boolean,
): { opacity: number; radiusFactor: number } | null {
  if (phase !== 'pulsing' || !showPulseRing) return null;
  const cycleFrames = Math.ceil(fps * 1.5);
  if (cycleFrames <= 0) return null;
  const totalFrames = cycleFrames * pulseRepeat;
  if (frame >= totalFrames) return null;
  const phaseFrame = frame % cycleFrames;
  const radiusFactor = interpolate(phaseFrame, [0, cycleFrames], [1, 1.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(phaseFrame, [0, cycleFrames], [0.3, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { opacity, radiusFactor };
}

interface AvatarRootStyleInput {
  position: { x: number; y: number };
  size: number;
  avatarScale: number;
  backgroundColor: string;
}

function avatarRootStyle(input: AvatarRootStyleInput): CSSProperties {
  return {
    position: 'absolute',
    left: input.position.x,
    top: input.position.y,
    width: input.size,
    height: input.size,
    borderRadius: '50%',
    backgroundColor: input.backgroundColor,
    transform: `scale(${scaleString(input.avatarScale)})`,
    transformOrigin: 'center center',
    boxSizing: 'border-box',
    userSelect: 'none',
  };
}

interface BadgeStyleInput {
  size: number;
  badgeScale: number;
  backgroundColor: string;
  glyphColor: string;
}

function badgeStyle(input: BadgeStyleInput): CSSProperties {
  // Badge ~40% of avatar size, half-overlapping the bottom edge.
  const badgeSize = Math.round(input.size * 0.4);
  return {
    position: 'absolute',
    left: '50%',
    bottom: -Math.round(badgeSize / 2),
    width: badgeSize,
    height: badgeSize,
    marginLeft: -Math.round(badgeSize / 2),
    borderRadius: '50%',
    backgroundColor: input.backgroundColor,
    color: input.glyphColor,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.round(badgeSize * 0.7),
    lineHeight: 1,
    fontWeight: 700,
    transform: `scale(${scaleString(input.badgeScale)})`,
    transformOrigin: 'center center',
    pointerEvents: 'none',
  };
}

interface MonogramStyleInput {
  size: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
}

function monogramStyle(input: MonogramStyleInput): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: input.fontFamily,
    fontWeight: input.fontWeight,
    fontSize: Math.round(input.size * 0.4),
    color: input.color,
    pointerEvents: 'none',
  };
}

interface PulseRingStyleInput {
  size: number;
  opacity: number;
  radiusFactor: number;
  color: string;
}

function pulseRingStyle(input: PulseRingStyleInput): CSSProperties {
  const ringSize = Math.round(input.size * input.radiusFactor);
  const offset = -Math.round((ringSize - input.size) / 2);
  // Use border to render the ring outline; opacity fades to 0 over the cycle.
  // toFixed(4) keeps the inline style byte-stable across renders.
  return {
    position: 'absolute',
    left: offset,
    top: offset,
    width: ringSize,
    height: ringSize,
    borderRadius: '50%',
    border: `2px solid ${input.color}`,
    opacity: Number(input.opacity.toFixed(4)),
    pointerEvents: 'none',
    boxSizing: 'border-box',
  };
}

interface InstagramRingStyleInput {
  size: number;
  gradient: string;
}

function instagramRingStyle(input: InstagramRingStyleInput): CSSProperties {
  // Outer wrapper one ring-thickness larger than the avatar; the avatar
  // (rendered absolutely at center) hides the inner half of the ring.
  const ringPadding = Math.max(2, Math.round(input.size * 0.08));
  const wrapperSize = input.size + ringPadding * 2;
  return {
    position: 'absolute',
    left: -ringPadding,
    top: -ringPadding,
    width: wrapperSize,
    height: wrapperSize,
    borderRadius: '50%',
    backgroundImage: input.gradient,
    pointerEvents: 'none',
  };
}

// ─── component ───────────────────────────────────────────────────────────

/**
 * `<FollowPrompt>` — the public component. Discriminates on
 * `props.platform` and delegates to a per-platform sub-renderer.
 * Frame-derived; v1 ships a sealed three-phase animation lexicon
 * (`'idle'` / `'pulsing'` / `'followed'`) driven by the consumer's
 * scene timing. Always-present register — never enters / exits;
 * `'pulsing'` runs `pulseRepeat` bounded cycles then settles.
 */
export function FollowPrompt(props: FollowPromptProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phase: Phase = props.phase ?? 'idle';
  const pulseRepeat = props.pulseRepeat ?? 1;
  const showPulseRing = props.showPulseRing !== false;
  const avatarScale = computeAvatarScale(frame, fps, phase, pulseRepeat);
  const badgeScale = computeBadgeScale(frame, fps, phase);
  const ring = computePulseRing(frame, fps, phase, pulseRepeat, showPulseRing);

  switch (props.platform) {
    case 'tiktok':
      return renderTiktok(props, { avatarScale, badgeScale, ring });
    case 'instagram':
      return renderInstagram(props, { avatarScale, badgeScale, ring });
    case 'youtube':
      return renderYoutube(props, { avatarScale, badgeScale, ring });
    case 'generic':
      return renderGeneric(props, { avatarScale, badgeScale, ring });
    default: {
      const _exhaustive: never = props;
      return _exhaustive;
    }
  }
}

interface RenderInput {
  avatarScale: number;
  badgeScale: number;
  ring: { opacity: number; radiusFactor: number } | null;
}

function renderBadgeContent(phase: Phase): string {
  return phase === 'followed' ? CHECK_GLYPH : PLUS_GLYPH;
}

// ─── tiktok ──────────────────────────────────────────────────────────────

function renderTiktok(props: TiktokProps, render: RenderInput): ReactElement {
  const phase: Phase = props.phase ?? 'idle';
  const size = props.size ?? DEFAULT_SIZE;
  // Brand canon dominates theme — `badgeColor` no-op on branded platforms
  // (per D-T318-6); avatar surface defaults to white, overridable via
  // `avatarColor`.
  const avatarColor = props.avatarColor ?? BRANDED_AVATAR_DEFAULT;
  const badgeColor = TIKTOK_PINK;
  const badgeGlyphColor = props.badgeGlyphColor ?? BRANDED_GLYPH_DEFAULT;
  const fontFamily = props.font?.family ?? TIKTOK_FONT_FAMILY;
  const fontWeight = props.font?.weight ?? TIKTOK_FONT_WEIGHT;
  const textColor = props.avatarTextColor ?? BRANDED_TEXT_DEFAULT;

  return (
    <div
      data-testid="follow-prompt-tiktok"
      style={avatarRootStyle({
        position: props.position,
        size,
        avatarScale: render.avatarScale,
        backgroundColor: avatarColor,
      })}
    >
      {render.ring ? (
        <div
          data-testid="follow-prompt-pulse-ring"
          style={pulseRingStyle({
            size,
            opacity: render.ring.opacity,
            radiusFactor: render.ring.radiusFactor,
            color: TIKTOK_PINK,
          })}
        />
      ) : null}
      {props.avatarText !== undefined ? (
        <span
          data-testid="follow-prompt-tiktok-text"
          style={monogramStyle({ size, fontFamily, fontWeight, color: textColor })}
        >
          {props.avatarText}
        </span>
      ) : null}
      <span
        data-testid="follow-prompt-tiktok-badge"
        aria-hidden
        style={badgeStyle({
          size,
          badgeScale: render.badgeScale,
          backgroundColor: badgeColor,
          glyphColor: badgeGlyphColor,
        })}
      >
        {renderBadgeContent(phase)}
      </span>
    </div>
  );
}

// ─── instagram ───────────────────────────────────────────────────────────

function renderInstagram(props: InstagramProps, render: RenderInput): ReactElement {
  const phase: Phase = props.phase ?? 'idle';
  const size = props.size ?? DEFAULT_SIZE;
  const avatarColor = props.avatarColor ?? BRANDED_AVATAR_DEFAULT;
  const badgeColor = INSTAGRAM_MAGENTA;
  const badgeGlyphColor = props.badgeGlyphColor ?? BRANDED_GLYPH_DEFAULT;
  const fontFamily = props.font?.family ?? INSTAGRAM_FONT_FAMILY;
  const fontWeight = props.font?.weight ?? INSTAGRAM_FONT_WEIGHT;
  const textColor = props.avatarTextColor ?? BRANDED_TEXT_DEFAULT;
  const start = props.gradient?.start ?? INSTAGRAM_GRADIENT_START;
  const mid = props.gradient?.mid ?? INSTAGRAM_GRADIENT_MID;
  const end = props.gradient?.end ?? INSTAGRAM_GRADIENT_END;
  const gradient = `linear-gradient(135deg, ${start} 0%, ${mid} 50%, ${end} 100%)`;
  const showRing = props.showRing === true;

  return (
    <div
      data-testid="follow-prompt-instagram"
      style={avatarRootStyle({
        position: props.position,
        size,
        avatarScale: render.avatarScale,
        backgroundColor: avatarColor,
      })}
    >
      {showRing ? (
        <div
          data-testid="follow-prompt-instagram-ring"
          style={instagramRingStyle({ size, gradient })}
        />
      ) : null}
      {render.ring ? (
        <div
          data-testid="follow-prompt-pulse-ring"
          style={pulseRingStyle({
            size,
            opacity: render.ring.opacity,
            radiusFactor: render.ring.radiusFactor,
            color: INSTAGRAM_MAGENTA,
          })}
        />
      ) : null}
      {props.avatarText !== undefined ? (
        <span
          data-testid="follow-prompt-instagram-text"
          style={monogramStyle({ size, fontFamily, fontWeight, color: textColor })}
        >
          {props.avatarText}
        </span>
      ) : null}
      <span
        data-testid="follow-prompt-instagram-badge"
        aria-hidden
        style={badgeStyle({
          size,
          badgeScale: render.badgeScale,
          backgroundColor: badgeColor,
          glyphColor: badgeGlyphColor,
        })}
      >
        {renderBadgeContent(phase)}
      </span>
    </div>
  );
}

// ─── youtube ─────────────────────────────────────────────────────────────

function renderYoutube(props: YoutubeProps, render: RenderInput): ReactElement {
  const phase: Phase = props.phase ?? 'idle';
  const size = props.size ?? DEFAULT_SIZE;
  const avatarColor = props.avatarColor ?? BRANDED_AVATAR_DEFAULT;
  const badgeColor = YOUTUBE_RED;
  const badgeGlyphColor = props.badgeGlyphColor ?? BRANDED_GLYPH_DEFAULT;
  const fontFamily = props.font?.family ?? YOUTUBE_FONT_FAMILY;
  const fontWeight = props.font?.weight ?? YOUTUBE_FONT_WEIGHT;
  const textColor = props.avatarTextColor ?? BRANDED_TEXT_DEFAULT;

  return (
    <div
      data-testid="follow-prompt-youtube"
      style={avatarRootStyle({
        position: props.position,
        size,
        avatarScale: render.avatarScale,
        backgroundColor: avatarColor,
      })}
    >
      {render.ring ? (
        <div
          data-testid="follow-prompt-pulse-ring"
          style={pulseRingStyle({
            size,
            opacity: render.ring.opacity,
            radiusFactor: render.ring.radiusFactor,
            color: YOUTUBE_RED,
          })}
        />
      ) : null}
      {props.avatarText !== undefined ? (
        <span
          data-testid="follow-prompt-youtube-text"
          style={monogramStyle({ size, fontFamily, fontWeight, color: textColor })}
        >
          {props.avatarText}
        </span>
      ) : null}
      <span
        data-testid="follow-prompt-youtube-badge"
        aria-hidden
        style={badgeStyle({
          size,
          badgeScale: render.badgeScale,
          backgroundColor: badgeColor,
          glyphColor: badgeGlyphColor,
        })}
      >
        {renderBadgeContent(phase)}
      </span>
    </div>
  );
}

// ─── generic ─────────────────────────────────────────────────────────────

function renderGeneric(props: GenericProps, render: RenderInput): ReactElement {
  const phase: Phase = props.phase ?? 'idle';
  const size = props.size ?? DEFAULT_SIZE;
  // Generic respects theme-slot fallback (avatarColor → palette/background,
  // badgeColor → palette/accent, avatarTextColor → palette/foreground).
  // Defaults (used when the bridge doesn't fill the slot) live in the
  // bridge constants below.
  const avatarColor = props.avatarColor ?? GENERIC_DEFAULT_AVATAR;
  const badgeColor = props.badgeColor ?? GENERIC_DEFAULT_BADGE;
  const badgeGlyphColor = props.badgeGlyphColor ?? '#FFFFFF';
  const fontFamily = props.font?.family ?? GENERIC_FONT_FAMILY;
  const fontWeight = props.font?.weight ?? GENERIC_FONT_WEIGHT;
  const textColor = props.avatarTextColor ?? GENERIC_DEFAULT_TEXT;

  return (
    <div
      data-testid="follow-prompt-generic"
      style={avatarRootStyle({
        position: props.position,
        size,
        avatarScale: render.avatarScale,
        backgroundColor: avatarColor,
      })}
    >
      {render.ring ? (
        <div
          data-testid="follow-prompt-pulse-ring"
          style={pulseRingStyle({
            size,
            opacity: render.ring.opacity,
            radiusFactor: render.ring.radiusFactor,
            color: badgeColor,
          })}
        />
      ) : null}
      {props.avatarText !== undefined ? (
        <span
          data-testid="follow-prompt-generic-text"
          style={monogramStyle({ size, fontFamily, fontWeight, color: textColor })}
        >
          {props.avatarText}
        </span>
      ) : null}
      <span
        data-testid="follow-prompt-generic-badge"
        aria-hidden
        style={badgeStyle({
          size,
          badgeScale: render.badgeScale,
          backgroundColor: badgeColor,
          glyphColor: badgeGlyphColor,
        })}
      >
        {renderBadgeContent(phase)}
      </span>
    </div>
  );
}

/**
 * `followPromptClip` clip definition — registered as
 * `kind: 'follow-prompt'` in the frame-runtime bridge. Theme slots map
 * `background` / `foreground` / `accent` to the standard palette roles
 * (consumed by `'generic'` only — branded platforms override with
 * brand-canonical colors per D-T318-6).
 */
export const followPromptClip: ClipDefinition<unknown> = defineFrameClip<FollowPromptProps>({
  kind: 'follow-prompt',
  component: FollowPrompt,
  propsSchema: followPromptPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    foreground: { kind: 'palette', role: 'foreground' },
    accent: { kind: 'palette', role: 'accent' },
  },
  fontRequirements: () => [
    { family: 'TikTok Sans', weight: 700 },
    { family: 'Roboto', weight: 500 },
    { family: 'Plus Jakarta Sans', weight: 700 },
  ],
});
