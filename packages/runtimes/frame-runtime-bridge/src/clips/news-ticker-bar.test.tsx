// packages/runtimes/frame-runtime-bridge/src/clips/news-ticker-bar.test.tsx
// T-356a — newsTickerBarClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  NewsTickerBar,
  type NewsTickerBarProps,
  newsTickerBarClip,
  newsTickerBarPropsSchema,
} from './news-ticker-bar.js';

afterEach(cleanup);

const FPS = 30;

function renderAt(frame: number, props: NewsTickerBarProps, durationInFrames = 600) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: FPS, durationInFrames }}>
      <NewsTickerBar {...props} />
    </FrameProvider>,
  );
}

const ENTRY_UP = { symbol: 'AAPL', price: '230.45', delta: '+1.2%', direction: 'up' as const };
const ENTRY_DOWN = { symbol: 'TSLA', price: '180.10', delta: '-0.8%', direction: 'down' as const };
const ENTRY_FLAT = { symbol: 'MSFT', price: '410.00', delta: '0.0%', direction: 'flat' as const };

describe('newsTickerBarPropsSchema (T-356a)', () => {
  it('accepts a single valid entry', () => {
    expect(newsTickerBarPropsSchema.safeParse({ entries: [ENTRY_UP] }).success).toBe(true);
  });

  it('rejects an empty entries array', () => {
    expect(newsTickerBarPropsSchema.safeParse({ entries: [] }).success).toBe(false);
  });

  it('rejects more than 24 entries', () => {
    const twentyFive = Array.from({ length: 25 }, () => ENTRY_UP);
    expect(newsTickerBarPropsSchema.safeParse({ entries: twentyFive }).success).toBe(false);
  });

  it('rejects an entry missing direction', () => {
    expect(
      newsTickerBarPropsSchema.safeParse({
        entries: [{ symbol: 'X', price: '1', delta: '0' }],
      }).success,
    ).toBe(false);
  });

  it('rejects an entry with an unknown direction', () => {
    expect(
      newsTickerBarPropsSchema.safeParse({
        entries: [{ ...ENTRY_UP, direction: 'sideways' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a malformed hex color', () => {
    expect(
      newsTickerBarPropsSchema.safeParse({
        entries: [ENTRY_UP],
        background: 'not-a-hex',
      }).success,
    ).toBe(false);
  });
});

describe('NewsTickerBar component (T-356a)', () => {
  it('renders N entries doubled (marquee) at frame 0 with translateX = 0', () => {
    const entries = [ENTRY_UP, ENTRY_DOWN, ENTRY_FLAT, ENTRY_UP, ENTRY_DOWN, ENTRY_FLAT];
    renderAt(0, { entries });
    // Doubled-row marquee: 6 entries → 12 chip nodes total.
    for (let i = 0; i < 12; i += 1) {
      expect(screen.getByTestId(`news-ticker-bar-chip-${i}`)).toBeDefined();
    }
    const marquee = screen.getByTestId('news-ticker-bar-marquee');
    expect(marquee.style.transform).toBe('translateX(0px)');
  });

  it('translates left at frame 60 by (frame * scrollSpeed) / fps px (defaults)', () => {
    const entries = [ENTRY_UP, ENTRY_DOWN, ENTRY_FLAT];
    renderAt(60, { entries });
    // defaults: scrollSpeed=60 px/sec, fps=30. offsetRaw = 60*60/30 = 120.
    // rowWidth = 3 * (220 + 60) = 840. 120 % 840 = 120. translateX = -120.
    const marquee = screen.getByTestId('news-ticker-bar-marquee');
    expect(marquee.style.transform).toBe('translateX(-120px)');
  });

  it('wraps continuously past row width (frame=600) via modulo', () => {
    const entries = [ENTRY_UP, ENTRY_DOWN, ENTRY_FLAT];
    renderAt(600, { entries });
    // offsetRaw = 600*60/30 = 1200. rowWidth = 840. 1200 % 840 = 360.
    const marquee = screen.getByTestId('news-ticker-bar-marquee');
    expect(marquee.style.transform).toBe('translateX(-360px)');
  });

  it('applies direction-driven colors (up/down/flat) to delta+arrow text', () => {
    const entries = [ENTRY_UP, ENTRY_DOWN, ENTRY_FLAT];
    renderAt(0, {
      entries,
      upColor: '#00d26a',
      downColor: '#ff3c3c',
      flatColor: '#a0a0a0',
      foreground: '#ffffff',
    });
    const delta0 = screen.getByTestId('news-ticker-bar-chip-0-delta');
    const delta1 = screen.getByTestId('news-ticker-bar-chip-1-delta');
    const delta2 = screen.getByTestId('news-ticker-bar-chip-2-delta');
    expect(delta0.style.color).toBe('#00d26a');
    expect(delta1.style.color).toBe('#ff3c3c');
    expect(delta2.style.color).toBe('#a0a0a0');
    // Symbol + price use foreground.
    const symbol0 = screen.getByTestId('news-ticker-bar-chip-0-symbol');
    expect(symbol0.style.color).toBe('#ffffff');
  });

  it('renders the correct Unicode arrow glyph for each direction', () => {
    const entries = [ENTRY_UP, ENTRY_DOWN, ENTRY_FLAT];
    renderAt(0, { entries });
    expect(screen.getByTestId('news-ticker-bar-chip-0-delta').textContent).toContain('▲');
    expect(screen.getByTestId('news-ticker-bar-chip-1-delta').textContent).toContain('▼');
    expect(screen.getByTestId('news-ticker-bar-chip-2-delta').textContent).toContain('▬');
  });

  it('positions the band at the bottom by default and at top when bandPosition="top"', () => {
    const entries = [ENTRY_UP];
    const { container: bottomContainer } = renderAt(0, { entries });
    const bandBottom = bottomContainer.querySelector(
      '[data-testid="news-ticker-bar-band"]',
    ) as HTMLElement;
    expect(bandBottom.style.bottom).toBe('0px');
    expect(bandBottom.style.top).toBe('');
    expect(bandBottom.style.height).toBe('50px');
    cleanup();
    const { container: topContainer } = renderAt(0, { entries, bandPosition: 'top' });
    const bandTop = topContainer.querySelector(
      '[data-testid="news-ticker-bar-band"]',
    ) as HTMLElement;
    expect(bandTop.style.top).toBe('0px');
    expect(bandTop.style.bottom).toBe('');
  });

  it('honors a custom bandHeight', () => {
    const entries = [ENTRY_UP];
    const { container } = renderAt(0, { entries, bandHeight: 80 });
    const band = container.querySelector('[data-testid="news-ticker-bar-band"]') as HTMLElement;
    expect(band.style.height).toBe('80px');
  });

  it('is frame-deterministic — identical HTML across two renders at the same frame', () => {
    const props: NewsTickerBarProps = {
      entries: [ENTRY_UP, ENTRY_DOWN, ENTRY_FLAT],
      background: '#0a0a0a',
      foreground: '#ffffff',
      upColor: '#00d26a',
      downColor: '#ff3c3c',
      flatColor: '#a0a0a0',
    };
    const a = renderAt(60, props).container.innerHTML;
    cleanup();
    const b = renderAt(60, props).container.innerHTML;
    expect(a).toBe(b);
  });
});

// T-356b — flip-mode register (post-2018 ESPN BottomLine canon).
describe('NewsTickerBar flip-mode rendering (T-356b)', () => {
  const SPORTS_ENTRIES: NewsTickerBarProps['entries'] = [
    { symbol: 'NYK', price: '102', delta: '+5', direction: 'up' },
    { symbol: 'BOS', price: '97', delta: 'F', direction: 'flat' },
    { symbol: 'LAL', price: '88', delta: '-3', direction: 'down' },
    { symbol: 'PHX', price: '91', delta: 'F', direction: 'flat' },
  ];

  it("mode: 'flip' renders two stacked rows (top + bottom), no marquee", () => {
    renderAt(30, { entries: SPORTS_ENTRIES, mode: 'flip', bandHeight: 100 });
    expect(screen.getByTestId('news-ticker-bar-flip-top')).toBeTruthy();
    expect(screen.getByTestId('news-ticker-bar-flip-bottom')).toBeTruthy();
    expect(screen.queryByTestId('news-ticker-bar-marquee')).toBeNull();
  });

  it("mode: 'flip' first pair shows entries[0] on top + entries[1] on bottom at frame=0", () => {
    renderAt(0, { entries: SPORTS_ENTRIES, mode: 'flip', bandHeight: 100 });
    expect(screen.getByTestId('news-ticker-bar-flip-top').textContent).toContain('NYK');
    expect(screen.getByTestId('news-ticker-bar-flip-bottom').textContent).toContain('BOS');
  });

  it("mode: 'flip' advances pair every flipDurationMs", () => {
    // flipDurationMs=1000 → frame=30 (1000ms) → pairIdx=1 → entries[2]+entries[3].
    renderAt(31, {
      entries: SPORTS_ENTRIES,
      mode: 'flip',
      flipDurationMs: 1000,
      bandHeight: 100,
    });
    expect(screen.getByTestId('news-ticker-bar-flip-top').textContent).toContain('LAL');
    expect(screen.getByTestId('news-ticker-bar-flip-bottom').textContent).toContain('PHX');
  });

  it("mode: 'scroll' (default; omitted) renders marquee, no flip rows", () => {
    renderAt(30, { entries: SPORTS_ENTRIES });
    expect(screen.getByTestId('news-ticker-bar-marquee')).toBeTruthy();
    expect(screen.queryByTestId('news-ticker-bar-flip-top')).toBeNull();
    expect(screen.queryByTestId('news-ticker-bar-flip-bottom')).toBeNull();
  });

  it('schema accepts mode + flipDurationMs', () => {
    const result = newsTickerBarPropsSchema.safeParse({
      entries: SPORTS_ENTRIES,
      mode: 'flip',
      flipDurationMs: 4500,
    });
    expect(result.success).toBe(true);
  });

  it('schema rejects invalid mode', () => {
    const result = newsTickerBarPropsSchema.safeParse({
      entries: SPORTS_ENTRIES,
      mode: 'invalid' as never,
    });
    expect(result.success).toBe(false);
  });
});

describe('newsTickerBarClip definition (T-356a)', () => {
  it("registers under kind 'news-ticker-bar' with the expected theme slots", () => {
    expect(newsTickerBarClip.kind).toBe('news-ticker-bar');
    expect(newsTickerBarClip.propsSchema).toBe(newsTickerBarPropsSchema);
    expect(newsTickerBarClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
      upColor: { kind: 'palette', role: 'accent' },
      downColor: { kind: 'palette', role: 'accent' },
      flatColor: { kind: 'palette', role: 'foreground' },
    });
  });
});
