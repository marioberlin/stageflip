// packages/runtimes/frame-runtime-bridge/src/clips/logo-intro.test.tsx
// T-131b.1 — logoIntroClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LogoIntro,
  type LogoIntroProps,
  logoIntroClip,
  logoIntroPropsSchema,
} from './logo-intro.js';

afterEach(cleanup);

function renderAt(frame: number, props: LogoIntroProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <LogoIntro {...props} />
    </FrameProvider>,
  );
}

describe('LogoIntro component (T-131b.1)', () => {
  it('starts at opacity 0 + scale 0.8 at frame=0', () => {
    renderAt(0, { text: 'StageFlip' });
    const span = screen.getByTestId('logo-intro-clip').querySelector('span') as HTMLElement;
    expect(Number(span.style.opacity)).toBe(0);
    expect(span.style.transform).toBe('scale(0.8)');
  });

  it('reaches opacity 1 + scale 1 after the entrance window settles', () => {
    renderAt(45, { text: 'StageFlip' }, 60);
    const span = screen.getByTestId('logo-intro-clip').querySelector('span') as HTMLElement;
    expect(Number(span.style.opacity)).toBe(1);
    expect(span.style.transform).toBe('scale(1)');
  });

  it('renders the supplied text inside the span', () => {
    renderAt(45, { text: 'Hello World' }, 60);
    expect(screen.getByTestId('logo-intro-clip').textContent).toBe('Hello World');
  });
});

describe('logoIntroClip definition (T-131b.1)', () => {
  it("registers under kind 'logo-intro' with three themeSlots", () => {
    expect(logoIntroClip.kind).toBe('logo-intro');
    expect(logoIntroClip.propsSchema).toBe(logoIntroPropsSchema);
    expect(logoIntroClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'primary' },
      glowColor: { kind: 'palette', role: 'accent' },
      background: { kind: 'palette', role: 'background' },
    });
  });

  it('propsSchema requires text', () => {
    expect(logoIntroPropsSchema.safeParse({}).success).toBe(false);
  });
});
