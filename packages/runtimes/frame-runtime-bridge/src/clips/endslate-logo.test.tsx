// packages/runtimes/frame-runtime-bridge/src/clips/endslate-logo.test.tsx
// T-183 — EndslateLogo clip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  EndslateLogo,
  type EndslateLogoProps,
  endslateLogoClip,
  endslateLogoPropsSchema,
} from './endslate-logo.js';

afterEach(cleanup);

function renderAt(frame: number, props: EndslateLogoProps, durationInFrames = 90) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <EndslateLogo {...props} />
    </FrameProvider>,
  );
}

describe('<EndslateLogo>', () => {
  it('starts faded out and scaled-down', () => {
    renderAt(0, { brand: 'StageFlip' });
    const el = screen.getByTestId('endslate-logo-clip');
    expect(Number(el.style.opacity)).toBe(0);
    const wordmark = el.firstElementChild as HTMLElement;
    expect(wordmark.style.transform).toBe('scale(0.92)');
  });

  it('is visible + full scale after the entrance window', () => {
    renderAt(30, { brand: 'StageFlip' }, 90);
    const el = screen.getByTestId('endslate-logo-clip');
    expect(Number(el.style.opacity)).toBe(1);
    const wordmark = el.firstElementChild as HTMLElement;
    expect(wordmark.style.transform).toBe('scale(1)');
  });

  it('fades out at the end', () => {
    renderAt(90, { brand: 'StageFlip' }, 90);
    const el = screen.getByTestId('endslate-logo-clip');
    expect(Number(el.style.opacity)).toBe(0);
  });

  it('renders the brand text', () => {
    renderAt(30, { brand: 'StageFlip' }, 90);
    expect(screen.getByTestId('endslate-logo-clip').textContent).toContain('StageFlip');
  });

  it('renders an optional tagline', () => {
    renderAt(30, { brand: 'StageFlip', tagline: 'motion for everyone' }, 90);
    expect(screen.getByTestId('endslate-logo-tagline').textContent).toBe('motion for everyone');
  });

  it('omits the tagline when empty', () => {
    renderAt(30, { brand: 'StageFlip', tagline: '' }, 90);
    expect(screen.queryByTestId('endslate-logo-tagline')).toBeNull();
  });
});

describe('endslateLogoClip definition', () => {
  it('registers under kind "endslate-logo" with theme slots', () => {
    expect(endslateLogoClip.kind).toBe('endslate-logo');
    expect(endslateLogoClip.propsSchema).toBe(endslateLogoPropsSchema);
    expect(endslateLogoClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'primary' },
      background: { kind: 'palette', role: 'background' },
      taglineColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('propsSchema requires brand', () => {
    expect(endslateLogoPropsSchema.safeParse({}).success).toBe(false);
    expect(endslateLogoPropsSchema.safeParse({ brand: 'x' }).success).toBe(true);
  });

  it('propsSchema rejects non-positive font size', () => {
    expect(endslateLogoPropsSchema.safeParse({ brand: 'x', fontSize: 0 }).success).toBe(false);
  });
});
