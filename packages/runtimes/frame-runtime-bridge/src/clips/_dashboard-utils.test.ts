// packages/runtimes/frame-runtime-bridge/src/clips/_dashboard-utils.test.ts
// Smoke tests for the shared dashboard helpers. Underscore-prefixed
// module mirrors the source file convention — the helpers are
// package-private but still worth pinning.

import { describe, expect, it } from 'vitest';

import { currencyPrefix, dashboardTrendColor, formatDashboardValue } from './_dashboard-utils.js';

describe('formatDashboardValue', () => {
  it('returns the bare value when no unit is supplied', () => {
    expect(formatDashboardValue(42)).toBe('42');
    expect(formatDashboardValue('x')).toBe('x');
  });

  it('appends the unit when present', () => {
    expect(formatDashboardValue(42, '%')).toBe('42%');
    expect(formatDashboardValue(3, ' days')).toBe('3 days');
  });

  it('treats an empty unit string as no unit', () => {
    expect(formatDashboardValue(42, '')).toBe('42');
  });
});

describe('dashboardTrendColor', () => {
  it("maps 'up' / 'down' / 'flat' / undefined deterministically", () => {
    expect(dashboardTrendColor('up')).toMatch(/^#/);
    expect(dashboardTrendColor('down')).toMatch(/^#/);
    expect(dashboardTrendColor('flat')).toMatch(/^#/);
    expect(dashboardTrendColor(undefined)).toMatch(/^#/);
    // Each variant produces a distinct colour except 'flat' which
    // shares the muted colour with undefined.
    expect(dashboardTrendColor('up')).not.toBe(dashboardTrendColor('down'));
    expect(dashboardTrendColor('flat')).toBe(dashboardTrendColor(undefined));
  });
});

describe('currencyPrefix', () => {
  it('maps the common ISO currencies to a short display prefix', () => {
    expect(currencyPrefix('USD')).toBe('$');
    expect(currencyPrefix('EUR')).toBe('\u20AC');
    expect(currencyPrefix('GBP')).toBe('\u00A3');
    expect(currencyPrefix('JPY')).toBe('\u00A5');
    expect(currencyPrefix('CNY')).toBe('\u00A5');
    expect(currencyPrefix('INR')).toBe('\u20B9');
    expect(currencyPrefix('KRW')).toBe('\u20A9');
  });

  it("disambiguates dollar-family currencies with a country-letter prefix (CAD → 'C$', AUD → 'A$', etc.)", () => {
    expect(currencyPrefix('CAD')).toBe('C$');
    expect(currencyPrefix('AUD')).toBe('A$');
    expect(currencyPrefix('HKD')).toBe('HK$');
    expect(currencyPrefix('SGD')).toBe('S$');
    expect(currencyPrefix('NZD')).toBe('NZ$');
  });

  it("falls back to the raw currency code with a trailing space for unknown codes (e.g. 'BRL 100K')", () => {
    expect(currencyPrefix('BRL')).toBe('BRL ');
    expect(currencyPrefix('ZAR')).toBe('ZAR ');
    expect(currencyPrefix('MXN')).toBe('MXN ');
  });

  it('returns an empty string when currency is undefined or empty', () => {
    expect(currencyPrefix(undefined)).toBe('');
    expect(currencyPrefix('')).toBe('');
  });
});
