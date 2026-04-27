// packages/collab/src/client.test.ts
// CollabClient tests per T-260 ACs #18–#21.

import { type Document, type Slide, documentSchema } from '@stageflip/schema';
import { InMemoryStorageAdapter } from '@stageflip/storage';
import { afterEach, describe, expect, it } from 'vitest';
import { CollabClient } from './client.js';

const nowISO = (): string => '2026-04-27T00:00:00.000Z';

const baseTransform = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
} as const;

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
      mode: 'slide' as const,
      slides: [
        {
          id: 's1',
          elements: [],
        },
      ],
    },
  });

const makeSlide = (id: string): Slide => ({
  id,
  elements: [],
});

const makeStorageWithDoc = async (doc: Document, version = 1) => {
  const storage = new InMemoryStorageAdapter();
  await storage.putSnapshot('d1', {
    docId: 'd1',
    version,
    content: doc,
    updatedAt: nowISO(),
  });
  return storage;
};

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

describe('CollabClient — construction + hydrate (AC #18)', () => {
  it('hydrate resolves once provider is synced', async () => {
    const storage = await makeStorageWithDoc(makeDoc());
    const client = new CollabClient({ docId: 'd1', storage, actor: 'u1' });
    await client.hydrate();
    expect(client.provider.status).toBe('synced');
    client.dispose();
  });
});

describe('CollabClient — document view (AC #19)', () => {
  it('returns the same Document by reference if no mutations occurred', async () => {
    const storage = await makeStorageWithDoc(makeDoc());
    const client = new CollabClient({ docId: 'd1', storage, actor: 'u1' });
    await client.hydrate();
    const a = client.document;
    const b = client.document;
    expect(a).toBe(b);
    client.dispose();
  });

  it('returns a new Document object after a mutation', async () => {
    const storage = await makeStorageWithDoc(makeDoc());
    const client = new CollabClient({ docId: 'd1', storage, actor: 'u1' });
    await client.hydrate();
    const a = client.document;
    await client.command('addSlide', { slide: makeSlide('s2') });
    const b = client.document;
    expect(b).not.toBe(a);
    client.dispose();
  });
});

describe('CollabClient — command(name, args) (AC #20)', () => {
  it('throws on unknown command name', async () => {
    const storage = await makeStorageWithDoc(makeDoc());
    const client = new CollabClient({ docId: 'd1', storage, actor: 'u1' });
    await client.hydrate();
    await expect(
      // @ts-expect-error — runtime test of unknown name
      client.command('nope', {}),
    ).rejects.toThrow(/unknown command/);
    client.dispose();
  });

  it('runs a registered command', async () => {
    const storage = await makeStorageWithDoc(makeDoc());
    const client = new CollabClient({ docId: 'd1', storage, actor: 'u1' });
    await client.hydrate();
    await client.command('addSlide', { slide: makeSlide('s2') });
    const doc = client.document;
    expect(doc.content.mode === 'slide' ? doc.content.slides.length : 0).toBe(2);
    client.dispose();
  });
});

describe('CollabClient — dispose (AC #21)', () => {
  it('clears the in-memory Y.Doc and is idempotent', async () => {
    const storage = await makeStorageWithDoc(makeDoc());
    const client = new CollabClient({ docId: 'd1', storage, actor: 'u1' });
    await client.hydrate();
    client.dispose();
    client.dispose();
    await expect(client.command('addSlide', { slide: makeSlide('s2') })).rejects.toThrow(
      /disposed/,
    );
  });
});

afterEach(async () => {
  // Real-timer let-everything-settle.
  await tick(0);
});
