// packages/engine/src/handlers/clip-animation/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { type Operation, applyPatch } from 'fast-json-patch';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { CLIP_ANIMATION_HANDLERS } from './handlers.js';

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

function baseDoc(elements: unknown[] = []): Document {
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

function videoDoc(): Document {
  return {
    ...baseDoc(),
    content: { mode: 'video', tracks: [], durationMs: 1 } as never,
  } as Document;
}

function clipEl(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'clip',
    runtime: 'css',
    clipName: 'fade-title',
    params: {},
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
    ...extra,
  };
}

function shapeEl(id: string, animations: unknown[] = []) {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    fill: { kind: 'solid', color: '#000000' },
    stroke: { kind: 'solid', color: '#000000', width: 1 },
    visible: true,
    locked: false,
    animations,
    transform: transform(),
  };
}

function fadeAnim(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    timing: { kind: 'absolute', startFrame: 0, durationFrames: 30 },
    animation: { kind: 'fade', from: 0, to: 1, easing: 'ease-out', ...overrides },
    autoplay: true,
  };
}

function keyframedAnim(id: string, keyframes: unknown[]) {
  return {
    id,
    timing: { kind: 'absolute', startFrame: 0, durationFrames: 30 },
    animation: { kind: 'keyframed', property: 'opacity', keyframes },
    autoplay: true,
  };
}

function find(name: string) {
  const h = CLIP_ANIMATION_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

function applyOps(doc: Document, ops: JsonPatchOp[]): Document {
  return applyPatch(doc, ops as Operation[], false, false).newDocument as Document;
}

// ---------------------------------------------------------------------------
// 1 — add_clip_element
// ---------------------------------------------------------------------------

describe('add_clip_element', () => {
  it('appends a clip element with auto-generated id + defaults', async () => {
    const c = ctx(baseDoc());
    const result = await find('add_clip_element').handle(
      { slideId: 'slide-1', runtime: 'css', clipName: 'fade-title' },
      c,
    );
    expect(result).toMatchObject({ ok: true, elementId: 'clip-1', position: 0 });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      const el = next.content.slides[0]?.elements[0] as unknown as Record<string, unknown>;
      expect(el).toMatchObject({
        id: 'clip-1',
        type: 'clip',
        runtime: 'css',
        clipName: 'fade-title',
        params: {},
        visible: true,
        locked: false,
        animations: [],
      });
    }
  });

  it('returns wrong_mode outside slide mode', async () => {
    const c = ctx(videoDoc());
    expect(
      await find('add_clip_element').handle(
        { slideId: 'slide-1', runtime: 'css', clipName: 'x' },
        c,
      ),
    ).toEqual({ ok: false, reason: 'wrong_mode' });
  });

  it('returns slide_not_found for unknown slide id', async () => {
    const c = ctx(baseDoc());
    expect(
      await find('add_clip_element').handle({ slideId: 'ghost', runtime: 'css', clipName: 'x' }, c),
    ).toEqual({ ok: false, reason: 'slide_not_found' });
  });
});

// ---------------------------------------------------------------------------
// 2 — update_clip_element
// ---------------------------------------------------------------------------

describe('update_clip_element', () => {
  it('patches runtime / clipName / params wholesale', async () => {
    const c = ctx(baseDoc([clipEl('clip-1', { params: { speed: 1 } })]));
    const result = await find('update_clip_element').handle(
      {
        slideId: 'slide-1',
        elementId: 'clip-1',
        runtime: 'gsap',
        clipName: 'magnet',
        params: { direction: 'up' },
      },
      c,
    );
    expect(result).toMatchObject({
      ok: true,
      updatedFields: ['runtime', 'clipName', 'params'],
    });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(3);
    expect(patches.map((p) => p.path)).toEqual([
      '/content/slides/0/elements/0/runtime',
      '/content/slides/0/elements/0/clipName',
      '/content/slides/0/elements/0/params',
    ]);
  });

  it('refuses with not_a_clip when the target is not a clip element', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1')]));
    expect(
      await find('update_clip_element').handle(
        { slideId: 'slide-1', elementId: 'sh-1', runtime: 'css' },
        c,
      ),
    ).toEqual({ ok: false, reason: 'not_a_clip' });
  });

  it('returns element_not_found for unknown element', async () => {
    const c = ctx(baseDoc([clipEl('clip-1')]));
    expect(
      await find('update_clip_element').handle(
        { slideId: 'slide-1', elementId: 'ghost', runtime: 'css' },
        c,
      ),
    ).toEqual({ ok: false, reason: 'element_not_found' });
  });
});

// ---------------------------------------------------------------------------
// 3 — set_clip_params
// ---------------------------------------------------------------------------

describe('set_clip_params', () => {
  it('merges new keys as add ops and replaces existing keys', async () => {
    const c = ctx(baseDoc([clipEl('clip-1', { params: { speed: 1, color: '#fff' } })]));
    const result = await find('set_clip_params').handle(
      {
        slideId: 'slide-1',
        elementId: 'clip-1',
        merge: { speed: 2, easing: 'linear' },
      },
      c,
    );
    expect(result).toMatchObject({
      ok: true,
      mergedKeys: ['speed', 'easing'],
      removedKeys: [],
    });
    const patches = c.patchSink.drain();
    expect(patches).toEqual([
      { op: 'replace', path: '/content/slides/0/elements/0/params/speed', value: 2 },
      { op: 'add', path: '/content/slides/0/elements/0/params/easing', value: 'linear' },
    ]);
  });

  it('removes only keys present on the element', async () => {
    const c = ctx(baseDoc([clipEl('clip-1', { params: { speed: 1 } })]));
    const result = await find('set_clip_params').handle(
      { slideId: 'slide-1', elementId: 'clip-1', remove: ['speed', 'missing'] },
      c,
    );
    expect(result).toMatchObject({ ok: true, mergedKeys: [], removedKeys: ['speed'] });
    expect(c.patchSink.drain()).toEqual([
      { op: 'remove', path: '/content/slides/0/elements/0/params/speed' },
    ]);
  });

  it('encodes JSON-Pointer special characters in param keys', async () => {
    const c = ctx(baseDoc([clipEl('clip-1', { params: { 'a/b': 1 } })]));
    await find('set_clip_params').handle(
      { slideId: 'slide-1', elementId: 'clip-1', merge: { 'a/b': 2 } },
      c,
    );
    expect(c.patchSink.drain()[0]?.path).toBe('/content/slides/0/elements/0/params/a~1b');
  });

  it('refuses with not_a_clip for non-clip elements', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1')]));
    expect(
      await find('set_clip_params').handle(
        { slideId: 'slide-1', elementId: 'sh-1', merge: { x: 1 } },
        c,
      ),
    ).toEqual({ ok: false, reason: 'not_a_clip' });
  });
});

// ---------------------------------------------------------------------------
// 4 — add_animation
// ---------------------------------------------------------------------------

describe('add_animation', () => {
  it('appends an animation with auto-generated id', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1')]));
    const result = await find('add_animation').handle(
      {
        slideId: 'slide-1',
        elementId: 'sh-1',
        animation: { kind: 'fade', from: 0, to: 1 },
        timing: { kind: 'absolute', startFrame: 0, durationFrames: 30 },
      },
      c,
    );
    expect(result).toMatchObject({ ok: true, animationId: 'anim-1', position: 0 });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      const el = next.content.slides[0]?.elements[0] as unknown as {
        animations: Array<{ id: string; autoplay: boolean }>;
      };
      expect(el.animations).toHaveLength(1);
      expect(el.animations[0]?.id).toBe('anim-1');
      expect(el.animations[0]?.autoplay).toBe(true);
    }
  });

  it('reassigns id on collision with existing animation', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1')])]));
    const result = await find('add_animation').handle(
      {
        slideId: 'slide-1',
        elementId: 'sh-1',
        animation: { kind: 'fade' },
        timing: { kind: 'absolute', startFrame: 0, durationFrames: 30 },
        id: 'anim-1',
      },
      c,
    );
    expect(result).toMatchObject({ ok: true, animationId: 'anim-2' });
  });

  it('returns element_not_found for unknown element id', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1')]));
    expect(
      await find('add_animation').handle(
        {
          slideId: 'slide-1',
          elementId: 'ghost',
          animation: { kind: 'fade' },
          timing: { kind: 'absolute', startFrame: 0, durationFrames: 30 },
        },
        c,
      ),
    ).toEqual({ ok: false, reason: 'element_not_found' });
  });
});

// ---------------------------------------------------------------------------
// 5 — remove_animation
// ---------------------------------------------------------------------------

describe('remove_animation', () => {
  it('removes the targeted animation and reports remaining count', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1'), fadeAnim('anim-2')])]));
    const result = await find('remove_animation').handle(
      { slideId: 'slide-1', elementId: 'sh-1', animationId: 'anim-1' },
      c,
    );
    expect(result).toMatchObject({ ok: true, remainingCount: 1 });
    expect(c.patchSink.drain()).toEqual([
      { op: 'remove', path: '/content/slides/0/elements/0/animations/0' },
    ]);
  });

  it('returns animation_not_found for missing id', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1')])]));
    expect(
      await find('remove_animation').handle(
        { slideId: 'slide-1', elementId: 'sh-1', animationId: 'ghost' },
        c,
      ),
    ).toEqual({ ok: false, reason: 'animation_not_found' });
  });
});

// ---------------------------------------------------------------------------
// 6 — clear_animations
// ---------------------------------------------------------------------------

describe('clear_animations', () => {
  it('replaces animations with [] and reports prior count', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1'), fadeAnim('anim-2')])]));
    const result = await find('clear_animations').handle(
      { slideId: 'slide-1', elementId: 'sh-1' },
      c,
    );
    expect(result).toMatchObject({ ok: true, cleared: 2 });
    expect(c.patchSink.drain()).toEqual([
      { op: 'replace', path: '/content/slides/0/elements/0/animations', value: [] },
    ]);
  });

  it('emits a replace op even when the list was already empty', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1')]));
    const result = await find('clear_animations').handle(
      { slideId: 'slide-1', elementId: 'sh-1' },
      c,
    );
    expect(result).toMatchObject({ ok: true, cleared: 0 });
    expect(c.patchSink.drain()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 7 — replace_animation
// ---------------------------------------------------------------------------

describe('replace_animation', () => {
  it('wholesale-replaces an animation (kind change allowed)', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1')])]));
    const replacement = {
      id: 'anim-1',
      timing: { kind: 'relative', offsetFrames: 10, durationFrames: 30 },
      animation: {
        kind: 'keyframed',
        property: 'opacity',
        keyframes: [
          { at: 0, value: 0 },
          { at: 1, value: 1 },
        ],
      },
      autoplay: false,
    };
    const result = await find('replace_animation').handle(
      {
        slideId: 'slide-1',
        elementId: 'sh-1',
        animationId: 'anim-1',
        animation: replacement,
      },
      c,
    );
    expect(result).toMatchObject({ ok: true, animationId: 'anim-1' });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(1);
    expect(patches[0]?.path).toBe('/content/slides/0/elements/0/animations/0');
  });

  it('refuses with mismatched_ids when animation.id ≠ animationId', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1')])]));
    const result = await find('replace_animation').handle(
      {
        slideId: 'slide-1',
        elementId: 'sh-1',
        animationId: 'anim-1',
        animation: fadeAnim('anim-99'),
      },
      c,
    );
    expect(result).toMatchObject({ ok: false, reason: 'mismatched_ids' });
  });
});

// ---------------------------------------------------------------------------
// 8 — reorder_animations
// ---------------------------------------------------------------------------

describe('reorder_animations', () => {
  it('replaces the animation array in the given order', async () => {
    const c = ctx(
      baseDoc([shapeEl('sh-1', [fadeAnim('anim-1'), fadeAnim('anim-2'), fadeAnim('anim-3')])]),
    );
    const result = await find('reorder_animations').handle(
      {
        slideId: 'slide-1',
        elementId: 'sh-1',
        order: ['anim-3', 'anim-1', 'anim-2'],
      },
      c,
    );
    expect(result).toMatchObject({ ok: true, applied: 3 });
    const next = applyOps(c.document, c.patchSink.drain());
    if (next.content.mode === 'slide') {
      const el = next.content.slides[0]?.elements[0] as unknown as {
        animations: Array<{ id: string }>;
      };
      expect(el.animations.map((a) => a.id)).toEqual(['anim-3', 'anim-1', 'anim-2']);
    }
  });

  it('refuses mismatched_count when order is the wrong length', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1'), fadeAnim('anim-2')])]));
    expect(
      await find('reorder_animations').handle(
        { slideId: 'slide-1', elementId: 'sh-1', order: ['anim-1'] },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'mismatched_count' });
  });

  it('refuses mismatched_ids when order contains an unknown id', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1'), fadeAnim('anim-2')])]));
    expect(
      await find('reorder_animations').handle(
        { slideId: 'slide-1', elementId: 'sh-1', order: ['anim-1', 'ghost'] },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'mismatched_ids' });
  });
});

// ---------------------------------------------------------------------------
// 9 — set_animation_timing
// ---------------------------------------------------------------------------

describe('set_animation_timing', () => {
  it('replaces the timing primitive and reports its kind', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1')])]));
    const result = await find('set_animation_timing').handle(
      {
        slideId: 'slide-1',
        elementId: 'sh-1',
        animationId: 'anim-1',
        timing: { kind: 'beat', beat: 4, subdivision: 'quarter', durationBeats: 2 },
      },
      c,
    );
    expect(result).toMatchObject({ ok: true, kind: 'beat' });
    expect(c.patchSink.drain()[0]?.path).toBe('/content/slides/0/elements/0/animations/0/timing');
  });
});

// ---------------------------------------------------------------------------
// 10 — set_animation_easing
// ---------------------------------------------------------------------------

describe('set_animation_easing', () => {
  it('replaces easing on fade / slide / scale / rotate / color animations', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1')])]));
    const result = await find('set_animation_easing').handle(
      {
        slideId: 'slide-1',
        elementId: 'sh-1',
        animationId: 'anim-1',
        easing: 'ease-in-out',
      },
      c,
    );
    expect(result).toMatchObject({ ok: true, animationKind: 'fade' });
    expect(c.patchSink.drain()).toEqual([
      {
        op: 'replace',
        path: '/content/slides/0/elements/0/animations/0/animation/easing',
        value: 'ease-in-out',
      },
    ]);
  });

  it('refuses with wrong_animation_kind on keyframed animations', async () => {
    const c = ctx(
      baseDoc([
        shapeEl('sh-1', [
          keyframedAnim('anim-1', [
            { at: 0, value: 0 },
            { at: 1, value: 1 },
          ]),
        ]),
      ]),
    );
    expect(
      await find('set_animation_easing').handle(
        {
          slideId: 'slide-1',
          elementId: 'sh-1',
          animationId: 'anim-1',
          easing: 'linear',
        },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'wrong_animation_kind' });
  });
});

// ---------------------------------------------------------------------------
// 11 — set_animation_autoplay
// ---------------------------------------------------------------------------

describe('set_animation_autoplay', () => {
  it('sets the autoplay boolean', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1')])]));
    const result = await find('set_animation_autoplay').handle(
      { slideId: 'slide-1', elementId: 'sh-1', animationId: 'anim-1', autoplay: false },
      c,
    );
    expect(result).toMatchObject({ ok: true, autoplay: false });
    expect(c.patchSink.drain()[0]?.value).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 12 — set_animation_kind_params
// ---------------------------------------------------------------------------

describe('set_animation_kind_params', () => {
  it('emits per-field replace ops on the inner animation object', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1')])]));
    const result = await find('set_animation_kind_params').handle(
      {
        slideId: 'slide-1',
        elementId: 'sh-1',
        animationId: 'anim-1',
        updates: { from: 0.25, to: 0.75 },
      },
      c,
    );
    expect(result).toMatchObject({ ok: true, updatedFields: ['from', 'to'] });
    expect(c.patchSink.drain()).toEqual([
      {
        op: 'replace',
        path: '/content/slides/0/elements/0/animations/0/animation/from',
        value: 0.25,
      },
      {
        op: 'replace',
        path: '/content/slides/0/elements/0/animations/0/animation/to',
        value: 0.75,
      },
    ]);
  });

  it('refuses rejected_fields when kind is in updates', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1')])]));
    expect(
      await find('set_animation_kind_params').handle(
        {
          slideId: 'slide-1',
          elementId: 'sh-1',
          animationId: 'anim-1',
          updates: { kind: 'scale' },
        },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'rejected_fields' });
  });
});

// ---------------------------------------------------------------------------
// 13 — add_keyframe
// ---------------------------------------------------------------------------

describe('add_keyframe', () => {
  it('appends a keyframe to a keyframed animation', async () => {
    const c = ctx(
      baseDoc([
        shapeEl('sh-1', [
          keyframedAnim('anim-1', [
            { at: 0, value: 0 },
            { at: 1, value: 1 },
          ]),
        ]),
      ]),
    );
    const result = await find('add_keyframe').handle(
      {
        slideId: 'slide-1',
        elementId: 'sh-1',
        animationId: 'anim-1',
        keyframe: { at: 0.5, value: 0.5 },
      },
      c,
    );
    expect(result).toMatchObject({ ok: true, position: 2, keyframeCount: 3 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(1);
    expect(patches[0]?.path).toBe(
      '/content/slides/0/elements/0/animations/0/animation/keyframes/-',
    );
  });

  it('refuses wrong_animation_kind for fade animations', async () => {
    const c = ctx(baseDoc([shapeEl('sh-1', [fadeAnim('anim-1')])]));
    expect(
      await find('add_keyframe').handle(
        {
          slideId: 'slide-1',
          elementId: 'sh-1',
          animationId: 'anim-1',
          keyframe: { at: 0, value: 0 },
        },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'wrong_animation_kind' });
  });
});

// ---------------------------------------------------------------------------
// 14 — remove_keyframe
// ---------------------------------------------------------------------------

describe('remove_keyframe', () => {
  it('removes a keyframe by index when keyframes.length > 2', async () => {
    const c = ctx(
      baseDoc([
        shapeEl('sh-1', [
          keyframedAnim('anim-1', [
            { at: 0, value: 0 },
            { at: 0.5, value: 0.5 },
            { at: 1, value: 1 },
          ]),
        ]),
      ]),
    );
    const result = await find('remove_keyframe').handle(
      {
        slideId: 'slide-1',
        elementId: 'sh-1',
        animationId: 'anim-1',
        index: 1,
      },
      c,
    );
    expect(result).toMatchObject({ ok: true, removedIndex: 1, keyframeCount: 2 });
    expect(c.patchSink.drain()).toEqual([
      {
        op: 'remove',
        path: '/content/slides/0/elements/0/animations/0/animation/keyframes/1',
      },
    ]);
  });

  it('refuses min_keyframes when length is already 2', async () => {
    const c = ctx(
      baseDoc([
        shapeEl('sh-1', [
          keyframedAnim('anim-1', [
            { at: 0, value: 0 },
            { at: 1, value: 1 },
          ]),
        ]),
      ]),
    );
    expect(
      await find('remove_keyframe').handle(
        { slideId: 'slide-1', elementId: 'sh-1', animationId: 'anim-1', index: 0 },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'min_keyframes' });
  });

  it('refuses keyframe_not_found for out-of-range index', async () => {
    const c = ctx(
      baseDoc([
        shapeEl('sh-1', [
          keyframedAnim('anim-1', [
            { at: 0, value: 0 },
            { at: 0.5, value: 0.5 },
            { at: 1, value: 1 },
          ]),
        ]),
      ]),
    );
    expect(
      await find('remove_keyframe').handle(
        { slideId: 'slide-1', elementId: 'sh-1', animationId: 'anim-1', index: 99 },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'keyframe_not_found' });
  });
});
