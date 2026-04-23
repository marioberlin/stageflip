// packages/editor-shell/src/cloud-save/stub-adapter.test.ts
// Contract tests for the in-memory stub adapter (T-139c).

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { createStubCloudSaveAdapter } from './stub-adapter';
import { CloudSaveConflictError } from './types';

function makeDoc(id: string): Document {
  return {
    meta: {
      id,
      version: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: {
      mode: 'slide',
      slides: [{ id: 's1', elements: [] }],
    },
  };
}

describe('createStubCloudSaveAdapter', () => {
  it('saves with monotonic revisions per id', async () => {
    const adapter = createStubCloudSaveAdapter({ now: () => new Date('2026-01-01T00:00:00Z') });
    const r1 = await adapter.save(makeDoc('a'));
    const r2 = await adapter.save(makeDoc('a'));
    expect(r1.revision).toBe(1);
    expect(r2.revision).toBe(2);
    expect(r1.id).toBe('a');
    expect(r1.savedAtIso).toBe('2026-01-01T00:00:00.000Z');
  });

  it('loads what it saved', async () => {
    const adapter = createStubCloudSaveAdapter();
    const doc = makeDoc('a');
    await adapter.save(doc);
    const loaded = await adapter.load('a');
    expect(loaded).toEqual(doc);
  });

  it('throws on missing id in load', async () => {
    const adapter = createStubCloudSaveAdapter();
    await expect(adapter.load('missing')).rejects.toThrow(/missing/);
  });

  it('throws CloudSaveConflictError when simulated', async () => {
    const adapter = createStubCloudSaveAdapter();
    await adapter.save(makeDoc('a'));
    const remote = makeDoc('a');
    adapter.__simulateConflict('a', remote);
    const local = makeDoc('a');
    await expect(adapter.save(local)).rejects.toBeInstanceOf(CloudSaveConflictError);
  });

  it('clears a simulated conflict after one throw', async () => {
    const adapter = createStubCloudSaveAdapter();
    const doc = makeDoc('a');
    await adapter.save(doc);
    adapter.__simulateConflict('a', doc);
    await expect(adapter.save(doc)).rejects.toBeInstanceOf(CloudSaveConflictError);
    const result = await adapter.save(doc);
    expect(result.revision).toBeGreaterThan(1);
  });

  it('honors seed', async () => {
    const seed = new Map([['a', { doc: makeDoc('a'), revision: 5 }]]);
    const adapter = createStubCloudSaveAdapter({ seed });
    const r = await adapter.save(makeDoc('a'));
    expect(r.revision).toBe(6);
  });

  it('simulates a generic error', async () => {
    const adapter = createStubCloudSaveAdapter();
    adapter.__simulateError(new Error('boom'));
    await expect(adapter.save(makeDoc('a'))).rejects.toThrow('boom');
  });
});
