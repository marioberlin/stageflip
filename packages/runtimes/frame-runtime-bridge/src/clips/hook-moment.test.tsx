// packages/runtimes/frame-runtime-bridge/src/clips/hook-moment.test.tsx
// T-183b — HookMoment clip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  HookMoment,
  type HookMomentProps,
  hookMomentClip,
  hookMomentPropsSchema,
} from './hook-moment.js';

afterEach(cleanup);

function renderAt(frame: number, props: HookMomentProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <HookMoment {...props} />
    </FrameProvider>,
  );
}

describe('<HookMoment>', () => {
  it('starts zoomed-in + faded at frame 0', () => {
    renderAt(0, { claim: 'New!' });
    const claim = screen.getByTestId('hook-moment-claim');
    expect(claim.style.transform).toBe('scale(1.4)');
    expect(Number(claim.style.opacity)).toBe(0);
  });

  it('settles to scale(1) + full opacity after the zoom window', () => {
    renderAt(15, { claim: 'New!' }, 60);
    const claim = screen.getByTestId('hook-moment-claim');
    expect(claim.style.transform).toBe('scale(1)');
    expect(Number(claim.style.opacity)).toBe(1);
  });

  it('renders the claim text', () => {
    renderAt(15, { claim: 'Big Idea' }, 60);
    expect(screen.getByTestId('hook-moment-claim').textContent).toBe('Big Idea');
  });

  it('renders supporting text after the claim-fade-in window', () => {
    renderAt(30, { claim: 'Big Idea', supporting: 'Limited time' }, 60);
    expect(screen.getByTestId('hook-moment-supporting').textContent).toBe('Limited time');
  });

  it('omits supporting when empty', () => {
    renderAt(30, { claim: 'Big Idea', supporting: '' }, 60);
    expect(screen.queryByTestId('hook-moment-supporting')).toBeNull();
  });
});

describe('hookMomentClip definition', () => {
  it('registers under kind "hook-moment" with theme slots', () => {
    expect(hookMomentClip.kind).toBe('hook-moment');
    expect(hookMomentClip.propsSchema).toBe(hookMomentPropsSchema);
    expect(hookMomentClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'foreground' },
      flashColor: { kind: 'palette', role: 'accent' },
      background: { kind: 'palette', role: 'background' },
    });
  });

  it('propsSchema requires claim', () => {
    expect(hookMomentPropsSchema.safeParse({}).success).toBe(false);
    expect(hookMomentPropsSchema.safeParse({ claim: 'x' }).success).toBe(true);
  });

  it('propsSchema rejects non-positive font size', () => {
    expect(hookMomentPropsSchema.safeParse({ claim: 'x', fontSize: 0 }).success).toBe(false);
  });
});
