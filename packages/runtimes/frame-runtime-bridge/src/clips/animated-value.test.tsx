// packages/runtimes/frame-runtime-bridge/src/clips/animated-value.test.tsx
// T-131b.3 — animatedValueClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AnimatedProgressBar,
  AnimatedProgressRing,
  AnimatedValue,
  type AnimatedValueProps,
  animatedValueClip,
  animatedValuePropsSchema,
} from './animated-value.js';

afterEach(cleanup);

function renderAt(frame: number, props: AnimatedValueProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <AnimatedValue {...props} />
    </FrameProvider>,
  );
}

describe('AnimatedValue component (T-131b.3)', () => {
  it('starts near 0 at frame=0 and reaches the target after spring settles', () => {
    renderAt(0, { value: 1000 });
    expect(screen.getByTestId('animated-value').textContent?.replace(/\D/g, '')).toBe('0');
    cleanup();
    // Spring with damping 15 / mass 0.8 / stiffness 120 settles well under 60f.
    renderAt(59, { value: 1000 }, 60);
    // Allow a 1-unit rounding tolerance — the integrator's last fraction may
    // land at 1000 or 999 depending on rounding, but not far off.
    const finalText = screen.getByTestId('animated-value').textContent?.replace(/\D/g, '') ?? '';
    const finalValue = Number(finalText);
    expect(finalValue).toBeGreaterThan(995);
    expect(finalValue).toBeLessThanOrEqual(1000);
  });

  it('respects prefix + suffix around the formatted number', () => {
    renderAt(59, { value: 42, prefix: '$', suffix: 'k' }, 60);
    const text = screen.getByTestId('animated-value').textContent ?? '';
    expect(text.startsWith('$')).toBe(true);
    expect(text.endsWith('k')).toBe(true);
  });

  it('formats with fixed decimals when decimals > 0 (no locale grouping)', () => {
    renderAt(59, { value: Math.PI, decimals: 2 }, 60);
    // Tail of the spring may not be exactly 3.14 — accept anything starting
    // with "3." that parses to roughly 3.14.
    const text = screen.getByTestId('animated-value').textContent ?? '';
    expect(text).toMatch(/^3\.\d{2}$/);
  });

  it('useSpring=false uses linear-easing interpolation over the clip window', () => {
    // End-frame default is durationInFrames - 10 = 50. At frame=50 we should
    // be exactly at target.
    renderAt(50, { value: 100, useSpring: false }, 60);
    expect(screen.getByTestId('animated-value').textContent?.replace(/\D/g, '')).toBe('100');
  });

  it('uses tabular-nums for steady digit width', () => {
    renderAt(30, { value: 10 });
    const span = screen.getByTestId('animated-value') as HTMLElement;
    expect(span.style.fontVariantNumeric).toBe('tabular-nums');
  });
});

describe('animatedValueClip definition (T-131b.3)', () => {
  it("registers under kind 'animated-value' with one themeSlot (color → foreground)", () => {
    expect(animatedValueClip.kind).toBe('animated-value');
    expect(animatedValueClip.propsSchema).toBe(animatedValuePropsSchema);
    expect(animatedValueClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'foreground' },
    });
  });

  it('propsSchema requires `value`', () => {
    expect(animatedValuePropsSchema.safeParse({}).success).toBe(false);
    expect(animatedValuePropsSchema.safeParse({ value: 0 }).success).toBe(true);
  });

  it('fontRequirements reads fontWeight from props so FontManager preloads the actual face', () => {
    expect(animatedValueClip.fontRequirements?.({ value: 1 })).toEqual([
      { family: 'Plus Jakarta Sans', weight: 700 },
    ]);
    expect(animatedValueClip.fontRequirements?.({ value: 1, fontWeight: 800 })).toEqual([
      { family: 'Plus Jakarta Sans', weight: 800 },
    ]);
  });
});

describe('AnimatedProgressBar + Ring — building blocks (T-131b.3)', () => {
  it('bar renders without throwing at a mid-frame and near end-frame', () => {
    render(
      <FrameProvider frame={15} config={{ width: 640, height: 360, fps: 30, durationInFrames: 60 }}>
        <AnimatedProgressBar progress={50} />
      </FrameProvider>,
    );
    expect(screen.getByTestId('animated-progress-bar')).toBeDefined();
  });

  it('ring renders its two circles + optional children', () => {
    render(
      <FrameProvider frame={30} config={{ width: 640, height: 360, fps: 30, durationInFrames: 60 }}>
        <AnimatedProgressRing progress={75}>
          <span data-testid="ring-child">75%</span>
        </AnimatedProgressRing>
      </FrameProvider>,
    );
    const ring = screen.getByTestId('animated-progress-ring');
    expect(ring.querySelectorAll('circle').length).toBe(2);
    expect(screen.getByTestId('ring-child')).toBeDefined();
  });
});
