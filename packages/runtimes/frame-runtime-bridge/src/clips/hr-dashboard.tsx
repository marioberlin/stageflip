// packages/runtimes/frame-runtime-bridge/src/clips/hr-dashboard.tsx
// T-131f.2 port of reference/slidemotion/.../components/hr/HrDashboardSlide.tsx.
//
// Option B (flat-prop interface): the reference clip imports an
// `HrContent` domain schema from `@slidemotion/schema`; we don't bring
// that schema over. Instead this clip's `propsSchema` declares just the
// fields it actually renders — department breakdown + KPI metrics —
// decoupling the bridge runtime from the agent-layer content model that
// lands in Phase 7. Authors / agent tools compose an `HrDashboardProps`
// directly.
//
// Animations: no spring/physics entrance (matches reference — the
// reference clip has no `useCurrentFrame` either; it's a static
// layout). We add a single fade-in over the first 15 frames so the
// clip matches the rest of the bridge tranche's entry discipline.

import { interpolate, useCurrentFrame } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const trendSchema = z.enum(['up', 'down', 'flat']);
export type HrTrend = z.infer<typeof trendSchema>;

const departmentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    headcount: z.number().int().nonnegative(),
    openPositions: z.number().int().nonnegative(),
    attritionRate: z.number().nonnegative(),
  })
  .strict();

const metricSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    value: z.union([z.number(), z.string()]),
    unit: z.string().optional(),
    trend: trendSchema.optional(),
    target: z.union([z.number(), z.string()]).optional(),
    benchmark: z.union([z.number(), z.string()]).optional(),
  })
  .strict();

export const hrDashboardPropsSchema = z
  .object({
    title: z.string().optional(),
    period: z.string().optional(),
    departments: z.array(departmentSchema),
    metrics: z.array(metricSchema).optional(),
    background: z.string().optional(),
    textColor: z.string().optional(),
    surface: z.string().optional(),
  })
  .strict();

export type HrDashboardDepartment = z.infer<typeof departmentSchema>;
export type HrDashboardMetric = z.infer<typeof metricSchema>;
export type HrDashboardProps = z.infer<typeof hrDashboardPropsSchema>;

const GOOD_COLOR = '#34d399';
const WARN_COLOR = '#fbbf24';
const BAD_COLOR = '#fb7185';
const MUTED_COLOR = '#a5acb4';
const SUBDUED_COLOR = '#6b7280';

function formatValue(value: number | string, unit?: string): string {
  const stringified = typeof value === 'number' ? String(value) : value;
  return unit !== undefined && unit.length > 0 ? `${stringified}${unit}` : stringified;
}

function trendColor(trend: HrTrend | undefined): string {
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
      data-testid={`hr-dashboard-kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
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

export function HrDashboard({
  title,
  period,
  departments,
  metrics = [],
  background = '#080f15',
  textColor = '#ebf1fa',
  surface = '#111820',
}: HrDashboardProps): ReactElement {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const totalHeadcount = departments.reduce((s, d) => s + d.headcount, 0);
  const totalOpen = departments.reduce((s, d) => s + d.openPositions, 0);
  const avgAttrition =
    departments.length > 0
      ? (departments.reduce((s, d) => s + d.attritionRate, 0) / departments.length).toFixed(1)
      : '0';

  const resolvedTitle = title ?? 'Headcount Overview';

  return (
    <div
      data-testid="hr-dashboard"
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
        data-testid="hr-dashboard-title"
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
        <KpiCard label="HEADCOUNT" value={totalHeadcount.toString()} color="#81aeff" />
        <KpiCard
          label="OPEN POSITIONS"
          value={totalOpen.toString()}
          color={totalOpen > 10 ? WARN_COLOR : GOOD_COLOR}
        />
        <KpiCard
          label="AVG ATTRITION"
          value={`${avgAttrition}%`}
          color={Number.parseFloat(avgAttrition) > 15 ? BAD_COLOR : GOOD_COLOR}
        />
        {metrics.slice(0, 2).map((m) => (
          <KpiCard
            key={m.id}
            label={m.name.toUpperCase()}
            value={formatValue(m.value, m.unit)}
            color={trendColor(m.trend)}
          />
        ))}
      </div>

      <div
        data-testid="hr-dashboard-departments"
        style={{
          position: 'absolute',
          left: 80,
          top: 156,
          width: 1100,
          height: 860,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            padding: '0 12px',
            fontSize: 10,
            fontWeight: 600,
            color: SUBDUED_COLOR,
          }}
        >
          <span style={{ flex: 2 }}>Department</span>
          <span style={{ width: 80, textAlign: 'right' }}>HC</span>
          <span style={{ width: 80, textAlign: 'right' }}>Open</span>
          <span style={{ width: 80, textAlign: 'right' }}>Attrition</span>
          <span style={{ flex: 3 }}>Distribution</span>
        </div>
        {departments.map((dept) => {
          const pct = totalHeadcount > 0 ? (dept.headcount / totalHeadcount) * 100 : 0;
          return (
            <div
              key={dept.id}
              data-testid={`hr-dashboard-department-${dept.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                backgroundColor: surface,
                borderRadius: 8,
              }}
            >
              <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: dept.color }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{dept.name}</span>
              </div>
              <span
                style={{
                  width: 80,
                  textAlign: 'right',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#81aeff',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {dept.headcount}
              </span>
              <span
                style={{
                  width: 80,
                  textAlign: 'right',
                  fontSize: 12,
                  color: dept.openPositions > 5 ? WARN_COLOR : MUTED_COLOR,
                }}
              >
                {dept.openPositions}
              </span>
              <span
                style={{
                  width: 80,
                  textAlign: 'right',
                  fontSize: 12,
                  color: dept.attritionRate > 15 ? BAD_COLOR : MUTED_COLOR,
                }}
              >
                {dept.attritionRate}%
              </span>
              <div style={{ flex: 3, paddingLeft: 16 }}>
                <div
                  style={{ width: '100%', height: 8, backgroundColor: '#1e252d', borderRadius: 4 }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      backgroundColor: dept.color,
                      borderRadius: 4,
                    }}
                  />
                </div>
                <span style={{ fontSize: 9, color: SUBDUED_COLOR, marginTop: 2, display: 'block' }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {metrics.length > 0 ? (
        <div
          data-testid="hr-dashboard-metrics"
          style={{
            position: 'absolute',
            right: 80,
            top: 156,
            width: 560,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SUBDUED_COLOR,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginBottom: 4,
            }}
          >
            Key Metrics
          </div>
          {metrics.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                backgroundColor: surface,
                borderRadius: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: MUTED_COLOR }}>{m.name}</div>
                <div style={{ fontSize: 9, color: SUBDUED_COLOR, marginTop: 2 }}>{m.category}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: trendColor(m.trend),
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatValue(m.value, m.unit)}
                </div>
                {m.target !== undefined ? (
                  <div style={{ fontSize: 9, color: SUBDUED_COLOR }}>
                    Target: {formatValue(m.target, m.unit)}
                  </div>
                ) : null}
                {m.benchmark !== undefined ? (
                  <div style={{ fontSize: 9, color: '#5af8fb' }}>
                    Benchmark: {formatValue(m.benchmark, m.unit)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {period !== undefined ? (
        <div
          data-testid="hr-dashboard-period"
          style={{ position: 'absolute', left: 80, bottom: 16, fontSize: 9, color: SUBDUED_COLOR }}
        >
          {period} | People Analytics
        </div>
      ) : null}
    </div>
  );
}

export const hrDashboardClip: ClipDefinition<unknown> = defineFrameClip<HrDashboardProps>({
  kind: 'hr-dashboard',
  component: HrDashboard,
  propsSchema: hrDashboardPropsSchema,
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
