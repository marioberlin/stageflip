// packages/collab/src/commands/commands.test.ts
// Command tests per T-260 ACs #22–#29. Each command must emit BOTH a Y.Doc
// transaction AND a ChangeSet (through applyPatch), with the actor and
// parentVersion set correctly.

import { type Document, type Slide, type TextElement, documentSchema } from '@stageflip/schema';
import { type ChangeSet, InMemoryStorageAdapter } from '@stageflip/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { getSlideMap, getSlidesArray } from '../binding.js';
import { setChangeSetIdProvider, setChangeSetNowProvider } from '../changeset.js';
import { CollabClient } from '../client.js';

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
          elements: [
            {
              id: 'e1',
              type: 'text' as const,
              transform: { ...baseTransform },
              visible: true,
              locked: false,
              animations: [],
              text: 'Hello',
              align: 'left' as const,
            },
          ],
        },
      ],
    },
  });

const slide = (id: string): Slide => ({ id, elements: [] });
const textEl = (id: string, text: string): TextElement => ({
  id,
  type: 'text',
  transform: { ...baseTransform },
  visible: true,
  locked: false,
  animations: [],
  text,
  align: 'left',
});

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

async function makeClient(opts?: {
  changeSetDebounceMs?: number;
  snapshotVersion?: number;
}): Promise<{ client: CollabClient; storage: InMemoryStorageAdapter; emitted: ChangeSet[] }> {
  const storage = new InMemoryStorageAdapter();
  await storage.putSnapshot('d1', {
    docId: 'd1',
    version: opts?.snapshotVersion ?? 1,
    content: makeDoc(),
    updatedAt: nowISO(),
  });
  const emitted: ChangeSet[] = [];
  const orig = storage.applyPatch.bind(storage);
  storage.applyPatch = async (id: string, patch: ChangeSet) => {
    emitted.push(patch);
    // Patch with parentVersion mismatch is fine for these tests; we are
    // pinning command emissions, not the storage version logic.
    if (patch.parentVersion !== undefined) {
      try {
        await orig(id, patch);
      } catch {
        // Ignore version-mismatch errors — these tests only care about emit.
      }
    }
  };
  const ydoc = new Y.Doc();
  const client = new CollabClient({
    docId: 'd1',
    storage,
    actor: 'u1',
    ydoc,
    changeSetDebounceMs: opts?.changeSetDebounceMs ?? 250,
  });
  await client.hydrate();
  return { client, storage, emitted };
}

describe('addSlide (AC #22)', () => {
  it('emits one Y.Doc transaction + one ChangeSet add at /content/slides/-', async () => {
    const { client, emitted } = await makeClient();
    await client.command('addSlide', { slide: slide('s2') });
    const slidesArr = getSlidesArray(client.ydoc);
    expect(slidesArr?.length).toBe(2);
    const cs = emitted.at(-1);
    expect(cs).toBeDefined();
    expect(cs?.ops).toHaveLength(1);
    expect(cs?.ops[0]?.op).toBe('add');
    expect(cs?.ops[0]?.path).toBe('/content/slides/-');
    expect(cs?.actor).toBe('u1');
    client.dispose();
  });
});

describe('removeSlide (AC #23)', () => {
  it('emits one Y.Doc transaction + ChangeSet remove at /content/slides/<idx>', async () => {
    const { client, emitted } = await makeClient();
    await client.command('addSlide', { slide: slide('s2') });
    await client.command('removeSlide', { slideId: 's1' });
    const slidesArr = getSlidesArray(client.ydoc);
    expect(slidesArr?.length).toBe(1);
    expect(slidesArr?.get(0).get('id')).toBe('s2');
    const cs = emitted.at(-1);
    expect(cs?.ops[0]?.op).toBe('remove');
    expect(cs?.ops[0]?.path).toBe('/content/slides/0');
    client.dispose();
  });
});

describe('reorderSlides (AC #24)', () => {
  it('emits one move op', async () => {
    const { client, emitted } = await makeClient();
    await client.command('addSlide', { slide: slide('s2') });
    await client.command('addSlide', { slide: slide('s3') });
    await client.command('reorderSlides', { fromIdx: 0, toIdx: 2 });
    const slidesArr = getSlidesArray(client.ydoc);
    const ids = slidesArr?.toArray().map((s) => s.get('id'));
    expect(ids).toEqual(['s2', 's3', 's1']);
    const cs = emitted.at(-1);
    expect(cs?.ops[0]?.op).toBe('move');
    expect(cs?.ops[0]?.from).toBe('/content/slides/0');
    expect(cs?.ops[0]?.path).toBe('/content/slides/2');
    client.dispose();
  });
});

describe('addElement / removeElement / updateElementTransform (AC #25)', () => {
  it('addElement emits add at /content/slides/0/elements/-', async () => {
    const { client, emitted } = await makeClient();
    await client.command('addElement', {
      slideId: 's1',
      element: textEl('e2', 'world'),
    });
    const slideMap = getSlideMap(client.ydoc, 's1');
    if (!slideMap) throw new Error('expected slide s1');
    const elements = slideMap.get('elements') as Y.Array<unknown>;
    expect(elements.length).toBe(2);
    const cs = emitted.at(-1);
    expect(cs?.ops[0]).toMatchObject({ op: 'add', path: '/content/slides/0/elements/-' });
    client.dispose();
  });

  it('removeElement emits remove at the located index', async () => {
    const { client, emitted } = await makeClient();
    await client.command('removeElement', { slideId: 's1', elementId: 'e1' });
    const cs = emitted.at(-1);
    expect(cs?.ops[0]).toMatchObject({ op: 'remove', path: '/content/slides/0/elements/0' });
    client.dispose();
  });

  it('updateElementTransform emits replace at .../transform', async () => {
    const { client, emitted } = await makeClient();
    const newTransform = { ...baseTransform, x: 50, y: 80 };
    await client.command('updateElementTransform', {
      slideId: 's1',
      elementId: 'e1',
      transform: newTransform,
    });
    const cs = emitted.at(-1);
    expect(cs?.ops[0]).toMatchObject({
      op: 'replace',
      path: '/content/slides/0/elements/0/transform',
    });
    expect(cs?.ops[0]?.value).toMatchObject({ x: 50, y: 80 });
    client.dispose();
  });
});

describe('setTextRun (AC #26 — minimal Y.Text edits)', () => {
  it('single-char insertion in middle of long run produces one Y.Text.insert, no deletes', async () => {
    const { client } = await makeClient();
    // Replace e1.text with a 1000-char run.
    const long = 'a'.repeat(500) + 'b'.repeat(500);
    await client.command('setTextRun', { slideId: 's1', elementId: 'e1', text: long });
    await tick(20);
    const slideMap = getSlideMap(client.ydoc, 's1');
    if (!slideMap) throw new Error('expected slide s1');
    const el = (slideMap.get('elements') as Y.Array<Y.Map<unknown>>).get(0);
    const yText = el.get('text') as Y.Text;
    // Spy on insert/delete.
    const insertSpy = vi.spyOn(yText, 'insert');
    const deleteSpy = vi.spyOn(yText, 'delete');
    const next = `${'a'.repeat(500)}X${'b'.repeat(500)}`;
    await client.command('setTextRun', { slideId: 's1', elementId: 'e1', text: next });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledTimes(0);
    client.dispose();
  });
});

describe('setTextRun ChangeSet debounce (AC #27)', () => {
  it('rapid setTextRun calls collapse into a single ChangeSet with the final text', async () => {
    // Build under real timers; switch to fake AFTER hydrate completes.
    const { client, emitted } = await makeClient({ changeSetDebounceMs: 250 });
    vi.useFakeTimers();
    try {
      const baselineCount = emitted.length;
      await client.command('setTextRun', { slideId: 's1', elementId: 'e1', text: 'a' });
      await client.command('setTextRun', { slideId: 's1', elementId: 'e1', text: 'ab' });
      await client.command('setTextRun', { slideId: 's1', elementId: 'e1', text: 'abc' });
      // Within debounce window — no new ChangeSet emitted.
      vi.advanceTimersByTime(50);
      await Promise.resolve();
      expect(emitted.length).toBe(baselineCount);
      // After window — exactly one new ChangeSet with the final text.
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
      expect(emitted.length).toBe(baselineCount + 1);
      const cs = emitted.at(-1);
      expect(cs?.ops[0]).toMatchObject({
        op: 'replace',
        path: '/content/slides/0/elements/0/text',
        value: 'abc',
      });
    } finally {
      vi.useRealTimers();
      client.dispose();
    }
  });
});

describe('setSlideTitle / setSlideNotes', () => {
  it('setSlideTitle emits replace at /content/slides/<idx>/title', async () => {
    const { client, emitted } = await makeClient();
    await client.command('setSlideTitle', { slideId: 's1', title: 'New Title' });
    const cs = emitted.at(-1);
    expect(cs?.ops[0]).toMatchObject({
      op: 'replace',
      path: '/content/slides/0/title',
      value: 'New Title',
    });
    client.dispose();
  });

  it('setSlideNotes uses Y.Text diffing and emits a debounced ChangeSet', async () => {
    const { client, emitted } = await makeClient({ changeSetDebounceMs: 50 });
    await client.command('setSlideNotes', { slideId: 's1', notes: 'first' });
    await tick(80);
    const cs = emitted.at(-1);
    expect(cs?.ops[0]).toMatchObject({
      op: 'replace',
      path: '/content/slides/0/notes',
      value: 'first',
    });
    client.dispose();
  });
});

describe('reorderSlides edge cases', () => {
  it('returns early when fromIdx === toIdx', async () => {
    const { client, emitted } = await makeClient();
    const before = emitted.length;
    await client.command('reorderSlides', { fromIdx: 0, toIdx: 0 });
    expect(emitted.length).toBe(before);
    client.dispose();
  });

  it('throws on out-of-range indices', async () => {
    const { client } = await makeClient();
    await expect(client.command('reorderSlides', { fromIdx: 5, toIdx: 0 })).rejects.toThrow(
      /out of range/,
    );
    await expect(client.command('reorderSlides', { fromIdx: 0, toIdx: 5 })).rejects.toThrow(
      /out of range/,
    );
    client.dispose();
  });
});

describe('removeSlide / removeElement / setTextRun error paths', () => {
  it('removeSlide throws when slide id missing', async () => {
    const { client } = await makeClient();
    await expect(client.command('removeSlide', { slideId: 'missing' })).rejects.toThrow(
      /not found/,
    );
    client.dispose();
  });

  it('setTextRun throws on non-text element', async () => {
    const { client } = await makeClient();
    await client.command('addElement', {
      slideId: 's1',
      element: {
        id: 'shape1',
        type: 'shape',
        transform: { ...baseTransform },
        visible: true,
        locked: false,
        animations: [],
        shape: 'rect',
        fill: '#000000',
      },
    });
    await expect(
      client.command('setTextRun', { slideId: 's1', elementId: 'shape1', text: 'hi' }),
    ).rejects.toThrow(/not a text element/);
    client.dispose();
  });
});

describe('actor + parentVersion (AC #28, #29)', () => {
  it('every ChangeSet carries the constructor actor', async () => {
    const { client, emitted } = await makeClient();
    await client.command('addSlide', { slide: slide('s2') });
    await client.command('removeSlide', { slideId: 's1' });
    expect(emitted.every((cs) => cs.actor === 'u1')).toBe(true);
    client.dispose();
  });

  it('parentVersion uses the most recent observed snapshot version', async () => {
    const { client, emitted } = await makeClient({ snapshotVersion: 7 });
    await client.command('addSlide', { slide: slide('s2') });
    expect(emitted.at(-1)?.parentVersion).toBe(7);
    client.dispose();
  });

  it('parentVersion is 0 when no snapshot has loaded', async () => {
    const storage = new InMemoryStorageAdapter();
    const emitted: ChangeSet[] = [];
    storage.applyPatch = async (_id, patch) => {
      emitted.push(patch);
    };
    const ydoc = new Y.Doc();
    // Seed the Y.Doc with a doc directly so addSlide has a slide-mode content.
    const doc = makeDoc();
    const { documentToYDoc } = await import('../binding.js');
    documentToYDoc(doc, ydoc);
    const client = new CollabClient({ docId: 'd1', storage, actor: 'u1', ydoc });
    await tick(20);
    await client.command('addSlide', { slide: slide('s2') });
    expect(emitted.at(-1)?.parentVersion).toBe(0);
    client.dispose();
  });
});

beforeEach(() => {
  setChangeSetIdProvider(() => 'cs-test');
  setChangeSetNowProvider(() => '2026-04-27T00:00:00.000Z');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await tick(0);
});
