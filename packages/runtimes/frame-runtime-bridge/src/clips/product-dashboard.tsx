// packages/runtimes/frame-runtime-bridge/src/clips/product-dashboard.tsx
// T-131f.2b port of reference/slidemotion/.../components/product/ProductDashboardSlide.tsx.
//
// Option B (flat-prop interface): domain `ProductContent` schema is
// NOT reimplemented. Three display modes driven by `reportType`:
//   - 'sprint_review' / 'release_notes' → feature card grid.
//   - 'roadmap'                         → Now/Next/Later kanban lanes.
//   - 'metrics_dashboard'               → right-side metrics panel
//                                         with sparklines.
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
  dashboardTrendColor,
  dashboardTrendSchema,
  formatDashboardValue,
} from './_dashboard-utils.js';

const featureStatusSchema = z.enum(['shipped', 'in_progress', 'planned', 'blocked']);
const featurePrioritySchema = z.enum(['p0', 'p1', 'p2', 'p3']);
const reportTypeSchema = z.enum(['sprint_review', 'release_notes', 'roadmap', 'metrics_dashboard']);

export type ProductFeatureStatus = z.infer<typeof featureStatusSchema>;
export type ProductFeaturePriority = z.infer<typeof featurePrioritySchema>;
export type ProductReportType = z.infer<typeof reportTypeSchema>;

const featureSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    status: featureStatusSchema,
    priority: featurePrioritySchema,
    team: z.string().optional(),
  })
  .strict();

const productMetricSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    value: z.number(),
    unit: z.string().optional(),
    trend: dashboardTrendSchema.optional(),
    previousValue: z.number().optional(),
    sparkline: z.array(z.number()).optional(),
    threshold: z.object({ warning: z.number(), critical: z.number() }).strict().optional(),
  })
  .strict();

export const productDashboardPropsSchema = z
  .object({
    title: z.string().optional(),
    period: z.string().optional(),
    reportType: reportTypeSchema.optional(),
    sprintNumber: z.union([z.string(), z.number()]).optional(),
    version: z.string().optional(),
    features: z.array(featureSchema),
    metrics: z.array(productMetricSchema).optional(),
    background: z.string().optional(),
    textColor: z.string().optional(),
    surface: z.string().optional(),
  })
  .strict();

export type ProductFeature = z.infer<typeof featureSchema>;
export type ProductMetric = z.infer<typeof productMetricSchema>;
export type ProductDashboardProps = z.infer<typeof productDashboardPropsSchema>;

const STATUS_COLORS: Record<ProductFeatureStatus, string> = {
  shipped: DASHBOARD_GOOD_COLOR,
  in_progress: '#81aeff',
  planned: DASHBOARD_SUBDUED_COLOR,
  blocked: DASHBOARD_BAD_COLOR,
};
const STATUS_LABELS: Record<ProductFeatureStatus, string> = {
  shipped: 'Shipped',
  in_progress: 'In Progress',
  planned: 'Planned',
  blocked: 'Blocked',
};
const PRIORITY_COLORS: Record<ProductFeaturePriority, string> = {
  p0: DASHBOARD_BAD_COLOR,
  p1: DASHBOARD_WARN_COLOR,
  p2: '#81aeff',
  p3: DASHBOARD_SUBDUED_COLOR,
};

function metricColor(m: ProductMetric): string {
  if (m.threshold !== undefined) {
    if (m.value >= m.threshold.critical) return DASHBOARD_BAD_COLOR;
    if (m.value >= m.threshold.warning) return DASHBOARD_WARN_COLOR;
    return DASHBOARD_GOOD_COLOR;
  }
  return dashboardTrendColor(m.trend);
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
      data-testid={`product-dashboard-kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
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

function FeatureCard({
  feature,
  surface,
  textColor,
}: {
  feature: ProductFeature;
  surface: string;
  textColor: string;
}): ReactElement {
  return (
    <div
      data-testid={`product-dashboard-feature-${feature.id}`}
      style={{
        backgroundColor: surface,
        borderRadius: 8,
        padding: 14,
        borderLeft: `3px solid ${STATUS_COLORS[feature.status]}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: textColor, flex: 1 }}>
          {feature.title}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: PRIORITY_COLORS[feature.priority],
            backgroundColor: `${PRIORITY_COLORS[feature.priority]}20`,
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {feature.priority.toUpperCase()}
        </span>
      </div>
      {feature.description !== undefined ? (
        <div style={{ fontSize: 10, color: DASHBOARD_MUTED_COLOR }}>{feature.description}</div>
      ) : null}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: STATUS_COLORS[feature.status],
            backgroundColor: `${STATUS_COLORS[feature.status]}20`,
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {STATUS_LABELS[feature.status]}
        </span>
        {feature.team !== undefined ? (
          <span style={{ fontSize: 9, color: DASHBOARD_SUBDUED_COLOR }}>{feature.team}</span>
        ) : null}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: readonly number[] }): ReactElement | null {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const segments: ReactElement[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1] as number;
    const curr = values[i] as number;
    const x1 = ((i - 1) / (values.length - 1)) * 80;
    const y1 = 20 - (prev / max) * 18;
    const x2 = (i / (values.length - 1)) * 80;
    const y2 = 20 - (curr / max) * 18;
    segments.push(
      <line
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed sparkline segment grid.
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#81aeff"
        strokeWidth={1.5}
      />,
    );
  }
  return (
    <svg width={80} height={20} style={{ marginTop: 4 }}>
      <title>sparkline</title>
      {segments}
    </svg>
  );
}

function resolveTitle(props: ProductDashboardProps): string {
  if (props.title !== undefined) return props.title;
  switch (props.reportType) {
    case 'sprint_review':
      return `Sprint ${props.sprintNumber ?? ''} Review`.trim();
    case 'release_notes':
      return `Release ${props.version ?? ''}`.trim();
    case 'roadmap':
      return 'Product Roadmap';
    case 'metrics_dashboard':
      return 'Product Metrics';
    default:
      return 'Product Metrics';
  }
}

export function ProductDashboard({
  title,
  period,
  reportType = 'metrics_dashboard',
  sprintNumber,
  version,
  features,
  metrics = [],
  background = '#080f15',
  textColor = '#ebf1fa',
  surface = '#111820',
}: ProductDashboardProps): ReactElement {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const shipped = features.filter((f) => f.status === 'shipped').length;
  const inProgress = features.filter((f) => f.status === 'in_progress').length;
  const blocked = features.filter((f) => f.status === 'blocked').length;
  const resolvedTitle = resolveTitle({
    title,
    period,
    reportType,
    sprintNumber,
    version,
    features,
  });

  return (
    <div
      data-testid="product-dashboard"
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
        data-testid="product-dashboard-title"
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

      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 68,
          width: 1760,
          height: 68,
          display: 'flex',
          gap: 14,
        }}
      >
        <KpiCard label="SHIPPED" value={String(shipped)} color={DASHBOARD_GOOD_COLOR} />
        <KpiCard label="IN PROGRESS" value={String(inProgress)} color="#81aeff" />
        <KpiCard
          label="BLOCKED"
          value={String(blocked)}
          color={blocked > 0 ? DASHBOARD_BAD_COLOR : DASHBOARD_GOOD_COLOR}
        />
        {metrics.slice(0, 2).map((m) => (
          <KpiCard
            key={m.id}
            label={m.name.toUpperCase()}
            value={formatDashboardValue(m.value, m.unit)}
            color={metricColor(m)}
          />
        ))}
      </div>

      {reportType === 'sprint_review' || reportType === 'release_notes' ? (
        <div
          data-testid="product-dashboard-features"
          style={{
            position: 'absolute',
            left: 80,
            top: 156,
            width: 1760,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            alignContent: 'start',
          }}
        >
          {features.map((f) => (
            <FeatureCard key={f.id} feature={f} surface={surface} textColor={textColor} />
          ))}
        </div>
      ) : null}

      {reportType === 'roadmap' ? (
        <div
          data-testid="product-dashboard-roadmap"
          style={{
            position: 'absolute',
            left: 80,
            top: 156,
            width: 1760,
            height: 860,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {(['shipped', 'in_progress', 'planned'] as const).map((status, col) => {
            const label = col === 0 ? 'Now' : col === 1 ? 'Next' : 'Later';
            const headerColor =
              col === 0 ? DASHBOARD_GOOD_COLOR : col === 1 ? '#81aeff' : DASHBOARD_SUBDUED_COLOR;
            const items = features.filter((f) => f.status === status);
            return (
              <div
                key={status}
                data-testid={`product-dashboard-lane-${label.toLowerCase()}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: headerColor,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                {items.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      backgroundColor: surface,
                      borderRadius: 8,
                      padding: 12,
                      borderLeft: `3px solid ${PRIORITY_COLORS[f.priority]}`,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{f.title}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: PRIORITY_COLORS[f.priority],
                        }}
                      >
                        {f.priority.toUpperCase()}
                      </span>
                      {f.team !== undefined ? (
                        <span style={{ fontSize: 9, color: DASHBOARD_SUBDUED_COLOR }}>
                          {f.team}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}

      {reportType === 'metrics_dashboard' ? (
        <div
          data-testid="product-dashboard-metrics"
          style={{
            position: 'absolute',
            right: 80,
            top: 156,
            width: 600,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {metrics.map((m) => {
            const warning = m.threshold?.warning;
            const critical = m.threshold?.critical;
            const alertLeft =
              warning !== undefined && m.value >= warning
                ? critical !== undefined && m.value >= critical
                  ? DASHBOARD_BAD_COLOR
                  : DASHBOARD_WARN_COLOR
                : undefined;
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  backgroundColor: surface,
                  borderRadius: 8,
                  borderLeft: alertLeft !== undefined ? `3px solid ${alertLeft}` : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: DASHBOARD_MUTED_COLOR }}>{m.name}</div>
                  {m.sparkline !== undefined ? <Sparkline values={m.sparkline} /> : null}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: dashboardTrendColor(m.trend),
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatDashboardValue(m.value, m.unit)}
                  </div>
                  {m.previousValue !== undefined ? (
                    <div style={{ fontSize: 9, color: DASHBOARD_SUBDUED_COLOR }}>
                      Prev: {formatDashboardValue(m.previousValue, m.unit)}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {period !== undefined ? (
        <div
          data-testid="product-dashboard-footer"
          style={{
            position: 'absolute',
            left: 80,
            bottom: 16,
            fontSize: 9,
            color: DASHBOARD_SUBDUED_COLOR,
          }}
        >
          {period} | Product &amp; Engineering
        </div>
      ) : null}
    </div>
  );
}

export const productDashboardClip: ClipDefinition<unknown> = defineFrameClip<ProductDashboardProps>(
  {
    kind: 'product-dashboard',
    component: ProductDashboard,
    propsSchema: productDashboardPropsSchema,
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
  },
);
