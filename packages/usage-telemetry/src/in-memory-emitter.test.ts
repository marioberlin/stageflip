// packages/usage-telemetry/src/in-memory-emitter.test.ts
// Contract tests for `InMemoryUsageTelemetryEmitter`.

import { describe, expect, it } from 'vitest';
import { InMemoryUsageTelemetryEmitter } from './in-memory-emitter.js';
import type { AdapterUsageEvent } from './types.js';

const makeEvent = (over: Partial<AdapterUsageEvent> = {}): AdapterUsageEvent => ({
  tenantId: 'tenant-a',
  adapterId: 'kokoro-tts',
  modality: 'tts',
  selectedReason: 'capability-router',
  latencyMs: 100,
  costAmount: 0,
  costCurrency: 'USD',
  outcome: 'success',
  timestamp: '2026-05-11T12:00:00.000Z',
  ...over,
});

describe('InMemoryUsageTelemetryEmitter', () => {
  it('starts empty', () => {
    const e = new InMemoryUsageTelemetryEmitter();
    expect(e.events()).toEqual([]);
    expect(e.droppedCount()).toBe(0);
  });

  it('records emitted events in order', () => {
    const e = new InMemoryUsageTelemetryEmitter();
    e.emit(makeEvent({ adapterId: 'a-one' }));
    e.emit(makeEvent({ adapterId: 'b-two' }));
    e.emit(makeEvent({ adapterId: 'c-three' }));
    expect(e.events().map((ev) => ev.adapterId)).toEqual(['a-one', 'b-two', 'c-three']);
  });

  it('returns a fresh array from events() — mutating does not affect internal state', () => {
    const e = new InMemoryUsageTelemetryEmitter();
    e.emit(makeEvent());
    const snap = [...e.events()];
    snap.length = 0;
    expect(e.events().length).toBe(1);
  });

  it('eventsForTenant filters by tenantId', () => {
    const e = new InMemoryUsageTelemetryEmitter();
    e.emit(makeEvent({ tenantId: 't1', adapterId: 'a-one' }));
    e.emit(makeEvent({ tenantId: 't2', adapterId: 'b-two' }));
    e.emit(makeEvent({ tenantId: 't1', adapterId: 'c-three' }));
    const t1 = e.eventsForTenant('t1');
    expect(t1.map((ev) => ev.adapterId)).toEqual(['a-one', 'c-three']);
    expect(e.eventsForTenant('t2').map((ev) => ev.adapterId)).toEqual(['b-two']);
    expect(e.eventsForTenant('t3')).toEqual([]);
  });

  it('drops oldest on overflow and surfaces the drop counter', () => {
    const e = new InMemoryUsageTelemetryEmitter(3);
    e.emit(makeEvent({ adapterId: 'a-one' }));
    e.emit(makeEvent({ adapterId: 'b-two' }));
    e.emit(makeEvent({ adapterId: 'c-three' }));
    e.emit(makeEvent({ adapterId: 'd-four' }));
    e.emit(makeEvent({ adapterId: 'e-five' }));
    expect(e.events().map((ev) => ev.adapterId)).toEqual(['c-three', 'd-four', 'e-five']);
    expect(e.droppedCount()).toBe(2);
  });

  it('clear() resets buffer + drop counter', () => {
    const e = new InMemoryUsageTelemetryEmitter(2);
    e.emit(makeEvent({ adapterId: 'a-one' }));
    e.emit(makeEvent({ adapterId: 'b-two' }));
    e.emit(makeEvent({ adapterId: 'c-three' }));
    expect(e.droppedCount()).toBe(1);
    e.clear();
    expect(e.events()).toEqual([]);
    expect(e.droppedCount()).toBe(0);
  });

  it('rejects non-positive-integer capacity', () => {
    expect(() => new InMemoryUsageTelemetryEmitter(0)).toThrow(/positive integer/);
    expect(() => new InMemoryUsageTelemetryEmitter(-1)).toThrow(/positive integer/);
    expect(() => new InMemoryUsageTelemetryEmitter(1.5)).toThrow(/positive integer/);
  });

  it('preserves all outcome variants across emissions', () => {
    const e = new InMemoryUsageTelemetryEmitter();
    e.emit(makeEvent({ outcome: 'success' }));
    e.emit(makeEvent({ outcome: 'failed' }));
    e.emit(makeEvent({ outcome: 'killed' }));
    expect(e.events().map((ev) => ev.outcome)).toEqual(['success', 'failed', 'killed']);
  });
});
