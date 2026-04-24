// packages/runtimes/frame-runtime-bridge/src/clips/product-reveal.test.tsx
// T-183b — ProductReveal clip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ProductReveal,
  type ProductRevealProps,
  productRevealClip,
  productRevealPropsSchema,
} from './product-reveal.js';

afterEach(cleanup);

function renderAt(frame: number, props: ProductRevealProps, durationInFrames = 90) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <ProductReveal {...props} />
    </FrameProvider>,
  );
}

const basic: ProductRevealProps = {
  imageSrc: 'https://example.com/p.png',
  productName: 'Flagship X',
};

describe('<ProductReveal>', () => {
  it('image starts offset + faded on frame 0', () => {
    renderAt(0, basic);
    const img = screen.getByTestId('product-reveal-image') as HTMLElement;
    expect(img.style.transform).toBe('translateY(80px) scale(0.88)');
    expect(Number(img.style.opacity)).toBe(0);
  });

  it('image settles after the image-reveal window', () => {
    renderAt(18, basic, 90);
    const img = screen.getByTestId('product-reveal-image') as HTMLElement;
    expect(img.style.transform).toBe('translateY(0px) scale(1)');
    expect(Number(img.style.opacity)).toBe(1);
  });

  it('name strip settles after its own window', () => {
    renderAt(27, basic, 90);
    const name = screen.getByTestId('product-reveal-name').parentElement as HTMLElement;
    expect(name.style.transform).toBe('translateX(0px)');
    expect(Number(name.style.opacity)).toBe(1);
  });

  it('renders product name text', () => {
    renderAt(60, basic, 90);
    expect(screen.getByTestId('product-reveal-name').textContent).toBe('Flagship X');
  });

  it('renders price when provided', () => {
    renderAt(60, { ...basic, price: '$299' }, 90);
    expect(screen.getByTestId('product-reveal-price').textContent).toBe('$299');
  });

  it('omits price when empty', () => {
    renderAt(60, { ...basic, price: '' }, 90);
    expect(screen.queryByTestId('product-reveal-price')).toBeNull();
  });

  it('uses alt when supplied, else falls back to productName', () => {
    renderAt(60, { ...basic, imageAlt: 'photo of product' }, 90);
    expect(screen.getByTestId('product-reveal-image').getAttribute('alt')).toBe('photo of product');
    cleanup();
    renderAt(60, basic, 90);
    expect(screen.getByTestId('product-reveal-image').getAttribute('alt')).toBe('Flagship X');
  });
});

describe('productRevealClip definition', () => {
  it('registers under kind "product-reveal" with theme slots', () => {
    expect(productRevealClip.kind).toBe('product-reveal');
    expect(productRevealClip.propsSchema).toBe(productRevealPropsSchema);
    expect(productRevealClip.themeSlots).toEqual({
      textColor: { kind: 'palette', role: 'foreground' },
      accent: { kind: 'palette', role: 'accent' },
      background: { kind: 'palette', role: 'background' },
    });
  });

  it('propsSchema requires imageSrc + productName', () => {
    expect(productRevealPropsSchema.safeParse({}).success).toBe(false);
    expect(
      productRevealPropsSchema.safeParse({
        imageSrc: 'https://x/y.png',
        productName: 'x',
      }).success,
    ).toBe(true);
  });

  it('propsSchema rejects non-URL imageSrc', () => {
    expect(
      productRevealPropsSchema.safeParse({ imageSrc: 'not-a-url', productName: 'x' }).success,
    ).toBe(false);
  });
});
