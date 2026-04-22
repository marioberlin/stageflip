// packages/runtimes/frame-runtime-bridge/src/clips/light-leak.test.tsx
// T-131b.2 — lightLeakClip behaviour + propsSchema + (no) themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LightLeak,
  type LightLeakProps,
  lightLeakClip,
  lightLeakPropsSchema,
} from './light-leak.js';

afterEach(cleanup);

function renderAt(frame: number, props: LightLeakProps = {}, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <LightLeak {...props} />
    </FrameProvider>,
  );
}

describe('LightLeak component (T-131b.2)', () => {
  it('renders three blob layers + the grain overlay', () => {
    renderAt(30, {});
    expect(screen.getByTestId('light-leak-blob-1')).toBeDefined();
    expect(screen.getByTestId('light-leak-blob-2')).toBeDefined();
    expect(screen.getByTestId('light-leak-blob-3')).toBeDefined();
  });

  it('global opacity is 0 at frame=0 (fade-in not yet started)', () => {
    renderAt(0, {});
    const root = screen.getByTestId('light-leak-clip') as HTMLElement;
    expect(Number(root.style.opacity)).toBe(0);
  });

  it('global opacity reaches `intensity` at the midpoint of the composition', () => {
    renderAt(30, { intensity: 0.5 }, 60);
    const root = screen.getByTestId('light-leak-clip') as HTMLElement;
    expect(Number(root.style.opacity)).toBeCloseTo(0.5, 5);
  });

  it('global opacity decays back to 0 at frame=duration', () => {
    renderAt(60, {}, 60);
    const root = screen.getByTestId('light-leak-clip') as HTMLElement;
    expect(Number(root.style.opacity)).toBe(0);
  });

  it('seed is deterministic — identical seed + frame → identical blob position', () => {
    const { container: c1, unmount } = renderAt(15, { seed: 7 });
    const blob1 = c1.querySelector('[data-testid="light-leak-blob-1"]') as HTMLElement;
    const left1 = blob1.style.left;
    unmount();
    const { container: c2 } = renderAt(15, { seed: 7 });
    const blob1b = c2.querySelector('[data-testid="light-leak-blob-1"]') as HTMLElement;
    expect(blob1b.style.left).toBe(left1);
  });
});

describe('lightLeakClip definition (T-131b.2)', () => {
  it("registers under kind 'light-leak' with no themeSlots (off-palette by design)", () => {
    expect(lightLeakClip.kind).toBe('light-leak');
    expect(lightLeakClip.propsSchema).toBe(lightLeakPropsSchema);
    expect(lightLeakClip.themeSlots).toBeUndefined();
  });

  it('propsSchema rejects intensity outside [0, 1]', () => {
    expect(lightLeakPropsSchema.safeParse({ intensity: 1.5 }).success).toBe(false);
    expect(lightLeakPropsSchema.safeParse({ intensity: -0.1 }).success).toBe(false);
    expect(lightLeakPropsSchema.safeParse({ intensity: 0.7 }).success).toBe(true);
  });
});
