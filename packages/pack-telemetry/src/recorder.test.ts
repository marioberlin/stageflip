// packages/pack-telemetry/src/recorder.test.ts
// T-503 — Tests for the PackTelemetryRecorder.

import { describe, expect, it } from 'vitest';

import type { PackTelemetryEvent } from './events.js';
import { PackTelemetryRecorder } from './recorder.js';
import { hashPackId } from './redact.js';
import type { TelemetryLogger, TelemetryTransport } from './transport.js';

class RecordingTransport implements TelemetryTransport {
  public batches: PackTelemetryEvent[][] = [];
  public throwOnSend = false;
  async send(events: readonly PackTelemetryEvent[]): Promise<void> {
    if (this.throwOnSend) {
      throw new Error('inner-transport-boom');
    }
    this.batches.push([...events]);
  }
  get all(): PackTelemetryEvent[] {
    return this.batches.flat();
  }
}

const FIXED_MS = Date.UTC(2026, 4, 13, 12, 34, 56);
const fixedNow = (): number => FIXED_MS;

function silentLogger(): { logger: TelemetryLogger; messages: string[] } {
  const messages: string[] = [];
  return {
    logger: {
      warn: (m) => messages.push(m),
      error: (m) => messages.push(m),
    },
    messages,
  };
}

describe('PackTelemetryRecorder — disabled', () => {
  it('recordInstall is a no-op when disabled', async () => {
    const transport = new RecordingTransport();
    const rec = new PackTelemetryRecorder({
      enabled: false,
      transport,
      engineVersion: '0.0.0',
      now: fixedNow,
      platform: 'linux',
    });
    rec.recordInstall({
      publisherId: 'stageflip',
      packId: 'news-pro',
      packVersion: '1.0.0',
      licenseKind: 'open',
    });
    await rec.flush();
    expect(transport.batches).toHaveLength(0);
    expect(rec.isEnabled).toBe(false);
  });

  it('all three record* APIs are no-ops when disabled', async () => {
    const transport = new RecordingTransport();
    const rec = new PackTelemetryRecorder({
      enabled: false,
      transport,
      engineVersion: '0.0.0',
      now: fixedNow,
      platform: 'linux',
    });
    rec.recordInstall({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      licenseKind: 'open',
    });
    rec.recordActivation({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      mountedAnyClip: true,
    });
    rec.recordUsage({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      clipMountCount: 1,
      windowSeconds: 60,
    });
    await rec.flush();
    expect(transport.batches).toHaveLength(0);
  });
});

describe('PackTelemetryRecorder — enabled', () => {
  function build(opts?: { bufferSize?: number }): {
    rec: PackTelemetryRecorder;
    transport: RecordingTransport;
  } {
    const transport = new RecordingTransport();
    const rec = new PackTelemetryRecorder({
      enabled: true,
      transport,
      engineVersion: '0.42.0',
      now: fixedNow,
      platform: 'darwin',
      ...(opts?.bufferSize !== undefined ? { bufferSize: opts.bufferSize } : {}),
    });
    return { rec, transport };
  }

  it('recordInstall produces 1 install event', async () => {
    const { rec, transport } = build({ bufferSize: 1 });
    rec.recordInstall({
      publisherId: 'stageflip',
      packId: 'news-pro',
      packVersion: '1.0.0',
      licenseKind: 'open',
    });
    await rec.flush();
    expect(transport.all).toHaveLength(1);
    expect(transport.all[0]?.kind).toBe('install');
  });

  it('recordActivation produces 1 activation event', async () => {
    const { rec, transport } = build({ bufferSize: 1 });
    rec.recordActivation({
      publisherId: 'stageflip',
      packId: 'news-pro',
      packVersion: '1.0.0',
      mountedAnyClip: true,
    });
    await rec.flush();
    expect(transport.all).toHaveLength(1);
    expect(transport.all[0]?.kind).toBe('activation');
  });

  it('recordUsage produces 1 usage event', async () => {
    const { rec, transport } = build({ bufferSize: 1 });
    rec.recordUsage({
      publisherId: 'stageflip',
      packId: 'news-pro',
      packVersion: '1.0.0',
      clipMountCount: 7,
      windowSeconds: 300,
    });
    await rec.flush();
    expect(transport.all).toHaveLength(1);
    expect(transport.all[0]?.kind).toBe('usage');
  });

  it('hashes publisherId+packId — transport never sees plaintext', async () => {
    const { rec, transport } = build({ bufferSize: 1 });
    rec.recordInstall({
      publisherId: 'stageflip',
      packId: 'news-pro',
      packVersion: '1.0.0',
      licenseKind: 'open',
    });
    await rec.flush();
    const ev = transport.all[0];
    if (ev === undefined) throw new Error('no event');
    const serialized = JSON.stringify(ev);
    expect(serialized).not.toMatch(/stageflip/);
    expect(serialized).not.toMatch(/news-pro/);
    expect(ev.packIdHash).toBe(hashPackId('stageflip', 'news-pro'));
  });

  it('preserves licenseKind through to the event', async () => {
    const { rec, transport } = build({ bufferSize: 1 });
    rec.recordInstall({
      publisherId: 'stageflip',
      packId: 'news-pro',
      packVersion: '1.0.0',
      licenseKind: 'enterprise',
    });
    await rec.flush();
    const ev = transport.all[0];
    if (ev?.kind !== 'install') throw new Error('expected install');
    expect(ev.licenseKind).toBe('enterprise');
  });

  it('preserves mountedAnyClip through to the event', async () => {
    const { rec, transport } = build({ bufferSize: 1 });
    rec.recordActivation({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      mountedAnyClip: false,
    });
    await rec.flush();
    const ev = transport.all[0];
    if (ev?.kind !== 'activation') throw new Error('expected activation');
    expect(ev.mountedAnyClip).toBe(false);
  });

  it('preserves clipMountCount + windowSeconds through to the event', async () => {
    const { rec, transport } = build({ bufferSize: 1 });
    rec.recordUsage({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      clipMountCount: 42,
      windowSeconds: 900,
    });
    await rec.flush();
    const ev = transport.all[0];
    if (ev?.kind !== 'usage') throw new Error('expected usage');
    expect(ev.clipMountCount).toBe(42);
    expect(ev.windowSeconds).toBe(900);
  });

  it('platform + engineVersion override are stamped on install events', async () => {
    const { rec, transport } = build({ bufferSize: 1 });
    rec.recordInstall({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      licenseKind: 'open',
    });
    await rec.flush();
    const ev = transport.all[0];
    if (ev?.kind !== 'install') throw new Error('expected install');
    expect(ev.platform).toBe('darwin');
    expect(ev.engineVersion).toBe('0.42.0');
  });

  it('buffer fills then auto-flushes at bufferSize', async () => {
    const { rec, transport } = build({ bufferSize: 3 });
    rec.recordUsage({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      clipMountCount: 1,
      windowSeconds: 60,
    });
    rec.recordUsage({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      clipMountCount: 1,
      windowSeconds: 60,
    });
    // Allow any pending microtasks in enqueue() to settle.
    await new Promise<void>((r) => setImmediate(r));
    expect(transport.batches).toHaveLength(0);
    rec.recordUsage({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      clipMountCount: 1,
      windowSeconds: 60,
    });
    await new Promise<void>((r) => setImmediate(r));
    expect(transport.batches.length).toBeGreaterThanOrEqual(1);
    expect(transport.all).toHaveLength(3);
  });

  it('flush() force-drains the buffer', async () => {
    const { rec, transport } = build({ bufferSize: 16 });
    rec.recordInstall({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      licenseKind: 'open',
    });
    rec.recordActivation({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      mountedAnyClip: true,
    });
    await new Promise<void>((r) => setImmediate(r));
    expect(transport.batches).toHaveLength(0);
    await rec.flush();
    expect(transport.all).toHaveLength(2);
  });

  it('mixes multiple event kinds in one buffer', async () => {
    const { rec, transport } = build({ bufferSize: 16 });
    rec.recordInstall({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      licenseKind: 'open',
    });
    rec.recordActivation({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      mountedAnyClip: true,
    });
    rec.recordUsage({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      clipMountCount: 3,
      windowSeconds: 60,
    });
    await rec.flush();
    const kinds = transport.all.map((e) => e.kind);
    expect(kinds).toContain('install');
    expect(kinds).toContain('activation');
    expect(kinds).toContain('usage');
  });

  it('does not throw on transport errors; logs instead', async () => {
    const transport = new RecordingTransport();
    transport.throwOnSend = true;
    const { logger, messages } = silentLogger();
    const rec = new PackTelemetryRecorder({
      enabled: true,
      transport,
      engineVersion: '0.0.0',
      now: fixedNow,
      bufferSize: 1,
      logger,
    });
    expect(() =>
      rec.recordInstall({
        publisherId: 'p',
        packId: 'i',
        packVersion: '1.0.0',
        licenseKind: 'open',
      }),
    ).not.toThrow();
    await rec.flush();
    expect(messages.join('\n')).toMatch(/inner-transport-boom|flush failed/);
  });

  it('defaults `now` to Date.now when not provided', async () => {
    const transport = new RecordingTransport();
    const rec = new PackTelemetryRecorder({
      enabled: true,
      transport,
      engineVersion: '0.0.0',
      bufferSize: 1,
    });
    rec.recordUsage({
      publisherId: 'p',
      packId: 'i',
      packVersion: '1.0.0',
      clipMountCount: 0,
      windowSeconds: 60,
    });
    await rec.flush();
    const ev = transport.all[0];
    expect(ev?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
