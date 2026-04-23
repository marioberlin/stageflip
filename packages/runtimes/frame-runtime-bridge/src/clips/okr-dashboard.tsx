// packages/runtimes/frame-runtime-bridge/src/clips/okr-dashboard.tsx
// T-131f.2b port of reference/slidemotion/.../components/okr/OkrDashboardSlide.tsx
// (+ OkrProgressCard inlined as `ObjectiveCard`).
//
// Option B (flat-prop interface): no `OkrContent` domain type from
// `@slidemotion/schema`. Three okrType modes:
//   - 'dashboard' / 'objective_detail' → grid of objective cards.
//   - 'team_comparison'                → columns per team with mini
//                                        cards.
//   - 'roadmap'                        → Now/Next/Later lanes
//                                        (status-mapped).
// Density controls `maxObjectives` + card layout.
//
// Entry animation: single 0..15-frame fade-in. No spring physics.
// SVG progress ring is computed deterministically from
// `objective.progress` (0..100).

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
  dashboardTrendSchema,
  formatDashboardValue,
} from './_dashboard-utils.js';

const okrStatusSchema = z.enum(['on_track', 'at_risk', 'behind', 'completed', 'not_started']);
export type OkrStatus = z.infer<typeof okrStatusSchema>;

const okrTypeSchema = z.enum(['dashboard', 'objective_detail', 'team_comparison', 'roadmap']);
const okrDensitySchema = z.enum(['executive', 'standard', 'detailed']);

const keyResultSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    current: z.number(),
    target: z.number(),
    unit: z.string().optional(),
    status: okrStatusSchema,
    trend: dashboardTrendSchema.optional(),
  })
  .strict();

const objectiveSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    owner: z.string(),
    status: okrStatusSchema,
    progress: z.number().min(0).max(100),
    team: z.string().optional(),
    keyResults: z.array(keyResultSchema),
  })
  .strict();

export const okrDashboardPropsSchema = z
  .object({
    title: z.string().optional(),
    period: z.string().optional(),
    okrType: okrTypeSchema.optional(),
    density: okrDensitySchema.optional(),
    maxObjectives: z.number().int().positive().optional(),
    showKeyResults: z.boolean().optional(),
    objectives: z.array(objectiveSchema),
    background: z.string().optional(),
    textColor: z.string().optional(),
    surface: z.string().optional(),
  })
  .strict();

export type OkrKeyResult = z.infer<typeof keyResultSchema>;
export type Objective = z.infer<typeof objectiveSchema>;
export type OkrDashboardProps = z.infer<typeof okrDashboardPropsSchema>;

const STATUS_COLORS: Record<OkrStatus, string> = {
  on_track: DASHBOARD_GOOD_COLOR,
  at_risk: DASHBOARD_WARN_COLOR,
  behind: DASHBOARD_BAD_COLOR,
  completed: '#22c55e',
  not_started: DASHBOARD_SUBDUED_COLOR,
};
const STATUS_LABELS: Record<OkrStatus, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  behind: 'Behind',
  completed: 'Completed',
  not_started: 'Not Started',
};

const TREND_GLYPHS: Record<'up' | 'down' | 'flat', string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

/**
 * Tint for the small inline trend-arrow glyph (`↑` / `↓` / `→`) at the
 * end of each key-result row. Intentionally distinct from
 * `_dashboard-utils.dashboardTrendColor`: that helper is for KPI-value
 * text (flat → muted, `#a5acb4`); this one is for the understated
 * glyph arrow (flat → subdued, `#6b7280`), preserving the SlideMotion
 * reference's tonal contrast between "KPI read-out" and "secondary
 * marker."
 */
function trendGlyphColor(trend: 'up' | 'down' | 'flat'): string {
  if (trend === 'up') return DASHBOARD_GOOD_COLOR;
  if (trend === 'down') return DASHBOARD_BAD_COLOR;
  return DASHBOARD_SUBDUED_COLOR;
}

interface ObjectiveCardProps {
  objective: Objective;
  showKeyResults: boolean;
  compact: boolean;
  surface: string;
  textColor: string;
}

export function ObjectiveCard({
  objective,
  showKeyResults,
  compact,
  surface,
  textColor,
}: ObjectiveCardProps): ReactElement {
  const color = STATUS_COLORS[objective.status];
  const radius = compact ? 24 : 32;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, objective.progress));
  const dashOffset = circumference * (1 - clamped / 100);
  const cx = radius + 4;

  return (
    <div
      data-testid={`okr-dashboard-objective-${objective.id}`}
      style={{
        backgroundColor: surface,
        borderRadius: 10,
        padding: compact ? 14 : 18,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 8 : 12,
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <svg width={(radius + 4) * 2} height={(radius + 4) * 2} style={{ flexShrink: 0 }}>
          <title>{`${clamped}%`}</title>
          <circle cx={cx} cy={cx} r={radius} fill="none" stroke="#1e252d" strokeWidth={4} />
          <circle
            cx={cx}
            cy={cx}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cx})`}
          />
          <text
            x={cx}
            y={cx}
            textAnchor="middle"
            dy=".35em"
            fill={textColor}
            fontSize={compact ? 12 : 14}
            fontWeight={800}
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            {`${clamped}%`}
          </text>
        </svg>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: compact ? 12 : 14,
              fontWeight: 700,
              color: textColor,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {objective.title}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                color,
                backgroundColor: `${color}20`,
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              {STATUS_LABELS[objective.status]}
            </span>
            <span style={{ fontSize: 9, color: DASHBOARD_SUBDUED_COLOR }}>{objective.owner}</span>
          </div>
        </div>
      </div>

      {showKeyResults && objective.keyResults.length > 0 ? (
        <div
          data-testid={`okr-dashboard-key-results-${objective.id}`}
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {objective.keyResults.map((kr) => {
            const krColor = STATUS_COLORS[kr.status];
            const progress = kr.target !== 0 ? Math.min(100, (kr.current / kr.target) * 100) : 0;
            return (
              <div key={kr.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: DASHBOARD_MUTED_COLOR,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {kr.title}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 4,
                      backgroundColor: '#1e252d',
                      borderRadius: 2,
                      marginTop: 3,
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        backgroundColor: krColor,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: krColor,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatDashboardValue(kr.current, kr.unit)} /{' '}
                  {formatDashboardValue(kr.target, kr.unit)}
                </div>
                {kr.trend !== undefined ? (
                  <span style={{ fontSize: 9, color: trendGlyphColor(kr.trend) }}>
                    {TREND_GLYPHS[kr.trend]}
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
      data-testid={`okr-dashboard-kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
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

function defaultMaxObjectives(
  density: z.infer<typeof okrDensitySchema>,
  override: number | undefined,
): number {
  if (override !== undefined) return override;
  if (density === 'executive') return 4;
  if (density === 'detailed') return 8;
  return 6;
}

export function OkrDashboard({
  title,
  period,
  okrType = 'dashboard',
  density = 'standard',
  maxObjectives,
  showKeyResults = true,
  objectives,
  background = '#080f15',
  textColor = '#ebf1fa',
  surface = '#111820',
}: OkrDashboardProps): ReactElement {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const max = defaultMaxObjectives(density, maxObjectives);
  const visible = objectives.slice(0, max);
  const resolvedTitle = title ?? (okrType === 'roadmap' ? 'Strategy Roadmap' : 'OKR Dashboard');

  const totalObj = objectives.length;
  const onTrack = objectives.filter(
    (o) => o.status === 'on_track' || o.status === 'completed',
  ).length;
  const atRisk = objectives.filter((o) => o.status === 'at_risk').length;
  const behind = objectives.filter((o) => o.status === 'behind').length;
  const avgProgress =
    totalObj > 0 ? Math.round(objectives.reduce((s, o) => s + o.progress, 0) / totalObj) : 0;
  const totalKRs = objectives.reduce((s, o) => s + o.keyResults.length, 0);
  const completedKRs = objectives.reduce(
    (s, o) => s + o.keyResults.filter((kr) => kr.status === 'completed').length,
    0,
  );

  const teams: string[] = [];
  for (const o of objectives) {
    if (o.team !== undefined && !teams.includes(o.team)) teams.push(o.team);
  }

  const avgColor =
    avgProgress >= 70
      ? DASHBOARD_GOOD_COLOR
      : avgProgress >= 40
        ? DASHBOARD_WARN_COLOR
        : DASHBOARD_BAD_COLOR;

  return (
    <div
      data-testid="okr-dashboard"
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
        data-testid="okr-dashboard-title"
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
      {period !== undefined ? (
        <div
          data-testid="okr-dashboard-period"
          style={{
            position: 'absolute',
            left: 80,
            top: 60,
            fontSize: 12,
            fontWeight: 500,
            color: DASHBOARD_SUBDUED_COLOR,
          }}
        >
          {period}
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
        <KpiCard label="AVG PROGRESS" value={`${avgProgress}%`} color={avgColor} />
        <KpiCard label="ON TRACK" value={`${onTrack}/${totalObj}`} color={DASHBOARD_GOOD_COLOR} />
        <KpiCard
          label="AT RISK"
          value={String(atRisk)}
          color={atRisk > 0 ? DASHBOARD_WARN_COLOR : DASHBOARD_GOOD_COLOR}
        />
        <KpiCard
          label="BEHIND"
          value={String(behind)}
          color={behind > 0 ? DASHBOARD_BAD_COLOR : DASHBOARD_GOOD_COLOR}
        />
        <KpiCard label="KEY RESULTS" value={`${completedKRs}/${totalKRs}`} color="#81aeff" />
      </div>

      {okrType === 'dashboard' || okrType === 'objective_detail' ? (
        <div
          data-testid="okr-dashboard-grid"
          style={{
            position: 'absolute',
            left: 80,
            top: 168,
            width: 1760,
            display: 'grid',
            gridTemplateColumns: density === 'executive' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: 14,
            height: 860,
            alignContent: 'start',
            overflow: 'hidden',
          }}
        >
          {visible.map((obj) => (
            <ObjectiveCard
              key={obj.id}
              objective={obj}
              showKeyResults={showKeyResults}
              compact={density === 'executive'}
              surface={surface}
              textColor={textColor}
            />
          ))}
        </div>
      ) : null}

      {okrType === 'team_comparison' && teams.length > 0 ? (
        <div
          data-testid="okr-dashboard-teams"
          style={{
            position: 'absolute',
            left: 80,
            top: 168,
            width: 1760,
            height: 860,
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(teams.length, 4)}, 1fr)`,
            gap: 16,
          }}
        >
          {teams.slice(0, 4).map((team) => {
            const teamObjs = objectives.filter((o) => o.team === team);
            const teamAvg =
              teamObjs.length > 0
                ? Math.round(teamObjs.reduce((s, o) => s + o.progress, 0) / teamObjs.length)
                : 0;
            const teamColor =
              teamAvg >= 70
                ? DASHBOARD_GOOD_COLOR
                : teamAvg >= 40
                  ? DASHBOARD_WARN_COLOR
                  : DASHBOARD_BAD_COLOR;
            return (
              <div
                key={team}
                data-testid={`okr-dashboard-team-${team}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: '#151c23',
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{team}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: teamColor }}>
                    {teamAvg}%
                  </span>
                </div>
                {teamObjs.slice(0, 4).map((obj) => (
                  <ObjectiveCard
                    key={obj.id}
                    objective={obj}
                    showKeyResults={false}
                    compact
                    surface={surface}
                    textColor={textColor}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ) : null}

      {okrType === 'roadmap' ? (
        <div
          data-testid="okr-dashboard-roadmap"
          style={{
            position: 'absolute',
            left: 80,
            top: 168,
            width: 1760,
            height: 860,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {(['now', 'next', 'later'] as const).map((lane) => {
            const header =
              lane === 'now'
                ? DASHBOARD_GOOD_COLOR
                : lane === 'next'
                  ? '#81aeff'
                  : DASHBOARD_SUBDUED_COLOR;
            // Roadmap status → lane mapping preserved from SlideMotion
            // reference. `completed` objectives are deliberately dropped
            // from the roadmap (a roadmap surfaces upcoming / in-flight
            // work, not finished work) — matches reference behaviour.
            const items = objectives
              .filter((o) => {
                if (lane === 'now') return o.status === 'on_track' || o.status === 'at_risk';
                if (lane === 'next') return o.status === 'not_started' && o.progress === 0;
                return o.status === 'behind';
              })
              .slice(0, 5);
            return (
              <div
                key={lane}
                data-testid={`okr-dashboard-lane-${lane}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: header,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    marginBottom: 4,
                  }}
                >
                  {lane}
                </div>
                {items.map((obj) => (
                  <ObjectiveCard
                    key={obj.id}
                    objective={obj}
                    showKeyResults={false}
                    compact
                    surface={surface}
                    textColor={textColor}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ) : null}

      {period !== undefined ? (
        <div
          data-testid="okr-dashboard-footer"
          style={{
            position: 'absolute',
            left: 80,
            bottom: 16,
            fontSize: 9,
            color: DASHBOARD_SUBDUED_COLOR,
          }}
        >
          {period} OKR Review | {totalObj} objectives, {totalKRs} key results
        </div>
      ) : null}
    </div>
  );
}

export const okrDashboardClip: ClipDefinition<unknown> = defineFrameClip<OkrDashboardProps>({
  kind: 'okr-dashboard',
  component: OkrDashboard,
  propsSchema: okrDashboardPropsSchema,
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
