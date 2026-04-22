// packages/runtimes/frame-runtime-bridge/src/clips/kinetic-text.tsx
// T-131b.1 port of reference/slidemotion/.../clips/kinetic-text.tsx.
// Stagger-fades each word in with a small upward translate.

import { cubicBezier, interpolate, useCurrentFrame } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const kineticTextPropsSchema = z
  .object({
    text: z.string().min(1),
    color: z.string().optional(),
    background: z.string().optional(),
    fontSize: z.number().positive().optional(),
  })
  .strict();

export type KineticTextProps = z.infer<typeof kineticTextPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);
const PER_WORD_DELAY = 4;
const FADE_FRAMES = 8;
const RISE_FRAMES = 10;
const RISE_DISTANCE_PX = 40;

export function KineticText({
  text,
  color = '#ebf1fa',
  background = '#0c1116',
  fontSize = 64,
}: KineticTextProps): ReactElement {
  const frame = useCurrentFrame();
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return (
    <div
      data-testid="kinetic-text-clip"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '0.3em',
        padding: '10%',
        backgroundColor: background,
      }}
    >
      {words.map((word, i) => {
        const delay = i * PER_WORD_DELAY;
        const opacity = interpolate(frame, [delay, delay + FADE_FRAMES], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_EXPO,
        });
        const y = interpolate(frame, [delay, delay + RISE_FRAMES], [RISE_DISTANCE_PX, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_EXPO,
        });
        return (
          <span
            // word + index keeps siblings stable across re-renders even when
            // the same word repeats; the renderer never reorders the input.
            key={`${i}-${word}`}
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize,
              fontWeight: 700,
              color,
              opacity,
              transform: `translateY(${y}px)`,
              display: 'inline-block',
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export const kineticTextClip: ClipDefinition<unknown> = defineFrameClip<KineticTextProps>({
  kind: 'kinetic-text',
  component: KineticText,
  propsSchema: kineticTextPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'foreground' },
    background: { kind: 'palette', role: 'background' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 700 }],
});
