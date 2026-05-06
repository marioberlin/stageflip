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

  // T-183z — noFlag / subtitleColor / font props
  it('renders the accent strip by default (no T-183z props)', () => {
    renderAt(30, { name: 'Ada Lovelace' }, 90);
    expect(screen.queryByTestId('lower-third-accent')).not.toBeNull();
  });

  it('omits the accent strip when noFlag=true', () => {
    renderAt(30, { name: 'Ada Lovelace', noFlag: true }, 90);
    expect(screen.queryByTestId('lower-third-accent')).toBeNull();
  });

  it('keeps the accent strip when noFlag=false (explicit)', () => {
    renderAt(30, { name: 'Ada Lovelace', noFlag: false }, 90);
    expect(screen.queryByTestId('lower-third-accent')).not.toBeNull();
  });

  it('subtitle inherits accent color when subtitleColor is absent', () => {
    renderAt(30, { name: 'Ada', title: 'Mathematician', accent: '#ff0000' }, 90);
    const subtitle = screen.getByTestId('lower-third-title');
    expect(subtitle.style.color).toBe('#ff0000');
  });

  it('subtitleColor overrides the accent-bound subtitle color', () => {
    renderAt(
      30,
      { name: 'Ada', title: 'Mathematician', accent: '#ff0000', subtitleColor: '#FFFFFF' },
      90,
    );
    const subtitle = screen.getByTestId('lower-third-title');
    expect(subtitle.style.color).toBe('#FFFFFF');
  });

  it('uses Plus Jakarta Sans as the default font family', () => {
    renderAt(30, { name: 'Ada', title: 'Mathematician' }, 90);
    const nameEl = screen.getByTestId('lower-third-name');
    const subtitleEl = screen.getByTestId('lower-third-title');
    expect(nameEl.style.fontFamily).toContain('Plus Jakarta Sans');
    expect(subtitleEl.style.fontFamily).toContain('Plus Jakarta Sans');
    expect(nameEl.style.fontWeight).toBe('700');
    expect(subtitleEl.style.fontWeight).toBe('500');
  });

  it('font.family overrides the family on both name and title', () => {
    renderAt(30, { name: 'Ada', title: 'Mathematician', font: { family: 'Source Serif 4' } }, 90);
    const nameEl = screen.getByTestId('lower-third-name');
    const subtitleEl = screen.getByTestId('lower-third-title');
    expect(nameEl.style.fontFamily).toContain('Source Serif 4');
    expect(subtitleEl.style.fontFamily).toContain('Source Serif 4');
    // Weight defaults preserved when font.weight absent
    expect(nameEl.style.fontWeight).toBe('700');
    expect(subtitleEl.style.fontWeight).toBe('500');
  });

  it('font.weight applies uniformly to name and title', () => {
    renderAt(
      30,
      { name: 'Ada', title: 'Mathematician', font: { family: 'Inter Tight', weight: 700 } },
      90,
    );
    const nameEl = screen.getByTestId('lower-third-name');
    const subtitleEl = screen.getByTestId('lower-third-title');
    expect(nameEl.style.fontFamily).toContain('Inter Tight');
    expect(subtitleEl.style.fontFamily).toContain('Inter Tight');
    expect(nameEl.style.fontWeight).toBe('700');
    expect(subtitleEl.style.fontWeight).toBe('700');
  });

  it('composes noFlag + subtitleColor + font together', () => {
    renderAt(
      30,
      {
        name: 'Ada',
        title: 'Mathematician',
        noFlag: true,
        subtitleColor: '#FFFFFF',
        font: { family: 'Inter', weight: 600 },
      },
      90,
    );
    expect(screen.queryByTestId('lower-third-accent')).toBeNull();
    const nameEl = screen.getByTestId('lower-third-name');
    const subtitleEl = screen.getByTestId('lower-third-title');
    expect(nameEl.style.fontFamily).toBe('Inter');
    expect(subtitleEl.style.fontFamily).toBe('Inter');
    expect(nameEl.style.fontWeight).toBe('600');
    expect(subtitleEl.style.fontWeight).toBe('600');
    expect(subtitleEl.style.color).toBe('#FFFFFF');
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

  // T-183z — schema accepts the three new optional props
  it('propsSchema accepts noFlag', () => {
    expect(lowerThirdPropsSchema.safeParse({ name: 'x', noFlag: true }).success).toBe(true);
    expect(lowerThirdPropsSchema.safeParse({ name: 'x', noFlag: false }).success).toBe(true);
  });

  it('propsSchema accepts subtitleColor', () => {
    expect(lowerThirdPropsSchema.safeParse({ name: 'x', subtitleColor: '#FFFFFF' }).success).toBe(
      true,
    );
  });

  it('propsSchema accepts font with family + weight', () => {
    expect(
      lowerThirdPropsSchema.safeParse({
        name: 'x',
        font: { family: 'Inter Tight', weight: 700 },
      }).success,
    ).toBe(true);
  });

  it('propsSchema accepts font with family only (weight optional)', () => {
    expect(
      lowerThirdPropsSchema.safeParse({ name: 'x', font: { family: 'Source Serif 4' } }).success,
    ).toBe(true);
  });

  it('propsSchema rejects font missing family', () => {
    expect(lowerThirdPropsSchema.safeParse({ name: 'x', font: { weight: 700 } }).success).toBe(
      false,
    );
    expect(lowerThirdPropsSchema.safeParse({ name: 'x', font: {} }).success).toBe(false);
  });

  it('propsSchema rejects unknown keys (strict)', () => {
    expect(lowerThirdPropsSchema.safeParse({ name: 'x', unknownKey: true }).success).toBe(false);
  });
});
