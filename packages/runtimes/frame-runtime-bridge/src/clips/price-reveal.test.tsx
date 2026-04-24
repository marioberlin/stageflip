// packages/runtimes/frame-runtime-bridge/src/clips/price-reveal.test.tsx
// T-202 — PriceReveal clip behaviour + propsSchema + clipDefinition shape.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PriceReveal,
  type PriceRevealProps,
  priceRevealClip,
  priceRevealPropsSchema,
} from './price-reveal.js';

afterEach(cleanup);

function renderAt(frame: number, props: PriceRevealProps, durationInFrames = 120) {
  return render(
    <FrameProvider frame={frame} config={{ width: 300, height: 250, fps: 24, durationInFrames }}>
      <PriceReveal {...props} />
    </FrameProvider>,
  );
}

const base: PriceRevealProps = { oldPrice: '$99', newPrice: '$79' };

describe('<PriceReveal>', () => {
  it('renders old + new prices', () => {
    renderAt(0, base);
    expect(screen.getByTestId('price-reveal-old-value').textContent).toBe('$99');
    expect(screen.getByTestId('price-reveal-new-value').textContent).toBe('$79');
  });

  it('renders default Was / Now labels', () => {
    renderAt(0, base);
    expect(screen.getByTestId('price-reveal-old-label').textContent).toBe('Was');
    expect(screen.getByTestId('price-reveal-new-label').textContent).toBe('Now');
  });

  it('hides the old label when oldLabel is empty', () => {
    renderAt(0, { ...base, oldLabel: '' });
    expect(screen.queryByTestId('price-reveal-old-label')).toBeNull();
  });

  it('hides the new label when newLabel is empty', () => {
    renderAt(0, { ...base, newLabel: '' });
    expect(screen.queryByTestId('price-reveal-new-label')).toBeNull();
  });

  it('starts with the old price fully visible and the new price hidden', () => {
    renderAt(0, base, 120);
    expect(Number(screen.getByTestId('price-reveal-old').style.opacity)).toBe(1);
    expect(Number(screen.getByTestId('price-reveal-new').style.opacity)).toBe(0);
  });

  it('ends with the new price fully visible', () => {
    renderAt(119, base, 120);
    expect(Number(screen.getByTestId('price-reveal-new').style.opacity)).toBe(1);
  });

  it('applies the scale pop while the new price is entering', () => {
    renderAt(119, base, 120);
    // At the end the scale has settled at 1.
    expect(screen.getByTestId('price-reveal-new').style.transform).toContain('scale(1.0000)');
  });

  it('applies line-through to the old-price value', () => {
    renderAt(0, base);
    const el = screen.getByTestId('price-reveal-old-value');
    expect(el.style.textDecoration).toContain('line-through');
  });

  it('fades the old price toward its low plateau after the midpoint', () => {
    const { container: beforeMid } = renderAt(0, base, 120);
    const beforeOpacity = Number(
      (beforeMid.querySelector('[data-testid="price-reveal-old"]') as HTMLElement).style.opacity,
    );
    cleanup();
    renderAt(119, base, 120);
    const afterOpacity = Number(screen.getByTestId('price-reveal-old').style.opacity);
    expect(afterOpacity).toBeLessThan(beforeOpacity);
  });
});

describe('priceRevealPropsSchema', () => {
  it('requires non-empty oldPrice and newPrice', () => {
    expect(priceRevealPropsSchema.safeParse({}).success).toBe(false);
    expect(priceRevealPropsSchema.safeParse({ oldPrice: '', newPrice: '$10' }).success).toBe(false);
    expect(priceRevealPropsSchema.safeParse({ oldPrice: '$99', newPrice: '' }).success).toBe(false);
  });

  it('accepts a complete config', () => {
    expect(
      priceRevealPropsSchema.safeParse({
        oldPrice: '$99',
        newPrice: '$79',
        oldLabel: 'Was',
        newLabel: 'Now',
        accent: '#f00',
        strikeColor: '#999',
        textColor: '#000',
        background: '#fff',
      }).success,
    ).toBe(true);
  });

  it('accepts empty label strings (used to hide)', () => {
    expect(
      priceRevealPropsSchema.safeParse({ oldPrice: '$99', newPrice: '$79', oldLabel: '' }).success,
    ).toBe(true);
  });
});

describe('priceRevealClip', () => {
  it('declares kind and fonts', () => {
    expect(priceRevealClip.kind).toBe('price-reveal');
    const fonts = priceRevealClip.fontRequirements?.({
      oldPrice: '$99',
      newPrice: '$79',
    } as PriceRevealProps);
    expect(fonts).toEqual([
      { family: 'Plus Jakarta Sans', weight: 500 },
      { family: 'Plus Jakarta Sans', weight: 600 },
      { family: 'Plus Jakarta Sans', weight: 800 },
    ]);
  });
});
