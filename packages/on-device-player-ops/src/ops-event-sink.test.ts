// packages/on-device-player-ops/src/ops-event-sink.test.ts
// Tests for `InMemoryOpsEventSink` (T-401).

import type { DisplayDeviceCapability } from '@stageflip/runtime-on-device-player';

import { describe, expect, it } from 'vitest';

import { InMemoryOpsEventSink, type OpsEventContext } from './ops-event-sink.js';

const DEVICE: DisplayDeviceCapability = {
  deviceId: 'd1',
  hardwareClass: 'dooh',
  resolution: { width: 1920, height: 1080 },
  refreshHz: 60,
  hasGpu: true,
  hasAudio: true,
  hasNetwork: true,
  hasMicrophone: false,
  hasCamera: false,
  osPlatform: 'linux',
  playerVersion: '1.0.0',
};

const CTX: OpsEventContext = {
  tenantId: 't1',
  deviceId: 'd1',
  playerVersion: '1.0.0',
};

describe('InMemoryOpsEventSink', () => {
  it('send appends; sent[] reflects order', async () => {
    const sink = new InMemoryOpsEventSink();
    await sink.send({ kind: 'boot', device: DEVICE }, CTX);
    await sink.send({ kind: 'shutdown', clipsUnmounted: 0 }, CTX);
    expect(sink.sent).toHaveLength(2);
    expect(sink.sent[0]?.event.kind).toBe('boot');
    expect(sink.sent[1]?.event.kind).toBe('shutdown');
  });

  it('send records the context fields alongside the event', async () => {
    const sink = new InMemoryOpsEventSink();
    await sink.send(
      { kind: 'mount-attempted', clipFamily: 'shader', clipId: 'c1' },
      { tenantId: 't42', deviceId: 'd42', playerVersion: '2.0.0' },
    );
    expect(sink.sent[0]).toEqual({
      event: { kind: 'mount-attempted', clipFamily: 'shader', clipId: 'c1' },
      tenantId: 't42',
      deviceId: 'd42',
      playerVersion: '2.0.0',
    });
  });

  it('flush resolves immediately', async () => {
    const sink = new InMemoryOpsEventSink();
    await sink.send({ kind: 'boot', device: DEVICE }, CTX);
    await expect(sink.flush()).resolves.toBeUndefined();
    // sent[] is unchanged after flush — in-memory has nothing to drain
    expect(sink.sent).toHaveLength(1);
  });

  it('reset clears sent[]', async () => {
    const sink = new InMemoryOpsEventSink();
    await sink.send({ kind: 'boot', device: DEVICE }, CTX);
    await sink.send({ kind: 'shutdown', clipsUnmounted: 0 }, CTX);
    expect(sink.sent).toHaveLength(2);
    sink.reset();
    expect(sink.sent).toHaveLength(0);
  });
});
