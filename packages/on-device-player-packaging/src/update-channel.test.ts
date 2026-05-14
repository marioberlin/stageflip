// packages/on-device-player-packaging/src/update-channel.test.ts
// Tests for `resolveUpdate` (stub fetcher injection).

import { describe, expect, it } from 'vitest';

import { type UpdateChannelDescriptor, resolveUpdate } from './update-channel.js';

const DESCRIPTOR: UpdateChannelDescriptor = {
  channel: 'stable',
  endpoint: 'https://updates.example.com/on-device-player',
  publisherKeyId: 'stageflip-prod-2026',
  pollIntervalSec: 3600,
};

describe('resolveUpdate', () => {
  it('reports hasUpdate=true when server returns a newer version', async () => {
    const result = await resolveUpdate({
      descriptor: DESCRIPTOR,
      currentVersion: '1.2.3',
      fetcher: async () => ({
        version: '1.2.4',
        downloadUrl: 'https://updates.example.com/on-device-player/1.2.4.tar.gz',
      }),
    });
    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('1.2.4');
    expect(result.downloadUrl).toBe('https://updates.example.com/on-device-player/1.2.4.tar.gz');
  });

  it('reports hasUpdate=false when server returns the current version', async () => {
    const result = await resolveUpdate({
      descriptor: DESCRIPTOR,
      currentVersion: '1.2.3',
      fetcher: async () => ({
        version: '1.2.3',
        downloadUrl: 'https://updates.example.com/on-device-player/1.2.3.tar.gz',
      }),
    });
    expect(result.hasUpdate).toBe(false);
    expect(result.latestVersion).toBe('1.2.3');
  });

  it('reports hasUpdate=false when server returns null', async () => {
    const result = await resolveUpdate({
      descriptor: DESCRIPTOR,
      currentVersion: '1.2.3',
      fetcher: async () => null,
    });
    expect(result.hasUpdate).toBe(false);
    expect(result.latestVersion).toBe('1.2.3');
  });

  it('passes the current version to the fetcher via the `current` query parameter', async () => {
    let observedUrl = '';
    await resolveUpdate({
      descriptor: DESCRIPTOR,
      currentVersion: '1.2.3-rc.1',
      fetcher: async (url) => {
        observedUrl = url;
        return null;
      },
    });
    expect(observedUrl).toBe('https://updates.example.com/on-device-player?current=1.2.3-rc.1');
  });

  it('default fetcher throws (production binary must inject one)', async () => {
    await expect(
      resolveUpdate({ descriptor: DESCRIPTOR, currentVersion: '1.2.3' }),
    ).rejects.toThrow();
  });
});
