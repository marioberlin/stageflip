// packages/runtimes/frame-runtime-bridge/src/clips/particles.test.tsx
// T-131d — particlesClip behaviour + propsSchema + (no) themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  Particles,
  type ParticlesProps,
  particlesClip,
  particlesPropsSchema,
} from './particles.js';

afterEach(cleanup);

function renderAt(frame: number, props: ParticlesProps = {}, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <Particles {...props} />
    </FrameProvider>,
  );
}

describe('Particles component (T-131d)', () => {
  it('renders `count` particle nodes at the requested style', () => {
    renderAt(30, { count: 7, style: 'confetti' });
    const root = screen.getByTestId('particles-clip');
    // 7 particle children directly under the root container.
    expect(root.children.length).toBe(7);
  });

  it('global opacity is 0 at frame=0 (fade-in not started)', () => {
    renderAt(0, {});
    const root = screen.getByTestId('particles-clip') as HTMLElement;
    expect(Number(root.style.opacity)).toBe(0);
  });

  it('global opacity is 1 at the middle of the composition', () => {
    renderAt(30, {}, 60);
    const root = screen.getByTestId('particles-clip') as HTMLElement;
    expect(Number(root.style.opacity)).toBeCloseTo(1, 5);
  });

  it('global opacity decays back to 0 at frame=duration', () => {
    renderAt(60, {}, 60);
    const root = screen.getByTestId('particles-clip') as HTMLElement;
    expect(Number(root.style.opacity)).toBe(0);
  });

  it('seeded — identical seed + frame yields identical first-particle layout', () => {
    const { container: c1, unmount } = renderAt(15, { count: 3, seed: 7 });
    const first = c1.querySelector('[data-testid="particles-clip"] > div') as HTMLElement;
    const left1 = first.style.left;
    unmount();
    const { container: c2 } = renderAt(15, { count: 3, seed: 7 });
    const second = c2.querySelector('[data-testid="particles-clip"] > div') as HTMLElement;
    expect(second.style.left).toBe(left1);
  });

  it('different seed yields a different first-particle x position', () => {
    const { container: c1, unmount } = renderAt(15, { count: 3, seed: 1 });
    const left1 = (c1.querySelector('[data-testid="particles-clip"] > div') as HTMLElement).style
      .left;
    unmount();
    const { container: c2 } = renderAt(15, { count: 3, seed: 999_999 });
    const left2 = (c2.querySelector('[data-testid="particles-clip"] > div') as HTMLElement).style
      .left;
    expect(left2).not.toBe(left1);
  });
});

describe('particlesClip definition (T-131d)', () => {
  it("registers under kind 'particles' with no themeSlots (style-driven palettes)", () => {
    expect(particlesClip.kind).toBe('particles');
    expect(particlesClip.propsSchema).toBe(particlesPropsSchema);
    expect(particlesClip.themeSlots).toBeUndefined();
  });

  it('propsSchema rejects unknown style', () => {
    expect(particlesPropsSchema.safeParse({ style: 'fireworks' }).success).toBe(false);
  });

  it('propsSchema rejects intensity outside [0, 1]', () => {
    expect(particlesPropsSchema.safeParse({ intensity: 1.5 }).success).toBe(false);
    expect(particlesPropsSchema.safeParse({ intensity: -0.1 }).success).toBe(false);
    expect(particlesPropsSchema.safeParse({ intensity: 0.5 }).success).toBe(true);
  });

  it('propsSchema caps `count` at 500', () => {
    expect(particlesPropsSchema.safeParse({ count: 600 }).success).toBe(false);
    expect(particlesPropsSchema.safeParse({ count: 500 }).success).toBe(true);
  });
});
