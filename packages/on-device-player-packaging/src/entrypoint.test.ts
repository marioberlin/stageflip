// packages/on-device-player-packaging/src/entrypoint.test.ts
// Tests for `bootOnDevicePlayer` — manifest read, signature verify,
// capability coverage, shim boot. All deps injected; no real harness
// construction inside this layer.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  DisplayDeviceCapability,
  OnDeviceClipHandle,
  OnDevicePlayerShim,
  TelemetryEvent,
} from '@stageflip/runtime-on-device-player';
import { describe, expect, it } from 'vitest';

import { bootOnDevicePlayer } from './entrypoint.js';
import { type OnDeviceBinaryManifest, writeManifest } from './manifest.js';

function makeDevice(overrides: Partial<DisplayDeviceCapability> = {}): DisplayDeviceCapability {
  return {
    deviceId: 'device-001',
    hardwareClass: 'signage',
    resolution: { width: 1920, height: 1080 },
    refreshHz: 60,
    hasGpu: true,
    hasAudio: true,
    hasNetwork: true,
    hasMicrophone: true,
    hasCamera: true,
    osPlatform: 'linux',
    playerVersion: '1.2.3',
    ...overrides,
  };
}

function makeManifest(overrides: Partial<OnDeviceBinaryManifest> = {}): OnDeviceBinaryManifest {
  return {
    manifestVersion: 1,
    binaryVersion: '1.2.3',
    tenantId: 'tenant-alpha',
    deviceId: 'device-001',
    enabledPackIds: ['pack-news-pro'],
    enabledClipFamilies: ['shader'],
    updateChannel: {
      channel: 'stable',
      endpoint: 'https://updates.example.com/on-device-player',
      publisherKeyId: 'stageflip-prod-2026',
      pollIntervalSec: 3600,
    },
    codeSigningPolicy: {
      enforce: 'strict',
      trustedPublisherKeyIds: ['stageflip-prod-2026'],
      signatureAlgorithm: 'ed25519',
      signatureUri: 'https://updates.example.com/on-device-player.sig',
    },
    health: { probeIntervalSec: 60 },
    ...overrides,
  };
}

function makeStubShim(): {
  shim: OnDevicePlayerShim;
  bootedWith: { value: Parameters<OnDevicePlayerShim['boot']>[0] | null };
} {
  const bootedWith: { value: Parameters<OnDevicePlayerShim['boot']>[0] | null } = {
    value: null,
  };
  const shim: OnDevicePlayerShim = {
    boot: (args) => {
      bootedWith.value = args;
    },
    mount: async () => ({
      result: 'fallback',
      reason: 'no-factory-registered',
    }),
    listMounted: (): readonly OnDeviceClipHandle[] => [],
    shutdown: async () => undefined,
  };
  return { shim, bootedWith };
}

describe('bootOnDevicePlayer', () => {
  it('returns manifest-invalid when manifest is missing', async () => {
    const result = await bootOnDevicePlayer({
      manifestPath: '/no/such/__on_device_boot_test__/manifest.json',
      device: makeDevice(),
      emitTelemetry: () => undefined,
      clock: () => 0,
    });
    expect(result.status).toBe('manifest-invalid');
    expect(result.reason).toBeDefined();
    expect(result.shim).toBeUndefined();
  });

  it('returns signature-rejected when verifier denies', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'on-device-boot-sig-'));
    try {
      const path = join(dir, 'manifest.json');
      writeManifest(path, makeManifest());
      const result = await bootOnDevicePlayer({
        manifestPath: path,
        device: makeDevice(),
        emitTelemetry: () => undefined,
        clock: () => 0,
        verifySignature: () => ({ verified: false, reason: 'signature-invalid' }),
      });
      expect(result.status).toBe('signature-rejected');
      expect(result.reason).toMatch(/signature-invalid/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns capability-mismatch when manifest enables shader but device has no GPU', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'on-device-boot-cap-'));
    try {
      const path = join(dir, 'manifest.json');
      writeManifest(path, makeManifest({ enabledClipFamilies: ['shader'] }));
      const result = await bootOnDevicePlayer({
        manifestPath: path,
        device: makeDevice({ hasGpu: false }),
        emitTelemetry: () => undefined,
        clock: () => 0,
        verifySignature: () => ({ verified: true, reason: 'verified' }),
      });
      expect(result.status).toBe('capability-mismatch');
      expect(result.reason).toMatch(/shader/);
      expect(result.reason).toMatch(/hasGpu/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns capability-mismatch when manifest enables voice but device has no microphone', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'on-device-boot-mic-'));
    try {
      const path = join(dir, 'manifest.json');
      writeManifest(path, makeManifest({ enabledClipFamilies: ['voice'] }));
      const result = await bootOnDevicePlayer({
        manifestPath: path,
        device: makeDevice({ hasMicrophone: false }),
        emitTelemetry: () => undefined,
        clock: () => 0,
        verifySignature: () => ({ verified: true, reason: 'verified' }),
      });
      expect(result.status).toBe('capability-mismatch');
      expect(result.reason).toMatch(/voice/);
      expect(result.reason).toMatch(/hasMicrophone/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('happy path: returns booted with shim handle and shim.boot was invoked', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'on-device-boot-ok-'));
    try {
      const path = join(dir, 'manifest.json');
      writeManifest(path, makeManifest());
      const { shim, bootedWith } = makeStubShim();
      const events: TelemetryEvent[] = [];
      const result = await bootOnDevicePlayer({
        manifestPath: path,
        device: makeDevice(),
        emitTelemetry: (e) => events.push(e),
        clock: () => 42,
        verifySignature: () => ({ verified: true, reason: 'verified' }),
        createShim: () => shim,
      });
      expect(result.status).toBe('booted');
      expect(result.shim).toBe(shim);
      expect(bootedWith.value).not.toBeNull();
      expect(bootedWith.value?.device.deviceId).toBe('device-001');
      // The injected clock is wired through to shim.boot.
      expect(bootedWith.value?.clock?.()).toBe(42);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('default createShim throws when no createShim is injected on a happy path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'on-device-boot-default-shim-'));
    try {
      const path = join(dir, 'manifest.json');
      writeManifest(path, makeManifest());
      await expect(
        bootOnDevicePlayer({
          manifestPath: path,
          device: makeDevice(),
          emitTelemetry: () => undefined,
          clock: () => 0,
          verifySignature: () => ({ verified: true, reason: 'verified' }),
        }),
      ).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('default verifier rejects (binary must wire one in production)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'on-device-boot-default-verify-'));
    try {
      const path = join(dir, 'manifest.json');
      writeManifest(path, makeManifest());
      const result = await bootOnDevicePlayer({
        manifestPath: path,
        device: makeDevice(),
        emitTelemetry: () => undefined,
        clock: () => 0,
      });
      expect(result.status).toBe('signature-rejected');
      expect(result.reason).toMatch(/signature-missing/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
