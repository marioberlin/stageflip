// packages/engine/src/handlers/semantic-layout/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { SEMANTIC_LAYOUT_HANDLERS } from './handlers.js';

function sink(): PatchSink & { drain(): JsonPatchOp[] } {
  const q: JsonPatchOp[] = [];
  return {
    push: (op) => void q.push(op),
    pushAll: (ops) => {
      for (const op of ops) q.push(op);
    },
    drain: () => {
      const out = q.slice();
      q.length = 0;
      return out;
    },
  };
}

function ctx(doc: Document) {
  return { document: doc, patchSink: sink() } as MutationContext & {
    patchSink: ReturnType<typeof sink>;
  };
}

function transform() {
  return { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 };
}

function el(id: string) {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    visible: true,
    locked: false,
    animations: [],
    transform: transform(),
  };
}

function doc(elementIds: string[]): Document {
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
      slides: [{ id: 'slide-1', elements: elementIds.map(el) } as never],
    },
  } as unknown as Document;
}

function find(name: string) {
  const h = SEMANTIC_LAYOUT_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

describe('apply_title_body_layout', () => {
  it('positions title at top + body below with default title height', async () => {
    const c = ctx(doc(['t-1', 'b-1']));
    const r = await find('apply_title_body_layout').handle(
      { slideId: 'slide-1', titleElementId: 't-1', bodyElementId: 'b-1' },
      c,
    );
    expect(r).toMatchObject({ ok: true, titleHeight: 160 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(2);
    const title = patches[0]?.value as { y: number; height: number };
    const body = patches[1]?.value as { y: number };
    expect(title.y).toBe(80);
    expect(title.height).toBe(160);
    expect(body.y).toBe(280);
  });

  it('refuses element_not_found', async () => {
    const c = ctx(doc(['t-1']));
    expect(
      await find('apply_title_body_layout').handle(
        { slideId: 'slide-1', titleElementId: 't-1', bodyElementId: 'ghost' },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'element_not_found' });
  });
});

describe('apply_two_column_layout', () => {
  it('lays out left + right columns with equal heights', async () => {
    const c = ctx(doc(['a', 'b', 'c']));
    const r = await find('apply_two_column_layout').handle(
      {
        slideId: 'slide-1',
        leftElementIds: ['a'],
        rightElementIds: ['b', 'c'],
      },
      c,
    );
    expect(r).toMatchObject({ ok: true, leftCount: 1, rightCount: 2 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(3);
    const leftX = (patches[0]?.value as { x: number }).x;
    const rightX = (patches[1]?.value as { x: number }).x;
    expect(rightX).toBeGreaterThan(leftX);
  });
});

describe('apply_kpi_strip_layout', () => {
  it('lays out 3 cards equal-width with default y + height', async () => {
    const c = ctx(doc(['a', 'b', 'c']));
    const r = await find('apply_kpi_strip_layout').handle(
      { slideId: 'slide-1', elementIds: ['a', 'b', 'c'] },
      c,
    );
    expect(r).toMatchObject({ ok: true, applied: 3 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(3);
    const widths = patches.map((p) => (p.value as { width: number }).width);
    // All widths equal
    expect(new Set(widths).size).toBe(1);
  });
});

describe('apply_centered_hero_layout', () => {
  it('centers the hero with default ratios (1440×540 at 240, 270)', async () => {
    const c = ctx(doc(['hero']));
    const r = await find('apply_centered_hero_layout').handle(
      { slideId: 'slide-1', elementId: 'hero' },
      c,
    );
    expect(r).toMatchObject({ ok: true, width: 1440, height: 540 });
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(1);
    const t = patches[0]?.value as { x: number; y: number; width: number; height: number };
    expect(t.x).toBe(240);
    expect(t.y).toBe(270);
    expect(t.width).toBe(1440);
    expect(t.height).toBe(540);
  });

  it('refuses slide_not_found', async () => {
    const c = ctx(doc(['x']));
    expect(
      await find('apply_centered_hero_layout').handle({ slideId: 'ghost', elementId: 'x' }, c),
    ).toMatchObject({ ok: false, reason: 'slide_not_found' });
  });
});

// ---------------------------------------------------------------------------
// 5 — arrange_reveal (T-407)
// ---------------------------------------------------------------------------

interface AnimationOp {
  id: string;
  timing: { kind: string; startFrame: number; durationFrames: number };
  animation: {
    kind: string;
    direction?: string;
    distance?: number;
    from?: number;
    to?: number;
    easing?: string;
  };
  autoplay: boolean;
}

describe('arrange_reveal', () => {
  it('emits one append-patch per element with default 9-frame stagger + fade', async () => {
    const c = ctx(doc(['head', 'body', 'pic']));
    const r = await find('arrange_reveal').handle(
      { slideId: 'slide-1', revealOrder: ['head', 'body', 'pic'] },
      c,
    );
    expect(r).toMatchObject({ ok: true, slideId: 'slide-1' });
    const applied = (r as { ok: true; applied: { startFrame: number }[] }).applied;
    expect(applied).toHaveLength(3);
    expect(applied.map((a) => a.startFrame)).toEqual([0, 9, 18]);
    const patches = c.patchSink.drain();
    expect(patches).toHaveLength(3);
    for (const p of patches) {
      expect(p.op).toBe('add');
      expect(String(p.path).endsWith('/animations/-')).toBe(true);
      const v = p.value as AnimationOp;
      expect(v.timing.kind).toBe('absolute');
      expect(v.animation.kind).toBe('fade');
      expect(v.timing.durationFrames).toBe(14);
    }
    expect((patches[0]?.value as AnimationOp).id).toBe('reveal-0');
    expect((patches[1]?.value as AnimationOp).id).toBe('reveal-1');
    expect((patches[2]?.value as AnimationOp).id).toBe('reveal-2');
  });

  it('honors initialDelayFrames + custom staggerFrames + enterDurationFrames', async () => {
    const c = ctx(doc(['a', 'b', 'c']));
    const r = await find('arrange_reveal').handle(
      {
        slideId: 'slide-1',
        revealOrder: ['a', 'b', 'c'],
        initialDelayFrames: 30,
        staggerFrames: 15,
        enterDurationFrames: 20,
      },
      c,
    );
    const applied = (r as { ok: true; applied: { startFrame: number }[] }).applied;
    expect(applied.map((a) => a.startFrame)).toEqual([30, 45, 60]);
    const patches = c.patchSink.drain();
    for (const p of patches) {
      expect((p.value as AnimationOp).timing.durationFrames).toBe(20);
    }
  });

  it('emits slide-up enter animation with direction + distance defaults', async () => {
    const c = ctx(doc(['x']));
    await find('arrange_reveal').handle(
      { slideId: 'slide-1', revealOrder: ['x'], enterAnimationKind: 'slide-up' },
      c,
    );
    const patches = c.patchSink.drain();
    const v = patches[0]?.value as AnimationOp;
    expect(v.animation.kind).toBe('slide');
    expect(v.animation.direction).toBe('up');
    expect(v.animation.distance).toBe(100);
  });

  it('emits scale enter animation with from 0.8 → 1', async () => {
    const c = ctx(doc(['x']));
    await find('arrange_reveal').handle(
      { slideId: 'slide-1', revealOrder: ['x'], enterAnimationKind: 'scale' },
      c,
    );
    const v = c.patchSink.drain()[0]?.value as AnimationOp;
    expect(v.animation.kind).toBe('scale');
    expect(v.animation.from).toBe(0.8);
    expect(v.animation.to).toBe(1);
  });

  it('overrides easing on enter animation', async () => {
    const c = ctx(doc(['x']));
    await find('arrange_reveal').handle(
      { slideId: 'slide-1', revealOrder: ['x'], enterEasing: 'ease-in-out' },
      c,
    );
    const v = c.patchSink.drain()[0]?.value as AnimationOp;
    expect(v.animation.easing).toBe('ease-in-out');
  });

  it('returns applied with elementId / animationId / startFrame / durationFrames', async () => {
    const c = ctx(doc(['head', 'body']));
    const r = await find('arrange_reveal').handle(
      { slideId: 'slide-1', revealOrder: ['head', 'body'] },
      c,
    );
    expect(r).toMatchObject({
      ok: true,
      applied: [
        { elementId: 'head', animationId: 'reveal-0', startFrame: 0, durationFrames: 14 },
        { elementId: 'body', animationId: 'reveal-1', startFrame: 9, durationFrames: 14 },
      ],
    });
  });

  it('refuses wrong_mode', async () => {
    const d = doc(['x']);
    (d.content as { mode: string }).mode = 'video';
    const c = ctx(d);
    expect(
      await find('arrange_reveal').handle({ slideId: 'slide-1', revealOrder: ['x'] }, c),
    ).toMatchObject({ ok: false, reason: 'wrong_mode' });
    expect(c.patchSink.drain()).toHaveLength(0);
  });

  it('refuses slide_not_found', async () => {
    const c = ctx(doc(['x']));
    expect(
      await find('arrange_reveal').handle({ slideId: 'ghost', revealOrder: ['x'] }, c),
    ).toMatchObject({ ok: false, reason: 'slide_not_found' });
    expect(c.patchSink.drain()).toHaveLength(0);
  });

  it('refuses element_not_found', async () => {
    const c = ctx(doc(['head']));
    expect(
      await find('arrange_reveal').handle(
        { slideId: 'slide-1', revealOrder: ['head', 'ghost'] },
        c,
      ),
    ).toMatchObject({ ok: false, reason: 'element_not_found' });
    expect(c.patchSink.drain()).toHaveLength(0);
  });

  it('refuses duplicate_element_id (checked BEFORE slide / element resolution)', async () => {
    const c = ctx(doc(['a', 'b']));
    expect(
      await find('arrange_reveal').handle({ slideId: 'slide-1', revealOrder: ['a', 'b', 'a'] }, c),
    ).toMatchObject({ ok: false, reason: 'duplicate_element_id' });
    expect(c.patchSink.drain()).toHaveLength(0);
  });

  it('produces deeply-equal patches on repeated invocation (determinism)', async () => {
    const c1 = ctx(doc(['a', 'b', 'c']));
    const c2 = ctx(doc(['a', 'b', 'c']));
    const input = {
      slideId: 'slide-1',
      revealOrder: ['a', 'b', 'c'],
      initialDelayFrames: 5,
      staggerFrames: 12,
      enterAnimationKind: 'slide-left' as const,
    };
    const r1 = await find('arrange_reveal').handle(input, c1);
    const r2 = await find('arrange_reveal').handle(input, c2);
    expect(r1).toEqual(r2);
    expect(c1.patchSink.drain()).toEqual(c2.patchSink.drain());
  });

  it('picks fresh reveal-N ids when the element already carries reveal-* animations', async () => {
    const d = doc(['x']);
    const slide = (d.content as { slides: { elements: { animations: unknown[] }[] }[] }).slides[0];
    if (slide) {
      slide.elements[0]!.animations = [{ id: 'reveal-3', timing: {}, animation: { kind: 'fade' } }];
    }
    const c = ctx(d);
    const r = await find('arrange_reveal').handle({ slideId: 'slide-1', revealOrder: ['x'] }, c);
    expect(r).toMatchObject({
      ok: true,
      applied: [{ animationId: 'reveal-4' }],
    });
  });
});
