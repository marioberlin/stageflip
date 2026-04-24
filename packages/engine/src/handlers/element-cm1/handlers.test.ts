// packages/engine/src/handlers/element-cm1/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { type Operation, applyPatch } from 'fast-json-patch';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { ELEMENT_CM1_HANDLERS } from './handlers.js';

function collectingSink(): PatchSink & { drain(): JsonPatchOp[] } {
  const queue: JsonPatchOp[] = [];
  return {
    push(op) {
      queue.push(op);
    },
    pushAll(ops) {
      for (const op of ops) queue.push(op);
    },
    drain() {
      const out = queue.slice();
      queue.length = 0;
      return out;
    },
  };
}

function ctx(document: Document): MutationContext & {
  patchSink: ReturnType<typeof collectingSink>;
} {
  return { document, patchSink: collectingSink() };
}

function transform() {
  return { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 };
}

function doc(elements: unknown[]): Document {
  return {
    meta: {
      id: 'doc-1',
      version: 1,
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      schemaVersion: 1,
      locale: 'en',
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: {
      mode: 'slide',
      slides: [{ id: 'slide-1', elements } as never],
    },
  } as unknown as Document;
}

function textEl(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'text',
    text: 'Hello',
    align: 'left',
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
    ...overrides,
  };
}

function shapeEl(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
    ...overrides,
  };
}

function imageEl(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'image',
    src: 'asset:foo',
    fit: 'cover',
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
    ...overrides,
  };
}

function videoEl(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'video',
    src: 'asset:foo',
    muted: false,
    loop: false,
    playbackRate: 1,
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
    ...overrides,
  };
}

function audioEl(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'audio',
    src: 'asset:foo',
    loop: false,
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
    ...overrides,
  };
}

function codeEl(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'code',
    code: 'print(1)',
    language: 'python',
    showLineNumbers: false,
    wrap: false,
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
    ...overrides,
  };
}

function embedEl(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'embed',
    src: 'https://example.com',
    sandbox: ['allow-scripts'],
    allowFullscreen: false,
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
    ...overrides,
  };
}

function find(name: string) {
  const h = ELEMENT_CM1_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

function applyOps(d: Document, ops: JsonPatchOp[]): Document {
  return applyPatch(d, ops as Operation[], false, false).newDocument as Document;
}

// ---------------------------------------------------------------------------
// 1 — set_text_content
// ---------------------------------------------------------------------------

describe('set_text_content', () => {
  it('updates `text` with a replace op', async () => {
    const c = ctx(doc([textEl('t-1')]));
    const r = await find('set_text_content').handle(
      { slideId: 'slide-1', elementId: 't-1', text: 'Updated' },
      c,
    );
    expect(r).toMatchObject({ ok: true, updatedFields: ['text'] });
    expect(c.patchSink.drain()).toEqual([
      { op: 'replace', path: '/content/slides/0/elements/0/text', value: 'Updated' },
    ]);
  });

  it('adds `runs` via add op when absent, replaces when present', async () => {
    const c = ctx(doc([textEl('t-1')]));
    await find('set_text_content').handle(
      { slideId: 'slide-1', elementId: 't-1', runs: [{ text: 'a' }] },
      c,
    );
    expect(c.patchSink.drain()[0]?.op).toBe('add');

    const c2 = ctx(doc([textEl('t-1', { runs: [{ text: 'x' }] })]));
    await find('set_text_content').handle(
      { slideId: 'slide-1', elementId: 't-1', runs: [{ text: 'y' }] },
      c2,
    );
    expect(c2.patchSink.drain()[0]?.op).toBe('replace');
  });

  it('refuses wrong_element_type on non-text', async () => {
    const c = ctx(doc([shapeEl('s-1')]));
    expect(
      await find('set_text_content').handle({ slideId: 'slide-1', elementId: 's-1', text: 'x' }, c),
    ).toMatchObject({ ok: false, reason: 'wrong_element_type' });
  });
});

// ---------------------------------------------------------------------------
// 2 — append_text_run
// ---------------------------------------------------------------------------

describe('append_text_run', () => {
  it('creates the runs array when absent', async () => {
    const c = ctx(doc([textEl('t-1')]));
    const r = await find('append_text_run').handle(
      { slideId: 'slide-1', elementId: 't-1', run: { text: 'new' } },
      c,
    );
    expect(r).toMatchObject({ ok: true, position: 0, runCount: 1 });
    expect(c.patchSink.drain()).toEqual([
      { op: 'add', path: '/content/slides/0/elements/0/runs', value: [{ text: 'new' }] },
    ]);
  });

  it('appends with `-` path token when runs exist', async () => {
    const c = ctx(doc([textEl('t-1', { runs: [{ text: 'a' }, { text: 'b' }] })]));
    const r = await find('append_text_run').handle(
      { slideId: 'slide-1', elementId: 't-1', run: { text: 'c' } },
      c,
    );
    expect(r).toMatchObject({ ok: true, position: 2, runCount: 3 });
    expect(c.patchSink.drain()[0]?.path).toBe('/content/slides/0/elements/0/runs/-');
  });

  it('honors `position` for mid-array insert', async () => {
    const c = ctx(doc([textEl('t-1', { runs: [{ text: 'a' }, { text: 'b' }] })]));
    await find('append_text_run').handle(
      { slideId: 'slide-1', elementId: 't-1', run: { text: 'new' }, position: 1 },
      c,
    );
    expect(c.patchSink.drain()[0]?.path).toBe('/content/slides/0/elements/0/runs/1');
  });
});

// ---------------------------------------------------------------------------
// 3 — remove_text_run
// ---------------------------------------------------------------------------

describe('remove_text_run', () => {
  it('removes a run by index', async () => {
    const c = ctx(doc([textEl('t-1', { runs: [{ text: 'a' }, { text: 'b' }] })]));
    const r = await find('remove_text_run').handle(
      { slideId: 'slide-1', elementId: 't-1', index: 0 },
      c,
    );
    expect(r).toMatchObject({ ok: true, removedIndex: 0, runCount: 1 });
    expect(c.patchSink.drain()).toEqual([
      { op: 'remove', path: '/content/slides/0/elements/0/runs/0' },
    ]);
  });

  it('refuses run_not_found on out-of-range index', async () => {
    const c = ctx(doc([textEl('t-1', { runs: [{ text: 'a' }] })]));
    expect(
      await find('remove_text_run').handle({ slideId: 'slide-1', elementId: 't-1', index: 5 }, c),
    ).toMatchObject({ ok: false, reason: 'run_not_found' });
  });
});

// ---------------------------------------------------------------------------
// 4 — update_text_run_style
// ---------------------------------------------------------------------------

describe('update_text_run_style', () => {
  it('merges run fields with add vs replace based on existing state', async () => {
    const c = ctx(doc([textEl('t-1', { runs: [{ text: 'a', color: '#fff' }] })]));
    const r = await find('update_text_run_style').handle(
      {
        slideId: 'slide-1',
        elementId: 't-1',
        index: 0,
        style: { color: '#000', italic: true },
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, runIndex: 0, updatedFields: ['color', 'italic'] });
    expect(c.patchSink.drain()).toEqual([
      { op: 'replace', path: '/content/slides/0/elements/0/runs/0/color', value: '#000' },
      { op: 'add', path: '/content/slides/0/elements/0/runs/0/italic', value: true },
    ]);
  });

  it('refuses run_not_found when index is past end', async () => {
    const c = ctx(doc([textEl('t-1', { runs: [{ text: 'a' }] })]));
    expect(
      await find('update_text_run_style').handle(
        { slideId: 'slide-1', elementId: 't-1', index: 9, style: { italic: true } },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'run_not_found' });
  });
});

// ---------------------------------------------------------------------------
// 5 — update_text_style
// ---------------------------------------------------------------------------

describe('update_text_style', () => {
  it('patches multiple block fields in order', async () => {
    const c = ctx(doc([textEl('t-1', { fontSize: 16 })]));
    const r = await find('update_text_style').handle(
      {
        slideId: 'slide-1',
        elementId: 't-1',
        fontFamily: 'Inter',
        fontSize: 24,
        align: 'center',
      },
      c,
    );
    expect(r).toMatchObject({
      ok: true,
      updatedFields: ['fontFamily', 'fontSize', 'align'],
    });
    const patches = c.patchSink.drain();
    expect(patches.map((p) => p.op)).toEqual(['add', 'replace', 'replace']);
  });
});

// ---------------------------------------------------------------------------
// 6 — update_shape
// ---------------------------------------------------------------------------

describe('update_shape', () => {
  it('replaces shape + fill + cornerRadius', async () => {
    const c = ctx(doc([shapeEl('s-1', { fill: '#fff' })]));
    const r = await find('update_shape').handle(
      {
        slideId: 'slide-1',
        elementId: 's-1',
        shape: 'ellipse',
        fill: '#000',
        cornerRadius: 8,
      },
      c,
    );
    expect(r).toMatchObject({
      ok: true,
      updatedFields: ['shape', 'fill', 'cornerRadius'],
    });
    expect(c.patchSink.drain()).toHaveLength(3);
  });

  it('refuses wrong_element_type on text', async () => {
    const c = ctx(doc([textEl('t-1')]));
    expect(
      await find('update_shape').handle({ slideId: 'slide-1', elementId: 't-1', shape: 'rect' }, c),
    ).toMatchObject({ ok: false, reason: 'wrong_element_type' });
  });
});

// ---------------------------------------------------------------------------
// 7 — update_image
// ---------------------------------------------------------------------------

describe('update_image', () => {
  it('replaces src + fit', async () => {
    const c = ctx(doc([imageEl('i-1')]));
    await find('update_image').handle(
      { slideId: 'slide-1', elementId: 'i-1', src: 'asset:bar', fit: 'contain' },
      c,
    );
    const patches = c.patchSink.drain();
    expect(patches).toEqual([
      { op: 'replace', path: '/content/slides/0/elements/0/src', value: 'asset:bar' },
      { op: 'replace', path: '/content/slides/0/elements/0/fit', value: 'contain' },
    ]);
  });

  it('empty-string `alt` removes the field when present', async () => {
    const c = ctx(doc([imageEl('i-1', { alt: 'old' })]));
    const r = await find('update_image').handle(
      { slideId: 'slide-1', elementId: 'i-1', alt: '' },
      c,
    );
    expect(r).toMatchObject({ ok: true, updatedFields: ['alt'] });
    expect(c.patchSink.drain()).toEqual([
      { op: 'remove', path: '/content/slides/0/elements/0/alt' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 8 — update_video
// ---------------------------------------------------------------------------

describe('update_video', () => {
  it('patches trim + playbackRate', async () => {
    const c = ctx(doc([videoEl('v-1')]));
    const r = await find('update_video').handle(
      {
        slideId: 'slide-1',
        elementId: 'v-1',
        trim: { startMs: 0, endMs: 1000 },
        playbackRate: 1.5,
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, updatedFields: ['trim', 'playbackRate'] });
    const patches = c.patchSink.drain();
    expect(patches[0]?.path).toBe('/content/slides/0/elements/0/trim');
    expect(patches[1]?.path).toBe('/content/slides/0/elements/0/playbackRate');
  });
});

// ---------------------------------------------------------------------------
// 9 — update_audio
// ---------------------------------------------------------------------------

describe('update_audio', () => {
  it('creates mix object when absent', async () => {
    const c = ctx(doc([audioEl('a-1')]));
    const r = await find('update_audio').handle(
      { slideId: 'slide-1', elementId: 'a-1', mix: { gain: 0.8 } },
      c,
    );
    expect(r).toMatchObject({ ok: true, updatedFields: ['mix'] });
    expect(c.patchSink.drain()).toEqual([
      { op: 'add', path: '/content/slides/0/elements/0/mix', value: { gain: 0.8 } },
    ]);
  });

  it('merges into existing mix field-by-field', async () => {
    const c = ctx(doc([audioEl('a-1', { mix: { gain: 1, pan: 0 } })]));
    await find('update_audio').handle(
      { slideId: 'slide-1', elementId: 'a-1', mix: { pan: 0.5, fadeInMs: 200 } },
      c,
    );
    const patches = c.patchSink.drain();
    expect(patches).toEqual([
      { op: 'replace', path: '/content/slides/0/elements/0/mix/pan', value: 0.5 },
      { op: 'add', path: '/content/slides/0/elements/0/mix/fadeInMs', value: 200 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 10 — update_code
// ---------------------------------------------------------------------------

describe('update_code', () => {
  it('replaces code + language', async () => {
    const c = ctx(doc([codeEl('c-1')]));
    const r = await find('update_code').handle(
      { slideId: 'slide-1', elementId: 'c-1', code: 'let x = 1;', language: 'typescript' },
      c,
    );
    expect(r).toMatchObject({ ok: true, updatedFields: ['code', 'language'] });
    expect(c.patchSink.drain()).toHaveLength(2);
  });

  it('empty-string `theme` removes when present', async () => {
    const c = ctx(doc([codeEl('c-1', { theme: 'dark' })]));
    await find('update_code').handle({ slideId: 'slide-1', elementId: 'c-1', theme: '' }, c);
    expect(c.patchSink.drain()).toEqual([
      { op: 'remove', path: '/content/slides/0/elements/0/theme' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 11 — update_embed
// ---------------------------------------------------------------------------

describe('update_embed', () => {
  it('replaces src + sandbox wholesale', async () => {
    const c = ctx(doc([embedEl('e-1')]));
    const r = await find('update_embed').handle(
      {
        slideId: 'slide-1',
        elementId: 'e-1',
        src: 'https://b.test',
        sandbox: ['allow-scripts', 'allow-same-origin'],
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, updatedFields: ['src', 'sandbox'] });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      const el = next.content.slides[0]?.elements[0] as unknown as {
        src: string;
        sandbox: string[];
      };
      expect(el.src).toBe('https://b.test');
      expect(el.sandbox).toEqual(['allow-scripts', 'allow-same-origin']);
    }
  });
});

// ---------------------------------------------------------------------------
// 12 — set_element_flags
// ---------------------------------------------------------------------------

describe('set_element_flags', () => {
  it('replaces visible + locked on any element type', async () => {
    const c = ctx(doc([imageEl('i-1')]));
    const r = await find('set_element_flags').handle(
      { slideId: 'slide-1', elementId: 'i-1', visible: false, locked: true },
      c,
    );
    expect(r).toMatchObject({ ok: true, updatedFields: ['visible', 'locked'] });
    expect(c.patchSink.drain()).toEqual([
      { op: 'replace', path: '/content/slides/0/elements/0/visible', value: false },
      { op: 'replace', path: '/content/slides/0/elements/0/locked', value: true },
    ]);
  });

  it('empty-string name removes the field when set', async () => {
    const c = ctx(doc([imageEl('i-1', { name: 'Cover' })]));
    await find('set_element_flags').handle({ slideId: 'slide-1', elementId: 'i-1', name: '' }, c);
    expect(c.patchSink.drain()).toEqual([
      { op: 'remove', path: '/content/slides/0/elements/0/name' },
    ]);
  });

  it('returns element_not_found for unknown id', async () => {
    const c = ctx(doc([textEl('t-1')]));
    expect(
      await find('set_element_flags').handle(
        { slideId: 'slide-1', elementId: 'ghost', visible: false },
        c,
      ),
    ).toEqual({ ok: false, reason: 'element_not_found' });
  });
});
