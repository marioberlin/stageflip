// packages/runtimes/frame-runtime-bridge/src/clips/link-sticker.tsx
// T-371a — `link-sticker` runtime-clip primitive: serves Cluster G's
// Instagram-style link-sticker canon — a rounded-pill free-form-positioned
// link sticker (~200 × 44 px native) on a Story frame with a closed-form
// linear shimmer / highlight sweep across the label glyphs (3 s cycle by
// default). Single Zod `object().strict()` schema with sealed `variant`
// enum (4 values: 'white-on-dark' | 'dark-on-white' | 'frosted-glass' |
// 'brand-color') and sealed `phase` enum (2 values: 'idle' |
// 'shimmering'). NO `discriminatedUnion` — the variant drives only color
// / contrast defaults via a constant token table, not render-path
// fan-out. Frame-deterministic shimmer math: `shimmerX(f) = round(((f %
// cycleFrames) / cycleFrames) * (pillWidth + bandWidth) - bandWidth)`.
// Pure trigonometry / arithmetic. The `'instagram-link-sticker'` preset
// (Cluster G's last unsigned preset, `clipKind: socialMedia`) is the v1
// consumer (wired in T-371). Inter Medium (OFL, T-307) registered as
// the hard fallback font; the Instagram proprietary system font is
// `platform-byo` (consumer-wired via `runtime.fonts`). Tap-depress +
// link-preview card animation deferred to T-371a-followup; backdrop-
// filter blur for the `'frosted-glass'` variant deferred to T-371a-blur
// (CDP determinism hazard); additional sticker kinds (mention / poll /
// GIF / question / slider / music) deferred to T-371a-extend; real
// Instagram-domain icon SVG deferred to T-371a-glyph. No `Date.now` /
// `Math.random` / `crypto.randomUUID` / `setTimeout` / `setInterval` /
// `fetch` / `requestAnimationFrame` / `addEventListener`.

import { useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// ─── schema ──────────────────────────────────────────────────────────────

/**
 * Sealed variant enum. v1: 4 variants per
 * `instagram-link-sticker.md` line 24. The variant drives only color
 * / contrast defaults via the `VARIANT_TOKENS` lookup; render path is
 * uniform (rounded pill + label + optional shimmer overlay).
 */
const linkStickerVariantSchema = z.enum([
  'white-on-dark',
  'dark-on-white',
  'frosted-glass',
  'brand-color',
]);

/**
 * Sealed phase enum. v1: 2 phases. `'pressing'` (tap-depress to 95 %
 * scale) and `'previewing'` (link-preview card) deferred to
 * T-371a-followup.
 */
const linkStickerPhaseSchema = z.enum(['idle', 'shimmering']);

const positionSchema = z
  .object({
    /** Absolute pixel x within the canvas (top-left of pill). */
    x: z.number(),
    /** Absolute pixel y within the canvas (top-left of pill). */
    y: z.number(),
  })
  .strict();

/**
 * Shimmer config. v1 sealed at light-sweep with closed-form linear
 * math.
 */
const shimmerSchema = z
  .object({
    /** Cycle period in frames. Default `ceil(fps * 3)` (3 s per stub line 36). */
    cycleFrames: z.number().int().positive().optional(),
    /** Width of the highlight band in pixels. Default 40. */
    bandWidth: z.number().positive().optional(),
    /** Highlight color hex. Default per-variant from `VARIANT_TOKENS`. */
    highlightColor: z.string().regex(HEX_COLOR_RE).optional(),
  })
  .strict();

export const linkStickerPropsSchema = z
  .object({
    /** Free-form label text. */
    label: z.string().min(1).max(80),
    /** Sealed variant — drives color / contrast defaults. */
    variant: linkStickerVariantSchema,
    /** Free-form pill position (top-left in canvas pixels). */
    position: positionSchema,
    /** Phase. v1 sealed at `'idle' | 'shimmering'`. Default `'shimmering'`. */
    phase: linkStickerPhaseSchema.optional(),
    /** Pill width in pixels. Default 200 (per stub line 23). */
    width: z.number().positive().min(80).max(600).optional(),
    /** Pill height in pixels. Default 44 (per stub line 23). */
    height: z.number().positive().min(28).max(96).optional(),
    /** Font size in pixels. Default 14 (lower bound of 14–16 per stub line 32). */
    fontSize: z.number().positive().min(10).max(24).optional(),
    /** Brand color hex (only meaningful when `variant === 'brand-color'`). */
    brandColor: z.string().regex(HEX_COLOR_RE).optional(),
    /** Shimmer config. */
    shimmer: shimmerSchema.optional(),
    /** Background color hex override. Default per-variant from token table. */
    background: z.string().regex(HEX_COLOR_RE).optional(),
    /** Text color hex override. Default per-variant from token table. */
    textColor: z.string().regex(HEX_COLOR_RE).optional(),
    /** Drop-shadow color hex override. Default per-variant from token table. */
    shadowColor: z.string().regex(HEX_COLOR_RE).optional(),
  })
  .strict();

export type LinkStickerProps = z.infer<typeof linkStickerPropsSchema>;
export type LinkStickerVariant = z.infer<typeof linkStickerVariantSchema>;
export type LinkStickerPhase = z.infer<typeof linkStickerPhaseSchema>;

// ─── constants ───────────────────────────────────────────────────────────

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 44;
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_BAND_WIDTH = 40;
const DEFAULT_BRAND_COLOR = '#E1306C'; // Instagram brand pink (default)

interface VariantTokens {
  readonly background: string;
  readonly textColor: string;
  readonly shadowColor: string;
  readonly shimmerHighlight: string;
}

/**
 * Per-variant default color tokens. Resolution order per slot (per
 * D-T371a-5): consumer-prop > theme-slot > variant-default. The
 * resolver in this file applies the consumer-prop / variant-default
 * branches; theme-slot resolution happens upstream in the runtime
 * dispatcher (`resolveClipDefaultsForTheme`) and arrives in the
 * component's props as the relevant prop value.
 */
const VARIANT_TOKENS: Record<LinkStickerVariant, VariantTokens> = {
  'white-on-dark': {
    background: '#000000',
    textColor: '#FFFFFF',
    shadowColor: '#000000',
    shimmerHighlight: '#FFFFFF',
  },
  'dark-on-white': {
    background: '#FFFFFF',
    textColor: '#000000',
    shadowColor: '#666666',
    shimmerHighlight: '#FFFFFF',
  },
  'frosted-glass': {
    // v1 fallback per D-T371a-blur deferral — `backdrop-filter: blur()`
    // is not deterministic across CDP versions. Sealed as opaque
    // `#CCCCCC` (a translucent-grey approximation of the white-alpha-
    // 0.4 frosted-glass canon).
    background: '#CCCCCC',
    textColor: '#000000',
    shadowColor: '#888888',
    shimmerHighlight: '#FFFFFF',
  },
  'brand-color': {
    background: DEFAULT_BRAND_COLOR,
    textColor: '#FFFFFF',
    shadowColor: '#000000',
    shimmerHighlight: '#FFFFFF',
  },
};

// ─── pure helpers — shimmer math ─────────────────────────────────────────

/**
 * Compute the integer-pixel x-offset of the shimmer highlight band at
 * `frame`, relative to the pill's left edge. Closed-form, deterministic
 * (per D-T371a-4):
 *
 *   shimmerX = round(((frame % cycleFrames) / cycleFrames)
 *              * (pillWidth + bandWidth) - bandWidth)
 *
 * At frame 0 → -bandWidth (band off-left). At frame cycleFrames/2 →
 * approximately pillWidth/2 - bandWidth/2 (band centered). At frame
 * cycleFrames → wraps back to -bandWidth. Pure function.
 */
export function computeShimmerX(
  frame: number,
  cycleFrames: number,
  pillWidth: number,
  bandWidth: number,
): number {
  if (cycleFrames <= 0) return -bandWidth;
  const phaseFrame = ((frame % cycleFrames) + cycleFrames) % cycleFrames;
  const phaseProgress = phaseFrame / cycleFrames;
  const travel = pillWidth + bandWidth;
  return Math.round(phaseProgress * travel - bandWidth);
}

// ─── pure helpers — variant token resolution ─────────────────────────────

interface ResolvedTokens {
  readonly background: string;
  readonly textColor: string;
  readonly shadowColor: string;
  readonly shimmerHighlight: string;
}

/**
 * Resolve per-variant color tokens. Consumer props win, then per-
 * variant defaults. Brand-color edge case (per AC #11): when
 * `variant === 'brand-color'` AND `brandColor` provided AND
 * `background` not provided, `background` resolves to `brandColor`.
 * When `background` provided, it always wins. Pure function.
 */
export function resolveTokens(props: LinkStickerProps): ResolvedTokens {
  const tokens = VARIANT_TOKENS[props.variant];
  // Background: consumer prop > brand-color override > variant default.
  let background: string;
  if (props.background !== undefined) {
    background = props.background;
  } else if (props.variant === 'brand-color' && props.brandColor !== undefined) {
    background = props.brandColor;
  } else {
    background = tokens.background;
  }
  const textColor = props.textColor ?? tokens.textColor;
  const shadowColor = props.shadowColor ?? tokens.shadowColor;
  const shimmerHighlight = props.shimmer?.highlightColor ?? tokens.shimmerHighlight;
  return { background, textColor, shadowColor, shimmerHighlight };
}

// ─── component ───────────────────────────────────────────────────────────

/**
 * `<LinkSticker>` — the public component. Renders a rounded-pill
 * Instagram-style link sticker free-form-positioned on the canvas with
 * a closed-form linear shimmer sweep across the label glyphs. Frame-
 * derived; v1 has 4 variants (color / contrast register) and 2 phases
 * (`'idle'` | `'shimmering'`, default `'shimmering'`). Always-present.
 */
export function LinkSticker(props: LinkStickerProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const width = props.width ?? DEFAULT_WIDTH;
  const height = props.height ?? DEFAULT_HEIGHT;
  const fontSize = props.fontSize ?? DEFAULT_FONT_SIZE;
  const phase: LinkStickerPhase = props.phase ?? 'shimmering';
  const cycleFrames = props.shimmer?.cycleFrames ?? Math.ceil(fps * 3);
  const bandWidth = props.shimmer?.bandWidth ?? DEFAULT_BAND_WIDTH;

  const { background, textColor, shadowColor, shimmerHighlight } = resolveTokens(props);

  const pillStyle: CSSProperties = {
    position: 'absolute',
    left: props.position.x,
    top: props.position.y,
    width,
    height,
    borderRadius: height / 2,
    background,
    boxShadow: `0 2px 4px ${shadowColor}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  const labelStyle: CSSProperties = {
    color: textColor,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  };

  let shimmerOverlay: ReactElement | null = null;
  if (phase === 'shimmering') {
    const shimmerX = computeShimmerX(frame, cycleFrames, width, bandWidth);
    const shimmerStyle: CSSProperties = {
      position: 'absolute',
      left: shimmerX,
      top: 0,
      width: bandWidth,
      height: '100%',
      background: `linear-gradient(90deg, transparent 0%, ${shimmerHighlight} 50%, transparent 100%)`,
      pointerEvents: 'none',
    };
    shimmerOverlay = (
      <div data-testid="link-sticker-shimmer" data-shimmer-x={shimmerX} style={shimmerStyle} />
    );
  }

  return (
    <div
      data-testid="link-sticker"
      data-variant={props.variant}
      data-phase={phase}
      data-background={background}
      data-text-color={textColor}
      data-shadow-color={shadowColor}
      style={pillStyle}
    >
      {shimmerOverlay}
      <span data-testid="link-sticker-label" style={labelStyle}>
        {props.label}
      </span>
    </div>
  );
}

/**
 * `linkStickerClip` clip definition — registered as
 * `kind: 'link-sticker'` in the frame-runtime bridge. Theme slots map
 * the prop names exposed by the schema to `ThemePalette` roles
 * (`background` / `foreground` / `accent` per the available
 * `themePaletteSchema` shape). Spec `surface` / `text` / `shadow` /
 * `shimmer` slots resolve onto the canonical palette roles
 * (`surface` is on the palette schema; the other three project onto
 * `background` / `foreground` / `accent` respectively per the sibling-
 * primitive convention). Inter Medium (OFL, T-307) registered as the
 * hard fallback font; the Instagram proprietary font is
 * `platform-byo` (consumer-wired via `runtime.fonts`).
 */
export const linkStickerClip: ClipDefinition<unknown> = defineFrameClip<LinkStickerProps>({
  kind: 'link-sticker',
  component: LinkSticker,
  propsSchema: linkStickerPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    textColor: { kind: 'palette', role: 'foreground' },
    shadowColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [{ family: 'Inter', weight: 500 }],
});
