// packages/runtimes/frame-runtime-bridge/src/clips/subscribe-button.test.tsx
// T-317 — SubscribeButton clip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue
// (mirrors the workaround documented in `lyrics.test.tsx` /
// `score-bug.test.tsx`): the barrel pulls in every clip module before
// this test's direct `./subscribe-button.js` import is dereferenced, so
// `ALL_BRIDGE_CLIPS` is fully populated when read.
import {
  ALL_BRIDGE_CLIPS,
  SubscribeButton,
  type SubscribeButtonProps,
  subscribeButtonClip,
  subscribeButtonPropsSchema,
} from './index.js';

afterEach(cleanup);

const YOUTUBE_MIN: SubscribeButtonProps = {
  platform: 'youtube',
  position: { x: 100, y: 800 },
  label: 'SUBSCRIBE',
};

const TIKTOK_MIN: SubscribeButtonProps = {
  platform: 'tiktok',
  position: { x: 100, y: 800 },
  label: 'Follow',
};

const INSTAGRAM_MIN: SubscribeButtonProps = {
  platform: 'instagram',
  position: { x: 100, y: 800 },
  label: 'Follow',
};

const GENERIC_MIN: SubscribeButtonProps = {
  platform: 'generic',
  position: { x: 100, y: 800 },
  label: 'Subscribe',
};

function renderAt(frame: number, props: SubscribeButtonProps, durationInFrames = 90) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <SubscribeButton {...props} />
    </FrameProvider>,
  );
}

describe('subscribeButtonPropsSchema — minimal inputs', () => {
  it('accepts minimal valid YouTube input', () => {
    expect(subscribeButtonPropsSchema.safeParse(YOUTUBE_MIN).success).toBe(true);
  });

  it('accepts minimal valid input for all four platforms', () => {
    expect(subscribeButtonPropsSchema.safeParse(YOUTUBE_MIN).success).toBe(true);
    expect(subscribeButtonPropsSchema.safeParse(TIKTOK_MIN).success).toBe(true);
    expect(subscribeButtonPropsSchema.safeParse(INSTAGRAM_MIN).success).toBe(true);
    expect(subscribeButtonPropsSchema.safeParse(GENERIC_MIN).success).toBe(true);
  });
});

describe('subscribeButtonPropsSchema — required-field rejections', () => {
  it('rejects unknown platform (sealed enum)', () => {
    expect(
      subscribeButtonPropsSchema.safeParse({
        platform: 'twitter',
        position: { x: 100, y: 800 },
        label: 'Follow',
      }).success,
    ).toBe(false);
  });

  it('rejects missing label on every platform', () => {
    expect(
      subscribeButtonPropsSchema.safeParse({
        platform: 'youtube',
        position: { x: 100, y: 800 },
      }).success,
    ).toBe(false);
    expect(
      subscribeButtonPropsSchema.safeParse({
        platform: 'tiktok',
        position: { x: 100, y: 800 },
      }).success,
    ).toBe(false);
    expect(
      subscribeButtonPropsSchema.safeParse({
        platform: 'instagram',
        position: { x: 100, y: 800 },
      }).success,
    ).toBe(false);
    expect(
      subscribeButtonPropsSchema.safeParse({
        platform: 'generic',
        position: { x: 100, y: 800 },
      }).success,
    ).toBe(false);
  });

  it('rejects missing position', () => {
    expect(
      subscribeButtonPropsSchema.safeParse({
        platform: 'youtube',
        label: 'SUBSCRIBE',
      }).success,
    ).toBe(false);
  });

  it('rejects extra unknown field (strict mode)', () => {
    expect(
      subscribeButtonPropsSchema.safeParse({
        platform: 'youtube',
        position: { x: 100, y: 800 },
        label: 'X',
        mystery: true,
      }).success,
    ).toBe(false);
  });

  it('accepts all phase + casing values + platform-specific optional fields', () => {
    for (const phase of ['idle', 'pressing', 'subscribed'] as const) {
      expect(subscribeButtonPropsSchema.safeParse({ ...YOUTUBE_MIN, phase }).success).toBe(true);
    }
    for (const casing of ['as-is', 'uppercase', 'lowercase', 'title-case'] as const) {
      expect(subscribeButtonPropsSchema.safeParse({ ...YOUTUBE_MIN, casing }).success).toBe(true);
    }
    expect(
      subscribeButtonPropsSchema.safeParse({
        ...YOUTUBE_MIN,
        showBell: false,
        subscribedLabel: 'SUBSCRIBED',
      }).success,
    ).toBe(true);
    expect(
      subscribeButtonPropsSchema.safeParse({
        ...TIKTOK_MIN,
        showPlus: false,
        followingLabel: 'Following',
      }).success,
    ).toBe(true);
    expect(
      subscribeButtonPropsSchema.safeParse({
        ...INSTAGRAM_MIN,
        gradient: { start: '#000000', mid: '#777777', end: '#FFFFFF' },
      }).success,
    ).toBe(true);
    expect(
      subscribeButtonPropsSchema.safeParse({
        ...GENERIC_MIN,
        postPressLabel: 'Subscribed',
      }).success,
    ).toBe(true);
    // Bad hex rejected
    expect(
      subscribeButtonPropsSchema.safeParse({ ...YOUTUBE_MIN, background: 'red' }).success,
    ).toBe(false);
  });
});

describe('<SubscribeButton> youtube', () => {
  it('phase "idle" renders red pill with uppercase label + white text (forced uppercase regardless of input casing)', () => {
    renderAt(15, { ...YOUTUBE_MIN, label: 'subscribe' });
    const root = screen.getByTestId('subscribe-button-youtube');
    expect(root.textContent).toContain('SUBSCRIBE');
    // happy-dom may serialize hex → rgb; accept either form.
    expect(root.style.backgroundColor.toLowerCase()).toMatch(/^(#ff0000|rgb\(255, 0, 0\))$/);
    expect(root.style.color.toLowerCase()).toMatch(/^(#ffffff|rgb\(255, 255, 255\))$/);
  });

  it('phase "subscribed" renders gray pill with bell glyph; showBell:false hides the bell', () => {
    renderAt(15, { ...YOUTUBE_MIN, phase: 'subscribed' });
    const root = screen.getByTestId('subscribe-button-youtube');
    expect(root.style.backgroundColor.toLowerCase()).toMatch(/^(#aaaaaa|rgb\(170, 170, 170\))$/);
    expect(root.textContent).toContain('SUBSCRIBED');
    expect(screen.getByTestId('subscribe-button-youtube-bell')).toBeTruthy();
    cleanup();
    renderAt(15, { ...YOUTUBE_MIN, phase: 'subscribed', showBell: false });
    expect(screen.queryByTestId('subscribe-button-youtube-bell')).toBeNull();
  });

  it('honors custom subscribedLabel', () => {
    renderAt(15, { ...YOUTUBE_MIN, phase: 'subscribed', subscribedLabel: 'inscrit' });
    const root = screen.getByTestId('subscribe-button-youtube');
    // Forced uppercase per D-T317-8
    expect(root.textContent).toContain('INSCRIT');
  });
});

describe('<SubscribeButton> tiktok', () => {
  it('phase "idle" renders pink pill with mixed-case label + plus glyph; showPlus:false hides it', () => {
    renderAt(15, TIKTOK_MIN);
    const root = screen.getByTestId('subscribe-button-tiktok');
    expect(root.style.backgroundColor.toLowerCase()).toMatch(/^(#fe2c55|rgb\(254, 44, 85\))$/);
    expect(root.textContent).toContain('Follow');
    expect(screen.getByTestId('subscribe-button-tiktok-plus')).toBeTruthy();
    cleanup();
    renderAt(15, { ...TIKTOK_MIN, showPlus: false });
    expect(screen.queryByTestId('subscribe-button-tiktok-plus')).toBeNull();
  });

  it('phase "subscribed" renders outline pill with Following label', () => {
    renderAt(15, { ...TIKTOK_MIN, phase: 'subscribed' });
    const root = screen.getByTestId('subscribe-button-tiktok');
    // Transparent background + 1px border #FE2C55
    expect(root.style.backgroundColor === '' || root.style.backgroundColor === 'transparent').toBe(
      true,
    );
    expect(root.style.border.toLowerCase()).toContain('1px solid');
    expect(root.textContent).toContain('Following');
  });
});

describe('<SubscribeButton> instagram', () => {
  it('phase "idle" renders the canonical gradient backdrop; gradient prop overrides the stops', () => {
    renderAt(15, INSTAGRAM_MIN);
    const root = screen.getByTestId('subscribe-button-instagram');
    const bg = root.style.backgroundImage.toLowerCase();
    expect(bg).toContain('linear-gradient');
    expect(bg).toContain('#f58529');
    expect(bg).toContain('#dd2a7b');
    expect(bg).toContain('#8134af');
    cleanup();
    renderAt(15, {
      ...INSTAGRAM_MIN,
      gradient: { start: '#000000', mid: '#777777', end: '#FFFFFF' },
    });
    const root2 = screen.getByTestId('subscribe-button-instagram');
    const bg2 = root2.style.backgroundImage.toLowerCase();
    expect(bg2).toContain('#000000');
    expect(bg2).toContain('#777777');
    expect(bg2).toContain('#ffffff');
  });

  it('phase "subscribed" renders 1px white outline with Following label', () => {
    renderAt(15, { ...INSTAGRAM_MIN, phase: 'subscribed' });
    const root = screen.getByTestId('subscribe-button-instagram');
    expect(root.style.border.toLowerCase()).toContain('1px solid');
    expect(root.textContent).toContain('Following');
  });
});

describe('<SubscribeButton> generic', () => {
  it('uses fallback theme palette colors with no explicit overrides; explicit background/foreground wins', () => {
    renderAt(15, GENERIC_MIN);
    const root = screen.getByTestId('subscribe-button-generic');
    // Default fallback palette colors (component-level defaults)
    expect(root.style.backgroundColor).not.toBe('');
    expect(root.style.color).not.toBe('');
    expect(root.textContent).toContain('Subscribe');
    cleanup();
    renderAt(15, { ...GENERIC_MIN, background: '#222222', foreground: '#EEEEEE' });
    const root2 = screen.getByTestId('subscribe-button-generic');
    expect(root2.style.backgroundColor.toLowerCase()).toMatch(/^(#222222|rgb\(34, 34, 34\))$/);
    expect(root2.style.color.toLowerCase()).toMatch(/^(#eeeeee|rgb\(238, 238, 238\))$/);
  });

  it('phase "subscribed" uses postPressLabel when provided, else falls back to label', () => {
    renderAt(15, { ...GENERIC_MIN, phase: 'subscribed', postPressLabel: 'Subscribed' });
    const root = screen.getByTestId('subscribe-button-generic');
    expect(root.textContent).toContain('Subscribed');
    cleanup();
    renderAt(15, { ...GENERIC_MIN, phase: 'subscribed' });
    const root2 = screen.getByTestId('subscribe-button-generic');
    expect(root2.textContent).toContain('Subscribe');
  });
});

describe('<SubscribeButton> entrance bounce overshoot (idle)', () => {
  it('scale ramps 0 → 1.10 (peak) → 1.00 (settled) and stays at 1.00', () => {
    // frame=0 → scale ~0
    const { container: c0 } = renderAt(0, YOUTUBE_MIN);
    const root0 = c0.querySelector('[data-testid="subscribe-button-youtube"]') as HTMLElement;
    expect(root0.style.transform).toMatch(/scale\(0(\.0+)?\)/);
    cleanup();
    // frame=ceil(30 * 0.30)=9 → scale ~1.10
    const { container: cPeak } = renderAt(9, YOUTUBE_MIN);
    const rootPeak = cPeak.querySelector('[data-testid="subscribe-button-youtube"]') as HTMLElement;
    expect(rootPeak.style.transform).toMatch(/scale\(1\.1\)/);
    cleanup();
    // frame=ceil(30 * 0.50)=15 → scale 1.00
    const { container: cSettle } = renderAt(15, YOUTUBE_MIN);
    const rootSettle = cSettle.querySelector(
      '[data-testid="subscribe-button-youtube"]',
    ) as HTMLElement;
    expect(rootSettle.style.transform).toMatch(/scale\(1\)/);
    cleanup();
    // frame=30 → still 1.00 (clamped, no infinite breathing)
    const { container: cLater } = renderAt(30, YOUTUBE_MIN);
    const rootLater = cLater.querySelector(
      '[data-testid="subscribe-button-youtube"]',
    ) as HTMLElement;
    expect(rootLater.style.transform).toMatch(/scale\(1\)/);
  });
});

describe('<SubscribeButton> press-dip animation', () => {
  it('scale dips from 1.00 toward 0.95 then returns; static cursor glyph appears when showCursor: true', () => {
    // Press-window: ceil(30 * 0.083)=3 → dip-peak at frame 3, settled at frame 6.
    const { container: cMid } = renderAt(3, { ...YOUTUBE_MIN, phase: 'pressing' });
    const rootMid = cMid.querySelector('[data-testid="subscribe-button-youtube"]') as HTMLElement;
    const matchMid = rootMid.style.transform.match(/scale\(([0-9.]+)\)/);
    expect(matchMid).not.toBeNull();
    if (matchMid?.[1] !== undefined) {
      expect(Number.parseFloat(matchMid[1])).toBeLessThan(1.0);
    }
    cleanup();
    const { container: cEnd } = renderAt(6, { ...YOUTUBE_MIN, phase: 'pressing' });
    const rootEnd = cEnd.querySelector('[data-testid="subscribe-button-youtube"]') as HTMLElement;
    expect(rootEnd.style.transform).toMatch(/scale\(1\)/);
    cleanup();
    // Cursor glyph
    renderAt(3, { ...YOUTUBE_MIN, phase: 'pressing', showCursor: true });
    expect(screen.getByTestId('subscribe-button-cursor')).toBeTruthy();
    cleanup();
    renderAt(3, { ...YOUTUBE_MIN, phase: 'pressing' });
    expect(screen.queryByTestId('subscribe-button-cursor')).toBeNull();
  });
});

describe('<SubscribeButton> casing transform', () => {
  it('youtube force-uppercases label regardless of casing prop; tiktok respects "lowercase"', () => {
    renderAt(15, { ...YOUTUBE_MIN, label: 'subscribe', casing: 'lowercase' });
    const yt = screen.getByTestId('subscribe-button-youtube');
    // YouTube force-uppercases per D-T317-8
    expect(yt.textContent).toContain('SUBSCRIBE');
    cleanup();
    renderAt(15, { ...TIKTOK_MIN, label: 'Follow', casing: 'lowercase' });
    const tt = screen.getByTestId('subscribe-button-tiktok');
    expect(tt.textContent).toContain('follow');
  });
});

describe('clip registration', () => {
  it('registers as kind "subscribe-button" and is in ALL_BRIDGE_CLIPS at length 54', () => {
    expect(subscribeButtonClip.kind).toBe('subscribe-button');
    expect(ALL_BRIDGE_CLIPS).toHaveLength(54);
    expect(ALL_BRIDGE_CLIPS).toContain(subscribeButtonClip);
  });

  it('fontRequirements registers Roboto / TikTok Sans / Plus Jakarta Sans', () => {
    const fonts = subscribeButtonClip.fontRequirements?.(YOUTUBE_MIN as unknown as never);
    expect(fonts).toEqual([
      { family: 'Roboto', weight: 500 },
      { family: 'TikTok Sans', weight: 700 },
      { family: 'Plus Jakarta Sans', weight: 700 },
    ]);
  });
});

describe('<SubscribeButton> drop-shadow + width/height + showCursor across platforms', () => {
  it('youtube emits boxShadow by default; dropShadow:false suppresses it', () => {
    renderAt(15, YOUTUBE_MIN);
    const root = screen.getByTestId('subscribe-button-youtube');
    expect(root.style.boxShadow).not.toBe('');
    cleanup();
    renderAt(15, { ...YOUTUBE_MIN, dropShadow: false });
    const root2 = screen.getByTestId('subscribe-button-youtube');
    expect(root2.style.boxShadow).toBe('');
  });

  it('honors explicit position.width / position.height', () => {
    renderAt(15, {
      ...YOUTUBE_MIN,
      position: { x: 50, y: 50, width: 220, height: 60 },
    });
    const root = screen.getByTestId('subscribe-button-youtube');
    expect(root.style.width).toBe('220px');
    expect(root.style.height).toBe('60px');
  });

  it('renders cursor on tiktok / instagram / generic when showCursor:true', () => {
    renderAt(3, { ...TIKTOK_MIN, phase: 'pressing', showCursor: true });
    expect(screen.getByTestId('subscribe-button-cursor')).toBeTruthy();
    cleanup();
    renderAt(3, { ...INSTAGRAM_MIN, phase: 'pressing', showCursor: true });
    expect(screen.getByTestId('subscribe-button-cursor')).toBeTruthy();
    cleanup();
    renderAt(3, { ...GENERIC_MIN, phase: 'pressing', showCursor: true });
    expect(screen.getByTestId('subscribe-button-cursor')).toBeTruthy();
  });

  it('honors font override (family + weight)', () => {
    renderAt(15, { ...YOUTUBE_MIN, font: { family: 'Inter', weight: 700 } });
    const root = screen.getByTestId('subscribe-button-youtube');
    expect(root.style.fontFamily).toContain('Inter');
    expect(root.style.fontWeight).toBe('700');
    cleanup();
    renderAt(15, { ...TIKTOK_MIN, font: { family: 'Inter' } });
    const root2 = screen.getByTestId('subscribe-button-tiktok');
    expect(root2.style.fontFamily).toContain('Inter');
  });

  it('generic dropShadow:true emits a shadow', () => {
    renderAt(15, { ...GENERIC_MIN, dropShadow: true });
    const root = screen.getByTestId('subscribe-button-generic');
    expect(root.style.boxShadow).not.toBe('');
  });

  it('borderRadius override applies on each platform', () => {
    renderAt(15, { ...TIKTOK_MIN, borderRadius: 24 });
    const root = screen.getByTestId('subscribe-button-tiktok');
    expect(root.style.borderRadius).toBe('24px');
  });

  it('casing transforms on tiktok ("uppercase" / "title-case")', () => {
    renderAt(15, { ...TIKTOK_MIN, label: 'follow now', casing: 'uppercase' });
    expect(screen.getByTestId('subscribe-button-tiktok').textContent).toContain('FOLLOW NOW');
    cleanup();
    renderAt(15, { ...TIKTOK_MIN, label: 'follow now', casing: 'title-case' });
    expect(screen.getByTestId('subscribe-button-tiktok').textContent).toContain('Follow Now');
    cleanup();
    // 'as-is' casing is the default; explicit pass should also work
    renderAt(15, { ...TIKTOK_MIN, label: 'Follow Now', casing: 'as-is' });
    expect(screen.getByTestId('subscribe-button-tiktok').textContent).toContain('Follow Now');
  });
});

describe('determinism', () => {
  it('renders byte-identical HTML for the same props at the same frame', () => {
    const { container: a } = renderAt(30, YOUTUBE_MIN);
    const htmlA = a.innerHTML;
    cleanup();
    const { container: b } = renderAt(30, YOUTUBE_MIN);
    const htmlB = b.innerHTML;
    expect(htmlA).toBe(htmlB);
  });
});
