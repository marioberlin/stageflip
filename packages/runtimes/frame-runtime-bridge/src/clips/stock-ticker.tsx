// packages/runtimes/frame-runtime-bridge/src/clips/stock-ticker.tsx
// T-131b.2 port of reference/slidemotion/.../clips/stock-ticker.tsx.
// Candlestick chart with per-candle stagger reveal + header ticker line.

import { cubicBezier, interpolate, useCurrentFrame } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const candleSchema = z
  .object({
    open: z.number(),
    close: z.number(),
    high: z.number(),
    low: z.number(),
    label: z.string().optional(),
  })
  .strict();

export const stockTickerPropsSchema = z
  .object({
    candles: z.array(candleSchema).min(1),
    title: z.string().optional(),
    upColor: z.string().optional(),
    downColor: z.string().optional(),
    background: z.string().optional(),
    titleColor: z.string().optional(),
  })
  .strict();

export type StockTickerProps = z.infer<typeof stockTickerPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);
const PER_CANDLE_DELAY = 3;
const PADDING = { top: 90, right: 60, bottom: 60, left: 80 };
const CANVAS_W = 1920;
const CANVAS_H = 1080;

export function StockTicker({
  candles,
  title = 'STOCK',
  upColor = '#22c55e',
  downColor = '#ef4444',
  background = '#0a0a0a',
  // Light foreground default — must contrast with the dark background.
  // Reference uses `AC.canvas` (`#FFFFFF`); we use the slightly-warmer
  // `#ebf1fa` that the rest of this tranche uses for "light text on dark".
  titleColor = '#ebf1fa',
}: StockTickerProps): ReactElement {
  const frame = useCurrentFrame();

  const chartW = CANVAS_W - PADDING.left - PADDING.right;
  const chartH = CANVAS_H - PADDING.top - PADDING.bottom;

  const allValues = candles.flatMap((c) => [c.open, c.close, c.high, c.low]);
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const range = maxVal - minVal || 1;

  const toY = (v: number) => PADDING.top + chartH - ((v - minVal) / range) * chartH;
  const barWidth = (chartW / candles.length) * 0.6;
  const barGap = (chartW / candles.length) * 0.4;

  const firstOpen = candles[0]?.open ?? 0;
  const lastClose = candles[candles.length - 1]?.close ?? 0;
  const changePercent =
    firstOpen === 0 ? '0.00' : (((lastClose - firstOpen) / firstOpen) * 100).toFixed(2);
  const isUp = lastClose >= firstOpen;

  const titleOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      data-testid="stock-ticker-clip"
      style={{ width: '100%', height: '100%', backgroundColor: background, position: 'relative' }}
    >
      <div
        data-testid="stock-ticker-header"
        style={{
          position: 'absolute',
          top: 24,
          left: PADDING.left,
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
          opacity: titleOpacity,
        }}
      >
        <span
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 32,
            fontWeight: 800,
            color: titleColor,
          }}
        >
          {title}
        </span>
        <span
          data-testid="stock-ticker-change"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 24,
            fontWeight: 600,
            color: isUp ? upColor : downColor,
          }}
        >
          {isUp ? '+' : ''}
          {changePercent}%
        </span>
      </div>

      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{ width: '100%', height: '100%' }}
        role="img"
      >
        <title>{title} candlestick chart</title>
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = PADDING.top + chartH * (1 - pct);
          return (
            <line
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 5-line grid; positions are positional.
              key={i}
              x1={PADDING.left}
              y1={y}
              x2={PADDING.left + chartW}
              y2={y}
              stroke="#1a1a1a"
              strokeWidth={1}
            />
          );
        })}

        {candles.map((candle, i) => {
          const x = PADDING.left + (i / candles.length) * chartW + barGap / 2;
          const isGreen = candle.close >= candle.open;
          const color = isGreen ? upColor : downColor;

          const bodyTop = toY(Math.max(candle.open, candle.close));
          const bodyBottom = toY(Math.min(candle.open, candle.close));
          const bodyHeight = Math.max(1, bodyBottom - bodyTop);
          const wickTop = toY(candle.high);
          const wickBottom = toY(candle.low);
          const centerX = x + barWidth / 2;

          const delay = i * PER_CANDLE_DELAY;
          const opacity = interpolate(frame, [delay, delay + 8], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const scaleY = interpolate(frame, [delay, delay + 12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE_OUT_EXPO,
          });

          return (
            <g
              // biome-ignore lint/suspicious/noArrayIndexKey: positional candle data — each index is conceptually the same bar across renders.
              key={i}
              opacity={opacity}
              data-testid={`stock-ticker-candle-${i}`}
            >
              <line
                x1={centerX}
                y1={wickTop}
                x2={centerX}
                y2={wickBottom}
                stroke={color}
                strokeWidth={2}
                style={{
                  transformOrigin: `${centerX}px ${(wickTop + wickBottom) / 2}px`,
                  transform: `scaleY(${scaleY})`,
                }}
              />
              <rect
                x={x}
                y={bodyTop}
                width={barWidth}
                height={bodyHeight * scaleY}
                fill={color}
                rx={2}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export const stockTickerClip: ClipDefinition<unknown> = defineFrameClip<StockTickerProps>({
  kind: 'stock-ticker',
  component: StockTicker,
  propsSchema: stockTickerPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    titleColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 800 }],
});
