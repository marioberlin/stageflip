// packages/runtimes/frame-runtime-bridge/src/clips/var-banner.tsx
// T-320 — `var-banner` runtime-clip primitive: sports VAR / refereeing-
// decision overlay (two-stage entrance — "VAR CHECK" pending register
// with animated dot-loader, then horizontal slide-in of the decision
// label coloured by the auto-derived register for the chosen
// `decision` enum value). Frame-derived; fully deterministic.
//
// Cluster B sports breaking sub-type per T-320 (M, doc row 612).
// Unblocks Cluster B sports presets needing the VAR sub-type.

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
 * Sealed enum of VAR / refereeing-decision outcomes. Each value drives
 * an auto-derived register colour + a canonical decision-label string;
 * callers may override the colour via `accentColor` but the label is
 * canon-bound per outcome.
 */
const VAR_DECISIONS = ['goal-confirmed', 'goal-disallowed', 'penalty-awarded', 'no-foul'] as const;

/**
 * Zod schema for `VarBanner` props.
 *
 * Required: `decision`, `competition`. All other props optional. Strict —
 * extras rejected.
 */
export const varBannerPropsSchema = z
  .object({
    decision: z.enum(VAR_DECISIONS),
    competition: z.string(),
    pendingDurationFrames: z.number().int().positive().optional(),
    accentColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    slideDirection: z.enum(['left-to-right', 'right-to-left']).optional(),
    insetBottomPx: z.number().nonnegative().optional(),
  })
  .strict();

export type VarBannerProps = z.infer<typeof varBannerPropsSchema>;

const EASE_OUT_QUART = cubicBezier(0.25, 1, 0.5, 1);
const DECISION_SLIDE_EASE = cubicBezier(0.4, 0, 0.2, 1);

const DEFAULT_PENDING_DURATION_FRAMES = 30;
const DEFAULT_BACKGROUND = '#0a0a0a';
const PENDING_BACKGROUND = '#1a1a1a';
const DEFAULT_INSET_BOTTOM_PX = 80;
const DEFAULT_FONT_FAMILY = 'Plus Jakarta Sans, sans-serif';
const BANNER_HEIGHT_PX = 96;
const FOREGROUND_COLOR = '#f5f7fa';

const DECISION_ACCENT: Record<(typeof VAR_DECISIONS)[number], string> = {
  'goal-confirmed': '#00a85a',
  'goal-disallowed': '#e53e3e',
  'penalty-awarded': '#f59e0b',
  'no-foul': '#737373',
};

const DECISION_LABEL: Record<(typeof VAR_DECISIONS)[number], string> = {
  'goal-confirmed': 'GOAL CONFIRMED',
  'goal-disallowed': 'NO GOAL',
  'penalty-awarded': 'PENALTY AWARDED',
  'no-foul': 'NO FOUL',
};

/**
 * Render a VAR (Video Assistant Referee) decision banner. Two-stage
 * register:
 *   1. Pending stage (frames 0..pendingDurationFrames-1): centred
 *      "VAR CHECK" label + 3-dot animated loader on a muted dark
 *      backdrop.
 *   2. Decision stage (frames pendingDurationFrames..end): banner
 *      switches to the decision register (auto-derived accent colour
 *      per `decision`), decision label fades + slides in horizontally
 *      from the leading edge (per `slideDirection`).
 *
 * Fully frame-derived. No `Date`/`Math.random`/`setTimeout`/`fetch`/RAF.
 */
export function VarBanner({
  decision,
  competition,
  pendingDurationFrames = DEFAULT_PENDING_DURATION_FRAMES,
  accentColor,
  backgroundColor = DEFAULT_BACKGROUND,
  slideDirection = 'left-to-right',
  insetBottomPx = DEFAULT_INSET_BOTTOM_PX,
}: VarBannerProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isPending = frame < pendingDurationFrames;
  const accent = accentColor ?? DECISION_ACCENT[decision];
  const decisionLabel = DECISION_LABEL[decision];

  // Decision-stage slide-in: 0..~0.4s after the pending boundary.
  const decisionEnterFrames = Math.max(1, Math.ceil(fps * 0.4));
  const decisionLocalFrame = frame - pendingDurationFrames;
  const fromPct = slideDirection === 'left-to-right' ? -100 : 100;
  const slidePct = isPending
    ? fromPct
    : interpolate(decisionLocalFrame, [0, decisionEnterFrames], [fromPct, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: DECISION_SLIDE_EASE,
      });
  const decisionOpacity = isPending
    ? 0
    : interpolate(decisionLocalFrame, [0, decisionEnterFrames], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: DECISION_SLIDE_EASE,
      });

  // Pending dot-loader: each dot pulses on its own 0.45s cycle staggered
  // by 0.15s. Closed-form on `frame` — no setTimeout / RAF.
  const cycleFrames = Math.max(1, Math.ceil(fps * 0.45));
  const staggerFrames = Math.max(1, Math.ceil(fps * 0.15));
  const dotOpacity = (index: number): number => {
    const local = (frame - index * staggerFrames + cycleFrames * 10) % cycleFrames;
    const half = cycleFrames / 2;
    return local < half
      ? interpolate(local, [0, half], [0.3, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_QUART,
        })
      : interpolate(local, [half, cycleFrames], [1, 0.3], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_QUART,
        });
  };

  const stageBackground = isPending ? PENDING_BACKGROUND : backgroundColor;

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: insetBottomPx,
    height: BANNER_HEIGHT_PX,
    background: stageBackground,
    display: 'flex',
    alignItems: 'stretch',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
  };

  const accentBarStyle: CSSProperties = {
    width: 12,
    background: accent,
    flexShrink: 0,
    opacity: isPending ? 0 : 1,
  };

  const competitionStyle: CSSProperties = {
    color: FOREGROUND_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: 600,
    fontSize: 16,
    letterSpacing: '0.06em',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 24,
    whiteSpace: 'nowrap',
  };

  const pendingLabelStyle: CSSProperties = {
    color: FOREGROUND_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: 800,
    fontSize: 28,
    letterSpacing: '0.08em',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  };

  const decisionLabelStyle: CSSProperties = {
    flex: 1,
    color: FOREGROUND_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: 800,
    fontSize: 30,
    letterSpacing: '0.04em',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transform: `translateX(${slidePct}%)`,
    opacity: decisionOpacity,
  };

  const dotStyle = (index: number): CSSProperties => ({
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: FOREGROUND_COLOR,
    opacity: dotOpacity(index),
  });

  return (
    <div data-testid="var-banner-clip" style={containerStyle}>
      <span data-testid="var-banner-accent-bar" style={accentBarStyle} />
      <span data-testid="var-banner-competition" style={competitionStyle}>
        {competition}
      </span>
      {isPending ? (
        <span data-testid="var-banner-pending" style={pendingLabelStyle}>
          <span>VAR CHECK</span>
          <span data-testid="var-banner-dots" aria-hidden>
            <span style={dotStyle(0)} />
            <span style={{ ...dotStyle(1), marginLeft: 6 }} />
            <span style={{ ...dotStyle(2), marginLeft: 6 }} />
          </span>
        </span>
      ) : (
        <span data-testid="var-banner-decision" style={decisionLabelStyle}>
          {decisionLabel}
        </span>
      )}
    </div>
  );
}

export const varBannerClip: ClipDefinition<unknown> = defineFrameClip<VarBannerProps>({
  kind: 'var-banner',
  component: VarBanner,
  propsSchema: varBannerPropsSchema,
  themeSlots: {
    backgroundColor: { kind: 'palette', role: 'background' },
    accentColor: { kind: 'palette', role: 'accent' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 800 }],
});
