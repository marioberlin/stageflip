// packages/runtimes/frame-runtime-bridge/src/clips/testimonial-card.test.tsx
// T-183 — TestimonialCard clip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  TestimonialCard,
  type TestimonialCardProps,
  testimonialCardClip,
  testimonialCardPropsSchema,
} from './testimonial-card.js';

afterEach(cleanup);

function renderAt(frame: number, props: TestimonialCardProps, durationInFrames = 120) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <TestimonialCard {...props} />
    </FrameProvider>,
  );
}

const basicProps: TestimonialCardProps = {
  quote: 'This tool changed everything.',
  attributionName: 'Grace Hopper',
};

describe('<TestimonialCard>', () => {
  it('is faded out + offset on frame 0', () => {
    renderAt(0, basicProps);
    const root = screen.getByTestId('testimonial-card-clip');
    expect(Number(root.style.opacity)).toBe(0);
    const card = root.firstElementChild as HTMLElement;
    expect(card.style.transform).toBe('translateY(24px)');
  });

  it('is fully visible + settled mid-clip', () => {
    renderAt(60, basicProps, 120);
    const root = screen.getByTestId('testimonial-card-clip');
    expect(Number(root.style.opacity)).toBe(1);
    const card = root.firstElementChild as HTMLElement;
    expect(card.style.transform).toBe('translateY(0px)');
  });

  it('fades out at the final frame', () => {
    renderAt(120, basicProps, 120);
    const root = screen.getByTestId('testimonial-card-clip');
    expect(Number(root.style.opacity)).toBe(0);
  });

  it('renders quote, name, and role', () => {
    renderAt(60, { ...basicProps, attributionRole: 'Rear Admiral' }, 120);
    expect(screen.getByTestId('testimonial-card-quote').textContent).toBe(
      '\u201CThis tool changed everything.\u201D',
    );
    expect(screen.getByTestId('testimonial-card-name').textContent).toBe('Grace Hopper');
    expect(screen.getByTestId('testimonial-card-role').textContent).toBe('Rear Admiral');
  });

  it('omits the role when empty', () => {
    renderAt(60, { ...basicProps, attributionRole: '' }, 120);
    expect(screen.queryByTestId('testimonial-card-role')).toBeNull();
  });
});

describe('testimonialCardClip definition', () => {
  it('registers under kind "testimonial-card" with theme slots', () => {
    expect(testimonialCardClip.kind).toBe('testimonial-card');
    expect(testimonialCardClip.propsSchema).toBe(testimonialCardPropsSchema);
    expect(testimonialCardClip.themeSlots).toEqual({
      surface: { kind: 'palette', role: 'surface' },
      accent: { kind: 'palette', role: 'accent' },
      textColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('propsSchema requires quote and attributionName', () => {
    expect(testimonialCardPropsSchema.safeParse({}).success).toBe(false);
    expect(testimonialCardPropsSchema.safeParse({ quote: 'x', attributionName: 'y' }).success).toBe(
      true,
    );
  });

  it('propsSchema rejects non-positive maxWidth', () => {
    expect(
      testimonialCardPropsSchema.safeParse({
        quote: 'x',
        attributionName: 'y',
        maxWidthPx: 0,
      }).success,
    ).toBe(false);
  });
});
