// packages/runtimes/frame-runtime-bridge/src/clips/financial-statement.tsx
// T-131f.3 port of reference/slidemotion/.../components/finance/{FinancialStatementSlide,StatementTable,StatementKpiStrip,StatementCommentsRail}.tsx.
//
// Option B (flat-prop interface): no `StatementTableContent` domain
// schema from `@slidemotion/schema`. The reference assembles a P&L /
// balance-sheet / cash-flow financial statement from four parts:
//   - KPI strip  — semantic-role-keyed top KPIs (revenue / ebitda /
//                   cash / etc., varies per statementType).
//   - Table       — hierarchical line/section/subtotal/total rows
//                   with period columns + optional variance cols.
//   - Comments    — priority-ordered side rail with row-linked
//                   commentary cards.
//   - Frame       — title, unit-label header, footer.
//
// All four are inlined as module-private helpers (single consumer).
//
// Determinism note: `toLocaleString('en-US', opts)` is used for
// thousands separators + decimal formatting. The locale argument is
// hardcoded — this is deterministic across CI runners (Intl data
// ships with Node). Unlike `toLocaleString()` without args (which
// reads the runtime locale and drifts), the `'en-US'` form is safe
// and preserves the reference's en-US thousands-separator output.

import { interpolate, useCurrentFrame } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';
import {
  DASHBOARD_BAD_COLOR,
  DASHBOARD_GOOD_COLOR,
  DASHBOARD_MUTED_COLOR,
  DASHBOARD_SUBDUED_COLOR,
  currencyPrefix,
} from './_dashboard-utils.js';

// ---------------------------------------------------------------------------
// Zod schemas + inferred types
// ---------------------------------------------------------------------------

const statementTypeSchema = z.enum(['pnl', 'balance_sheet', 'cash_flow']);
const densitySchema = z.enum(['board', 'standard', 'appendix']);
const emphasisSchema = z.enum(['primary', 'secondary']);
const negativeStyleSchema = z.enum(['parentheses', 'red', 'minus']);
const unitSchema = z.enum(['full', 'thousands', 'millions']);
const commentaryModeSchema = z.enum(['rail', 'inline', 'none']);
const rowKindSchema = z.enum(['line', 'section', 'subtotal', 'total', 'note', 'spacer']);
const commentTypeSchema = z.enum(['driver', 'variance', 'risk', 'note', 'action']);
const commentPrioritySchema = z.enum(['high', 'medium', 'low']);

const semanticRoleSchema = z.enum([
  'revenue',
  'cogs',
  'gross_profit',
  'operating_expenses',
  'operating_income',
  'ebitda',
  'net_income',
  'cash',
  'debt',
  'equity',
  'assets',
  'liabilities',
  'operating_cf',
  'investing_cf',
  'financing_cf',
]);

export type StatementType = z.infer<typeof statementTypeSchema>;
export type StatementDensity = z.infer<typeof densitySchema>;
export type StatementPeriodEmphasis = z.infer<typeof emphasisSchema>;
export type StatementRowKind = z.infer<typeof rowKindSchema>;
export type StatementSemanticRole = z.infer<typeof semanticRoleSchema>;

const statementPeriodSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    emphasis: emphasisSchema.optional(),
  })
  .strict();

const statementRowVarianceSchema = z
  .object({
    absolute: z.array(z.number()).optional(),
    percent: z.array(z.number()).optional(),
  })
  .strict();

const statementRowFormattingSchema = z
  .object({
    negativeStyle: negativeStyleSchema.optional(),
    hiddenInBoardMode: z.boolean().optional(),
  })
  .strict();

const statementRowMetaSchema = z
  .object({
    semanticRole: semanticRoleSchema.optional(),
  })
  .strict();

const statementRowSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    shortLabel: z.string().optional(),
    kind: rowKindSchema,
    level: z.number().int().nonnegative(),
    values: z.array(z.number().nullable()),
    variance: statementRowVarianceSchema.optional(),
    formatting: statementRowFormattingSchema.optional(),
    meta: statementRowMetaSchema.optional(),
  })
  .strict();

const statementSettingsSchema = z
  .object({
    density: densitySchema.optional(),
    zebraRows: z.boolean().optional(),
    showVarianceAbsolute: z.boolean().optional(),
    showVariancePercent: z.boolean().optional(),
    commentaryMode: commentaryModeSchema.optional(),
  })
  .strict();

const statementCommentSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    body: z.string(),
    type: commentTypeSchema.optional(),
    priority: commentPrioritySchema.optional(),
  })
  .strict();

export const financialStatementPropsSchema = z
  .object({
    title: z.string().optional(),
    statementType: statementTypeSchema,
    currency: z.string().optional(),
    unit: unitSchema.optional(),
    decimals: z.number().int().min(0).max(4).optional(),
    periods: z.array(statementPeriodSchema),
    rows: z.array(statementRowSchema),
    comments: z.array(statementCommentSchema).optional(),
    settings: statementSettingsSchema.optional(),
    showKpiStrip: z.boolean().optional(),
    background: z.string().optional(),
    textColor: z.string().optional(),
    surface: z.string().optional(),
  })
  .strict();

export type StatementRow = z.infer<typeof statementRowSchema>;
export type StatementPeriod = z.infer<typeof statementPeriodSchema>;
export type StatementComment = z.infer<typeof statementCommentSchema>;
export type StatementSettings = z.infer<typeof statementSettingsSchema>;
export type FinancialStatementProps = z.infer<typeof financialStatementPropsSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATEMENT_TITLES: Record<StatementType, string> = {
  pnl: 'Consolidated Profit & Loss',
  balance_sheet: 'Consolidated Balance Sheet',
  cash_flow: 'Consolidated Cash Flow',
};

const DEFAULT_KPI_ROLES: Record<StatementType, readonly StatementSemanticRole[]> = {
  pnl: ['revenue', 'gross_profit', 'ebitda', 'net_income'],
  balance_sheet: ['cash', 'debt', 'equity'],
  cash_flow: ['operating_cf', 'investing_cf', 'financing_cf'],
};

const ROW_HEIGHTS: Record<StatementDensity, number> = {
  board: 32,
  standard: 28,
  appendix: 24,
};

const MAX_COMMENTS: Record<StatementDensity, number> = {
  board: 5,
  standard: 8,
  appendix: 3,
};

// ---------------------------------------------------------------------------
// Colour + format helpers
// ---------------------------------------------------------------------------

interface FinanceColors {
  bg: string;
  rowAlt: string;
  sectionBg: string;
  subtotalBg: string;
  totalBg: string;
  positive: string;
  negative: string;
  text: string;
  textMuted: string;
  textDim: string;
  primary: string;
  accent: string;
  border: string;
}

function buildColors(overrides: { text: string; surface: string }): FinanceColors {
  return {
    bg: '#0a0e13',
    rowAlt: '#0d1219',
    sectionBg: overrides.surface,
    subtotalBg: '#111820',
    totalBg: 'rgba(0,114,229,0.08)',
    positive: DASHBOARD_GOOD_COLOR,
    negative: DASHBOARD_BAD_COLOR,
    text: overrides.text,
    textMuted: DASHBOARD_MUTED_COLOR,
    textDim: DASHBOARD_SUBDUED_COLOR,
    primary: '#81aeff',
    accent: '#5af8fb',
    border: 'rgba(129,174,255,0.15)',
  };
}

function fmtNumber(value: number, decimals: number): string {
  // `toLocaleString('en-US', …)` is deterministic (locale argument
  // is hardcoded). See file header for the determinism rationale.
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtSignedWithStyle(
  value: number,
  decimals: number,
  negStyle: z.infer<typeof negativeStyleSchema>,
  colors: FinanceColors,
): ReactElement | string {
  const abs = Math.abs(value);
  const formatted = fmtNumber(abs, decimals);
  if (value < 0) {
    const display = negStyle === 'parentheses' ? `(${formatted})` : `-${formatted}`;
    return (
      <span style={{ color: negStyle === 'red' ? colors.negative : undefined }}>{display}</span>
    );
  }
  return formatted;
}

function fmtVariance(
  value: number,
  decimals: number,
  negStyle: z.infer<typeof negativeStyleSchema>,
  colors: FinanceColors,
): ReactElement {
  const abs = Math.abs(value);
  const formatted = fmtNumber(abs, decimals);
  const isNeg = value < 0;
  const display = isNeg
    ? negStyle === 'parentheses'
      ? `(${formatted})`
      : `-${formatted}`
    : formatted;
  return <span style={{ color: isNeg ? colors.negative : colors.positive }}>{display}</span>;
}

function fmtVariancePercent(
  value: number,
  negStyle: z.infer<typeof negativeStyleSchema>,
  colors: FinanceColors,
): ReactElement {
  const isNeg = value < 0;
  const abs = Math.abs(value);
  const formatted = `${abs.toFixed(1)}%`;
  const display = isNeg
    ? negStyle === 'parentheses'
      ? `(${formatted})`
      : `-${formatted}`
    : formatted;
  return <span style={{ color: isNeg ? colors.negative : colors.positive }}>{display}</span>;
}

function humaniseRole(role: StatementSemanticRole): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// KPI strip
// ---------------------------------------------------------------------------

interface KpiItem {
  readonly label: string;
  readonly value: string;
  readonly change?: string;
  readonly changePositive?: boolean;
}

function buildKpiItems(props: FinancialStatementProps): KpiItem[] {
  const { rows, periods, statementType, currency, unit, decimals = 1 } = props;
  const roles = DEFAULT_KPI_ROLES[statementType];
  const primaryIdx = periods.findIndex((p) => p.emphasis === 'primary');
  const valIdx = primaryIdx >= 0 ? primaryIdx : Math.max(0, periods.length - 1);

  const prefix = currencyPrefix(currency);
  const suffix = unit === 'millions' ? 'M' : unit === 'thousands' ? 'K' : '';

  const items: KpiItem[] = [];
  for (const role of roles) {
    const row = rows.find((r) => r.meta?.semanticRole === role);
    if (row === undefined) continue;
    const raw = row.values[valIdx];
    const formatted =
      raw !== undefined && raw !== null
        ? `${prefix}${fmtNumber(Math.abs(raw), decimals)}${suffix}`
        : '—';

    let change: string | undefined;
    let changePositive: boolean | undefined;
    const pct = row.variance?.percent?.[0];
    const abs = row.variance?.absolute?.[0];
    if (pct !== undefined && pct !== null) {
      changePositive = pct >= 0;
      change = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    } else if (abs !== undefined && abs !== null) {
      changePositive = abs >= 0;
      change = `${abs >= 0 ? '+' : ''}${fmtNumber(abs, decimals)}`;
    }

    items.push({
      label: row.shortLabel ?? humaniseRole(role),
      value: formatted,
      ...(change !== undefined ? { change } : {}),
      ...(changePositive !== undefined ? { changePositive } : {}),
    });
  }
  return items;
}

function KpiStrip({
  items,
  colors,
}: { items: readonly KpiItem[]; colors: FinanceColors }): ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div
      data-testid="financial-statement-kpi-strip"
      style={{ display: 'flex', gap: 16, width: '100%', height: '100%', alignItems: 'center' }}
    >
      {items.map((kpi) => (
        <div
          key={kpi.label}
          data-testid={`financial-statement-kpi-${kpi.label.toLowerCase().replace(/\s+/g, '-')}`}
          style={{
            flex: 1,
            backgroundColor: 'rgba(21,28,35,0.4)',
            borderRadius: 8,
            padding: '12px 16px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: colors.textDim,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >
            {kpi.label}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: colors.primary,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontVariantNumeric: 'tabular-nums',
              marginTop: 4,
            }}
          >
            {kpi.value}
          </div>
          {kpi.change !== undefined ? (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: kpi.changePositive === true ? colors.positive : colors.negative,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                marginTop: 4,
              }}
            >
              {kpi.change}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function headerCell(colors: FinanceColors): CSSProperties {
  return {
    textAlign: 'right',
    fontSize: 11,
    fontWeight: 600,
    color: colors.textDim,
    padding: '0 12px',
    backgroundColor: colors.bg,
    borderBottom: `1px solid ${colors.border}`,
  };
}

function labelStyleFor(row: StatementRow, colors: FinanceColors): CSSProperties {
  const base: CSSProperties = { padding: '0 12px', fontSize: 13 };
  switch (row.kind) {
    case 'section':
      return { ...base, fontWeight: 700, color: colors.text, letterSpacing: 1.5 };
    case 'subtotal':
      return { ...base, fontWeight: 600, color: colors.text };
    case 'total':
      return { ...base, fontWeight: 800, color: colors.text, fontSize: 14 };
    case 'note':
      return { ...base, fontWeight: 400, color: colors.textDim, fontSize: 12, fontStyle: 'italic' };
    default:
      return { ...base, fontWeight: 400, color: colors.textMuted };
  }
}

function valueStyleFor(row: StatementRow, colors: FinanceColors): CSSProperties {
  const base: CSSProperties = {
    textAlign: 'right',
    padding: '0 12px',
    fontVariantNumeric: 'tabular-nums',
    fontSize: 13,
  };
  if (row.kind === 'subtotal') return { ...base, fontWeight: 600, color: colors.text };
  if (row.kind === 'total') return { ...base, fontWeight: 800, color: colors.text, fontSize: 14 };
  return { ...base, fontWeight: 400, color: colors.text };
}

function rowBackground(
  row: StatementRow,
  idx: number,
  settings: StatementSettings,
  colors: FinanceColors,
): string {
  if (row.kind === 'section') return colors.sectionBg;
  if (row.kind === 'total') return colors.totalBg;
  if (row.kind === 'subtotal') return colors.subtotalBg;
  if (settings.zebraRows === true && idx % 2 === 1) return colors.rowAlt;
  return 'transparent';
}

function StatementTable({
  rows,
  periods,
  settings,
  decimals,
  colors,
}: {
  rows: readonly StatementRow[];
  periods: readonly StatementPeriod[];
  settings: StatementSettings;
  decimals: number;
  colors: FinanceColors;
}): ReactElement {
  const density = settings.density ?? 'standard';
  const rowHeight = ROW_HEIGHTS[density];
  const showVarAbs = settings.showVarianceAbsolute !== false;
  const showVarPct = settings.showVariancePercent !== false;
  const negStyle = rows[0]?.formatting?.negativeStyle ?? 'parentheses';
  const hasVariance = rows.some(
    (r) =>
      (r.variance?.absolute !== undefined && r.variance.absolute.length > 0) ||
      (r.variance?.percent !== undefined && r.variance.percent.length > 0),
  );
  const visible = rows.filter(
    (row) => !(density === 'board' && row.formatting?.hiddenInBoardMode === true),
  );
  const valueColspan =
    periods.length + (hasVariance ? (showVarAbs ? 1 : 0) + (showVarPct ? 1 : 0) : 0);

  return (
    <div
      data-testid="financial-statement-table"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: colors.bg,
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <caption style={{ position: 'absolute', left: -10000, top: 'auto' }}>
          Financial statement table
        </caption>
        <thead>
          <tr style={{ height: rowHeight }}>
            <th
              style={{ ...headerCell(colors), textAlign: 'left', width: '35%', paddingLeft: 16 }}
            />
            {periods.map((period) => (
              <th
                key={period.id}
                style={{
                  ...headerCell(colors),
                  color: period.emphasis === 'primary' ? colors.primary : colors.textDim,
                  fontWeight: period.emphasis === 'primary' ? 700 : 600,
                }}
              >
                {period.label}
              </th>
            ))}
            {hasVariance && showVarAbs ? <th style={headerCell(colors)}>Var</th> : null}
            {hasVariance && showVarPct ? <th style={headerCell(colors)}>Var %</th> : null}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, idx) => {
            if (row.kind === 'spacer') {
              return (
                <tr
                  key={row.id}
                  data-testid={`financial-statement-row-${row.id}`}
                  style={{ height: rowHeight * 0.5 }}
                >
                  <td colSpan={1 + valueColspan} />
                </tr>
              );
            }
            const rowBg = rowBackground(row, idx, settings, colors);
            const label = labelStyleFor(row, colors);
            const value = valueStyleFor(row, colors);
            const indent = row.level * 16;
            const rowTopBorder =
              row.kind === 'subtotal'
                ? `1px solid ${colors.border}`
                : row.kind === 'total'
                  ? `2px solid ${colors.border}`
                  : 'none';
            const cells: ReactNode =
              row.kind === 'section' ? (
                <td colSpan={valueColspan} />
              ) : (
                <>
                  {periods.map((period, pIdx) => {
                    const emphasised =
                      period.emphasis === 'primary' &&
                      (row.kind === 'subtotal' || row.kind === 'total');
                    const cellColor = emphasised ? colors.primary : value.color;
                    const cellValue = row.values[pIdx];
                    return (
                      <td key={period.id} style={{ ...value, color: cellColor }}>
                        {cellValue === undefined || cellValue === null
                          ? ''
                          : fmtSignedWithStyle(cellValue, decimals, negStyle, colors)}
                      </td>
                    );
                  })}
                  {hasVariance && showVarAbs ? (
                    <td style={{ ...value, fontSize: 12 }}>
                      {row.variance?.absolute?.[0] !== undefined
                        ? fmtVariance(
                            row.variance.absolute[0] as number,
                            decimals,
                            negStyle,
                            colors,
                          )
                        : ''}
                    </td>
                  ) : null}
                  {hasVariance && showVarPct ? (
                    <td style={{ ...value, fontSize: 12 }}>
                      {row.variance?.percent?.[0] !== undefined
                        ? fmtVariancePercent(row.variance.percent[0] as number, negStyle, colors)
                        : ''}
                    </td>
                  ) : null}
                </>
              );
            return (
              <tr
                key={row.id}
                data-testid={`financial-statement-row-${row.id}`}
                style={{ height: rowHeight, backgroundColor: rowBg, borderTop: rowTopBorder }}
              >
                <td
                  style={{
                    ...label,
                    paddingLeft: 16 + indent,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 0,
                  }}
                >
                  {row.kind === 'section' ? row.label.toUpperCase() : row.label}
                </td>
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comments rail
// ---------------------------------------------------------------------------

const COMMENT_PRIORITY_ORDER: Record<z.infer<typeof commentPrioritySchema>, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const COMMENT_TYPE_USES_ALT_ACCENT: Record<z.infer<typeof commentTypeSchema>, boolean> = {
  driver: false,
  variance: true,
  risk: true,
  note: false,
  action: false,
};

function CommentsRail({
  comments,
  density,
  colors,
  layout = 'rail',
}: {
  comments: readonly StatementComment[];
  density: StatementDensity;
  colors: FinanceColors;
  /**
   * `rail` lays out the cards vertically as a right-side panel;
   * `inline` lays them out horizontally as a strip below the table.
   * The top-level clip picks the layout from `settings.commentaryMode`
   * and sizes the surrounding container accordingly.
   */
  layout?: 'rail' | 'inline';
}): ReactElement {
  const sorted = [...comments].sort((a, b) => {
    const pa = COMMENT_PRIORITY_ORDER[a.priority ?? 'medium'];
    const pb = COMMENT_PRIORITY_ORDER[b.priority ?? 'medium'];
    return pa - pb;
  });
  const visible = sorted.slice(0, MAX_COMMENTS[density]);

  return (
    <div
      data-testid={
        layout === 'inline'
          ? 'financial-statement-comments-inline'
          : 'financial-statement-comments-rail'
      }
      style={{
        display: 'flex',
        flexDirection: layout === 'inline' ? 'row' : 'column',
        gap: 12,
        width: '100%',
        height: '100%',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}
    >
      {visible.map((comment) => {
        const useAlt = COMMENT_TYPE_USES_ALT_ACCENT[comment.type ?? 'note'];
        const accent = useAlt ? colors.primary : colors.accent;
        return (
          <div
            key={comment.id}
            data-testid={`financial-statement-comment-${comment.id}`}
            style={{
              backgroundColor: colors.subtotalBg,
              borderRadius: 8,
              padding: 12,
              paddingLeft: 14,
              borderLeft: `3px solid ${accent}`,
              // Inline layout lets cards share the horizontal strip
              // evenly; rail layout lets cards stack full-width.
              ...(layout === 'inline' ? { flex: '1 1 0', minWidth: 0 } : {}),
            }}
          >
            {comment.title !== undefined ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.text, marginBottom: 4 }}>
                {comment.title}
              </div>
            ) : null}
            <div
              style={{ fontSize: 11, fontWeight: 400, color: colors.textMuted, lineHeight: 1.6 }}
            >
              {comment.body}
            </div>
            {comment.type !== undefined ? (
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: colors.textDim,
                  marginTop: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {comment.type}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-level clip
// ---------------------------------------------------------------------------

export function FinancialStatement({
  title,
  statementType,
  currency = 'USD',
  unit,
  decimals = 1,
  periods,
  rows,
  comments,
  settings = {},
  showKpiStrip = true,
  background = '#080f15',
  textColor = '#ebf1fa',
  surface = '#151c23',
}: FinancialStatementProps): ReactElement {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const colors = buildColors({ text: textColor, surface });
  const commentaryMode = settings.commentaryMode ?? 'rail';
  const hasComments = comments !== undefined && comments.length > 0 && commentaryMode !== 'none';
  const resolvedTitle = title ?? STATEMENT_TITLES[statementType];
  const unitLabel = [currency, unit !== undefined && unit !== 'full' ? unit : null]
    .filter((s): s is string => s !== null && s !== undefined && s.length > 0)
    .join(' ');

  const density = settings.density ?? 'standard';
  const kpiItems = showKpiStrip
    ? buildKpiItems({
        title,
        statementType,
        currency,
        unit,
        decimals,
        periods,
        rows,
        comments,
        settings,
        showKpiStrip,
        background,
        textColor,
        surface,
      })
    : [];

  // Layout zones (matches reference pixel offsets). Two commentary
  // layouts are supported:
  //   - 'rail'   — side panel: table shrinks to 1320, rail 400 right.
  //   - 'inline' — horizontal strip below the table: table keeps full
  //                width, 120px strip below for a row of cards.
  const kpiY = 80;
  const kpiH = showKpiStrip && kpiItems.length > 0 ? 68 : 0;
  const tableY = kpiH > 0 ? 160 : 80;
  const railActive = hasComments && commentaryMode === 'rail';
  const inlineActive = hasComments && commentaryMode === 'inline';
  const inlineH = inlineActive ? 120 : 0;
  const tableH = 1080 - tableY - 50 - inlineH - (inlineActive ? 16 : 0);
  const tableW = railActive ? 1320 : 1760;
  const railX = railActive ? 1440 : 0;
  const railW = railActive ? 400 : 0;
  const inlineY = tableY + tableH + 16;

  return (
    <div
      data-testid="financial-statement"
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
        data-testid="financial-statement-title"
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
      {unitLabel.length > 0 ? (
        <div
          data-testid="financial-statement-unit-label"
          style={{
            position: 'absolute',
            left: 80,
            top: 60,
            fontSize: 12,
            fontWeight: 500,
            color: colors.textDim,
          }}
        >
          {unitLabel}
          {decimals !== undefined ? `, ${decimals} decimals` : ''}
        </div>
      ) : null}

      {showKpiStrip && kpiItems.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: kpiY,
            width: 1760,
            height: kpiH,
          }}
        >
          <KpiStrip items={kpiItems} colors={colors} />
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          left: 80,
          top: tableY,
          width: tableW,
          height: tableH,
        }}
      >
        <StatementTable
          rows={rows}
          periods={periods}
          settings={settings}
          decimals={decimals}
          colors={colors}
        />
      </div>

      {railActive && comments !== undefined ? (
        <div
          style={{
            position: 'absolute',
            left: railX,
            top: tableY,
            width: railW,
            height: tableH,
          }}
        >
          <CommentsRail comments={comments} density={density} colors={colors} layout="rail" />
        </div>
      ) : null}
      {inlineActive && comments !== undefined ? (
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: inlineY,
            width: 1760,
            height: inlineH,
          }}
        >
          <CommentsRail comments={comments} density={density} colors={colors} layout="inline" />
        </div>
      ) : null}

      <div
        data-testid="financial-statement-footer"
        style={{
          position: 'absolute',
          left: 80,
          right: 80,
          bottom: 16,
          fontSize: 9,
          fontWeight: 400,
          color: colors.textDim,
        }}
      >
        Source: {title ?? STATEMENT_TITLES[statementType]} |{' '}
        {unitLabel.length > 0 ? unitLabel : 'USD'} | Unaudited summary
      </div>
    </div>
  );
}

export const financialStatementClip: ClipDefinition<unknown> =
  defineFrameClip<FinancialStatementProps>({
    kind: 'financial-statement',
    component: FinancialStatement,
    propsSchema: financialStatementPropsSchema,
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
