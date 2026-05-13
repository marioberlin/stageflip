// packages/marketplace-conversion/src/metrics/tracker.test.ts
// T-544 — `ConversionMetricsTracker` tests.

import { describe, expect, it } from 'vitest';
import type { ConversionEvent } from '../events/conversion-event.js';
import { ConversionMetricsTracker } from './tracker.js';

function eventOf(kind: ConversionEvent['kind']): ConversionEvent {
  return {
    kind,
    tenantId: 'tenant-1',
    sku: 'sku.news.pro',
    at: '2026-05-14T09:00:00.000Z',
    metadata: {},
  };
}

describe('ConversionMetricsTracker', () => {
  it('empty tracker → zero counts and conversionRate 0', () => {
    const tracker = new ConversionMetricsTracker();
    expect(tracker.summary()).toEqual({
      trialToPaid: 0,
      trialExpiredNoConversion: 0,
      lapsedRecovered: 0,
      lapsedChurned: 0,
      conversionRate: 0,
    });
  });

  it('trial-to-paid + converted increments only trialToPaid', () => {
    const tracker = new ConversionMetricsTracker();
    tracker.recordEvent(eventOf('trial-to-paid'), 'converted');
    const s = tracker.summary();
    expect(s.trialToPaid).toBe(1);
    expect(s.trialExpiredNoConversion).toBe(0);
    expect(s.lapsedRecovered).toBe(0);
    expect(s.lapsedChurned).toBe(0);
    expect(s.conversionRate).toBe(1);
  });

  it('trial-expired + expired increments only trialExpiredNoConversion', () => {
    const tracker = new ConversionMetricsTracker();
    tracker.recordEvent(eventOf('trial-expired'), 'expired');
    const s = tracker.summary();
    expect(s.trialExpiredNoConversion).toBe(1);
    expect(s.trialToPaid).toBe(0);
    expect(s.conversionRate).toBe(0);
  });

  it('trial-expired + converted increments trialToPaid (mid-trial late upgrade)', () => {
    const tracker = new ConversionMetricsTracker();
    tracker.recordEvent(eventOf('trial-expired'), 'converted');
    expect(tracker.summary().trialToPaid).toBe(1);
    expect(tracker.summary().trialExpiredNoConversion).toBe(0);
  });

  it('lapsed-recovered + recovered increments lapsedRecovered', () => {
    const tracker = new ConversionMetricsTracker();
    tracker.recordEvent(eventOf('lapsed-recovered'), 'recovered');
    expect(tracker.summary().lapsedRecovered).toBe(1);
    expect(tracker.summary().lapsedChurned).toBe(0);
  });

  it('lapsed-recovered + churned increments lapsedChurned', () => {
    const tracker = new ConversionMetricsTracker();
    tracker.recordEvent(eventOf('lapsed-recovered'), 'churned');
    expect(tracker.summary().lapsedChurned).toBe(1);
    expect(tracker.summary().lapsedRecovered).toBe(0);
  });

  it('conversionRate computes trialToPaid / (trialToPaid + expired)', () => {
    const tracker = new ConversionMetricsTracker();
    tracker.recordEvent(eventOf('trial-to-paid'), 'converted');
    tracker.recordEvent(eventOf('trial-to-paid'), 'converted');
    tracker.recordEvent(eventOf('trial-to-paid'), 'converted');
    tracker.recordEvent(eventOf('trial-expired'), 'expired');
    const s = tracker.summary();
    expect(s.trialToPaid).toBe(3);
    expect(s.trialExpiredNoConversion).toBe(1);
    expect(s.conversionRate).toBeCloseTo(0.75, 5);
  });

  it('ignores non-matching outcome / event combinations', () => {
    const tracker = new ConversionMetricsTracker();
    // trial-to-paid + expired is a meaningless combo — ignored.
    tracker.recordEvent(eventOf('trial-to-paid'), 'expired');
    tracker.recordEvent(eventOf('trial-to-paid'), 'recovered');
    tracker.recordEvent(eventOf('trial-to-paid'), 'churned');
    tracker.recordEvent(eventOf('lapsed-recovered'), 'converted');
    tracker.recordEvent(eventOf('lapsed-recovered'), 'expired');
    expect(tracker.summary()).toEqual({
      trialToPaid: 0,
      trialExpiredNoConversion: 0,
      lapsedRecovered: 0,
      lapsedChurned: 0,
      conversionRate: 0,
    });
  });

  it('summary() is idempotent — calling twice returns same counts', () => {
    const tracker = new ConversionMetricsTracker();
    tracker.recordEvent(eventOf('trial-to-paid'), 'converted');
    tracker.recordEvent(eventOf('lapsed-recovered'), 'recovered');
    const first = tracker.summary();
    const second = tracker.summary();
    expect(first).toEqual(second);
  });
});
