// packages/runtimes/frame-runtime-bridge/src/clips/typewriter-clip.tsx
// T-131b.1 port of reference/slidemotion/.../clips/typewriter-clip.tsx.
// Reveals characters one by one and blinks a primary-coloured caret.

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const typewriterClipPropsSchema = z
  .object({
    text: z.string(),
    color: z.string().optional(),
    caretColor: z.string().optional(),
    background: z.string().optional(),
    fontSize: z.number().positive().optional(),
  })
  .strict();

export type TypewriterClipProps = z.infer<typeof typewriterClipPropsSchema>;

const CARET_PERIOD_FRAMES = 16;
const CARET_ON_FRAMES = 10;
const TAIL_HOLD_FRAMES = 15;

export function TypewriterClip({
  text,
  color = '#ebf1fa',
  caretColor = '#0072e5',
  background = '#0c1116',
  fontSize = 48,
}: TypewriterClipProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const endFrame = Math.max(1, durationInFrames - TAIL_HOLD_FRAMES);
  const charsToShow = Math.floor(
    interpolate(frame, [0, endFrame], [0, text.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const showCaret = frame % CARET_PERIOD_FRAMES < CARET_ON_FRAMES;
  return (
    <div
      data-testid="typewriter-clip"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10%',
        backgroundColor: background,
      }}
    >
      <span
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize,
          fontWeight: 500,
          color,
        }}
      >
        {text.slice(0, charsToShow)}
        <span
          data-testid="typewriter-caret"
          style={{ opacity: showCaret ? 1 : 0, color: caretColor }}
        >
          |
        </span>
      </span>
    </div>
  );
}

export const typewriterClip: ClipDefinition<unknown> = defineFrameClip<TypewriterClipProps>({
  kind: 'typewriter',
  component: TypewriterClip,
  propsSchema: typewriterClipPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'foreground' },
    caretColor: { kind: 'palette', role: 'primary' },
    background: { kind: 'palette', role: 'background' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 500 }],
});
