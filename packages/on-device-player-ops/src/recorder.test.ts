// packages/on-device-player-ops/src/recorder.test.ts
// Tests for `OnDeviceTelemetryRecorder` (T-401).

import type { DisplayDeviceCapability } from '@stageflip/runtime-on-device-player';

import { describe, expect, it } from 'vitest';

import { createTelemetryRecorder } from './recorder.js';

const DEVICE: DisplayDeviceCapability = {
  deviceId: 'd',
  hardwareClass: 'signage',
  resolution: { width: 1920, height: 1080 },
  refreshHz: 60,
  hasGpu: true,
  hasAudio: false,
  hasNetwork: true,
  hasMicrophone: false,
  hasCamera: false,
  osPlatform: 'linux',
  playerVersion: '1.0.0',
};

describe('createTelemetryRecorder', () => {
  it('records events in arrival order', () => {
    const rec = createTelemetryRecorder();
    rec.asSink({ kind: 'boot', device: DEVICE });
    rec.asSink({ kind: 'mount-attempted', clipFamily: 'shader', clipId: 'c1' });
    rec.asSink({
      kind: 'mount-success',
      clipFamily: 'shader',
      clipId: 'c1',
      elapsedMs: 20,
    });
    expect(rec.recorded).toHaveLength(3);
    expect(rec.recorded[0]?.kind).toBe('boot');
    expect(rec.recorded[1]?.kind).toBe('mount-attempted');
    expect(rec.recorded[2]?.kind).toBe('mount-success');
  });

  it("byKind('boot') returns only boot events with narrowed type", () => {
    const rec = createTelemetryRecorder();
    rec.asSink({ kind: 'boot', device: DEVICE });
    rec.asSink({ kind: 'mount-attempted', clipFamily: 's', clipId: 'c' });
    const boots = rec.byKind('boot');
    expect(boots).toHaveLength(1);
    // type narrowing: device is accessible directly
    expect(boots[0]?.device.deviceId).toBe('d');
  });

  it("byKind('mount-success') returns only mount-success events", () => {
    const rec = createTelemetryRecorder();
    rec.asSink({ kind: 'mount-attempted', clipFamily: 's', clipId: 'c1' });
    rec.asSink({
      kind: 'mount-success',
      clipFamily: 's',
      clipId: 'c1',
      elapsedMs: 5,
    });
    rec.asSink({
      kind: 'mount-success',
      clipFamily: 's',
      clipId: 'c2',
      elapsedMs: 7,
    });
    const successes = rec.byKind('mount-success');
    expect(successes).toHaveLength(2);
    expect(successes[0]?.elapsedMs).toBe(5);
    expect(successes[1]?.elapsedMs).toBe(7);
  });

  it('clear() empties recorded', () => {
    const rec = createTelemetryRecorder();
    rec.asSink({ kind: 'boot', device: DEVICE });
    rec.asSink({ kind: 'shutdown', clipsUnmounted: 0 });
    expect(rec.recorded).toHaveLength(2);
    rec.clear();
    expect(rec.recorded).toHaveLength(0);
  });
});
