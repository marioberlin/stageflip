// packages/runtimes/frame-runtime-bridge/src/clips/counter.tsx
// T-131b.1 port of reference/slidemotion/.../clips/counter.tsx.
// Animates from 0 to `target` over (duration - 10f) with ease-out-expo.

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

export const counterPropsSchema = z
  .object({
    target: z.number(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    color: z.string().optional(),
    background: z.string().optional(),
    fontSize: z.number().positive().optional(),
  })
  .strict();

export type CounterProps = z.infer<typeof counterPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

export function Counter({
  target,
  prefix = '',
  suffix = '',
  color = '#0072e5',
  background = '#0c1116',
  fontSize = 96,
}: CounterProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const endFrame = Math.max(1, durationInFrames - 10);
  const value = Math.round(
    interpolate(frame, [0, endFrame], [0, target], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASE_OUT_EXPO,
    }),
  );
  return (
    <div
      data-testid="counter-clip"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background,
      }}
    >
      <span
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize,
          fontWeight: 800,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {prefix}
        {value.toLocaleString()}
        {suffix}
      </span>
    </div>
  );
}

export const counterClip: ClipDefinition<unknown> = defineFrameClip<CounterProps>({
  kind: 'counter',
  component: Counter,
  propsSchema: counterPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'primary' },
    background: { kind: 'palette', role: 'background' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 800 }],
});
