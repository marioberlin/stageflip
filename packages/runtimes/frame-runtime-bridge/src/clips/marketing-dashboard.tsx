// packages/runtimes/frame-runtime-bridge/src/clips/marketing-dashboard.tsx
// T-131f.2 port of reference/slidemotion/.../components/marketing/MarketingDashboardSlide.tsx.
//
// Option B (flat-prop interface): the reference imports `CampaignContent`
// from `@slidemotion/schema`; this port declares just the fields the
// clip actually renders. Two display modes:
//   - `mode: 'channels'` (default): bar chart of channel revenue +
//     per-channel ROAS/CPA table.
//   - `mode: 'funnel'`: horizontal funnel bars with conversion rates.
//
// Entry animation: single fade-in over frames 0..15. No spring physics.

import { interpolate, useCurrentFrame } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const trendSchema = z.enum(['up', 'down', 'flat']);

const channelSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    spend: z.number().nonnegative(),
    revenue: z.number().nonnegative(),
    conversions: z.number().int().nonnegative(),
  })
  .strict();

const kpiSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    value: z.union([z.number(), z.string()]),
    unit: z.string().optional(),
    trend: trendSchema.optional(),
  })
  .strict();

const funnelStageSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    value: z.number().nonnegative(),
    conversionRate: z.number().optional(),
  })
  .strict();

export const marketingDashboardPropsSchema = z
  .object({
    title: z.string().optional(),
    mode: z.enum(['channels', 'funnel']).optional(),
    currencyPrefix: z.string().optional(),
    dateRange: z.object({ start: z.string(), end: z.string() }).strict().optional(),
    channels: z.array(channelSchema),
    kpis: z.array(kpiSchema).optional(),
    funnelStages: z.array(funnelStageSchema).optional(),
    background: z.string().optional(),
    textColor: z.string().optional(),
    surface: z.string().optional(),
  })
  .strict();

export type MarketingDashboardChannel = z.infer<typeof channelSchema>;
export type MarketingDashboardKpi = z.infer<typeof kpiSchema>;
export type MarketingDashboardFunnelStage = z.infer<typeof funnelStageSchema>;
export type MarketingDashboardProps = z.infer<typeof marketingDashboardPropsSchema>;

const GOOD_COLOR = '#34d399';
const WARN_COLOR = '#fbbf24';
const BAD_COLOR = '#fb7185';
const MUTED_COLOR = '#a5acb4';
const SUBDUED_COLOR = '#6b7280';

function formatValue(value: number | string, unit?: string): string {
  const s = typeof value === 'number' ? String(value) : value;
  return unit !== undefined && unit.length > 0 ? `${s}${unit}` : s;
}

function trendColor(trend: 'up' | 'down' | 'flat' | undefined): string {
  if (trend === 'up') return GOOD_COLOR;
  if (trend === 'down') return BAD_COLOR;
  return MUTED_COLOR;
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}): ReactElement {
  return (
    <div
      data-testid={`marketing-dashboard-kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        flex: 1,
        backgroundColor: 'rgba(21,28,35,0.4)',
        borderRadius: 8,
        padding: '10px 14px',
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: SUBDUED_COLOR,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function MarketingDashboard({
  title,
  mode = 'channels',
  currencyPrefix = '$',
  dateRange,
  channels,
  kpis = [],
  funnelStages = [],
  background = '#080f15',
  textColor = '#ebf1fa',
  surface = '#111820',
}: MarketingDashboardProps): ReactElement {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);
  const totalConversions = channels.reduce((s, c) => s + c.conversions, 0);
  const roas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(1) : '0';
  const resolvedTitle = title ?? (mode === 'funnel' ? 'Marketing Funnel' : 'Campaign Performance');

  return (
    <div
      data-testid="marketing-dashboard"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: background,
        position: 'relative',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        overflow: 'hidden',
        opacity: fadeIn,
      }}
    >
      <div
        data-testid="marketing-dashboard-title"
        style={{
          position: 'absolute',
          left: 80,
          top: 28,
          fontSize: 24,
          fontWeight: 700,
          color: textColor,
        }}
      >
        {resolvedTitle}
      </div>
      {dateRange !== undefined ? (
        <div
          data-testid="marketing-dashboard-date-range"
          style={{ position: 'absolute', left: 80, top: 60, fontSize: 12, color: SUBDUED_COLOR }}
        >
          {dateRange.start} — {dateRange.end}
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 80,
          width: 1760,
          height: 68,
          display: 'flex',
          gap: 14,
        }}
      >
        <KpiCard
          label="TOTAL SPEND"
          value={`${currencyPrefix}${(totalSpend / 1000).toFixed(0)}K`}
          color={BAD_COLOR}
        />
        <KpiCard
          label="REVENUE"
          value={`${currencyPrefix}${(totalRevenue / 1000).toFixed(0)}K`}
          color={GOOD_COLOR}
        />
        <KpiCard
          label="ROAS"
          value={`${roas}x`}
          color={Number.parseFloat(roas) >= 3 ? GOOD_COLOR : WARN_COLOR}
        />
        <KpiCard label="CONVERSIONS" value={totalConversions.toLocaleString()} color="#81aeff" />
        {kpis.slice(0, 1).map((k) => (
          <KpiCard
            key={k.id}
            label={k.name.toUpperCase()}
            value={formatValue(k.value, k.unit)}
            color={trendColor(k.trend)}
          />
        ))}
      </div>

      {mode === 'channels' ? (
        <div
          data-testid="marketing-dashboard-channels"
          style={{
            position: 'absolute',
            left: 80,
            top: 168,
            width: 1760,
            height: 500,
            display: 'flex',
            gap: 16,
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 24,
              padding: '0 40px 40px',
            }}
          >
            {channels.map((ch) => {
              const maxRev = Math.max(...channels.map((c) => c.revenue), 1);
              const height = (ch.revenue / maxRev) * 380;
              return (
                <div
                  key={ch.id}
                  data-testid={`marketing-dashboard-channel-bar-${ch.id}`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: textColor }}>
                    {currencyPrefix}
                    {(ch.revenue / 1000).toFixed(0)}K
                  </span>
                  <div
                    style={{
                      width: '100%',
                      height,
                      backgroundColor: ch.color,
                      borderRadius: '6px 6px 0 0',
                      minHeight: 4,
                    }}
                  />
                  <span style={{ fontSize: 10, color: MUTED_COLOR, textAlign: 'center' }}>
                    {ch.name}
                  </span>
                  <span style={{ fontSize: 9, color: SUBDUED_COLOR }}>
                    Spend: {currencyPrefix}
                    {(ch.spend / 1000).toFixed(0)}K
                  </span>
                </div>
              );
            })}
          </div>

          <div
            data-testid="marketing-dashboard-channel-table"
            style={{
              width: 500,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              paddingTop: 20,
            }}
          >
            {channels.map((ch) => {
              const chRoas = ch.spend > 0 ? (ch.revenue / ch.spend).toFixed(1) : '0';
              const cpa = ch.conversions > 0 ? (ch.spend / ch.conversions).toFixed(0) : '—';
              return (
                <div
                  key={ch.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    backgroundColor: surface,
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      backgroundColor: ch.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 11, color: textColor, fontWeight: 600 }}>
                    {ch.name}
                  </span>
                  <span style={{ fontSize: 10, color: MUTED_COLOR, width: 60, textAlign: 'right' }}>
                    ROAS {chRoas}x
                  </span>
                  <span
                    style={{ fontSize: 10, color: SUBDUED_COLOR, width: 60, textAlign: 'right' }}
                  >
                    CPA {currencyPrefix}
                    {cpa}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {mode === 'funnel' ? (
        <div
          data-testid="marketing-dashboard-funnel"
          style={{
            position: 'absolute',
            left: 80,
            top: 168,
            width: 1760,
            height: 800,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 8,
            padding: '0 200px',
          }}
        >
          {funnelStages.map((stage) => {
            const maxVal = funnelStages[0]?.value ?? 1;
            const widthPct = maxVal > 0 ? (stage.value / maxVal) * 100 : 0;
            return (
              <div
                key={stage.id}
                data-testid={`marketing-dashboard-funnel-stage-${stage.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 16 }}
              >
                <div
                  style={{
                    width: 140,
                    textAlign: 'right',
                    fontSize: 12,
                    fontWeight: 600,
                    color: MUTED_COLOR,
                  }}
                >
                  {stage.name}
                </div>
                <div style={{ flex: 1, height: 40, position: 'relative' }}>
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: '100%',
                      backgroundColor: stage.color,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      {stage.value.toLocaleString()}
                    </span>
                  </div>
                </div>
                {stage.conversionRate !== undefined ? (
                  <span style={{ fontSize: 11, color: SUBDUED_COLOR, width: 50 }}>
                    {stage.conversionRate}%
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export const marketingDashboardClip: ClipDefinition<unknown> =
  defineFrameClip<MarketingDashboardProps>({
    kind: 'marketing-dashboard',
    component: MarketingDashboard,
    propsSchema: marketingDashboardPropsSchema,
    themeSlots: {
      background: { kind: 'palette', role: 'background' },
      textColor: { kind: 'palette', role: 'foreground' },
      surface: { kind: 'palette', role: 'surface' },
    },
    fontRequirements: () => [
      { family: 'Plus Jakarta Sans', weight: 600 },
      { family: 'Plus Jakarta Sans', weight: 700 },
      { family: 'Plus Jakarta Sans', weight: 800 },
    ],
  });
