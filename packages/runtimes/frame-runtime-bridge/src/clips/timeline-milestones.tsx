// packages/runtimes/frame-runtime-bridge/src/clips/timeline-milestones.tsx
// T-131f.1 port of reference/slidemotion/.../clips/timeline-milestones.tsx.
// Horizontal axis with a sweeping progress dot + per-milestone "pop" via
// spring; labels alternate above / below the axis for readability.

import {
  cubicBezier,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

const milestoneSchema = z
  .object({
    date: z.string(),
    title: z.string(),
    description: z.string().optional(),
  })
  .strict();

export const timelineMilestonesPropsSchema = z
  .object({
    milestones: z.array(milestoneSchema).min(1),
    title: z.string().optional(),
    axisColor: z.string().optional(),
    accentColor: z.string().optional(),
    bioColor: z.string().optional(),
    textColor: z.string().optional(),
    background: z.string().optional(),
  })
  .strict();

export type TimelineMilestonesProps = z.infer<typeof timelineMilestonesPropsSchema>;

const AXIS_START_PCT = 8;
const AXIS_END_PCT = 92;
const AXIS_SPAN_PCT = AXIS_END_PCT - AXIS_START_PCT;

export function TimelineMilestones({
  milestones,
  title,
  axisColor = 'rgba(26,26,46,0.15)',
  accentColor = '#0072e5',
  bioColor = '#5af8fb',
  textColor = '#1a1a2e',
  background = '#ffffff',
}: TimelineMilestonesProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const count = Math.max(milestones.length, 1);
  const sweepEnd = Math.max(30, durationInFrames - 15);
  const sweepProgress = interpolate(frame, [10, sweepEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });

  const titleOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const reachThreshold = (i: number) => (count === 1 ? 0.5 : i / (count - 1));
  const progressedDotLeft = AXIS_START_PCT + AXIS_SPAN_PCT * sweepProgress;

  return (
    <div
      data-testid="timeline-milestones-clip"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: background,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        position: 'relative',
        padding: 80,
        boxSizing: 'border-box',
      }}
    >
      {title !== undefined && title.length > 0 && (
        <div
          data-testid="timeline-milestones-title"
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: textColor,
            letterSpacing: '-0.01em',
            opacity: titleOpacity,
            marginBottom: 48,
          }}
        >
          {title}
        </div>
      )}

      <div
        style={{
          position: 'relative',
          width: '100%',
          height: title !== undefined && title.length > 0 ? 'calc(100% - 120px)' : '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          data-testid="timeline-milestones-axis-track"
          style={{
            position: 'absolute',
            top: '50%',
            left: `${AXIS_START_PCT}%`,
            width: `${AXIS_SPAN_PCT}%`,
            height: 4,
            backgroundColor: axisColor,
            borderRadius: 2,
            transform: 'translateY(-50%)',
          }}
        />

        <div
          data-testid="timeline-milestones-axis-fill"
          style={{
            position: 'absolute',
            top: '50%',
            left: `${AXIS_START_PCT}%`,
            width: `${AXIS_SPAN_PCT * sweepProgress}%`,
            height: 4,
            background: `linear-gradient(90deg, ${accentColor}, ${bioColor})`,
            borderRadius: 2,
            transform: 'translateY(-50%)',
            boxShadow: `0 0 12px ${bioColor}55`,
          }}
        />

        <div
          data-testid="timeline-milestones-sweep-dot"
          style={{
            position: 'absolute',
            top: '50%',
            left: `${progressedDotLeft}%`,
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: bioColor,
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 18px ${bioColor}, 0 0 6px ${bioColor}`,
          }}
        />

        {milestones.map((m, i) => {
          const leftPct = count === 1 ? 50 : AXIS_START_PCT + AXIS_SPAN_PCT * (i / (count - 1));
          const reached = sweepProgress >= reachThreshold(i);

          const reachFrame = 10 + (sweepEnd - 10) * reachThreshold(i);
          const popSpring = spring({
            fps,
            frame: Math.max(0, frame - reachFrame),
            damping: 12,
            mass: 0.8,
            stiffness: 200,
          });
          const popScale = 0.3 + 0.7 * popSpring;

          const labelOpacity = interpolate(frame, [reachFrame - 4, reachFrame + 10], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const dotColor = reached ? bioColor : axisColor;
          const dotRing = reached ? accentColor : 'rgba(26,26,46,0.2)';
          const above = i % 2 === 0;
          const labelBlock = (
            <>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  color: accentColor,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                {m.date}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: textColor,
                  lineHeight: 1.3,
                  marginBottom: m.description !== undefined ? 4 : 0,
                }}
              >
                {m.title}
              </div>
              {m.description !== undefined && m.description.length > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'rgba(26,26,46,0.65)',
                    lineHeight: 1.4,
                  }}
                >
                  {m.description}
                </div>
              )}
            </>
          );

          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: positional milestone — slot i is the same milestone across renders.
              key={i}
              data-testid={`timeline-milestone-${i}`}
              style={{
                position: 'absolute',
                top: '50%',
                left: `${leftPct}%`,
                transform: 'translate(-50%, -50%)',
                width: 180,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {above && (
                <div
                  data-testid={`timeline-milestone-${i}-label`}
                  style={{
                    position: 'absolute',
                    bottom: 32,
                    width: '100%',
                    textAlign: 'center',
                    opacity: labelOpacity,
                  }}
                >
                  {labelBlock}
                </div>
              )}

              <div
                data-testid={`timeline-milestone-${i}-dot`}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: dotColor,
                  border: `3px solid ${dotRing}`,
                  transform: `scale(${popScale})`,
                  boxShadow: reached ? `0 0 14px ${bioColor}99` : 'none',
                  transition: 'none',
                }}
              />

              {!above && (
                <div
                  data-testid={`timeline-milestone-${i}-label`}
                  style={{
                    position: 'absolute',
                    top: 32,
                    width: '100%',
                    textAlign: 'center',
                    opacity: labelOpacity,
                  }}
                >
                  {labelBlock}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const timelineMilestonesClip: ClipDefinition<unknown> =
  defineFrameClip<TimelineMilestonesProps>({
    kind: 'timeline-milestones',
    component: TimelineMilestones,
    propsSchema: timelineMilestonesPropsSchema,
    themeSlots: {
      accentColor: { kind: 'palette', role: 'primary' },
      bioColor: { kind: 'palette', role: 'accent' },
      textColor: { kind: 'palette', role: 'foreground' },
      background: { kind: 'palette', role: 'surface' },
    },
    fontRequirements: () => [
      { family: 'Plus Jakarta Sans', weight: 400 },
      { family: 'Plus Jakarta Sans', weight: 600 },
      { family: 'Plus Jakarta Sans', weight: 700 },
    ],
  });
