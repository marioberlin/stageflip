// packages/runtimes/frame-runtime-bridge/src/clips/stock-ticker.test.tsx
// T-131b.2 — stockTickerClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  StockTicker,
  type StockTickerProps,
  stockTickerClip,
  stockTickerPropsSchema,
} from './stock-ticker.js';

afterEach(cleanup);

function renderAt(frame: number, props: StockTickerProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <StockTicker {...props} />
    </FrameProvider>,
  );
}

const SAMPLE_CANDLES: StockTickerProps['candles'] = [
  { open: 100, close: 105, high: 108, low: 99 },
  { open: 105, close: 102, high: 106, low: 100 },
  { open: 102, close: 110, high: 112, low: 101 },
];

describe('StockTicker component (T-131b.2)', () => {
  it('renders one candle group per data point', () => {
    renderAt(60, { candles: SAMPLE_CANDLES });
    expect(screen.getByTestId('stock-ticker-candle-0')).toBeDefined();
    expect(screen.getByTestId('stock-ticker-candle-1')).toBeDefined();
    expect(screen.getByTestId('stock-ticker-candle-2')).toBeDefined();
  });

  it('displays an up-arrow change percent in upColor when last close >= first open', () => {
    renderAt(60, { candles: SAMPLE_CANDLES, upColor: '#00ff00' });
    const change = screen.getByTestId('stock-ticker-change') as HTMLElement;
    expect(change.textContent).toContain('+');
    // happy-dom preserves hex strings on style.color (browsers normalize to rgb()).
    // Compare lowercased to be robust to either behaviour.
    expect(change.style.color.toLowerCase()).toMatch(/^(#00ff00|rgb\(0, ?255, ?0\))$/);
  });

  it('uses downColor when last close < first open', () => {
    const losing: StockTickerProps['candles'] = [{ open: 110, close: 100, high: 112, low: 99 }];
    renderAt(60, { candles: losing, downColor: '#ff0000' });
    const change = screen.getByTestId('stock-ticker-change') as HTMLElement;
    expect(change.style.color.toLowerCase()).toMatch(/^(#ff0000|rgb\(255, ?0, ?0\))$/);
    expect(change.textContent).not.toContain('+');
  });

  it('first candle is invisible at frame=0 and visible after its stagger window', () => {
    const { unmount } = renderAt(0, { candles: SAMPLE_CANDLES });
    expect(
      Number(
        (screen.getByTestId('stock-ticker-candle-0') as unknown as SVGElement).getAttribute(
          'opacity',
        ),
      ),
    ).toBe(0);
    unmount();
    renderAt(20, { candles: SAMPLE_CANDLES });
    expect(
      Number(
        (screen.getByTestId('stock-ticker-candle-0') as unknown as SVGElement).getAttribute(
          'opacity',
        ),
      ),
    ).toBe(1);
  });
});

describe('stockTickerClip definition (T-131b.2)', () => {
  it("registers under kind 'stock-ticker' with two themeSlots", () => {
    expect(stockTickerClip.kind).toBe('stock-ticker');
    expect(stockTickerClip.propsSchema).toBe(stockTickerPropsSchema);
    expect(stockTickerClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      titleColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('propsSchema rejects empty candles array', () => {
    expect(stockTickerPropsSchema.safeParse({ candles: [] }).success).toBe(false);
  });
});
