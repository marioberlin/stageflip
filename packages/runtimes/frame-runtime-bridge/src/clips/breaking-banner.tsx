// packages/runtimes/frame-runtime-bridge/src/clips/breaking-banner.tsx
// T-324a — `breaking-banner` runtime-clip primitive: a single
// "BREAKING NEWS" register that serves both CNN-style horizontal
// slide-in banners (`mode: 'banner'`, default) and Fox-style
// persistent narrow slivers (`mode: 'sliver'`). `slideAxis: 'horizontal'`
// (default) mirrors `lower-third`'s X-axis slide; `slideAxis: 'vertical'`
// swaps the same math to translateY. Sliver mode skips the entrance
// animation per D-T324a-6 — the canonical Fox posture is a persistent
// register, not an entrance. Frame-derived; fully deterministic.
//
// Out of scope (deferred carve-outs per D-T324a-12): LIVE pulse bug
// (T-324b), red-block-wipe text-change between consecutive headlines
// (T-324c), Fox searchlight morph (T-327a), return-from-commercial
// multi-stage sequence (T-327b). Ticker strip composes externally
// via the existing `news-ticker-bar` primitive.

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

/**
 * Zod schema for `BreakingBanner` props (D-T324a-4).
 *
 * All optional except `headline` and `label`. Strict — extras rejected.
 * `mode: 'banner'` (default) renders a full-width strip; `'sliver'` a
 * partial-width persistent register. `slideAxis` dispatches the
 * entrance translate axis (banner mode only — sliver skips entrance).
 */
export const breakingBannerPropsSchema = z
  .object({
    mode: z.enum(['banner', 'sliver']).optional(),
    headline: z.string(),
    label: z
      .object({
        text: z.string(),
        fill: z.string(),
        color: z.string(),
      })
      .strict(),
    background: z.string().optional(),
    headlineColor: z.string().optional(),
    endCap: z
      .object({
        fill: z.string(),
        position: z.enum(['left', 'right']),
      })
      .strict()
      .optional(),
    slideAxis: z.enum(['horizontal', 'vertical']).optional(),
    insetBottomPx: z.number().nonnegative().optional(),
    sliverAnchor: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
    sliverWidthPct: z.number().min(0.1).max(0.6).optional(),
    borderRadius: z.number().nonnegative().optional(),
    font: z
      .object({
        family: z.string(),
        weight: z.number().optional(),
      })
      .strict()
      .optional(),
    casing: z.enum(['as-is', 'uppercase', 'lowercase', 'title-case']).optional(),
  })
  .strict();

export type BreakingBannerProps = z.infer<typeof breakingBannerPropsSchema>;

const EASE_OUT_QUART = cubicBezier(0.25, 1, 0.5, 1);
const EASE_IN_QUART = cubicBezier(0.5, 0, 0.75, 0);

const DEFAULT_BACKGROUND = '#080f15';
const DEFAULT_HEADLINE_COLOR = '#f5f7fa';
const DEFAULT_FONT_FAMILY = 'Plus Jakarta Sans, sans-serif';
const DEFAULT_FONT_WEIGHT = 800;
const DEFAULT_INSET_BOTTOM_PX = 80;
const DEFAULT_SLIVER_WIDTH_PCT = 0.3;
const BANNER_HEIGHT_PX = 96;
const SLIVER_HEIGHT_PX = 64;

function applyCasing(text: string, casing: BreakingBannerProps['casing']): string {
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

function sliverAnchorStyle(
  anchor: NonNullable<BreakingBannerProps['sliverAnchor']>,
): CSSProperties {
  switch (anchor) {
    case 'top-left':
      return { top: 0, left: 0 };
    case 'top-right':
      return { top: 0, right: 0 };
    case 'bottom-left':
      return { bottom: 0, left: 0 };
    case 'bottom-right':
      return { bottom: 0, right: 0 };
  }
}

/**
 * Render a "breaking news" register: full-width banner (CNN-style) or
 * partial-width persistent sliver (Fox-style). Banner mode plays an
 * entrance slide along `slideAxis` and a mirrored exit. Sliver mode
 * renders steady-state at full opacity from frame 0 (no entrance
 * animation) — the canonical Fox posture per D-T324a-6.
 */
export function BreakingBanner({
  mode = 'banner',
  headline,
  label,
  background = DEFAULT_BACKGROUND,
  headlineColor = DEFAULT_HEADLINE_COLOR,
  endCap,
  slideAxis = 'horizontal',
  insetBottomPx = DEFAULT_INSET_BOTTOM_PX,
  sliverAnchor = 'top-left',
  sliverWidthPct = DEFAULT_SLIVER_WIDTH_PCT,
  borderRadius = 0,
  font,
  casing = 'as-is',
}: BreakingBannerProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();

  const fontFamily = font?.family ?? DEFAULT_FONT_FAMILY;
  const fontWeight = font?.weight ?? DEFAULT_FONT_WEIGHT;

  const enterEnd = Math.ceil(fps * 0.45);
  const exitStart = Math.max(enterEnd + 1, durationInFrames - Math.ceil(fps * 0.35));

  const isSliver = mode === 'sliver';

  // Banner-mode slide math; sliver mode forces steady-state.
  const enterPct = isSliver
    ? 0
    : interpolate(frame, [0, enterEnd], [slideAxis === 'horizontal' ? -100 : 100, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: EASE_OUT_QUART,
      });
  const exitPct = isSliver
    ? 0
    : interpolate(frame, [exitStart, durationInFrames], [0, 120], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: EASE_IN_QUART,
      });
  const translatePct = enterPct + exitPct;
  const opacity = isSliver
    ? 1
    : frame < enterEnd
      ? interpolate(frame, [0, enterEnd], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_QUART,
        })
      : interpolate(frame, [exitStart, durationInFrames], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_IN_QUART,
        });

  const transform =
    slideAxis === 'horizontal' ? `translateX(${translatePct}%)` : `translateY(${translatePct}%)`;

  const containerStyle: CSSProperties = isSliver
    ? {
        position: 'absolute',
        ...sliverAnchorStyle(sliverAnchor),
        width: Math.round(width * sliverWidthPct),
        height: SLIVER_HEIGHT_PX,
        background,
        borderRadius,
        transform,
        opacity,
        display: 'flex',
        alignItems: 'stretch',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.32)',
      }
    : {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insetBottomPx,
        height: BANNER_HEIGHT_PX,
        background,
        borderRadius,
        transform,
        opacity,
        display: 'flex',
        alignItems: 'stretch',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
      };

  const labelStyle: CSSProperties = {
    background: label.fill,
    color: label.color,
    fontFamily,
    fontWeight,
    fontSize: isSliver ? 18 : 26,
    letterSpacing: '0.04em',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: isSliver ? 16 : 24,
    paddingRight: isSliver ? 16 : 24,
    whiteSpace: 'nowrap',
  };

  const headlineStyle: CSSProperties = {
    flex: 1,
    color: headlineColor,
    fontFamily,
    fontWeight,
    fontSize: isSliver ? 18 : 30,
    letterSpacing: '-0.01em',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const endCapStyle: CSSProperties | undefined = endCap
    ? {
        width: isSliver ? 8 : 12,
        background: endCap.fill,
        flexShrink: 0,
      }
    : undefined;

  const headlineText = applyCasing(headline, casing);
  const renderLeftEndCap = endCap !== undefined && endCap.position === 'left';
  const renderRightEndCap = endCap !== undefined && endCap.position === 'right';

  return (
    <div data-testid="breaking-banner-clip" style={containerStyle}>
      {renderLeftEndCap && endCapStyle ? (
        <span data-testid="breaking-banner-end-cap" style={endCapStyle} />
      ) : null}
      <span data-testid="breaking-banner-label" style={labelStyle}>
        {label.text}
      </span>
      <span data-testid="breaking-banner-headline" style={headlineStyle}>
        {headlineText}
      </span>
      {renderRightEndCap && endCapStyle ? (
        <span data-testid="breaking-banner-end-cap" style={endCapStyle} />
      ) : null}
    </div>
  );
}

export const breakingBannerClip: ClipDefinition<unknown> = defineFrameClip<BreakingBannerProps>({
  kind: 'breaking-banner',
  component: BreakingBanner,
  propsSchema: breakingBannerPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    headlineColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 800 }],
});
