// packages/runtimes/frame-runtime-bridge/src/clips/breaking-banner.test.tsx
// T-324a — BreakingBanner clip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue
// (mirrors the workaround documented in `lyrics.test.tsx`): the barrel
// pulls in every clip module before this test's direct `./breaking-banner.js`
// import is dereferenced, so `ALL_BRIDGE_CLIPS` is fully populated when read.
import {
  ALL_BRIDGE_CLIPS,
  BreakingBanner,
  type BreakingBannerProps,
  breakingBannerClip,
  breakingBannerPropsSchema,
} from './index.js';

afterEach(cleanup);

const MIN_PROPS: BreakingBannerProps = {
  headline: 'severe storms hit Florida coastline',
  label: { text: 'BREAKING NEWS', fill: '#CC0000', color: '#FFFFFF' },
};

function renderAt(frame: number, props: BreakingBannerProps, durationInFrames = 90) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <BreakingBanner {...props} />
    </FrameProvider>,
  );
}

describe('breakingBannerPropsSchema', () => {
  it('accepts minimal valid input (only required fields)', () => {
    expect(breakingBannerPropsSchema.safeParse(MIN_PROPS).success).toBe(true);
  });

  it('rejects missing headline', () => {
    expect(
      breakingBannerPropsSchema.safeParse({
        label: { text: 'BREAKING', fill: '#CC0000', color: '#FFFFFF' },
      }).success,
    ).toBe(false);
  });

  it('rejects missing label', () => {
    expect(breakingBannerPropsSchema.safeParse({ headline: 'x' }).success).toBe(false);
  });

  it('rejects invalid mode / slideAxis / casing / sliverAnchor enums', () => {
    expect(breakingBannerPropsSchema.safeParse({ ...MIN_PROPS, mode: 'invalid' }).success).toBe(
      false,
    );
    expect(
      breakingBannerPropsSchema.safeParse({ ...MIN_PROPS, slideAxis: 'diagonal' }).success,
    ).toBe(false);
    expect(
      breakingBannerPropsSchema.safeParse({ ...MIN_PROPS, casing: 'sentence-case' }).success,
    ).toBe(false);
    expect(
      breakingBannerPropsSchema.safeParse({ ...MIN_PROPS, sliverAnchor: 'middle' }).success,
    ).toBe(false);
  });

  it('rejects out-of-range sliverWidthPct', () => {
    expect(
      breakingBannerPropsSchema.safeParse({ ...MIN_PROPS, sliverWidthPct: 0.05 }).success,
    ).toBe(false);
    expect(breakingBannerPropsSchema.safeParse({ ...MIN_PROPS, sliverWidthPct: 0.7 }).success).toBe(
      false,
    );
  });

  it('accepts all enum values', () => {
    for (const mode of ['banner', 'sliver'] as const) {
      expect(breakingBannerPropsSchema.safeParse({ ...MIN_PROPS, mode }).success).toBe(true);
    }
    for (const slideAxis of ['horizontal', 'vertical'] as const) {
      expect(breakingBannerPropsSchema.safeParse({ ...MIN_PROPS, slideAxis }).success).toBe(true);
    }
    for (const casing of ['as-is', 'uppercase', 'lowercase', 'title-case'] as const) {
      expect(breakingBannerPropsSchema.safeParse({ ...MIN_PROPS, casing }).success).toBe(true);
    }
    for (const sliverAnchor of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
      expect(breakingBannerPropsSchema.safeParse({ ...MIN_PROPS, sliverAnchor }).success).toBe(
        true,
      );
    }
  });

  it('rejects unknown keys (strict)', () => {
    expect(breakingBannerPropsSchema.safeParse({ ...MIN_PROPS, unknownKey: true }).success).toBe(
      false,
    );
  });
});

describe('<BreakingBanner> banner mode — horizontal slide', () => {
  it('starts off-screen translateX(-100%) at frame 0', () => {
    renderAt(0, MIN_PROPS);
    const el = screen.getByTestId('breaking-banner-clip');
    expect(el.style.transform).toBe('translateX(-100%)');
    expect(Number(el.style.opacity)).toBe(0);
  });

  it('settles at translateX(0%) after the entrance window', () => {
    renderAt(30, MIN_PROPS, 90);
    const el = screen.getByTestId('breaking-banner-clip');
    expect(el.style.transform).toBe('translateX(0%)');
    expect(Number(el.style.opacity)).toBe(1);
  });

  it('exits to translateX(120%) at the final frame', () => {
    renderAt(90, MIN_PROPS, 90);
    const el = screen.getByTestId('breaking-banner-clip');
    expect(el.style.transform).toBe('translateX(120%)');
    expect(Number(el.style.opacity)).toBe(0);
  });
});

describe('<BreakingBanner> banner mode — vertical slide', () => {
  it('starts off-screen translateY(100%) at frame 0', () => {
    renderAt(0, { ...MIN_PROPS, slideAxis: 'vertical' });
    const el = screen.getByTestId('breaking-banner-clip');
    expect(el.style.transform).toBe('translateY(100%)');
    expect(Number(el.style.opacity)).toBe(0);
  });

  it('settles at translateY(0%) after the entrance window', () => {
    renderAt(30, { ...MIN_PROPS, slideAxis: 'vertical' }, 90);
    const el = screen.getByTestId('breaking-banner-clip');
    expect(el.style.transform).toBe('translateY(0%)');
    expect(Number(el.style.opacity)).toBe(1);
  });
});

describe('<BreakingBanner> sliver mode skips entrance', () => {
  it('renders at translateX(0%) and opacity=1 at frame 0', () => {
    renderAt(0, { ...MIN_PROPS, mode: 'sliver' });
    const el = screen.getByTestId('breaking-banner-clip');
    expect(el.style.transform).toBe('translateX(0%)');
    expect(Number(el.style.opacity)).toBe(1);
  });

  it('renders identically across frames (no animation)', () => {
    const r1 = renderAt(0, { ...MIN_PROPS, mode: 'sliver' });
    const html1 = r1.container.innerHTML;
    cleanup();
    const r2 = renderAt(45, { ...MIN_PROPS, mode: 'sliver' });
    const html2 = r2.container.innerHTML;
    expect(html1).toBe(html2);
  });

  it('respects sliverAnchor', () => {
    renderAt(0, { ...MIN_PROPS, mode: 'sliver', sliverAnchor: 'top-right' });
    const el = screen.getByTestId('breaking-banner-clip');
    expect(el.style.top).toBe('0px');
    expect(el.style.right).toBe('0px');
  });
});

describe('<BreakingBanner> headline + label rendering', () => {
  it('uppercase casing transforms headline text', () => {
    renderAt(30, { ...MIN_PROPS, casing: 'uppercase' }, 90);
    const headline = screen.getByTestId('breaking-banner-headline');
    expect(headline.textContent).toBe('SEVERE STORMS HIT FLORIDA COASTLINE');
    // Label text rendered verbatim regardless
    expect(screen.getByTestId('breaking-banner-label').textContent).toBe('BREAKING NEWS');
  });

  it('title-case casing capitalizes first letter of each token', () => {
    renderAt(
      30,
      {
        headline: 'severe storms hit florida',
        label: { text: 'BREAKING NEWS', fill: '#CC0000', color: '#FFFFFF' },
        casing: 'title-case',
      },
      90,
    );
    expect(screen.getByTestId('breaking-banner-headline').textContent).toBe(
      'Severe Storms Hit Florida',
    );
  });

  it('lowercase casing lowercases the headline', () => {
    renderAt(
      30,
      {
        headline: 'SEVERE STORMS',
        label: { text: 'BREAKING', fill: '#CC0000', color: '#FFFFFF' },
        casing: 'lowercase',
      },
      90,
    );
    expect(screen.getByTestId('breaking-banner-headline').textContent).toBe('severe storms');
  });

  it('as-is casing leaves headline verbatim', () => {
    renderAt(30, MIN_PROPS, 90);
    expect(screen.getByTestId('breaking-banner-headline').textContent).toBe(
      'severe storms hit Florida coastline',
    );
  });
});

describe('<BreakingBanner> end-cap', () => {
  it('renders end-cap at given fill + position', () => {
    renderAt(30, { ...MIN_PROPS, endCap: { fill: '#CC0000', position: 'right' } }, 90);
    const cap = screen.getByTestId('breaking-banner-end-cap');
    expect(cap.style.background).toBe('#CC0000');
  });

  it('omits the end-cap element when endCap prop is absent', () => {
    renderAt(30, MIN_PROPS, 90);
    expect(screen.queryByTestId('breaking-banner-end-cap')).toBeNull();
  });
});

describe('<BreakingBanner> font override', () => {
  it('uses Plus Jakarta Sans 800 by default on label + headline', () => {
    renderAt(30, MIN_PROPS, 90);
    const label = screen.getByTestId('breaking-banner-label');
    const headline = screen.getByTestId('breaking-banner-headline');
    expect(label.style.fontFamily).toContain('Plus Jakarta Sans');
    expect(headline.style.fontFamily).toContain('Plus Jakarta Sans');
    expect(label.style.fontWeight).toBe('800');
    expect(headline.style.fontWeight).toBe('800');
  });

  it('font.family + weight override applies to label + headline', () => {
    renderAt(
      30,
      { ...MIN_PROPS, font: { family: 'Bebas Neue, Impact, sans-serif', weight: 700 } },
      90,
    );
    const label = screen.getByTestId('breaking-banner-label');
    const headline = screen.getByTestId('breaking-banner-headline');
    expect(label.style.fontFamily).toContain('Bebas Neue');
    expect(headline.style.fontFamily).toContain('Bebas Neue');
    expect(label.style.fontWeight).toBe('700');
    expect(headline.style.fontWeight).toBe('700');
  });
});

describe('<BreakingBanner> theme-slot fallback + borderRadius', () => {
  it('applies explicit background + headlineColor when set', () => {
    renderAt(
      30,
      { ...MIN_PROPS, background: '#FFFFFF', headlineColor: '#000000', borderRadius: 8 },
      90,
    );
    const el = screen.getByTestId('breaking-banner-clip');
    expect(el.style.background).toBe('#FFFFFF');
    expect(el.style.borderRadius).toBe('8px');
    expect(screen.getByTestId('breaking-banner-headline').style.color).toBe('#000000');
  });

  it('falls back to defaults when background + headlineColor absent', () => {
    renderAt(30, MIN_PROPS, 90);
    const el = screen.getByTestId('breaking-banner-clip');
    expect(el.style.background).toBeTruthy();
    expect(el.style.borderRadius).toBe('0px');
  });
});

describe('<BreakingBanner> determinism', () => {
  it('renders byte-identical HTML across two calls at the same frame', () => {
    const r1 = renderAt(30, MIN_PROPS, 90);
    const html1 = r1.container.innerHTML;
    cleanup();
    const r2 = renderAt(30, MIN_PROPS, 90);
    const html2 = r2.container.innerHTML;
    expect(html1).toBe(html2);
  });
});

describe('breakingBannerClip definition', () => {
  it('registers under kind "breaking-banner" with theme slots', () => {
    expect(breakingBannerClip.kind).toBe('breaking-banner');
    expect(breakingBannerClip.propsSchema).toBe(breakingBannerPropsSchema);
    expect(breakingBannerClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      headlineColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('declares Plus Jakarta Sans 800 as a font requirement', () => {
    expect(breakingBannerClip.fontRequirements?.({} as never)).toEqual([
      { family: 'Plus Jakarta Sans', weight: 800 },
    ]);
  });

  it('is appended to ALL_BRIDGE_CLIPS (length 59, includes breaking-banner kind)', () => {
    expect(ALL_BRIDGE_CLIPS).toHaveLength(63);
    expect(ALL_BRIDGE_CLIPS.some((c) => c.kind === 'breaking-banner')).toBe(true);
  });
});
