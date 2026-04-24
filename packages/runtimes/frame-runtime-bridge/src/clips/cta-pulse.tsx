// packages/runtimes/frame-runtime-bridge/src/clips/cta-pulse.tsx
// T-202 — "cta-pulse" display-profile clip. A call-to-action button that
// pulses on a deterministic `(1 - cos) / 2` envelope to draw attention.
// One "pulse" is one rest → peak → rest cycle, so `pulseHz` reads as
// pulses-per-second with no surprises.
//
// Determinism: the pulse phase is `(frame / fps) * pulseHz * 2π`. No
// `Date.now()`, no `Math.random()`, no timers. The animation never uses
// extrapolation that could silently drift across renders.

import { useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const ctaPulsePropsSchema = z
  .object({
    /** Button label. */
    label: z.string().min(1),
    /** Pulses per second. Default 1. IAB / GDN pace ≤ 2 Hz to avoid flicker. */
    pulseHz: z.number().positive().max(4).optional(),
    /**
     * Peak scale at the top of the pulse envelope. Default 1.08. Values
     * past ~1.2 look jittery; the schema tolerates up to 1.5 for loud
     * sales creative.
     */
    peakScale: z.number().min(1).max(1.5).optional(),
    /** Button background colour. Defaults to theme primary. */
    accent: z.string().optional(),
    /** Label colour. Defaults to theme background (inverted). */
    textColor: z.string().optional(),
    /** Optional sub-label rendered under the button. */
    subLabel: z.string().optional(),
  })
  .strict();

export type CtaPulseProps = z.infer<typeof ctaPulsePropsSchema>;

/**
 * Scale at a given frame for a cosine-based pulse envelope. Returns a
 * value in `[1, peakScale]` — rest at the start of each period, rising
 * to peak at the half-period and falling back to rest at the end. Used
 * so a "1 Hz" pulse means exactly one swell-up-swell-down per second.
 */
export function pulseScale(frame: number, fps: number, pulseHz: number, peakScale: number): number {
  const phase = (frame / fps) * pulseHz * Math.PI * 2;
  const envelope = (1 - Math.cos(phase)) / 2; // 0..1, 0 at phase=0
  return 1 + envelope * (peakScale - 1);
}

export function CtaPulse({
  label,
  pulseHz = 1,
  peakScale = 1.08,
  accent = '#0072e5',
  textColor = '#ffffff',
  subLabel,
}: CtaPulseProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = pulseScale(frame, fps, pulseHz, peakScale);

  return (
    <div
      data-testid="cta-pulse-clip"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <button
        type="button"
        data-testid="cta-pulse-button"
        style={{
          transform: `scale(${scale.toFixed(4)})`,
          transformOrigin: 'center',
          padding: '14px 28px',
          background: accent,
          color: textColor,
          border: 'none',
          borderRadius: 999,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: '-0.01em',
          boxShadow: '0 6px 20px rgba(0, 114, 229, 0.32)',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
      {subLabel !== undefined && subLabel.length > 0 ? (
        <div
          data-testid="cta-pulse-sub"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 500,
            fontSize: 13,
            color: textColor,
            letterSpacing: '0.03em',
          }}
        >
          {subLabel}
        </div>
      ) : null}
    </div>
  );
}

export const ctaPulseClip: ClipDefinition<unknown> = defineFrameClip<CtaPulseProps>({
  kind: 'cta-pulse',
  component: CtaPulse,
  propsSchema: ctaPulsePropsSchema,
  themeSlots: {
    accent: { kind: 'palette', role: 'primary' },
    textColor: { kind: 'palette', role: 'background' },
  },
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 500 },
    { family: 'Plus Jakarta Sans', weight: 700 },
  ],
});
