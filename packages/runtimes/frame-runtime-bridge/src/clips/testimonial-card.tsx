// packages/runtimes/frame-runtime-bridge/src/clips/testimonial-card.tsx
// T-183 — "testimonial-card" video-profile clip. A centered quote card
// with attribution (name + role), subtle entrance + exit. Used for
// customer testimonials and pull-quotes in social-video ads.

import {
  cubicBezier,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const testimonialCardPropsSchema = z
  .object({
    quote: z.string(),
    attributionName: z.string(),
    attributionRole: z.string().optional(),
    /** Card surface color. Defaults to theme palette.surface. */
    surface: z.string().optional(),
    /** Accent bar + role color. Defaults to theme palette.accent. */
    accent: z.string().optional(),
    /** Quote body color. Defaults to theme palette.foreground. */
    textColor: z.string().optional(),
    /** Maximum card width in px. Default 960. */
    maxWidthPx: z.number().positive().optional(),
  })
  .strict();

export type TestimonialCardProps = z.infer<typeof testimonialCardPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);
const EASE_IN_EXPO = cubicBezier(0.7, 0, 0.84, 0);

export function TestimonialCard({
  quote,
  attributionName,
  attributionRole,
  surface = '#111821',
  accent = '#5af8fb',
  textColor = '#f5f7fa',
  maxWidthPx = 960,
}: TestimonialCardProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enterEnd = Math.ceil(fps * 0.6);
  const exitStart = Math.max(enterEnd + 1, durationInFrames - Math.ceil(fps * 0.4));

  const enterOpacity = interpolate(frame, [0, enterEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const exitOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_IN_EXPO,
  });
  const opacity = frame < exitStart ? enterOpacity : exitOpacity;

  const enterY = interpolate(frame, [0, enterEnd], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });

  return (
    <div
      data-testid="testimonial-card-clip"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: maxWidthPx,
          background: surface,
          padding: '56px 64px',
          borderRadius: 16,
          borderLeft: `6px solid ${accent}`,
          transform: `translateY(${enterY}px)`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
        }}
      >
        <div
          data-testid="testimonial-card-quote"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 500,
            fontSize: 44,
            color: textColor,
            lineHeight: 1.25,
            letterSpacing: '-0.015em',
          }}
        >
          &ldquo;{quote}&rdquo;
        </div>
        <div
          style={{
            marginTop: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            data-testid="testimonial-card-name"
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 700,
              fontSize: 22,
              color: textColor,
              letterSpacing: '-0.01em',
            }}
          >
            {attributionName}
          </div>
          {attributionRole !== undefined && attributionRole.length > 0 ? (
            <div
              data-testid="testimonial-card-role"
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 500,
                fontSize: 18,
                color: accent,
                letterSpacing: '0.02em',
              }}
            >
              {attributionRole}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const testimonialCardClip: ClipDefinition<unknown> = defineFrameClip<TestimonialCardProps>({
  kind: 'testimonial-card',
  component: TestimonialCard,
  propsSchema: testimonialCardPropsSchema,
  themeSlots: {
    surface: { kind: 'palette', role: 'surface' },
    accent: { kind: 'palette', role: 'accent' },
    textColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 500 },
    { family: 'Plus Jakarta Sans', weight: 700 },
  ],
});
