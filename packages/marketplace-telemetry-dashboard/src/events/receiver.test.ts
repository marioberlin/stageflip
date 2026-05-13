// packages/marketplace-telemetry-dashboard/src/events/receiver.test.ts
// T-541 — Coverage for the receiver: valid batch accepted, malformed
// JSON / shape rejected, missing auth rejected, third-party hash
// filtered out, mixed batch only writes first-party, empty batch
// returns 200/0/0, store-write failure surfaces as 500.

import { hashPackId } from '@stageflip/pack-telemetry';
import { describe, expect, it } from 'vitest';

import { computeFirstPartyHashes } from '../first-party/scope.js';
import { InMemoryTimeSeriesStore } from '../storage/in-memory.js';
import { createTelemetryReceiver } from './receiver.js';

const NEWS_PRO_HASH = hashPackId('stageflip', 'news-pro');
const FINANCE_HASH = hashPackId('stageflip', 'finance');
const THIRD_PARTY_HASH = hashPackId('acme', 'random-pack');

const authHeaders = (): Record<string, string> => ({ authorization: 'Bearer test-token' });

const validInstall = (hash: string) => ({
  kind: 'install',
  packIdHash: hash,
  packVersion: '1.0.0',
  licenseKind: 'paid-per-tenant',
  engineVersion: '1.0.0',
  platform: 'darwin',
  at: '2026-05-13T00:00:00Z',
});

describe('createTelemetryReceiver', () => {
  it('accepts a valid batch and writes to the store', async () => {
    const store = new InMemoryTimeSeriesStore();
    const handler = createTelemetryReceiver({
      store,
      firstPartyScope: computeFirstPartyHashes(),
    });
    const res = await handler({
      headers: authHeaders(),
      body: JSON.stringify([validInstall(NEWS_PRO_HASH)]),
    });
    expect(res.status).toBe(200);
    expect(res.accepted).toBe(1);
    expect(res.rejected).toBe(0);
    expect(store.size()).toBe(1);
  });

  it('rejects malformed JSON with 400', async () => {
    const store = new InMemoryTimeSeriesStore();
    const handler = createTelemetryReceiver({
      store,
      firstPartyScope: computeFirstPartyHashes(),
    });
    const res = await handler({ headers: authHeaders(), body: '{not json' });
    expect(res.status).toBe(400);
    expect(res.reason).toBe('malformed-json');
    expect(store.size()).toBe(0);
  });

  it('rejects non-array body with 400', async () => {
    const handler = createTelemetryReceiver({
      store: new InMemoryTimeSeriesStore(),
      firstPartyScope: computeFirstPartyHashes(),
    });
    const res = await handler({ headers: authHeaders(), body: '{"foo":"bar"}' });
    expect(res.status).toBe(400);
    expect(res.reason).toBe('expected-array');
  });

  it('rejects request with missing Authorization header (401)', async () => {
    const handler = createTelemetryReceiver({
      store: new InMemoryTimeSeriesStore(),
      firstPartyScope: computeFirstPartyHashes(),
    });
    const res = await handler({ headers: {}, body: '[]' });
    expect(res.status).toBe(401);
    expect(res.reason).toBe('unauthorized');
  });

  it('rejects malformed Authorization header (no Bearer scheme)', async () => {
    const handler = createTelemetryReceiver({
      store: new InMemoryTimeSeriesStore(),
      firstPartyScope: computeFirstPartyHashes(),
    });
    const res = await handler({
      headers: { authorization: 'Basic xxx' },
      body: '[]',
    });
    expect(res.status).toBe(401);
  });

  it('filters out a third-party pack hash', async () => {
    const store = new InMemoryTimeSeriesStore();
    const handler = createTelemetryReceiver({
      store,
      firstPartyScope: computeFirstPartyHashes(),
    });
    const res = await handler({
      headers: authHeaders(),
      body: JSON.stringify([validInstall(THIRD_PARTY_HASH)]),
    });
    expect(res.status).toBe(200);
    expect(res.accepted).toBe(0);
    expect(res.rejected).toBe(1);
    expect(store.size()).toBe(0);
  });

  it('writes only the first-party rows in a mixed batch', async () => {
    const store = new InMemoryTimeSeriesStore();
    const handler = createTelemetryReceiver({
      store,
      firstPartyScope: computeFirstPartyHashes(),
    });
    const res = await handler({
      headers: authHeaders(),
      body: JSON.stringify([
        validInstall(NEWS_PRO_HASH),
        validInstall(THIRD_PARTY_HASH),
        validInstall(FINANCE_HASH),
      ]),
    });
    expect(res.accepted).toBe(2);
    expect(res.rejected).toBe(1);
    expect(store.size()).toBe(2);
  });

  it('rejects events with malformed shape (missing required fields)', async () => {
    const store = new InMemoryTimeSeriesStore();
    const handler = createTelemetryReceiver({
      store,
      firstPartyScope: computeFirstPartyHashes(),
    });
    const res = await handler({
      headers: authHeaders(),
      body: JSON.stringify([{ kind: 'install', at: '2026-05-13T00:00:00Z' }]),
    });
    expect(res.accepted).toBe(0);
    expect(res.rejected).toBe(1);
  });

  it('returns 200 / 0 / 0 for an empty batch', async () => {
    const handler = createTelemetryReceiver({
      store: new InMemoryTimeSeriesStore(),
      firstPartyScope: computeFirstPartyHashes(),
    });
    const res = await handler({ headers: authHeaders(), body: '[]' });
    expect(res).toEqual({ status: 200, accepted: 0, rejected: 0 });
  });

  it('surfaces a 500 + reason when the store write throws', async () => {
    const failing = {
      write: async () => {
        throw new Error('boom');
      },
      query: async () => [],
    };
    const handler = createTelemetryReceiver({
      store: failing,
      firstPartyScope: computeFirstPartyHashes(),
    });
    const res = await handler({
      headers: authHeaders(),
      body: JSON.stringify([validInstall(NEWS_PRO_HASH)]),
    });
    expect(res.status).toBe(500);
    expect(res.reason).toBe('store-write-failed');
  });
});
