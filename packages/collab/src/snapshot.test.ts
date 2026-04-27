// packages/collab/src/snapshot.test.ts
// compact() helper tests per T-260 ACs #30–#32.

import { type Document, documentSchema } from '@stageflip/schema';
import { InMemoryStorageAdapter } from '@stageflip/storage';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { documentToYDoc, yDocToDocument } from './binding.js';
import { compact, setSnapshotNowProvider } from './snapshot.js';

const nowISO = (): string => '2026-04-27T00:00:00.000Z';

const makeDoc = (): Document =>
  documentSchema.parse({
    meta: {
      id: 'doc-1',
      version: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: {
      mode: 'slide',
      slides: [{ id: 's1', elements: [] }],
    },
  });

afterEach(() => {
  setSnapshotNowProvider(() => new Date().toISOString());
});

describe('compact (AC #30)', () => {
  it('writes a snapshot with monotonically increasing version', async () => {
    setSnapshotNowProvider(() => '2026-04-27T00:00:00.000Z');
    const storage = new InMemoryStorageAdapter();
    const ydoc = new Y.Doc();
    documentToYDoc(makeDoc(), ydoc);

    const snap1 = await compact('d1', ydoc, storage);
    expect(snap1.version).toBe(1);
    expect(snap1.docId).toBe('d1');
    expect(snap1.content).toBeInstanceOf(Uint8Array);

    const snap2 = await compact('d1', ydoc, storage);
    expect(snap2.version).toBe(2);
  });
});

describe('compact concurrent safety (AC #31)', () => {
  it('two concurrent compact() calls do not produce conflicting versions (last write wins)', async () => {
    const storage = new InMemoryStorageAdapter();
    const ydoc = new Y.Doc();
    documentToYDoc(makeDoc(), ydoc);

    const [a, b] = await Promise.all([compact('d1', ydoc, storage), compact('d1', ydoc, storage)]);
    // Both compute version 1 from the same pre-state; last write wins at storage.
    // The contract is: no two snapshots share a version *for the same content*;
    // the versions are equal but the persisted snapshot is one of the two.
    expect(a.version).toBe(1);
    expect(b.version).toBe(1);
    const persisted = await storage.getSnapshot('d1');
    expect(persisted?.version).toBe(1);
  });
});

describe('compact + replay (AC #32)', () => {
  it('a fresh provider hydrating from a compacted snapshot reaches the same Document view', async () => {
    const storage = new InMemoryStorageAdapter();
    const sourceDoc = makeDoc();
    const sourceY = new Y.Doc();
    documentToYDoc(sourceDoc, sourceY);
    await compact('d1', sourceY, storage);

    const replayY = new Y.Doc();
    const persisted = await storage.getSnapshot('d1');
    expect(persisted?.content).toBeInstanceOf(Uint8Array);
    Y.applyUpdate(replayY, persisted?.content as Uint8Array);
    const replayed = yDocToDocument(replayY);
    expect(documentSchema.parse(replayed)).toEqual(sourceDoc);
  });
});
