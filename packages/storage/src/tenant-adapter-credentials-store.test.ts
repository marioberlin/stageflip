// packages/storage/src/tenant-adapter-credentials-store.test.ts
// Contract tests for InMemoryTenantAdapterCredentialsStore (T-444 AC #3).
// Mirrors TenantCostTrackerStore tests; same surface will be provable
// for Postgres + Firebase impls by name alignment.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryTenantAdapterCredentialsStore } from './tenant-adapter-credentials-store.js';

describe('InMemoryTenantAdapterCredentialsStore', () => {
  let store: InMemoryTenantAdapterCredentialsStore;

  beforeEach(() => {
    store = new InMemoryTenantAdapterCredentialsStore();
  });

  afterEach(() => {
    store.reset();
  });

  describe('getCredentials + setCredentials', () => {
    it('returns null for an unknown tenant', async () => {
      expect(await store.getCredentials('missing', 'kokoro')).toBeNull();
    });

    it('returns null for a known tenant but unknown adapter', async () => {
      await store.setCredentials('t-1', 'kokoro', { apiKey: 'sk' });
      expect(await store.getCredentials('t-1', 'meshy')).toBeNull();
    });

    it('round-trips a credential', async () => {
      await store.setCredentials('t-1', 'kokoro', { apiKey: 'sk-abc' });
      expect(await store.getCredentials('t-1', 'kokoro')).toEqual({ apiKey: 'sk-abc' });
    });

    it('upserts (set twice replaces)', async () => {
      await store.setCredentials('t-1', 'kokoro', { apiKey: 'old' });
      await store.setCredentials('t-1', 'kokoro', { apiKey: 'new' });
      expect(await store.getCredentials('t-1', 'kokoro')).toEqual({ apiKey: 'new' });
    });

    it('isolates per-tenant credentials', async () => {
      await store.setCredentials('t-1', 'kokoro', { apiKey: 'sk-a' });
      await store.setCredentials('t-2', 'kokoro', { apiKey: 'sk-b' });
      expect(await store.getCredentials('t-1', 'kokoro')).toEqual({ apiKey: 'sk-a' });
      expect(await store.getCredentials('t-2', 'kokoro')).toEqual({ apiKey: 'sk-b' });
    });

    it('isolates per-adapter credentials within one tenant', async () => {
      await store.setCredentials('t-1', 'kokoro', { apiKey: 'sk-kokoro' });
      await store.setCredentials('t-1', 'video-runway', {
        baseUrl: 'https://runway.example',
      });
      expect(await store.getCredentials('t-1', 'kokoro')).toEqual({ apiKey: 'sk-kokoro' });
      expect(await store.getCredentials('t-1', 'video-runway')).toEqual({
        baseUrl: 'https://runway.example',
      });
    });

    it('rejects empty {} credential at set boundary', async () => {
      await expect(store.setCredentials('t-1', 'kokoro', {} as never)).rejects.toThrow();
    });

    it('rejects non-kebab-case adapterId at set boundary', async () => {
      await expect(store.setCredentials('t-1', 'Kokoro_TTS', { apiKey: 'sk' })).rejects.toThrow();
    });
  });

  describe('listAdapterIds', () => {
    it('returns [] for unknown tenant', async () => {
      expect(await store.listAdapterIds('missing')).toEqual([]);
    });

    it('returns the configured adapter ids', async () => {
      await store.setCredentials('t-1', 'kokoro', { apiKey: 'a' });
      await store.setCredentials('t-1', 'meshy', { apiKey: 'b' });
      const ids = await store.listAdapterIds('t-1');
      expect([...ids].sort()).toEqual(['kokoro', 'meshy']);
    });
  });

  describe('deleteCredentials', () => {
    it('removes the credential', async () => {
      await store.setCredentials('t-1', 'kokoro', { apiKey: 'sk' });
      await store.deleteCredentials('t-1', 'kokoro');
      expect(await store.getCredentials('t-1', 'kokoro')).toBeNull();
    });

    it('is idempotent on unknown adapter', async () => {
      await expect(store.deleteCredentials('t-1', 'never-set')).resolves.toBeUndefined();
    });

    it('is idempotent on unknown tenant', async () => {
      await expect(store.deleteCredentials('missing', 'kokoro')).resolves.toBeUndefined();
    });

    it('drops the tenant row when last credential is deleted', async () => {
      await store.setCredentials('t-1', 'kokoro', { apiKey: 'sk' });
      expect(store.size()).toBe(1);
      await store.deleteCredentials('t-1', 'kokoro');
      expect(store.size()).toBe(0);
    });
  });

  describe('reset', () => {
    it('clears all rows', async () => {
      await store.setCredentials('t-1', 'kokoro', { apiKey: 'a' });
      await store.setCredentials('t-2', 'meshy', { apiKey: 'b' });
      store.reset();
      expect(store.size()).toBe(0);
      expect(await store.getCredentials('t-1', 'kokoro')).toBeNull();
      expect(await store.getCredentials('t-2', 'meshy')).toBeNull();
    });
  });
});
