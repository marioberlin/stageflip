// packages/marketplace-conversion/src/events/conversion-event.test.ts
// T-544 — `ConversionEvent` shape + discriminator-narrowing tests.

import { describe, expect, it } from 'vitest';
import { type ConversionEvent, isConversionEventKind } from './conversion-event.js';

const BASE: ConversionEvent = {
  kind: 'trial-to-paid',
  tenantId: 'tenant-1',
  sku: 'sku.news.pro',
  at: '2026-05-14T09:00:00.000Z',
  metadata: {},
};

describe('ConversionEvent', () => {
  it('accepts a well-formed trial-to-paid event', () => {
    const event: ConversionEvent = { ...BASE, kind: 'trial-to-paid' };
    expect(event.kind).toBe('trial-to-paid');
    expect(event.tenantId).toBe('tenant-1');
    expect(event.sku).toBe('sku.news.pro');
  });

  it('accepts a well-formed trial-expired event', () => {
    const event: ConversionEvent = { ...BASE, kind: 'trial-expired' };
    expect(event.kind).toBe('trial-expired');
  });

  it('accepts a well-formed lapsed-recovered event', () => {
    const event: ConversionEvent = { ...BASE, kind: 'lapsed-recovered' };
    expect(event.kind).toBe('lapsed-recovered');
  });

  it('threads metadata through unchanged', () => {
    const event: ConversionEvent = {
      ...BASE,
      metadata: { source: 'mid-trial-upsell', campaign: 'spring-2026' },
    };
    expect(event.metadata.source).toBe('mid-trial-upsell');
    expect(event.metadata.campaign).toBe('spring-2026');
  });

  it('narrows via isConversionEventKind for trial-to-paid', () => {
    const event: ConversionEvent = { ...BASE, kind: 'trial-to-paid' };
    if (isConversionEventKind(event, 'trial-to-paid')) {
      // Type-level assertion: the narrowed kind is the literal.
      const narrowed: 'trial-to-paid' = event.kind;
      expect(narrowed).toBe('trial-to-paid');
    } else {
      throw new Error('expected trial-to-paid narrowing');
    }
  });

  it('isConversionEventKind returns false for non-matching kind', () => {
    const event: ConversionEvent = { ...BASE, kind: 'trial-expired' };
    expect(isConversionEventKind(event, 'trial-to-paid')).toBe(false);
    expect(isConversionEventKind(event, 'lapsed-recovered')).toBe(false);
    expect(isConversionEventKind(event, 'trial-expired')).toBe(true);
  });
});
