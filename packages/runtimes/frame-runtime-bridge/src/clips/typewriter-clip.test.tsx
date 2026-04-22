// packages/runtimes/frame-runtime-bridge/src/clips/typewriter-clip.test.tsx
// T-131b.1 — typewriterClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  TypewriterClip,
  type TypewriterClipProps,
  typewriterClip,
  typewriterClipPropsSchema,
} from './typewriter-clip.js';

afterEach(cleanup);

function renderAt(frame: number, props: TypewriterClipProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <TypewriterClip {...props} />
    </FrameProvider>,
  );
}

describe('TypewriterClip component (T-131b.1)', () => {
  it('shows zero characters at frame=0', () => {
    renderAt(0, { text: 'hello' });
    const root = screen.getByTestId('typewriter-clip');
    expect(root.textContent?.replace('|', '')).toBe('');
  });

  it('shows the full text at frame=duration-tail', () => {
    renderAt(45, { text: 'hello' }, 60);
    const root = screen.getByTestId('typewriter-clip');
    expect(root.textContent).toContain('hello');
  });

  it('caret is on for the first 10 frames of every 16-frame period and off for the next 6', () => {
    const { unmount: u1 } = renderAt(0, { text: 'x' });
    expect((screen.getByTestId('typewriter-caret') as HTMLElement).style.opacity).toBe('1');
    u1();
    const { unmount: u2 } = renderAt(13, { text: 'x' });
    expect((screen.getByTestId('typewriter-caret') as HTMLElement).style.opacity).toBe('0');
    u2();
    renderAt(16, { text: 'x' });
    expect((screen.getByTestId('typewriter-caret') as HTMLElement).style.opacity).toBe('1');
  });
});

describe('typewriterClip definition (T-131b.1)', () => {
  it("registers under kind 'typewriter' with three themeSlots", () => {
    expect(typewriterClip.kind).toBe('typewriter');
    expect(typewriterClip.propsSchema).toBe(typewriterClipPropsSchema);
    expect(typewriterClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'foreground' },
      caretColor: { kind: 'palette', role: 'primary' },
      background: { kind: 'palette', role: 'background' },
    });
  });
});
