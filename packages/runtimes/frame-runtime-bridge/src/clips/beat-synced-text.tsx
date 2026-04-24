// packages/runtimes/frame-runtime-bridge/src/clips/beat-synced-text.tsx
// T-183b — "beat-synced-text" video-profile clip. Cycles through a list
// of short phrases, switching on each beat, and pulses a scale bump on
// every beat. Beats are declared in frames (the host converts from
// audio-aligned ms via fps × beatMs/1000). Determinism: beat timing
// comes from props; no Date.now, no audio-driven RNG.

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

export const beatSyncedTextPropsSchema = z
  .object({
    phrases: z.array(z.string().min(1)).min(1),
    /**
     * Beat frames in ascending order. The clip swaps to phrases[i % phrases.length]
     * at beat i. An implicit beat at frame 0 is always added.
     */
    beatFrames: z.array(z.number().int().nonnegative()).min(1),
    /** Text color. Defaults to theme palette.foreground. */
    color: z.string().optional(),
    /** Pulse color tint applied at each beat peak. Defaults to theme palette.accent. */
    pulseColor: z.string().optional(),
    /** Background color. Defaults to theme palette.background. */
    background: z.string().optional(),
    /** Font size in px. Default 140. */
    fontSize: z.number().positive().optional(),
    /** Pulse decay duration in frames after each beat. Default 8. */
    pulseDecayFrames: z.number().int().positive().optional(),
  })
  .strict();

export type BeatSyncedTextProps = z.infer<typeof beatSyncedTextPropsSchema>;

const EASE_OUT_QUART = cubicBezier(0.25, 1, 0.5, 1);

/** Which beat index is the most recent at or before `frame`. `-1` if none. */
export function currentBeatIndex(frame: number, beatFrames: readonly number[]): number {
  let lo = 0;
  let hi = beatFrames.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const f = beatFrames[mid];
    if (f === undefined) break;
    if (f <= frame) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export function BeatSyncedText({
  phrases,
  beatFrames,
  color = '#f5f7fa',
  pulseColor = '#5af8fb',
  background = '#080f15',
  fontSize = 140,
  pulseDecayFrames = 8,
}: BeatSyncedTextProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps: _fps } = useVideoConfig();
  // Insert an implicit beat at frame 0 so the clip renders from the start.
  const normalised = beatFrames[0] === 0 ? beatFrames : [0, ...beatFrames];
  const beatIndex = Math.max(0, currentBeatIndex(frame, normalised));
  const beatFrame = normalised[beatIndex] ?? 0;
  const sinceBeat = frame - beatFrame;

  const phrase = phrases[beatIndex % phrases.length] ?? '';

  const pulseProgress = interpolate(sinceBeat, [0, pulseDecayFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_QUART,
  });
  const scale = 1 + pulseProgress * 0.08;
  const tintAlpha = pulseProgress * 0.75;

  return (
    <div
      data-testid="beat-synced-text-clip"
      data-beat-index={beatIndex}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background,
      }}
    >
      <span
        data-testid="beat-synced-text-phrase"
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 900,
          fontSize,
          color,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          transform: `scale(${scale})`,
          textShadow: `0 0 ${Math.round(pulseProgress * 32)}px ${pulseColor}${Math.round(
            tintAlpha * 255,
          )
            .toString(16)
            .padStart(2, '0')}`,
        }}
      >
        {phrase}
      </span>
    </div>
  );
}

export const beatSyncedTextClip: ClipDefinition<unknown> = defineFrameClip<BeatSyncedTextProps>({
  kind: 'beat-synced-text',
  component: BeatSyncedText,
  propsSchema: beatSyncedTextPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'foreground' },
    pulseColor: { kind: 'palette', role: 'accent' },
    background: { kind: 'palette', role: 'background' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 900 }],
});
