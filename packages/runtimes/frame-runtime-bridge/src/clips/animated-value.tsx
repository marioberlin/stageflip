// packages/runtimes/frame-runtime-bridge/src/clips/animated-value.tsx
// T-131b.3 port of reference/slidemotion/.../clips/animated-value.tsx.
// Reusable count-up primitive + progress bar + ring, used both as standalone
// clips and as building blocks for kpi-grid (T-131b.3) and future dashboard
// clips.

import {
  cubicBezier,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

export const animatedValuePropsSchema = z
  .object({
    value: z.number(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    decimals: z.number().int().nonnegative().optional(),
    delay: z.number().int().nonnegative().optional(),
    useSpring: z.boolean().optional(),
    fontSize: z.number().positive().optional(),
    fontWeight: z.number().int().optional(),
    color: z.string().optional(),
  })
  .strict();

export type AnimatedValueProps = z.infer<typeof animatedValuePropsSchema> & {
  /** Additional CSS properties — escape hatch for composition consumers. */
  style?: CSSProperties;
};

export function AnimatedValue({
  value: target,
  prefix = '',
  suffix = '',
  decimals = 0,
  delay = 0,
  useSpring: useSpringAnim = true,
  fontSize,
  fontWeight = 700,
  color,
  style,
}: AnimatedValueProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  let progress: number;
  if (useSpringAnim) {
    const adjustedFrame = Math.max(0, frame - delay);
    progress = spring({
      fps,
      frame: adjustedFrame,
      damping: 15,
      mass: 0.8,
      stiffness: 120,
    });
  } else {
    const start = delay;
    const end = Math.max(delay + 1, durationInFrames - 10);
    progress = interpolate(frame, [start, end], [0, 1], {
      extrapolateRight: 'clamp',
      extrapolateLeft: 'clamp',
      easing: EASE_OUT_EXPO,
    });
  }

  const current = target * progress;
  // Locale-formatted output preserved from reference. Tests compare against
  // stripped-digit form to tolerate locale drift on CI runners.
  const formatted = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString();

  return (
    <span
      data-testid="animated-value"
      style={{
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        fontSize,
        fontWeight,
        color,
        ...style,
      }}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export const animatedValueClip: ClipDefinition<unknown> = defineFrameClip<AnimatedValueProps>({
  kind: 'animated-value',
  component: AnimatedValue,
  propsSchema: animatedValuePropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'foreground' },
  },
  // Read weight from props so the FontManager (T-072) preloads the exact
  // face the render will use — e.g. kpi-grid renders these at weight 800.
  fontRequirements: (props) => [{ family: 'Plus Jakarta Sans', weight: props.fontWeight ?? 700 }],
});

// ---------------------------------------------------------------------------
// Progress-bar + ring — non-clip primitives kept as named exports so the
// composing clips (kpi-grid now, future dashboard clips later) can reuse
// them. Not registered as standalone ClipDefinitions.
// ---------------------------------------------------------------------------

export interface AnimatedProgressBarProps {
  progress: number;
  color?: string;
  background?: string;
  height?: number;
  delay?: number;
  borderRadius?: number;
}

export function AnimatedProgressBar({
  progress: targetProgress,
  color = '#81aeff',
  background = 'rgba(129,174,255,0.15)',
  height = 8,
  delay = 0,
  borderRadius = 4,
}: AnimatedProgressBarProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);
  const s = spring({
    fps,
    frame: adjustedFrame,
    damping: 18,
    mass: 1,
    stiffness: 100,
  });
  const currentWidth = targetProgress * s;
  return (
    <div
      data-testid="animated-progress-bar"
      style={{
        width: '100%',
        height,
        backgroundColor: background,
        borderRadius,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${currentWidth}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius,
          transition: 'none',
        }}
      />
    </div>
  );
}

export interface AnimatedProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  background?: string;
  delay?: number;
  children?: ReactNode;
}

export function AnimatedProgressRing({
  progress: targetProgress,
  size = 80,
  strokeWidth = 6,
  color = '#81aeff',
  background = 'rgba(129,174,255,0.15)',
  delay = 0,
  children,
}: AnimatedProgressRingProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);
  const s = spring({
    fps,
    frame: adjustedFrame,
    damping: 15,
    mass: 1,
    stiffness: 80,
  });
  const currentProgress = targetProgress * s;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - currentProgress / 100);
  return (
    <div
      data-testid="animated-progress-ring"
      style={{ position: 'relative', width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
        role="img"
        aria-label="progress ring"
      >
        <title>Progress ring</title>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={background}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {children !== undefined && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
