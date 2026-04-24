// packages/runtimes/frame-runtime-bridge/src/clips/product-carousel.test.tsx
// T-202 — ProductCarousel clip behaviour + propsSchema + slot helper.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  type CarouselItem,
  ProductCarousel,
  type ProductCarouselProps,
  carouselSlotsAtFrame,
  productCarouselClip,
  productCarouselPropsSchema,
} from './product-carousel.js';

afterEach(cleanup);

const items: CarouselItem[] = [
  { imageSrc: 'https://example.com/a.png', name: 'Alpha', price: '$10' },
  { imageSrc: 'https://example.com/b.png', name: 'Bravo', price: '$20' },
  { imageSrc: 'https://example.com/c.png', name: 'Charlie' },
];

function renderAt(frame: number, props: ProductCarouselProps, durationInFrames = 240) {
  return render(
    <FrameProvider frame={frame} config={{ width: 300, height: 250, fps: 24, durationInFrames }}>
      <ProductCarousel {...props} />
    </FrameProvider>,
  );
}

describe('carouselSlotsAtFrame', () => {
  // fps=24, hold=2s=48f, crossfade=0.4s=10f → cycle=58f, 3 items = 174f
  const fps = 24;
  const hold = 2;
  const xfade = 0.4;
  const items3 = 3;

  it('returns slot 0 fully visible at frame 0', () => {
    const s = carouselSlotsAtFrame(0, fps, items3, hold, xfade);
    expect(s.current.index).toBe(0);
    expect(s.current.opacity).toBe(1);
    expect(s.next.opacity).toBe(0);
  });

  it('stays on slot 0 throughout the hold window', () => {
    const s = carouselSlotsAtFrame(47, fps, items3, hold, xfade);
    expect(s.current.index).toBe(0);
    expect(s.current.opacity).toBe(1);
  });

  it('crosses into the next slot partway through the crossfade window', () => {
    // hold=48f, crossfade=10f → at frame 53 (mid-crossfade) opacity ≈ 0.5
    const s = carouselSlotsAtFrame(53, fps, items3, hold, xfade);
    expect(s.current.index).toBe(0);
    expect(s.next.index).toBe(1);
    expect(s.current.opacity).toBeCloseTo(0.5, 1);
    expect(s.next.opacity).toBeCloseTo(0.5, 1);
  });

  it('advances to slot 1 at the start of the next cycle', () => {
    // cycle = 58f
    const s = carouselSlotsAtFrame(58, fps, items3, hold, xfade);
    expect(s.current.index).toBe(1);
    expect(s.current.opacity).toBe(1);
  });

  it('wraps around from the last slot back to slot 0', () => {
    // cycle=58, 3 items → total = 174. frame 174 wraps to 0.
    const s = carouselSlotsAtFrame(174, fps, items3, hold, xfade);
    expect(s.current.index).toBe(0);
    expect(s.current.opacity).toBe(1);
  });

  it('opacities always sum to 1 across every frame', () => {
    for (let f = 0; f < 300; f++) {
      const s = carouselSlotsAtFrame(f, fps, items3, hold, xfade);
      expect(s.current.opacity + s.next.opacity).toBeCloseTo(1, 4);
    }
  });

  it('is deterministic', () => {
    const a = carouselSlotsAtFrame(42, fps, items3, hold, xfade);
    const b = carouselSlotsAtFrame(42, fps, items3, hold, xfade);
    expect(a).toEqual(b);
  });
});

describe('<ProductCarousel>', () => {
  it('renders the first item at frame 0', () => {
    renderAt(0, { items });
    expect(screen.getByTestId('product-carousel-current-name').textContent).toBe('Alpha');
    expect(screen.queryByTestId('product-carousel-next')).toBeNull();
  });

  it('renders the second item after the first cycle', () => {
    renderAt(58, { items }); // cycle=58f at fps=24 / hold=2 / xfade=0.4
    expect(screen.getByTestId('product-carousel-current-name').textContent).toBe('Bravo');
  });

  it('mounts both layers during the crossfade window', () => {
    renderAt(53, { items }); // mid-crossfade
    expect(screen.getByTestId('product-carousel-current-name').textContent).toBe('Alpha');
    expect(screen.getByTestId('product-carousel-next-name').textContent).toBe('Bravo');
  });

  it('renders the price when provided', () => {
    renderAt(0, { items });
    expect(screen.getByTestId('product-carousel-current-price').textContent).toBe('$10');
  });

  it('omits the price element when the item has none', () => {
    renderAt(58 * 2, { items }); // slot 2 = Charlie (no price)
    expect(screen.queryByTestId('product-carousel-current-price')).toBeNull();
  });
});

describe('productCarouselPropsSchema', () => {
  it('requires at least 2 items', () => {
    expect(productCarouselPropsSchema.safeParse({ items: [items[0]] }).success).toBe(false);
  });

  it('rejects more than 5 items', () => {
    const big = Array.from({ length: 6 }, (_, i) => ({
      imageSrc: `https://example.com/${i}.png`,
      name: `n${i}`,
    }));
    expect(productCarouselPropsSchema.safeParse({ items: big }).success).toBe(false);
  });

  it('rejects an item with an empty name', () => {
    expect(
      productCarouselPropsSchema.safeParse({
        items: [
          { imageSrc: 'https://example.com/a.png', name: '' },
          { imageSrc: 'https://example.com/b.png', name: 'b' },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects holdSeconds outside (0, 10]', () => {
    expect(productCarouselPropsSchema.safeParse({ items, holdSeconds: 0 }).success).toBe(false);
    expect(productCarouselPropsSchema.safeParse({ items, holdSeconds: 11 }).success).toBe(false);
  });

  it('rejects crossfadeSeconds outside (0, 2]', () => {
    expect(productCarouselPropsSchema.safeParse({ items, crossfadeSeconds: 0 }).success).toBe(
      false,
    );
    expect(productCarouselPropsSchema.safeParse({ items, crossfadeSeconds: 3 }).success).toBe(
      false,
    );
  });

  it('accepts a complete config', () => {
    expect(
      productCarouselPropsSchema.safeParse({
        items,
        holdSeconds: 1.5,
        crossfadeSeconds: 0.3,
        textColor: '#111',
        accent: '#f00',
        background: '#fff',
      }).success,
    ).toBe(true);
  });
});

describe('productCarouselClip', () => {
  it('declares kind and fonts', () => {
    expect(productCarouselClip.kind).toBe('product-carousel');
    const fonts = productCarouselClip.fontRequirements?.({
      items,
    } as ProductCarouselProps);
    expect(fonts).toEqual([
      { family: 'Plus Jakarta Sans', weight: 700 },
      { family: 'Plus Jakarta Sans', weight: 800 },
    ]);
  });
});
