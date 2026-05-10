// packages/runtimes/frame-runtime-bridge/src/clips/link-sticker.test.tsx
// T-371a — LinkSticker clip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue
// (mirrors the workaround documented in `lyrics.test.tsx` /
// `score-bug.test.tsx` / `subscribe-button.test.tsx` /
// `follow-prompt.test.tsx` / `qr-code-bounce.test.tsx`): the barrel
// pulls in every clip module before this test's direct
// `./link-sticker.js` import is dereferenced, so `ALL_BRIDGE_CLIPS` is
// fully populated when read.
import {
  ALL_BRIDGE_CLIPS,
  LinkSticker,
  type LinkStickerProps,
  computeShimmerX,
  linkStickerClip,
  linkStickerPropsSchema,
  resolveTokens,
} from './index.js';

afterEach(cleanup);

const MIN_PROPS: LinkStickerProps = {
  label: 'example.com',
  variant: 'white-on-dark',
  position: { x: 100, y: 200 },
};

function renderAt(
  frame: number,
  props: LinkStickerProps,
  config: { width?: number; height?: number; fps?: number; durationInFrames?: number } = {},
) {
  // Default to a 9:16 portrait Story canvas at fps 30 (per task spec
  // — typical Instagram Story duration / aspect).
  const { width = 1080, height = 1920, fps = 30, durationInFrames = 600 } = config;
  return render(
    <FrameProvider frame={frame} config={{ width, height, fps, durationInFrames }}>
      <LinkSticker {...props} />
    </FrameProvider>,
  );
}

describe('linkStickerPropsSchema — minimal inputs', () => {
  it('accepts minimal valid input (label + variant + position)', () => {
    expect(linkStickerPropsSchema.safeParse(MIN_PROPS).success).toBe(true);
  });

  it('accepts override of all optional fields', () => {
    expect(
      linkStickerPropsSchema.safeParse({
        ...MIN_PROPS,
        phase: 'idle',
        width: 240,
        height: 50,
        fontSize: 16,
        brandColor: '#FF6600',
        shimmer: { cycleFrames: 60, bandWidth: 30, highlightColor: '#FFFFFF' },
        background: '#222222',
        textColor: '#FFFFFF',
        shadowColor: '#888888',
      }).success,
    ).toBe(true);
  });
});

describe('linkStickerPropsSchema — required-field rejections', () => {
  it('rejects missing label', () => {
    expect(
      linkStickerPropsSchema.safeParse({
        variant: 'white-on-dark',
        position: { x: 0, y: 0 },
      }).success,
    ).toBe(false);
  });

  it('rejects missing variant', () => {
    expect(
      linkStickerPropsSchema.safeParse({
        label: 'example.com',
        position: { x: 0, y: 0 },
      }).success,
    ).toBe(false);
  });

  it('rejects missing position', () => {
    expect(
      linkStickerPropsSchema.safeParse({
        label: 'example.com',
        variant: 'white-on-dark',
      }).success,
    ).toBe(false);
  });

  it('rejects empty label and overlong label', () => {
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, label: '' }).success).toBe(false);
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, label: 'x'.repeat(81) }).success).toBe(
      false,
    );
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, label: 'x'.repeat(80) }).success).toBe(
      true,
    );
  });

  it('rejects unknown variant', () => {
    expect(
      linkStickerPropsSchema.safeParse({ ...MIN_PROPS, variant: 'rainbow-gradient' }).success,
    ).toBe(false);
  });

  it('rejects unknown phase', () => {
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, phase: 'pressing' }).success).toBe(
      false,
    );
  });

  it('rejects out-of-range geometry', () => {
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, width: 79 }).success).toBe(false);
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, width: 601 }).success).toBe(false);
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, width: 80 }).success).toBe(true);
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, width: 600 }).success).toBe(true);

    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, height: 27 }).success).toBe(false);
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, height: 97 }).success).toBe(false);
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, height: 28 }).success).toBe(true);
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, height: 96 }).success).toBe(true);

    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, fontSize: 9 }).success).toBe(false);
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, fontSize: 25 }).success).toBe(false);
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, fontSize: 10 }).success).toBe(true);
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, fontSize: 24 }).success).toBe(true);
  });

  it('rejects extra unknown field (strict mode)', () => {
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, mystery: true }).success).toBe(false);
  });

  it('rejects malformed hex on background / brandColor / textColor / shadowColor', () => {
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, background: '#GGG' }).success).toBe(
      false,
    );
    expect(
      linkStickerPropsSchema.safeParse({ ...MIN_PROPS, brandColor: 'rgb(0,0,0)' }).success,
    ).toBe(false);
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, textColor: 'red' }).success).toBe(
      false,
    );
    expect(linkStickerPropsSchema.safeParse({ ...MIN_PROPS, shadowColor: '#fff' }).success).toBe(
      false,
    );
  });
});

describe('computeShimmerX — closed-form linear sweep', () => {
  it('returns -bandWidth at frame 0 (band off-left)', () => {
    expect(computeShimmerX(0, 90, 200, 40)).toBe(-40);
  });

  it('returns approximately pillWidth/2 - bandWidth/2 at half-cycle', () => {
    // (45/90) * (200+40) - 40 = 0.5 * 240 - 40 = 120 - 40 = 80
    expect(computeShimmerX(45, 90, 200, 40)).toBe(80);
  });

  it('wraps back to -bandWidth at the cycleFrames boundary', () => {
    expect(computeShimmerX(90, 90, 200, 40)).toBe(-40);
    expect(computeShimmerX(180, 90, 200, 40)).toBe(-40);
  });

  it('handles negative frames via the modulo guard', () => {
    expect(computeShimmerX(-90, 90, 200, 40)).toBe(-40);
  });

  it('returns -bandWidth defensively when cycleFrames <= 0', () => {
    expect(computeShimmerX(60, 0, 200, 40)).toBe(-40);
  });
});

describe('resolveTokens — variant defaults + brand-color edge cases', () => {
  it('white-on-dark — black background, white text', () => {
    expect(resolveTokens(MIN_PROPS)).toEqual({
      background: '#000000',
      textColor: '#FFFFFF',
      shadowColor: '#000000',
      shimmerHighlight: '#FFFFFF',
    });
  });

  it('dark-on-white — white background, black text', () => {
    expect(
      resolveTokens({
        label: 'x',
        variant: 'dark-on-white',
        position: { x: 0, y: 0 },
      }),
    ).toEqual({
      background: '#FFFFFF',
      textColor: '#000000',
      shadowColor: '#666666',
      shimmerHighlight: '#FFFFFF',
    });
  });

  it('frosted-glass — opaque #CCCCCC fallback (D-T371a-blur deferral)', () => {
    expect(
      resolveTokens({
        label: 'x',
        variant: 'frosted-glass',
        position: { x: 0, y: 0 },
      }).background,
    ).toBe('#CCCCCC');
  });

  it('brand-color — defaults to Instagram pink #E1306C when no brandColor', () => {
    expect(
      resolveTokens({
        label: 'x',
        variant: 'brand-color',
        position: { x: 0, y: 0 },
      }).background,
    ).toBe('#E1306C');
  });

  it('brand-color — uses brandColor as background when provided and no background override', () => {
    expect(
      resolveTokens({
        label: 'x',
        variant: 'brand-color',
        brandColor: '#FF6600',
        position: { x: 0, y: 0 },
      }).background,
    ).toBe('#FF6600');
  });

  it('brand-color — explicit background prop wins over brandColor', () => {
    expect(
      resolveTokens({
        label: 'x',
        variant: 'brand-color',
        brandColor: '#FF6600',
        background: '#000000',
        position: { x: 0, y: 0 },
      }).background,
    ).toBe('#000000');
  });

  it('consumer prop wins over variant default for textColor / shadowColor', () => {
    expect(
      resolveTokens({
        ...MIN_PROPS,
        textColor: '#AAAAAA',
        shadowColor: '#BBBBBB',
      }),
    ).toMatchObject({
      textColor: '#AAAAAA',
      shadowColor: '#BBBBBB',
    });
  });

  it('shimmer.highlightColor wins over variant default', () => {
    expect(
      resolveTokens({
        ...MIN_PROPS,
        shimmer: { highlightColor: '#FFEE00' },
      }).shimmerHighlight,
    ).toBe('#FFEE00');
  });
});

describe('<LinkSticker> render', () => {
  it('renders the pill at position with default geometry', () => {
    renderAt(0, MIN_PROPS);
    const pill = screen.getByTestId('link-sticker');
    expect(pill.style.left).toBe('100px');
    expect(pill.style.top).toBe('200px');
    expect(pill.style.width).toBe('200px');
    expect(pill.style.height).toBe('44px');
    // border-radius = height / 2 = 22px (full-pill)
    expect(pill.style.borderRadius).toBe('22px');
  });

  it('renders the label text', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.getByTestId('link-sticker-label').textContent).toBe('example.com');
  });

  it('honors width / height / fontSize overrides', () => {
    renderAt(0, { ...MIN_PROPS, width: 320, height: 60, fontSize: 18 });
    const pill = screen.getByTestId('link-sticker');
    expect(pill.style.width).toBe('320px');
    expect(pill.style.height).toBe('60px');
    expect(pill.style.borderRadius).toBe('30px');
    const label = screen.getByTestId('link-sticker-label');
    expect(label.style.fontSize).toBe('18px');
  });

  it('renders all 4 variants with canonical default backgrounds', () => {
    const variants: Array<
      ['white-on-dark' | 'dark-on-white' | 'frosted-glass' | 'brand-color', string]
    > = [
      ['white-on-dark', '#000000'],
      ['dark-on-white', '#FFFFFF'],
      ['frosted-glass', '#CCCCCC'],
      ['brand-color', '#E1306C'],
    ];
    for (const [variant, expectedBg] of variants) {
      renderAt(0, { ...MIN_PROPS, variant, phase: 'idle' });
      const pill = screen.getByTestId('link-sticker');
      expect(pill.dataset.variant).toBe(variant);
      expect(pill.dataset.background).toBe(expectedBg);
      cleanup();
    }
  });

  it('brand-color: brandColor drives background when no background override', () => {
    renderAt(0, {
      ...MIN_PROPS,
      variant: 'brand-color',
      brandColor: '#FF6600',
      phase: 'idle',
    });
    const pill = screen.getByTestId('link-sticker');
    expect(pill.dataset.background).toBe('#FF6600');
  });

  it('brand-color: explicit background wins over brandColor', () => {
    renderAt(0, {
      ...MIN_PROPS,
      variant: 'brand-color',
      brandColor: '#FF6600',
      background: '#000000',
      phase: 'idle',
    });
    const pill = screen.getByTestId('link-sticker');
    expect(pill.dataset.background).toBe('#000000');
  });

  it('renders shimmer overlay when phase=shimmering (default)', () => {
    renderAt(0, MIN_PROPS);
    const shimmer = screen.getByTestId('link-sticker-shimmer');
    expect(shimmer).toBeTruthy();
    // At frame 0 with default cycleFrames=ceil(30*3)=90 and bandWidth=40,
    // shimmerX = -40 (off-left).
    expect(shimmer.style.left).toBe('-40px');
    expect(shimmer.dataset.shimmerX).toBe('-40');
  });

  it('renders shimmer overlay at mid-cycle position', () => {
    // fps 30 → cycleFrames default 90 → frame 45 is mid-cycle.
    // shimmerX = round((45/90) * (200 + 40) - 40) = round(80) = 80
    renderAt(45, MIN_PROPS);
    const shimmer = screen.getByTestId('link-sticker-shimmer');
    expect(shimmer.style.left).toBe('80px');
  });

  it('shimmer wraps at cycleFrames boundary', () => {
    renderAt(90, MIN_PROPS);
    const shimmer = screen.getByTestId('link-sticker-shimmer');
    expect(shimmer.style.left).toBe('-40px');
  });

  it('does NOT render shimmer overlay when phase=idle', () => {
    renderAt(0, { ...MIN_PROPS, phase: 'idle' });
    expect(screen.queryByTestId('link-sticker-shimmer')).toBeNull();
  });

  it('honors shimmer.cycleFrames / shimmer.bandWidth / shimmer.highlightColor overrides', () => {
    // cycleFrames=60, bandWidth=30, frame=15 → shimmerX = round((15/60)*(200+30) - 30) = round(57.5 - 30) = round(27.5) = 28
    renderAt(15, {
      ...MIN_PROPS,
      shimmer: { cycleFrames: 60, bandWidth: 30, highlightColor: '#FFEE00' },
    });
    const shimmer = screen.getByTestId('link-sticker-shimmer');
    expect(shimmer.style.left).toBe('28px');
    expect(shimmer.style.width).toBe('30px');
    expect(shimmer.style.background.toLowerCase()).toContain('#ffee00');
  });

  it('renders shadow color from variant default', () => {
    renderAt(0, MIN_PROPS);
    const pill = screen.getByTestId('link-sticker');
    expect(pill.dataset.shadowColor).toBe('#000000');
    expect(pill.style.boxShadow).toContain('2px 4px');
    expect(pill.style.boxShadow).toContain('#000000');
  });
});

describe('clip registration', () => {
  it('registers as kind "link-sticker" and is in ALL_BRIDGE_CLIPS at length 63', () => {
    expect(linkStickerClip.kind).toBe('link-sticker');
    expect(ALL_BRIDGE_CLIPS).toHaveLength(63);
    expect(ALL_BRIDGE_CLIPS).toContain(linkStickerClip);
  });

  it('declares Inter Medium fontRequirements', () => {
    expect(linkStickerClip.fontRequirements).toBeDefined();
    const reqs = linkStickerClip.fontRequirements?.({} as never) ?? [];
    expect(reqs).toEqual([{ family: 'Inter', weight: 500 }]);
  });
});

describe('determinism', () => {
  it('renders byte-identical HTML for the same props at the same frame', () => {
    const { container: a } = renderAt(60, MIN_PROPS);
    const htmlA = a.innerHTML;
    cleanup();
    const { container: b } = renderAt(60, MIN_PROPS);
    const htmlB = b.innerHTML;
    expect(htmlA).toBe(htmlB);
  });

  it('renders byte-identical HTML at the canonical mid-shimmer reference frame 60', () => {
    const { container: a } = renderAt(60, { ...MIN_PROPS, variant: 'brand-color' });
    const htmlA = a.innerHTML;
    cleanup();
    const { container: b } = renderAt(60, { ...MIN_PROPS, variant: 'brand-color' });
    const htmlB = b.innerHTML;
    expect(htmlA).toBe(htmlB);
  });
});
