// packages/runtimes/frame-runtime-bridge/src/clips/_dashboard-utils.ts
// T-131f.2 — shared dashboard helpers. Extracted from hr-dashboard +
// marketing-dashboard so the T-131f.2b/.2c follow-ups (product / okr /
// sales) import one canonical implementation of each helper. The
// underscore prefix marks this file as private to the clips directory —
// not re-exported from the package barrel.

import { z } from 'zod';

/** `'up' | 'down' | 'flat'` — reused by every dashboard's metric/KPI rows. */
export const dashboardTrendSchema = z.enum(['up', 'down', 'flat']);
export type DashboardTrend = z.infer<typeof dashboardTrendSchema>;

export const DASHBOARD_GOOD_COLOR = '#34d399';
export const DASHBOARD_WARN_COLOR = '#fbbf24';
export const DASHBOARD_BAD_COLOR = '#fb7185';
export const DASHBOARD_MUTED_COLOR = '#a5acb4';
export const DASHBOARD_SUBDUED_COLOR = '#6b7280';

/**
 * Render `value[unit]` as a display string. Numeric values are stringified
 * via `String()` (locale-independent) — do NOT use `toLocaleString` here;
 * dashboards render inside a deterministic parity-scoring loop and locale
 * formatting drifts between CI runners.
 */
export function formatDashboardValue(value: number | string, unit?: string): string {
  const stringified = typeof value === 'number' ? String(value) : value;
  return unit !== undefined && unit.length > 0 ? `${stringified}${unit}` : stringified;
}

/** Map a trend indicator to a foreground colour. `undefined` → muted. */
export function dashboardTrendColor(trend: DashboardTrend | undefined): string {
  if (trend === 'up') return DASHBOARD_GOOD_COLOR;
  if (trend === 'down') return DASHBOARD_BAD_COLOR;
  return DASHBOARD_MUTED_COLOR;
}

/**
 * ISO 4217 currency code → short display prefix. Covers the currencies
 * most decks actually use; any other code falls through to the
 * `<CODE> ` prefix so the number stays unambiguous (reference behaviour
 * silently renders the value with NO prefix, which looked buggy).
 *
 * CNY shares the ¥ glyph with JPY by convention; CAD / AUD / HKD /
 * SGD / NZD are prefixed with their single-letter country to avoid
 * colliding with the unadorned $ of USD.
 */
const CURRENCY_PREFIX_MAP: Readonly<Record<string, string>> = {
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
  JPY: '\u00A5',
  CNY: '\u00A5',
  INR: '\u20B9',
  KRW: '\u20A9',
  CHF: 'CHF ',
  CAD: 'C$',
  AUD: 'A$',
  HKD: 'HK$',
  SGD: 'S$',
  NZD: 'NZ$',
};

/**
 * Resolve the display prefix for a currency code. Unknown codes return
 * `<CODE> ` (the code itself followed by a space) so the author sees
 * *something* rather than a bare number.
 */
export function currencyPrefix(currency: string | undefined): string {
  if (currency === undefined || currency.length === 0) return '';
  const mapped = CURRENCY_PREFIX_MAP[currency];
  if (mapped !== undefined) return mapped;
  return `${currency} `;
}
