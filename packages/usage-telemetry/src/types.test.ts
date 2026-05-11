// packages/usage-telemetry/src/types.test.ts
// Schema-level contract tests for `AdapterUsageEvent`.

import { describe, expect, it } from 'vitest';
import { type AdapterUsageEvent, adapterUsageEventSchema } from './types.js';

const valid: AdapterUsageEvent = {
  tenantId: 'tenant-a',
  adapterId: 'kokoro-tts',
  modality: 'tts',
  selectedReason: 'capability-router',
  latencyMs: 250,
  costAmount: 0,
  costCurrency: 'USD',
  outcome: 'success',
  timestamp: '2026-05-11T12:00:00.000Z',
};

describe('adapterUsageEventSchema', () => {
  it('parses a valid event', () => {
    const parsed = adapterUsageEventSchema.parse(valid);
    expect(parsed).toEqual(valid);
  });

  it('rejects empty tenantId', () => {
    expect(() => adapterUsageEventSchema.parse({ ...valid, tenantId: '' })).toThrow();
  });

  it('rejects non-kebab-case adapterId', () => {
    expect(() => adapterUsageEventSchema.parse({ ...valid, adapterId: 'KokoroTTS' })).toThrow();
    expect(() => adapterUsageEventSchema.parse({ ...valid, adapterId: 'kokoro_tts' })).toThrow();
    expect(() => adapterUsageEventSchema.parse({ ...valid, adapterId: '' })).toThrow();
  });

  it('rejects unknown selectedReason', () => {
    expect(() =>
      adapterUsageEventSchema.parse({ ...valid, selectedReason: 'random' as never }),
    ).toThrow();
  });

  it('rejects unknown outcome', () => {
    expect(() =>
      adapterUsageEventSchema.parse({ ...valid, outcome: 'timeout' as never }),
    ).toThrow();
  });

  it('rejects negative latencyMs', () => {
    expect(() => adapterUsageEventSchema.parse({ ...valid, latencyMs: -1 })).toThrow();
  });

  it('rejects non-finite latencyMs', () => {
    expect(() =>
      adapterUsageEventSchema.parse({ ...valid, latencyMs: Number.POSITIVE_INFINITY }),
    ).toThrow();
    expect(() => adapterUsageEventSchema.parse({ ...valid, latencyMs: Number.NaN })).toThrow();
  });

  it('rejects negative costAmount', () => {
    expect(() => adapterUsageEventSchema.parse({ ...valid, costAmount: -0.01 })).toThrow();
  });

  it('rejects non-ISO-4217 currency', () => {
    expect(() => adapterUsageEventSchema.parse({ ...valid, costCurrency: 'usd' })).toThrow();
    expect(() => adapterUsageEventSchema.parse({ ...valid, costCurrency: 'US' })).toThrow();
    expect(() => adapterUsageEventSchema.parse({ ...valid, costCurrency: 'USDT' })).toThrow();
  });

  it('rejects non-ISO-8601 timestamp', () => {
    expect(() =>
      adapterUsageEventSchema.parse({ ...valid, timestamp: '2026-05-11 12:00:00' }),
    ).toThrow();
    expect(() => adapterUsageEventSchema.parse({ ...valid, timestamp: 'today' })).toThrow();
  });

  it('rejects extra keys (strict)', () => {
    expect(() =>
      adapterUsageEventSchema.parse({ ...valid, extra: 'forbidden' } as never),
    ).toThrow();
  });

  it('accepts all three outcomes', () => {
    for (const outcome of ['success', 'failed', 'killed'] as const) {
      expect(() => adapterUsageEventSchema.parse({ ...valid, outcome })).not.toThrow();
    }
  });

  it('accepts both selectedReason values', () => {
    for (const selectedReason of ['capability-router', 'explicit'] as const) {
      expect(() => adapterUsageEventSchema.parse({ ...valid, selectedReason })).not.toThrow();
    }
  });

  it('accepts non-zero costAmount with declared currency', () => {
    expect(() =>
      adapterUsageEventSchema.parse({ ...valid, costAmount: 0.04, costCurrency: 'EUR' }),
    ).not.toThrow();
  });
});
