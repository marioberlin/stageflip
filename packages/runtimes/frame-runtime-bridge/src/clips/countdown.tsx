// packages/runtimes/frame-runtime-bridge/src/clips/countdown.tsx
// T-202 — "countdown" display-profile clip. Renders a deadline timer that
// counts down from `startFromSeconds` to 00:00 across the clip's window.
//
// Determinism: seconds remaining = max(0, startFromSeconds - frame/fps).
// Every numeric derives from `useCurrentFrame` + `useVideoConfig`. No
// wall-clock time — the countdown is composition-relative. Export-time
// baking substitutes real timestamps at the surface where the banner is
// served; the clip itself only ever sees frame-indexed time.

import { useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const countdownPropsSchema = z
  .object({
    /**
     * Number of seconds to count down from at frame 0. Choose values that
     * fit the clip window (e.g. 15 for a 15s banner; 3600 for a 1-hour
     * sale loop). Values past the clip duration simply render a partial
     * count; the timer will not reach 0.
     */
    startFromSeconds: z.number().nonnegative(),
    /**
     * Format for the rendered time. `mm:ss` for short sales/windows;
     * `hh:mm:ss` for hour-scale countdowns; `dd hh:mm:ss` for multi-day
     * deadlines. Fields above the current remaining time are elided.
     */
    format: z.enum(['mm:ss', 'hh:mm:ss', 'dd hh:mm:ss']).optional(),
    /** Optional label rendered above the timer (e.g. "Sale ends in"). */
    label: z.string().optional(),
    /** Accent colour used for the digits. Defaults to theme primary. */
    accent: z.string().optional(),
    /** Label / separator colour. Defaults to theme foreground. */
    textColor: z.string().optional(),
    /** Background colour for the card. Defaults to theme background. */
    background: z.string().optional(),
  })
  .strict();

export type CountdownProps = z.infer<typeof countdownPropsSchema>;

/**
 * Return the number of seconds remaining in the countdown at a given
 * frame. Exported for tests (and for clips that want to key other
 * animations off the same timer).
 */
export function secondsRemaining(startFromSeconds: number, frame: number, fps: number): number {
  const elapsed = frame / fps;
  return Math.max(0, startFromSeconds - elapsed);
}

function pad(n: number, width = 2): string {
  return Math.floor(n).toString().padStart(width, '0');
}

/**
 * Format a number of seconds into the requested display format. Exported
 * for tests — the component uses this directly.
 */
export function formatCountdown(
  secondsLeft: number,
  format: 'mm:ss' | 'hh:mm:ss' | 'dd hh:mm:ss',
): string {
  const s = Math.floor(secondsLeft);
  const seconds = s % 60;
  const minutes = Math.floor(s / 60) % 60;
  const hours = Math.floor(s / 3600) % 24;
  const days = Math.floor(s / 86400);
  switch (format) {
    case 'mm:ss':
      return `${pad(Math.floor(s / 60))}:${pad(seconds)}`;
    case 'hh:mm:ss':
      return `${pad(Math.floor(s / 3600))}:${pad(minutes)}:${pad(seconds)}`;
    case 'dd hh:mm:ss':
      return `${pad(days)}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
}

export function Countdown({
  startFromSeconds,
  format = 'mm:ss',
  label,
  accent = '#0072e5',
  textColor = '#080f15',
  background = '#ffffff',
}: CountdownProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const remaining = secondsRemaining(startFromSeconds, frame, fps);
  const formatted = formatCountdown(remaining, format);

  return (
    <div
      data-testid="countdown-clip"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background,
        gap: 8,
      }}
    >
      {label !== undefined && label.length > 0 ? (
        <div
          data-testid="countdown-label"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 500,
            fontSize: 14,
            color: textColor,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        data-testid="countdown-digits"
        style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontWeight: 700,
          fontSize: 44,
          color: accent,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatted}
      </div>
    </div>
  );
}

export const countdownClip: ClipDefinition<unknown> = defineFrameClip<CountdownProps>({
  kind: 'countdown',
  component: Countdown,
  propsSchema: countdownPropsSchema,
  themeSlots: {
    accent: { kind: 'palette', role: 'primary' },
    textColor: { kind: 'palette', role: 'foreground' },
    background: { kind: 'palette', role: 'background' },
  },
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 500 },
    { family: 'JetBrains Mono', weight: 700 },
  ],
});
