// packages/runtimes/frame-runtime-bridge/src/clips/cta-pulse.test.tsx
// T-202 — CtaPulse clip behaviour + propsSchema + helpers.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CtaPulse,
  type CtaPulseProps,
  ctaPulseClip,
  ctaPulsePropsSchema,
  pulseScale,
} from './cta-pulse.js';

afterEach(cleanup);

function renderAt(frame: number, props: CtaPulseProps, fps = 24, durationInFrames = 120) {
  return render(
    <FrameProvider frame={frame} config={{ width: 300, height: 250, fps, durationInFrames }}>
      <CtaPulse {...props} />
    </FrameProvider>,
  );
}

describe('pulseScale', () => {
  it('starts at rest size (1) at frame 0', () => {
    expect(pulseScale(0, 24, 1, 1.1)).toBeCloseTo(1, 4);
  });

  it('hits peak at the half-period', () => {
    // pulseHz=1 → period=1s=24 frames → half = 12 frames (peak of the
    // swell-up-swell-down envelope)
    expect(pulseScale(12, 24, 1, 1.1)).toBeCloseTo(1.1, 4);
  });

  it('returns to rest at the full period', () => {
    expect(pulseScale(24, 24, 1, 1.1)).toBeCloseTo(1, 4);
  });

  it('never dips below rest size', () => {
    for (let f = 0; f < 240; f++) {
      expect(pulseScale(f, 24, 1, 1.1)).toBeGreaterThanOrEqual(1);
    }
  });

  it('never exceeds peak scale', () => {
    for (let f = 0; f < 240; f++) {
      expect(pulseScale(f, 24, 1, 1.1)).toBeLessThanOrEqual(1.1 + 1e-9);
    }
  });

  it('is deterministic — same input yields same output', () => {
    const a = pulseScale(42, 24, 1.5, 1.12);
    const b = pulseScale(42, 24, 1.5, 1.12);
    expect(a).toBe(b);
  });
});

describe('<CtaPulse>', () => {
  it('renders the label', () => {
    renderAt(0, { label: 'Buy now' });
    expect(screen.getByTestId('cta-pulse-button').textContent).toBe('Buy now');
  });

  it('applies peak scale at the half-period', () => {
    renderAt(12, { label: 'Buy now' }); // half-period for pulseHz=1 at fps=24
    const btn = screen.getByTestId('cta-pulse-button');
    expect(btn.style.transform).toBe('scale(1.0800)');
  });

  it('applies rest-size scale at frame 0', () => {
    renderAt(0, { label: 'Buy now' });
    const btn = screen.getByTestId('cta-pulse-button');
    expect(btn.style.transform).toBe('scale(1.0000)');
  });

  it('renders the sub-label when provided', () => {
    renderAt(0, { label: 'Buy now', subLabel: 'Free shipping' });
    expect(screen.getByTestId('cta-pulse-sub').textContent).toBe('Free shipping');
  });

  it('omits the sub-label element when empty', () => {
    renderAt(0, { label: 'Buy now', subLabel: '' });
    expect(screen.queryByTestId('cta-pulse-sub')).toBeNull();
  });
});

describe('ctaPulsePropsSchema', () => {
  it('requires a non-empty label', () => {
    expect(ctaPulsePropsSchema.safeParse({}).success).toBe(false);
    expect(ctaPulsePropsSchema.safeParse({ label: '' }).success).toBe(false);
  });

  it('rejects pulseHz outside (0, 4]', () => {
    expect(ctaPulsePropsSchema.safeParse({ label: 'x', pulseHz: 0 }).success).toBe(false);
    expect(ctaPulsePropsSchema.safeParse({ label: 'x', pulseHz: 5 }).success).toBe(false);
  });

  it('rejects peakScale outside [1, 1.5]', () => {
    expect(ctaPulsePropsSchema.safeParse({ label: 'x', peakScale: 0.9 }).success).toBe(false);
    expect(ctaPulsePropsSchema.safeParse({ label: 'x', peakScale: 2 }).success).toBe(false);
  });

  it('accepts a complete config', () => {
    expect(
      ctaPulsePropsSchema.safeParse({
        label: 'Shop the sale',
        pulseHz: 1.5,
        peakScale: 1.12,
        accent: '#f00',
        textColor: '#fff',
        subLabel: 'Ends tonight',
      }).success,
    ).toBe(true);
  });
});

describe('ctaPulseClip', () => {
  it('declares kind and fonts', () => {
    expect(ctaPulseClip.kind).toBe('cta-pulse');
    const fonts = ctaPulseClip.fontRequirements?.({
      label: 'Buy now',
    } as CtaPulseProps);
    expect(fonts).toEqual([
      { family: 'Plus Jakarta Sans', weight: 500 },
      { family: 'Plus Jakarta Sans', weight: 700 },
    ]);
  });
});
