// packages/adapter-sandbox/src/audit-emitter.test.ts
// Contract tests for InMemoryAuditEmitter.

import { describe, expect, it } from 'vitest';

import { InMemoryAuditEmitter } from './audit-emitter.js';
import type { AdapterAuditEvent } from './types.js';

const startEvent = (over: Partial<AdapterAuditEvent> = {}): AdapterAuditEvent => ({
  kind: 'start',
  adapterId: 'a',
  modality: 'tts',
  tenantId: 't',
  sandboxKind: 'in-process',
  ...over,
});

describe('InMemoryAuditEmitter', () => {
  it('starts empty', () => {
    const e = new InMemoryAuditEmitter();
    expect(e.events()).toEqual([]);
    expect(e.droppedCount()).toBe(0);
  });

  it('records emitted events in order', () => {
    const e = new InMemoryAuditEmitter();
    e.emit(startEvent({ adapterId: 'a' }));
    e.emit(startEvent({ adapterId: 'b' }));
    e.emit(startEvent({ adapterId: 'c' }));
    expect(e.events().map((ev) => (ev as { adapterId: string }).adapterId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('returns a fresh array from events() — mutating it does not affect internal state', () => {
    const e = new InMemoryAuditEmitter();
    e.emit(startEvent());
    const snap = [...e.events()];
    snap.length = 0;
    expect(e.events().length).toBe(1);
  });

  it('drops oldest on overflow and surfaces the drop counter', () => {
    const e = new InMemoryAuditEmitter(3);
    e.emit(startEvent({ adapterId: 'a' }));
    e.emit(startEvent({ adapterId: 'b' }));
    e.emit(startEvent({ adapterId: 'c' }));
    e.emit(startEvent({ adapterId: 'd' }));
    e.emit(startEvent({ adapterId: 'e' }));
    expect(e.events().map((ev) => (ev as { adapterId: string }).adapterId)).toEqual([
      'c',
      'd',
      'e',
    ]);
    expect(e.droppedCount()).toBe(2);
  });

  it('clear() resets buffer + drop counter', () => {
    const e = new InMemoryAuditEmitter(2);
    e.emit(startEvent({ adapterId: 'a' }));
    e.emit(startEvent({ adapterId: 'b' }));
    e.emit(startEvent({ adapterId: 'c' }));
    expect(e.droppedCount()).toBe(1);
    e.clear();
    expect(e.events()).toEqual([]);
    expect(e.droppedCount()).toBe(0);
  });

  it('rejects non-positive-integer capacity', () => {
    expect(() => new InMemoryAuditEmitter(0)).toThrow(/positive integer/);
    expect(() => new InMemoryAuditEmitter(-1)).toThrow(/positive integer/);
    expect(() => new InMemoryAuditEmitter(1.5)).toThrow(/positive integer/);
  });

  it('preserves discriminated-event shape across kinds', () => {
    const e = new InMemoryAuditEmitter();
    e.emit(startEvent());
    e.emit({
      kind: 'complete',
      adapterId: 'a',
      modality: 'tts',
      tenantId: 't',
      sandboxKind: 'in-process',
      durationMs: 42,
    });
    e.emit({
      kind: 'failed',
      adapterId: 'a',
      modality: 'tts',
      tenantId: 't',
      sandboxKind: 'in-process',
      errorMessage: 'boom',
    });
    e.emit({
      kind: 'killed-for-resource-limit',
      adapterId: 'a',
      modality: 'tts',
      tenantId: 't',
      sandboxKind: 'sidecar',
      dimension: 'memory',
    });
    const evs = e.events();
    expect(evs.map((ev) => ev.kind)).toEqual([
      'start',
      'complete',
      'failed',
      'killed-for-resource-limit',
    ]);
  });
});
