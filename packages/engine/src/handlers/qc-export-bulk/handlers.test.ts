// packages/engine/src/handlers/qc-export-bulk/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { type Operation, applyPatch } from 'fast-json-patch';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { QC_EXPORT_BULK_HANDLERS } from './handlers.js';

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

function transform(x = 0, y = 0, w = 100, h = 100) {
  return { x, y, width: w, height: h, rotation: 0, opacity: 1 };
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

function doc(slides: Array<Record<string, unknown>>): Document {
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
      slides: slides.map(
        (s, i) =>
          ({
            id: (s.id as string) ?? `slide-${i + 1}`,
            elements: (s.elements as unknown[]) ?? [],
            ...s,
          }) as never,
      ),
    },
  } as unknown as Document;
}

function videoDoc(): Document {
  return {
    ...doc([]),
    content: { mode: 'video', tracks: [], durationMs: 1 } as never,
  } as Document;
}

function find(name: string) {
  const h = QC_EXPORT_BULK_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

function applyOps(d: Document, ops: JsonPatchOp[]): Document {
  return applyPatch(d, ops as Operation[], false, false).newDocument as Document;
}

// ---------------------------------------------------------------------------
// 1 — check_alt_text_coverage
// ---------------------------------------------------------------------------

describe('check_alt_text_coverage', () => {
  it('reports images without alt, skips decorative (empty-string) alt', async () => {
    const c = ctx(
      doc([
        {
          id: 'slide-1',
          elements: [
            imageEl('i-1'),
            imageEl('i-2', { alt: 'Logo' }),
            imageEl('i-3', { alt: '' }),
            shapeEl('s-1'),
          ],
        },
      ]),
    );
    const r = await find('check_alt_text_coverage').handle({}, c);
    expect(r).toMatchObject({
      ok: true,
      totalImages: 3,
      missingAlt: [{ slideId: 'slide-1', elementId: 'i-1' }],
    });
  });

  it('refuses wrong_mode outside slide mode', async () => {
    expect(await find('check_alt_text_coverage').handle({}, ctx(videoDoc()))).toEqual({
      ok: false,
      reason: 'wrong_mode',
    });
  });
});

// ---------------------------------------------------------------------------
// 2 — check_notes_coverage
// ---------------------------------------------------------------------------

describe('check_notes_coverage', () => {
  it('reports slides without notes', async () => {
    const c = ctx(
      doc([
        { id: 'slide-1', elements: [], notes: 'have notes' },
        { id: 'slide-2', elements: [] },
        { id: 'slide-3', elements: [], notes: '' },
      ]),
    );
    const r = await find('check_notes_coverage').handle({}, c);
    expect(r).toMatchObject({
      ok: true,
      totalSlides: 3,
      missingNotes: ['slide-2', 'slide-3'],
    });
  });
});

// ---------------------------------------------------------------------------
// 3 — check_element_outside_canvas
// ---------------------------------------------------------------------------

describe('check_element_outside_canvas', () => {
  it('reports direction tags for elements exceeding 1920×1080', async () => {
    const c = ctx(
      doc([
        {
          id: 'slide-1',
          elements: [
            shapeEl('inside', { transform: transform(0, 0, 100, 100) }),
            shapeEl('right-only', { transform: transform(1900, 0, 100, 100) }),
            shapeEl('multi', { transform: transform(-50, -50, 100, 100) }),
          ],
        },
      ]),
    );
    const r = (await find('check_element_outside_canvas').handle({}, c)) as {
      ok: true;
      outsideElements: Array<{
        elementId: string;
        direction: string[];
      }>;
    };
    expect(r.ok).toBe(true);
    expect(r.outsideElements.map((o) => o.elementId)).toEqual(['right-only', 'multi']);
    const multi = r.outsideElements.find((o) => o.elementId === 'multi');
    expect(multi?.direction).toEqual(['left', 'top']);
  });
});

// ---------------------------------------------------------------------------
// 4 — check_orphan_animations
// ---------------------------------------------------------------------------

describe('check_orphan_animations', () => {
  it('finds anchored animations referencing missing element ids', async () => {
    const c = ctx(
      doc([
        {
          id: 'slide-1',
          elements: [
            shapeEl('a'),
            shapeEl('b', {
              animations: [
                {
                  id: 'anim-1',
                  timing: {
                    kind: 'anchored',
                    anchor: 'ghost',
                    anchorEdge: 'start',
                    mySide: 'start',
                    offsetFrames: 0,
                    durationFrames: 10,
                  },
                  animation: { kind: 'fade' },
                  autoplay: true,
                },
              ],
            }),
          ],
        },
      ]),
    );
    const r = await find('check_orphan_animations').handle({}, c);
    expect(r).toMatchObject({
      ok: true,
      orphans: [
        {
          slideId: 'slide-1',
          elementId: 'b',
          animationId: 'anim-1',
          missingAnchor: 'ghost',
        },
      ],
    });
  });

  it('does not flag anchored animations with a valid anchor on the same slide', async () => {
    const c = ctx(
      doc([
        {
          id: 'slide-1',
          elements: [
            shapeEl('a'),
            shapeEl('b', {
              animations: [
                {
                  id: 'anim-1',
                  timing: {
                    kind: 'anchored',
                    anchor: 'a',
                    anchorEdge: 'start',
                    mySide: 'start',
                    offsetFrames: 0,
                    durationFrames: 10,
                  },
                  animation: { kind: 'fade' },
                  autoplay: true,
                },
              ],
            }),
          ],
        },
      ]),
    );
    const r = (await find('check_orphan_animations').handle({}, c)) as {
      ok: true;
      orphans: unknown[];
    };
    expect(r.orphans).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5 — bulk_set_slide_duration
// ---------------------------------------------------------------------------

describe('bulk_set_slide_duration', () => {
  it('applies durations across slides, picks add vs replace per slide', async () => {
    const c = ctx(
      doc([
        { id: 'slide-1', elements: [] },
        { id: 'slide-2', elements: [], durationMs: 1000 },
      ]),
    );
    const r = await find('bulk_set_slide_duration').handle(
      {
        assignments: [
          { slideId: 'slide-1', durationMs: 3000 },
          { slideId: 'slide-2', durationMs: 5000 },
        ],
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, applied: 2 });
    expect(c.patchSink.drain()).toEqual([
      { op: 'add', path: '/content/slides/0/durationMs', value: 3000 },
      { op: 'replace', path: '/content/slides/1/durationMs', value: 5000 },
    ]);
  });

  it('atomic: rejects slide_not_found with no patches emitted', async () => {
    const c = ctx(doc([{ id: 'slide-1', elements: [] }]));
    const r = await find('bulk_set_slide_duration').handle(
      {
        assignments: [
          { slideId: 'slide-1', durationMs: 1000 },
          { slideId: 'ghost', durationMs: 2000 },
        ],
      },
      c,
    );
    expect(r).toMatchObject({ ok: false, reason: 'slide_not_found' });
    expect(c.patchSink.drain()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6 — bulk_set_element_flags
// ---------------------------------------------------------------------------

describe('bulk_set_element_flags', () => {
  it('flips visible / locked across elements + slides, reports patchCount', async () => {
    const c = ctx(
      doc([
        { id: 'slide-1', elements: [shapeEl('a'), shapeEl('b')] },
        { id: 'slide-2', elements: [shapeEl('c')] },
      ]),
    );
    const r = await find('bulk_set_element_flags').handle(
      {
        assignments: [
          { slideId: 'slide-1', elementId: 'a', visible: false, locked: true },
          { slideId: 'slide-2', elementId: 'c', locked: true },
        ],
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, applied: 2, patchCount: 3 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(3);
  });

  it('refuses element_not_found atomically', async () => {
    const c = ctx(doc([{ id: 'slide-1', elements: [shapeEl('a')] }]));
    const r = await find('bulk_set_element_flags').handle(
      {
        assignments: [
          { slideId: 'slide-1', elementId: 'a', visible: false },
          { slideId: 'slide-1', elementId: 'ghost', visible: true },
        ],
      },
      c,
    );
    expect(r).toMatchObject({ ok: false, reason: 'element_not_found' });
    expect(c.patchSink.drain()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7 — bulk_delete_elements
// ---------------------------------------------------------------------------

describe('bulk_delete_elements', () => {
  it('emits patches in reverse index order per slide', async () => {
    const c = ctx(
      doc([
        {
          id: 'slide-1',
          elements: [textEl('a'), textEl('b'), textEl('c'), textEl('d')],
        },
      ]),
    );
    const r = await find('bulk_delete_elements').handle(
      {
        assignments: [
          { slideId: 'slide-1', elementId: 'a' },
          { slideId: 'slide-1', elementId: 'c' },
        ],
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, deleted: 2 });
    const patches = c.patchSink.drain();
    expect(patches.map((p) => p.path)).toEqual([
      '/content/slides/0/elements/2',
      '/content/slides/0/elements/0',
    ]);
    const next = applyOps(c.document, patches);
    if (next.content.mode === 'slide') {
      const ids = next.content.slides[0]?.elements.map((e) => e.id);
      expect(ids).toEqual(['b', 'd']);
    }
  });
});

// ---------------------------------------------------------------------------
// 8 — list_export_profiles
// ---------------------------------------------------------------------------

describe('list_export_profiles', () => {
  it('returns the static profile catalog', async () => {
    const c = ctx(doc([{ id: 'slide-1', elements: [] }]));
    const r = (await find('list_export_profiles').handle({}, c)) as {
      ok: true;
      profiles: Array<{ name: string; animationsSupported: boolean }>;
    };
    expect(r.ok).toBe(true);
    expect(r.profiles.map((p) => p.name)).toEqual(['pdf', 'pptx', 'marp', 'html5-zip', 'video']);
    const pdf = r.profiles.find((p) => p.name === 'pdf');
    expect(pdf?.animationsSupported).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9 — freeze_animations_for_static_export
// ---------------------------------------------------------------------------

describe('freeze_animations_for_static_export', () => {
  it('clears animations on every element with animations', async () => {
    const c = ctx(
      doc([
        {
          id: 'slide-1',
          elements: [
            shapeEl('a', {
              animations: [
                {
                  id: 'anim-1',
                  timing: { kind: 'absolute', startFrame: 0, durationFrames: 10 },
                  animation: { kind: 'fade' },
                  autoplay: true,
                },
              ],
            }),
            shapeEl('b'),
          ],
        },
        {
          id: 'slide-2',
          elements: [
            shapeEl('c', {
              animations: [
                {
                  id: 'anim-2',
                  timing: { kind: 'absolute', startFrame: 0, durationFrames: 10 },
                  animation: { kind: 'fade' },
                  autoplay: true,
                },
                {
                  id: 'anim-3',
                  timing: { kind: 'absolute', startFrame: 0, durationFrames: 10 },
                  animation: { kind: 'fade' },
                  autoplay: true,
                },
              ],
            }),
          ],
        },
      ]),
    );
    const r = await find('freeze_animations_for_static_export').handle({}, c);
    expect(r).toMatchObject({ ok: true, slidesTouched: 2, animationsCleared: 3 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(2);
    for (const p of patches) {
      expect(p.op).toBe('replace');
      expect(p.value).toEqual([]);
    }
  });

  it('noop (no patches) when no animations exist', async () => {
    const c = ctx(doc([{ id: 'slide-1', elements: [shapeEl('a')] }]));
    const r = await find('freeze_animations_for_static_export').handle({}, c);
    expect(r).toMatchObject({ ok: true, slidesTouched: 0, animationsCleared: 0 });
    expect(c.patchSink.drain()).toEqual([]);
  });
});
