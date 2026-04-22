// packages/runtimes/frame-runtime-bridge/src/clips/image-gallery.test.tsx
// T-131f.1 — imageGalleryClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ImageGallery,
  type ImageGalleryProps,
  imageGalleryClip,
  imageGalleryPropsSchema,
} from './image-gallery.js';

afterEach(cleanup);

const URLS = [
  'https://example.com/a.jpg',
  'https://example.com/b.jpg',
  'https://example.com/c.jpg',
];

function renderAt(frame: number, props: ImageGalleryProps, durationInFrames = 240) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <ImageGallery {...props} />
    </FrameProvider>,
  );
}

describe('ImageGallery component (T-131f.1)', () => {
  it('renders one <img> per imageUrl', () => {
    renderAt(60, { imageUrls: URLS });
    expect(screen.getByTestId('image-gallery-image-0')).toBeDefined();
    expect(screen.getByTestId('image-gallery-image-1')).toBeDefined();
    expect(screen.getByTestId('image-gallery-image-2')).toBeDefined();
  });

  it('first image fades in at frame=0', () => {
    renderAt(0, { imageUrls: URLS });
    const img0 = screen.getByTestId('image-gallery-image-0') as HTMLImageElement;
    expect(Number(img0.style.opacity)).toBe(0);
  });

  it('first image is fully visible after the fade window (15f at 30fps = 0.5s)', () => {
    renderAt(15, { imageUrls: URLS });
    const img0 = screen.getByTestId('image-gallery-image-0') as HTMLImageElement;
    expect(Number(img0.style.opacity)).toBe(1);
  });

  it('last image stays visible after end of cycle', () => {
    // 3 images × (1.5+0.5)s × 30fps = 180f cycle. At frame 200 (past end),
    // the last image should be at full opacity.
    renderAt(200, { imageUrls: URLS });
    const last = screen.getByTestId('image-gallery-image-2') as HTMLImageElement;
    expect(Number(last.style.opacity)).toBe(1);
  });

  it('renders a title when supplied', () => {
    renderAt(60, { imageUrls: URLS, title: 'Gallery' });
    expect(screen.getByTestId('image-gallery-title').textContent).toBe('Gallery');
  });

  it('shows a caption strip only when captions are provided', () => {
    renderAt(60, { imageUrls: URLS });
    expect(screen.queryByTestId('image-gallery-caption-strip')).toBeNull();
    cleanup();
    renderAt(60, { imageUrls: URLS, captions: ['cap-a', 'cap-b', 'cap-c'] });
    const strip = screen.getByTestId('image-gallery-caption-strip');
    expect(strip).toBeDefined();
    expect(strip.textContent).toContain('cap-a');
  });

  it('uses caption text as <img alt> for accessibility, falling back to "Image N" for missing slots', () => {
    // Sparse array — index 1 is a hole. The component handles
    // `captions[i]` returning `undefined` defensively (the schema
    // accepts only strings, but JSON parsing or runtime mutations could
    // leave holes). Sparse-array literal sidesteps the need for a type
    // cast in the test.
    // biome-ignore lint/suspicious/noSparseArray: deliberate — exercises the alt-fallback path.
    const captions = ['first', , 'third'] as readonly string[];
    renderAt(60, { imageUrls: URLS, captions: [...captions] });
    const img0 = screen.getByTestId('image-gallery-image-0') as HTMLImageElement;
    const img1 = screen.getByTestId('image-gallery-image-1') as HTMLImageElement;
    const img2 = screen.getByTestId('image-gallery-image-2') as HTMLImageElement;
    expect(img0.alt).toBe('first');
    expect(img1.alt).toBe('Image 2');
    expect(img2.alt).toBe('third');
  });
});

describe('imageGalleryClip definition (T-131f.1)', () => {
  it("registers under kind 'image-gallery' with three themeSlots", () => {
    expect(imageGalleryClip.kind).toBe('image-gallery');
    expect(imageGalleryClip.propsSchema).toBe(imageGalleryPropsSchema);
    expect(imageGalleryClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      titleColor: { kind: 'palette', role: 'foreground' },
      captionColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('propsSchema rejects empty imageUrls array', () => {
    expect(imageGalleryPropsSchema.safeParse({ imageUrls: [] }).success).toBe(false);
  });

  it('propsSchema rejects non-URL strings in imageUrls', () => {
    expect(imageGalleryPropsSchema.safeParse({ imageUrls: ['not-a-url'] }).success).toBe(false);
  });
});
