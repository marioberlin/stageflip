// packages/runtimes/frame-runtime-bridge/src/clips/kpi-grid.tsx
// T-131b.3 port of reference/slidemotion/.../clips/kpi-grid.tsx.
// Dashboard KPI grid composed of AnimatedValue cards with per-card stagger.

import { interpolate, spring, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';
import { AnimatedValue } from './animated-value.js';

const kpiCardSchema = z
  .object({
    value: z.number(),
    label: z.string(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    decimals: z.number().int().nonnegative().optional(),
    trend: z.number().optional(),
  })
  .strict();

export const kpiGridPropsSchema = z
  .object({
    cards: z.array(kpiCardSchema).min(1),
    columns: z.union([z.literal(2), z.literal(3)]).optional(),
    rows: z.union([z.literal(2), z.literal(3)]).optional(),
    title: z.string().optional(),
    accentColor: z.string().optional(),
    bioColor: z.string().optional(),
    textColor: z.string().optional(),
    background: z.string().optional(),
    positiveColor: z.string().optional(),
    negativeColor: z.string().optional(),
    cardBackground: z.string().optional(),
  })
  .strict();

export type KpiGridProps = z.infer<typeof kpiGridPropsSchema>;

const STAGGER_MS = 200;

export function KpiGrid({
  cards,
  columns = 3,
  rows = 2,
  title,
  accentColor = '#81aeff',
  bioColor = '#5af8fb',
  textColor = '#1a1a2e',
  background = '#ffffff',
  positiveColor = '#22c55e',
  negativeColor = '#ef4444',
  cardBackground = 'rgba(129,174,255,0.06)',
}: KpiGridProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalCells = columns * rows;
  const visibleCards = cards.slice(0, totalCells);
  const staggerFrames = Math.round((STAGGER_MS / 1000) * fps);

  const titleOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      data-testid="kpi-grid-clip"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: background,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        padding: 80,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {title !== undefined && title.length > 0 && (
        <div
          data-testid="kpi-grid-title"
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: textColor,
            letterSpacing: '-0.01em',
            opacity: titleOpacity,
            marginBottom: 40,
          }}
        >
          {title}
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: 24,
        }}
      >
        {visibleCards.map((card, i) => {
          const delay = i * staggerFrames;
          const cardSpring = spring({
            fps,
            frame: Math.max(0, frame - delay),
            damping: 20,
            mass: 1.2,
            stiffness: 120,
          });
          const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const cardTranslate = interpolate(cardSpring, [0, 1], [20, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const hasTrend = typeof card.trend === 'number';
          const trendValue = card.trend ?? 0;
          // `> 0` — not `>= 0`. A flat trend of 0 is *not* a gain; it gets the
          // down-arrow + negative colour branch, matching the reference
          // behaviour of `trendValue > 0` before the port.
          const trendPositive = hasTrend && trendValue > 0;
          const trendColor = trendPositive ? positiveColor : negativeColor;
          const trendLabel = hasTrend ? `${trendPositive ? '+' : ''}${trendValue.toFixed(1)}%` : '';
          const trendOpacity = interpolate(frame, [delay + 12, delay + 24], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: positional card data — slot i is the same card across renders.
              key={i}
              data-testid={`kpi-card-${i}`}
              style={{
                backgroundColor: cardBackground,
                borderRadius: 12,
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                opacity: cardOpacity,
                transform: `translateY(${cardTranslate}px)`,
                boxShadow: '0 2px 16px rgba(0,114,229,0.08)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 4,
                  height: '100%',
                  background: `linear-gradient(180deg, ${accentColor}, ${bioColor})`,
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <AnimatedValue
                  value={card.value}
                  prefix={card.prefix}
                  suffix={card.suffix}
                  decimals={card.decimals ?? 0}
                  delay={delay}
                  fontSize={56}
                  fontWeight={800}
                  color={textColor}
                  style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
                />
                {hasTrend && (
                  <div
                    data-testid={`kpi-card-${i}-trend`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 16,
                      fontWeight: 700,
                      color: trendColor,
                      fontVariantNumeric: 'tabular-nums',
                      opacity: trendOpacity,
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{trendPositive ? '▲' : '▼'}</span>
                    <span>{trendLabel}</span>
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'rgba(26,26,46,0.65)',
                  lineHeight: 1.5,
                  marginTop: 16,
                }}
              >
                {card.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const kpiGridClip: ClipDefinition<unknown> = defineFrameClip<KpiGridProps>({
  kind: 'kpi-grid',
  component: KpiGrid,
  propsSchema: kpiGridPropsSchema,
  themeSlots: {
    accentColor: { kind: 'palette', role: 'primary' },
    bioColor: { kind: 'palette', role: 'accent' },
    textColor: { kind: 'palette', role: 'foreground' },
    background: { kind: 'palette', role: 'surface' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 800 }],
});
