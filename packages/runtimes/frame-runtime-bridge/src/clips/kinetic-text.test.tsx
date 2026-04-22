// packages/runtimes/frame-runtime-bridge/src/clips/kinetic-text.test.tsx
// T-131b.1 — kineticTextClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  KineticText,
  type KineticTextProps,
  kineticTextClip,
  kineticTextPropsSchema,
} from './kinetic-text.js';

afterEach(cleanup);

function renderAt(frame: number, props: KineticTextProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <KineticText {...props} />
    </FrameProvider>,
  );
}

describe('KineticText component (T-131b.1)', () => {
  it('renders one span per word, splitting on whitespace', () => {
    renderAt(60, { text: 'one two three' });
    const root = screen.getByTestId('kinetic-text-clip');
    expect(root.querySelectorAll('span').length).toBe(3);
  });

  it('drops empty tokens from collapsed whitespace', () => {
    renderAt(60, { text: '  hello   world  ' });
    expect(screen.getByTestId('kinetic-text-clip').querySelectorAll('span').length).toBe(2);
  });

  it('first word is invisible at frame=0 and visible after the fade window', () => {
    const { container, unmount } = renderAt(0, { text: 'hello' });
    const firstAt0 = container.querySelector('span') as HTMLElement;
    expect(Number(firstAt0.style.opacity)).toBe(0);
    unmount();
    const { container: c2 } = renderAt(20, { text: 'hello' });
    const firstAt20 = c2.querySelector('span') as HTMLElement;
    expect(Number(firstAt20.style.opacity)).toBe(1);
  });

  it('staggers word entrance — second word fades after the first', () => {
    const { container } = renderAt(2, { text: 'first second' });
    const spans = container.querySelectorAll('span');
    const opacityFirst = Number((spans[0] as HTMLElement).style.opacity);
    const opacitySecond = Number((spans[1] as HTMLElement).style.opacity);
    expect(opacityFirst).toBeGreaterThan(opacitySecond);
  });
});

describe('kineticTextClip definition (T-131b.1)', () => {
  it("registers under kind 'kinetic-text'", () => {
    expect(kineticTextClip.kind).toBe('kinetic-text');
    expect(kineticTextClip.propsSchema).toBe(kineticTextPropsSchema);
  });

  it('binds color → foreground, background → background via themeSlots', () => {
    expect(kineticTextClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'foreground' },
      background: { kind: 'palette', role: 'background' },
    });
  });

  it('propsSchema rejects empty input (text required)', () => {
    expect(kineticTextPropsSchema.safeParse({}).success).toBe(false);
  });

  it('propsSchema rejects empty-string text (would render zero spans)', () => {
    expect(kineticTextPropsSchema.safeParse({ text: '' }).success).toBe(false);
  });
});
