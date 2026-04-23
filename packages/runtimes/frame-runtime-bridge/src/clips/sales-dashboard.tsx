// packages/runtimes/frame-runtime-bridge/src/clips/sales-dashboard.tsx
// T-131f.2c port of reference/slidemotion/.../components/sales/{SalesDashboardSlide,PipelineFunnel,ForecastChart,DealCard}.tsx.
//
// Option B (flat-prop interface): no `SalesPipelineContent` domain
// schema from `@slidemotion/schema`. Five `pipelineType` modes:
//   - 'funnel' / 'quarterly_review' → PipelineFunnel + optional
//                                     DealCards strip below
//   - 'forecast'                    → ForecastChart (bars + quota
//                                     line + summary-KPI column)
//   - 'deal_review'                 → full-bleed DealCard grid
//   - 'win_loss'                    → Won / Lost two-column DealCard
//                                     layout
//
// Sub-components (PipelineFunnel, ForecastChart, DealCard) are
// inlined as private module-level functions — single consumer, no
// reuse across clips, so the scope stays contained.
//
// Entry animation: single 0..15-frame fade-in. No spring physics.

import { interpolate, useCurrentFrame } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';
import {
  DASHBOARD_BAD_COLOR,
  DASHBOARD_GOOD_COLOR,
  DASHBOARD_MUTED_COLOR,
  DASHBOARD_SUBDUED_COLOR,
  DASHBOARD_WARN_COLOR,
} from './_dashboard-utils.js';

const dealStatusSchema = z.enum(['on_track', 'at_risk', 'slipping', 'won', 'lost']);
export type SalesDealStatus = z.infer<typeof dealStatusSchema>;

const pipelineTypeSchema = z.enum([
  'funnel',
  'forecast',
  'deal_review',
  'quarterly_review',
  'win_loss',
]);
export type SalesPipelineType = z.infer<typeof pipelineTypeSchema>;

const densitySchema = z.enum(['executive', 'standard', 'detailed']);
const sortBySchema = z.enum(['value', 'close_date', 'probability', 'status']);

const stageSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    order: z.number().int().nonnegative(),
    probability: z.number().min(0).max(100),
  })
  .strict();

const dealSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    company: z.string(),
    value: z.number().nonnegative(),
    status: dealStatusSchema,
    stageId: z.string(),
    probability: z.number().min(0).max(100).optional(),
    closeDate: z.string(),
    owner: z.string().optional(),
    nextStep: z.string().optional(),
  })
  .strict();

const summarySchema = z
  .object({
    totalPipeline: z.number().nonnegative(),
    weightedPipeline: z.number().nonnegative(),
    closedWon: z.number().nonnegative(),
    quota: z.number().nonnegative(),
    winRate: z.number().min(0).max(100),
    pipelineCoverage: z.number().nonnegative(),
    avgDealSize: z.number().nonnegative(),
    avgCycleLength: z.number().nonnegative(),
  })
  .strict();

const settingsSchema = z
  .object({
    density: densitySchema.optional(),
    maxDealsShown: z.number().int().positive().optional(),
    sortBy: sortBySchema.optional(),
    showDealCards: z.boolean().optional(),
  })
  .strict();

export const salesDashboardPropsSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    period: z.string().optional(),
    pipelineType: pipelineTypeSchema.optional(),
    currency: z.string().optional(),
    stages: z.array(stageSchema),
    deals: z.array(dealSchema),
    summary: summarySchema.optional(),
    settings: settingsSchema.optional(),
    background: z.string().optional(),
    textColor: z.string().optional(),
    surface: z.string().optional(),
  })
  .strict();

export type SalesDealStage = z.infer<typeof stageSchema>;
export type SalesDeal = z.infer<typeof dealSchema>;
export type SalesSummary = z.infer<typeof summarySchema>;
export type SalesSettings = z.infer<typeof settingsSchema>;
export type SalesDashboardProps = z.infer<typeof salesDashboardPropsSchema>;

const ARCHETYPE_TITLES: Record<SalesPipelineType, string> = {
  funnel: 'Pipeline Overview',
  forecast: 'Forecast Summary',
  deal_review: 'Deal Review',
  win_loss: 'Win/Loss Analysis',
  quarterly_review: 'Quarterly Pipeline Review',
};

const STATUS_BADGES: Record<SalesDealStatus, { bg: string; text: string; label: string }> = {
  on_track: { bg: 'rgba(52,211,153,0.15)', text: DASHBOARD_GOOD_COLOR, label: 'On Track' },
  at_risk: { bg: 'rgba(251,191,36,0.15)', text: DASHBOARD_WARN_COLOR, label: 'At Risk' },
  slipping: { bg: 'rgba(251,113,133,0.15)', text: DASHBOARD_BAD_COLOR, label: 'Slipping' },
  won: { bg: 'rgba(52,211,153,0.15)', text: DASHBOARD_GOOD_COLOR, label: 'Won' },
  lost: { bg: 'rgba(251,113,133,0.15)', text: DASHBOARD_BAD_COLOR, label: 'Lost' },
};

function currencyPrefix(currency: string): string {
  if (currency === 'EUR') return '\u20AC';
  if (currency === 'USD') return '$';
  return '';
}

function fmtCurrency(value: number, currency: string): string {
  return `${currencyPrefix(currency)}${(value / 1000).toFixed(0)}K`;
}

function defaultMaxDeals(
  density: z.infer<typeof densitySchema>,
  override: number | undefined,
): number {
  if (override !== undefined) return override;
  if (density === 'executive') return 4;
  if (density === 'detailed') return 12;
  return 6;
}

function sortDeals(
  deals: readonly SalesDeal[],
  sortBy: z.infer<typeof sortBySchema> | undefined,
): SalesDeal[] {
  const copy = [...deals];
  if (sortBy === 'close_date') {
    copy.sort((a, b) => a.closeDate.localeCompare(b.closeDate));
  } else if (sortBy === 'probability') {
    copy.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  } else if (sortBy === 'status') {
    copy.sort((a, _b) => (a.status === 'at_risk' ? -1 : 1));
  } else {
    copy.sort((a, b) => b.value - a.value);
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Sub-components (private to this file)
// ---------------------------------------------------------------------------

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
      data-testid={`sales-dashboard-kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        flex: 1,
        backgroundColor: 'rgba(21,28,35,0.4)',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: DASHBOARD_SUBDUED_COLOR,
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

function DealCard({
  deal,
  stage,
  currency,
  surface,
  textColor,
}: {
  deal: SalesDeal;
  stage: SalesDealStage | undefined;
  currency: string;
  surface: string;
  textColor: string;
}): ReactElement {
  const statusStyle = STATUS_BADGES[deal.status];
  return (
    <div
      data-testid={`sales-dashboard-deal-${deal.id}`}
      style={{
        backgroundColor: surface,
        borderRadius: 8,
        padding: 14,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        borderLeft: `3px solid ${stage?.color ?? '#81aeff'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: textColor,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {deal.name}
          </div>
          <div style={{ fontSize: 10, color: DASHBOARD_MUTED_COLOR, marginTop: 2 }}>
            {deal.company}
          </div>
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#81aeff',
            fontVariantNumeric: 'tabular-nums',
            marginLeft: 8,
          }}
        >
          {fmtCurrency(deal.value, currency)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {stage !== undefined ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: stage.color,
              backgroundColor: `${stage.color}20`,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {stage.name}
          </span>
        ) : null}
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: statusStyle.text,
            backgroundColor: statusStyle.bg,
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {statusStyle.label}
        </span>
        {deal.probability !== undefined ? (
          <span style={{ fontSize: 9, color: DASHBOARD_SUBDUED_COLOR }}>{deal.probability}%</span>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9,
          color: DASHBOARD_SUBDUED_COLOR,
        }}
      >
        <span>Close: {deal.closeDate}</span>
        {deal.owner !== undefined ? <span>{deal.owner}</span> : null}
      </div>

      {deal.nextStep !== undefined ? (
        <div style={{ fontSize: 9, color: '#5af8fb', marginTop: 2 }}>Next: {deal.nextStep}</div>
      ) : null}
    </div>
  );
}

function PipelineFunnel({
  stages,
  deals,
  currency,
  textColor,
}: {
  stages: readonly SalesDealStage[];
  deals: readonly SalesDeal[];
  currency: string;
  textColor: string;
}): ReactElement {
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  const metrics = sortedStages.map((stage) => {
    const stageDeals = deals.filter((d) => d.stageId === stage.id && d.status !== 'lost');
    const totalValue = stageDeals.reduce((s, d) => s + d.value, 0);
    const atRisk = stageDeals.filter(
      (d) => d.status === 'at_risk' || d.status === 'slipping',
    ).length;
    return { stage, count: stageDeals.length, totalValue, atRisk };
  });
  const maxValue = Math.max(...metrics.map((m) => m.totalValue), 1);

  return (
    <div
      data-testid="sales-dashboard-funnel"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        gap: 4,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}
    >
      {metrics.map((m, i) => {
        const widthPct = Math.max(20, (m.totalValue / maxValue) * 100);
        const isFirst = i === 0;
        const isLast = i === metrics.length - 1;
        const opacity = 0.85 + (i / Math.max(1, metrics.length)) * 0.15;
        return (
          <div
            key={m.stage.id}
            data-testid={`sales-dashboard-funnel-stage-${m.stage.id}`}
            style={{
              flex: `0 0 ${100 / Math.max(1, metrics.length)}%`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${widthPct}%`,
                backgroundColor: m.stage.color,
                borderRadius: isFirst ? '8px 8px 0 0' : isLast ? '0 0 8px 8px' : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 40,
                position: 'relative',
                opacity,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              >
                {fmtCurrency(m.totalValue, currency)}
              </span>
              {m.atRisk > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: DASHBOARD_WARN_COLOR,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#000',
                  }}
                >
                  {m.atRisk}
                </div>
              ) : null}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{m.stage.name}</div>
              <div style={{ fontSize: 10, color: DASHBOARD_MUTED_COLOR }}>
                {m.count} deal{m.count === 1 ? '' : 's'} · {m.stage.probability}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KpiRow({
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
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: 'rgba(21,28,35,0.4)',
        borderRadius: 8,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: DASHBOARD_MUTED_COLOR,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ForecastChart({
  summary,
  deals,
  currency,
}: {
  summary: SalesSummary;
  deals: readonly SalesDeal[];
  currency: string;
}): ReactElement {
  const maxVal = Math.max(summary.quota, summary.totalPipeline, 1) * 1.1;
  const bar = (v: number): string => `${(v / maxVal) * 100}%`;

  const atRiskDeals = deals.filter((d) => d.status === 'at_risk').length;
  const slippingDeals = deals.filter((d) => d.status === 'slipping').length;

  return (
    <div
      data-testid="sales-dashboard-forecast"
      style={{
        width: '100%',
        height: '100%',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        display: 'flex',
        gap: 40,
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 32,
          position: 'relative',
          paddingBottom: 40,
        }}
      >
        <div
          data-testid="sales-dashboard-forecast-quota-line"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: `calc(${bar(summary.quota)} + 40px)`,
            borderBottom: `2px dashed ${DASHBOARD_BAD_COLOR}`,
            zIndex: 5,
          }}
        >
          <span
            style={{
              position: 'absolute',
              right: 0,
              top: -18,
              fontSize: 10,
              fontWeight: 600,
              color: DASHBOARD_BAD_COLOR,
            }}
          >
            Quota: {fmtCurrency(summary.quota, currency)}
          </span>
        </div>

        {[
          {
            key: 'closed-won',
            label: 'Closed Won',
            color: DASHBOARD_GOOD_COLOR,
            value: summary.closedWon,
            opacity: 1,
          },
          {
            key: 'weighted',
            label: 'Weighted',
            color: '#81aeff',
            value: summary.weightedPipeline,
            opacity: 1,
          },
          {
            key: 'total',
            label: 'Total Pipeline',
            color: '#5af8fb',
            value: summary.totalPipeline,
            opacity: 0.6,
          },
        ].map((b) => (
          <div
            key={b.key}
            data-testid={`sales-dashboard-forecast-bar-${b.key}`}
            style={{
              width: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: b.color }}>
              {fmtCurrency(b.value, currency)}
            </span>
            <div
              style={{
                width: '100%',
                height: bar(b.value),
                backgroundColor: b.color,
                borderRadius: '6px 6px 0 0',
                minHeight: 4,
                opacity: b.opacity,
              }}
            />
            <span style={{ fontSize: 10, fontWeight: 600, color: DASHBOARD_MUTED_COLOR }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          width: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          justifyContent: 'center',
        }}
      >
        <KpiRow
          label="Pipeline Coverage"
          value={`${summary.pipelineCoverage.toFixed(1)}x`}
          color={summary.pipelineCoverage >= 3 ? DASHBOARD_GOOD_COLOR : DASHBOARD_WARN_COLOR}
        />
        <KpiRow
          label="Win Rate"
          value={`${summary.winRate.toFixed(0)}%`}
          color={summary.winRate >= 30 ? DASHBOARD_GOOD_COLOR : DASHBOARD_BAD_COLOR}
        />
        <KpiRow
          label="Avg Deal Size"
          value={fmtCurrency(summary.avgDealSize, currency)}
          color="#81aeff"
        />
        <KpiRow
          label="Avg Cycle"
          value={`${summary.avgCycleLength}d`}
          color={DASHBOARD_MUTED_COLOR}
        />
        <KpiRow
          label="At Risk"
          value={`${atRiskDeals} deal${atRiskDeals === 1 ? '' : 's'}`}
          color={atRiskDeals > 0 ? DASHBOARD_WARN_COLOR : DASHBOARD_GOOD_COLOR}
        />
        <KpiRow
          label="Slipping"
          value={`${slippingDeals} deal${slippingDeals === 1 ? '' : 's'}`}
          color={slippingDeals > 0 ? DASHBOARD_BAD_COLOR : DASHBOARD_GOOD_COLOR}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-level clip
// ---------------------------------------------------------------------------

export function SalesDashboard({
  title,
  subtitle,
  period,
  pipelineType = 'funnel',
  currency = 'USD',
  stages,
  deals,
  summary,
  settings,
  background = '#080f15',
  textColor = '#ebf1fa',
  surface = '#111820',
}: SalesDashboardProps): ReactElement {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const density = settings?.density ?? 'standard';
  const maxDeals = defaultMaxDeals(density, settings?.maxDealsShown);
  // Lost deals are filtered OUT except in win_loss mode where they're the
  // point of the slide.
  const filtered = deals.filter((d) => d.status !== 'lost' || pipelineType === 'win_loss');
  const dealsToShow = sortDeals(filtered, settings?.sortBy).slice(0, maxDeals);

  const resolvedTitle = title ?? ARCHETYPE_TITLES[pipelineType];

  return (
    <div
      data-testid="sales-dashboard"
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
        data-testid="sales-dashboard-title"
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
      {subtitle !== undefined ? (
        <div
          data-testid="sales-dashboard-subtitle"
          style={{
            position: 'absolute',
            left: 80,
            top: 60,
            fontSize: 12,
            fontWeight: 500,
            color: DASHBOARD_SUBDUED_COLOR,
          }}
        >
          {subtitle}
        </div>
      ) : null}

      {summary !== undefined ? (
        <div
          data-testid="sales-dashboard-summary"
          style={{
            position: 'absolute',
            left: 80,
            top: 80,
            width: 1760,
            height: 68,
            display: 'flex',
            gap: 16,
          }}
        >
          <KpiCard
            label="TOTAL PIPELINE"
            value={fmtCurrency(summary.totalPipeline, currency)}
            color="#5af8fb"
          />
          <KpiCard
            label="WEIGHTED"
            value={fmtCurrency(summary.weightedPipeline, currency)}
            color="#81aeff"
          />
          <KpiCard
            label="CLOSED WON"
            value={fmtCurrency(summary.closedWon, currency)}
            color={DASHBOARD_GOOD_COLOR}
          />
          <KpiCard
            label="WIN RATE"
            value={`${summary.winRate.toFixed(0)}%`}
            color={summary.winRate >= 30 ? DASHBOARD_GOOD_COLOR : DASHBOARD_BAD_COLOR}
          />
          <KpiCard
            label="COVERAGE"
            value={`${summary.pipelineCoverage.toFixed(1)}x`}
            color={summary.pipelineCoverage >= 3 ? DASHBOARD_GOOD_COLOR : DASHBOARD_WARN_COLOR}
          />
        </div>
      ) : null}

      {pipelineType === 'funnel' || pipelineType === 'quarterly_review' ? (
        <div style={{ position: 'absolute', left: 80, top: 156, width: 1760, height: 460 }}>
          <PipelineFunnel stages={stages} deals={deals} currency={currency} textColor={textColor} />
        </div>
      ) : null}

      {pipelineType === 'forecast' && summary !== undefined ? (
        <div style={{ position: 'absolute', left: 80, top: 156, width: 1760, height: 500 }}>
          <ForecastChart summary={summary} deals={deals} currency={currency} />
        </div>
      ) : null}

      {pipelineType === 'deal_review' || settings?.showDealCards === true ? (
        <div
          data-testid="sales-dashboard-deals"
          style={{
            position: 'absolute',
            left: 80,
            top: pipelineType === 'deal_review' ? 156 : 648,
            width: 1760,
            height: pipelineType === 'deal_review' ? 860 : 360,
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(Math.max(1, dealsToShow.length), density === 'executive' ? 2 : 3)}, 1fr)`,
            gap: 12,
            alignContent: 'start',
          }}
        >
          {dealsToShow.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              stage={stages.find((s) => s.id === deal.stageId)}
              currency={currency}
              surface={surface}
              textColor={textColor}
            />
          ))}
        </div>
      ) : null}

      {pipelineType === 'win_loss' ? (
        <div
          data-testid="sales-dashboard-win-loss"
          style={{
            position: 'absolute',
            left: 80,
            top: 156,
            width: 1760,
            height: 860,
            display: 'flex',
            gap: 32,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: DASHBOARD_GOOD_COLOR,
                marginBottom: 12,
              }}
            >
              Won ({deals.filter((d) => d.status === 'won').length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deals
                .filter((d) => d.status === 'won')
                .slice(0, 6)
                .map((d) => (
                  <DealCard
                    key={d.id}
                    deal={d}
                    stage={stages.find((s) => s.id === d.stageId)}
                    currency={currency}
                    surface={surface}
                    textColor={textColor}
                  />
                ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: DASHBOARD_BAD_COLOR,
                marginBottom: 12,
              }}
            >
              Lost ({deals.filter((d) => d.status === 'lost').length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deals
                .filter((d) => d.status === 'lost')
                .slice(0, 6)
                .map((d) => (
                  <DealCard
                    key={d.id}
                    deal={d}
                    stage={stages.find((s) => s.id === d.stageId)}
                    currency={currency}
                    surface={surface}
                    textColor={textColor}
                  />
                ))}
            </div>
          </div>
        </div>
      ) : null}

      <div
        data-testid="sales-dashboard-footer"
        style={{
          position: 'absolute',
          left: 80,
          right: 80,
          bottom: 16,
          fontSize: 9,
          fontWeight: 400,
          color: DASHBOARD_SUBDUED_COLOR,
        }}
      >
        {period ?? 'Current Period'} | {currency} | Pipeline data
      </div>
    </div>
  );
}

export const salesDashboardClip: ClipDefinition<unknown> = defineFrameClip<SalesDashboardProps>({
  kind: 'sales-dashboard',
  component: SalesDashboard,
  propsSchema: salesDashboardPropsSchema,
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
