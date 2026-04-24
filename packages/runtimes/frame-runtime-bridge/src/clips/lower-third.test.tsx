// packages/runtimes/frame-runtime-bridge/src/clips/lower-third.test.tsx
// T-183 — LowerThird clip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LowerThird,
  type LowerThirdProps,
  lowerThirdClip,
  lowerThirdPropsSchema,
} from './lower-third.js';

afterEach(cleanup);

function renderAt(frame: number, props: LowerThirdProps, durationInFrames = 90) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <LowerThird {...props} />
    </FrameProvider>,
  );
}

describe('<LowerThird>', () => {
  it('starts off-screen at frame 0', () => {
    renderAt(0, { name: 'Ada Lovelace' });
    const el = screen.getByTestId('lower-third-clip');
    expect(Number(el.style.opacity)).toBe(0);
    expect(el.style.transform).toBe('translateX(-100%)');
  });

  it('is fully on-screen after the entrance window', () => {
    renderAt(30, { name: 'Ada Lovelace' }, 90);
    const el = screen.getByTestId('lower-third-clip');
    expect(Number(el.style.opacity)).toBe(1);
    expect(el.style.transform).toBe('translateX(0%)');
  });

  it('is fully off-screen again at the final frame', () => {
    renderAt(90, { name: 'Ada Lovelace' }, 90);
    const el = screen.getByTestId('lower-third-clip');
    expect(Number(el.style.opacity)).toBe(0);
    // exit translates +120%; entrance already settled at 0
    expect(el.style.transform).toBe('translateX(120%)');
  });

  it('renders the name text', () => {
    renderAt(30, { name: 'Ada Lovelace' }, 90);
    expect(screen.getByTestId('lower-third-clip').textContent).toContain('Ada Lovelace');
  });

  it('renders an optional title subline', () => {
    renderAt(30, { name: 'Ada Lovelace', title: 'Mathematician' }, 90);
    expect(screen.getByTestId('lower-third-title').textContent).toBe('Mathematician');
  });

  it('omits the title subline when title is empty', () => {
    renderAt(30, { name: 'Ada Lovelace', title: '' }, 90);
    expect(screen.queryByTestId('lower-third-title')).toBeNull();
  });

  it('accent bar uses the accent color', () => {
    renderAt(30, { name: 'Ada Lovelace', accent: '#ff0000' }, 90);
    const accent = screen.getByTestId('lower-third-accent');
    expect(accent.style.background).toBe('#ff0000');
  });
});

describe('lowerThirdClip definition', () => {
  it('registers under kind "lower-third" with theme slots', () => {
    expect(lowerThirdClip.kind).toBe('lower-third');
    expect(lowerThirdClip.propsSchema).toBe(lowerThirdPropsSchema);
    expect(lowerThirdClip.themeSlots).toEqual({
      accent: { kind: 'palette', role: 'primary' },
      background: { kind: 'palette', role: 'background' },
      textColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('propsSchema requires name', () => {
    expect(lowerThirdPropsSchema.safeParse({}).success).toBe(false);
    expect(lowerThirdPropsSchema.safeParse({ name: 'x' }).success).toBe(true);
  });

  it('propsSchema rejects negative inset', () => {
    expect(lowerThirdPropsSchema.safeParse({ name: 'x', insetLeftPx: -1 }).success).toBe(false);
  });
});
