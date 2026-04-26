// packages/schema/src/inheritance.test.ts
// Tests for applyInheritance(doc) — the schema-level helper (T-251). Covers
// AC #8-#15: fast path, override semantics, transitive inheritance through
// master, slide-side id preservation, animations-default semantics, purity,
// and "output is a valid Document".

import { describe, expect, it } from 'vitest';
import { type Document, documentSchema } from './document.js';
import { applyInheritance } from './inheritance.js';

const NOW = '2026-04-26T00:00:00.000Z';
const TRANSFORM = { x: 0, y: 0, width: 100, height: 50 };
const SLIDE_TRANSFORM = { x: 10, y: 20, width: 200, height: 80 };

function baseDoc(overrides: Partial<Document> = {}): Document {
  return documentSchema.parse({
    meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: { mode: 'slide', slides: [{ id: 's1', elements: [] }] },
    ...overrides,
  });
}

describe('applyInheritance — fast path (AC #8)', () => {
  it('returns the same reference when layouts and masters are both empty', () => {
    const doc = baseDoc();
    const out = applyInheritance(doc);
    expect(out).toBe(doc);
  });

  it('returns the same reference when content mode is not slide (with non-empty layouts)', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      // Force the non-fast-path branch by populating layouts; the mode check
      // is what should still short-circuit.
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [{ id: 'layout-1', name: 'L', masterId: 'master-1', placeholders: [] }],
      content: {
        mode: 'video',
        aspectRatio: '16:9',
        durationMs: 1000,
        tracks: [{ id: 't1', kind: 'visual', elements: [] }],
      },
    });
    const out = applyInheritance(doc);
    expect(out).toBe(doc);
  });

  it('returns the same reference when no slide element has inheritsFrom', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [{ id: 'layout-1', name: 'L', masterId: 'master-1', placeholders: [] }],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'hi' }],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    // Identity preserved when nothing changed.
    expect(out).toBe(doc);
  });
});

describe('applyInheritance — placeholder fill (AC #10)', () => {
  it('fills `name` from the placeholder when slide leaves it unset', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [
            {
              id: 'ph-0',
              name: 'Title placeholder',
              type: 'text',
              transform: TRANSFORM,
              text: 'PLACEHOLDER TITLE',
            },
          ],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'Real slide text',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    if (out.content.mode !== 'slide') throw new Error('mode invariant');
    const slide = out.content.slides[0];
    if (!slide) throw new Error('slide invariant');
    const el = slide.elements[0];
    if (!el || el.type !== 'text') throw new Error('text invariant');
    expect(el.name).toBe('Title placeholder');
    expect(el.text).toBe('Real slide text'); // slide override wins
  });

  it('does NOT override fields that the slide explicitly sets (incl. empty string / 0 / false)', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [
            {
              id: 'ph-0',
              type: 'text',
              transform: TRANSFORM,
              text: 'PLACEHOLDER',
              fontSize: 64,
            },
          ],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: '',
                fontSize: 12,
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    if (out.content.mode !== 'slide') throw new Error('mode');
    const el = out.content.slides[0]?.elements[0];
    if (!el || el.type !== 'text') throw new Error('text');
    expect(el.text).toBe(''); // slide explicit empty string wins
    expect(el.fontSize).toBe(12); // slide explicit 12 wins
  });
});

describe('applyInheritance — transform never overridden (AC #9)', () => {
  it('keeps the slide-side transform whole even when it differs from the placeholder', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [
            {
              id: 'ph-0',
              type: 'text',
              transform: { x: 999, y: 999, width: 999, height: 999 },
              text: 'P',
            },
          ],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'S',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    if (out.content.mode !== 'slide') throw new Error('mode');
    const el = out.content.slides[0]?.elements[0];
    if (!el) throw new Error('el');
    // Slide transform is preserved verbatim — no nested-field merge.
    expect(el.transform.x).toBe(SLIDE_TRANSFORM.x);
    expect(el.transform.y).toBe(SLIDE_TRANSFORM.y);
    expect(el.transform.width).toBe(SLIDE_TRANSFORM.width);
    expect(el.transform.height).toBe(SLIDE_TRANSFORM.height);
  });
});

describe('applyInheritance — transitive via master (AC #11)', () => {
  it('walks up to the master when the layout has no matching placeholderIdx', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [
        {
          id: 'master-1',
          name: 'M',
          placeholders: [
            // 6 entries so index 5 exists; only the last one carries a name.
            { id: 'ph-m-0', type: 'text', transform: TRANSFORM, text: 'a' },
            { id: 'ph-m-1', type: 'text', transform: TRANSFORM, text: 'b' },
            { id: 'ph-m-2', type: 'text', transform: TRANSFORM, text: 'c' },
            { id: 'ph-m-3', type: 'text', transform: TRANSFORM, text: 'd' },
            { id: 'ph-m-4', type: 'text', transform: TRANSFORM, text: 'e' },
            {
              id: 'ph-m-5',
              name: 'Master footer',
              type: 'text',
              transform: TRANSFORM,
              text: 'MASTER FOOTER',
            },
          ],
        },
      ],
      // Layout has only one placeholder at idx 0 — idx 5 misses, must walk up.
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [{ id: 'ph-l-0', type: 'text', transform: TRANSFORM, text: 'L0' }],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'real footer',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 5 },
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    if (out.content.mode !== 'slide') throw new Error('mode');
    const el = out.content.slides[0]?.elements[0];
    if (!el || el.type !== 'text') throw new Error('text');
    expect(el.name).toBe('Master footer');
  });
});

describe('applyInheritance — slide-side id preservation (AC #12)', () => {
  it('keeps the slide-side id; the placeholder id is discarded', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [{ id: 'PLACEHOLDER-ID', type: 'text', transform: TRANSFORM, text: 'P' }],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'SLIDE-SIDE-ID',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'S',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    if (out.content.mode !== 'slide') throw new Error('mode');
    const el = out.content.slides[0]?.elements[0];
    expect(el?.id).toBe('SLIDE-SIDE-ID');
  });

  it('preserves inheritsFrom on the materialized element', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [{ id: 'p', type: 'text', transform: TRANSFORM, text: 'P' }],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'S',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    if (out.content.mode !== 'slide') throw new Error('mode');
    const el = out.content.slides[0]?.elements[0];
    expect(el?.inheritsFrom).toEqual({ templateId: 'layout-1', placeholderIdx: 0 });
  });
});

describe('applyInheritance — animations not inherited (AC #13)', () => {
  it('keeps the slide-side `animations: []` even if the placeholder declares animations', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [
            {
              id: 'p',
              type: 'text',
              transform: TRANSFORM,
              text: 'P',
              animations: [
                {
                  id: 'a1',
                  timing: { kind: 'absolute', startFrame: 0, durationFrames: 30 },
                  animation: { kind: 'fade', from: 0, to: 1 },
                },
              ],
            },
          ],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'S',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    if (out.content.mode !== 'slide') throw new Error('mode');
    const el = out.content.slides[0]?.elements[0];
    expect(el?.animations).toEqual([]);
  });
});

describe('applyInheritance — purity (AC #14)', () => {
  it('is deterministic — same input produces same output across many invocations', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [{ id: 'p', name: 'PName', type: 'text', transform: TRANSFORM, text: 'P' }],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'S',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const baseline = applyInheritance(doc);
    for (let i = 0; i < 10; i += 1) {
      const out = applyInheritance(doc);
      expect(JSON.stringify(out)).toBe(JSON.stringify(baseline));
    }
  });

  it('does not mutate the input document', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [{ id: 'p', name: 'PName', type: 'text', transform: TRANSFORM, text: 'P' }],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'S',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const before = JSON.stringify(doc);
    applyInheritance(doc);
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe('applyInheritance — output is a valid Document (AC #15)', () => {
  it('output passes documentSchema.parse without throwing', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [{ id: 'p', name: 'PName', type: 'text', transform: TRANSFORM, text: 'P' }],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'S',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    expect(() => documentSchema.parse(out)).not.toThrow();
  });
});

describe('applyInheritance — unresolved references pass through unchanged', () => {
  it('returns slide elements unchanged when layout id does not resolve (helper is silent; RIR pass emits diag)', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [],
      layouts: [
        {
          id: 'layout-real',
          name: 'L',
          masterId: 'master-real',
          placeholders: [],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-real',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'S',
                // templateId points nowhere
                inheritsFrom: { templateId: 'layout-MISSING', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    if (out.content.mode !== 'slide') throw new Error('mode');
    const el = out.content.slides[0]?.elements[0];
    if (!el || el.type !== 'text') throw new Error('text');
    expect(el.name).toBeUndefined();
    expect(el.text).toBe('S');
  });

  it('returns slide elements unchanged when placeholderIdx does not resolve on layout or master', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'S',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 99 },
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    if (out.content.mode !== 'slide') throw new Error('mode');
    const el = out.content.slides[0]?.elements[0];
    if (!el || el.type !== 'text') throw new Error('text');
    expect(el.name).toBeUndefined();
  });
});

describe('applyInheritance — direct master reference', () => {
  it('resolves inheritsFrom.templateId pointing directly at a master', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [
        {
          id: 'master-1',
          name: 'M',
          placeholders: [
            { id: 'p', name: 'MasterName', type: 'text', transform: TRANSFORM, text: 'M' },
          ],
        },
      ],
      layouts: [],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: SLIDE_TRANSFORM,
                text: 'S',
                inheritsFrom: { templateId: 'master-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    if (out.content.mode !== 'slide') throw new Error('mode');
    const el = out.content.slides[0]?.elements[0];
    if (!el || el.type !== 'text') throw new Error('text');
    expect(el.name).toBe('MasterName');
  });
});

describe('applyInheritance — recurses into group children', () => {
  it('materializes inheritance on group children too', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [
            { id: 'p', name: 'GroupChildName', type: 'text', transform: TRANSFORM, text: 'P' },
          ],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'g1',
                type: 'group',
                transform: SLIDE_TRANSFORM,
                clip: false,
                children: [
                  {
                    id: 'gc1',
                    type: 'text',
                    transform: SLIDE_TRANSFORM,
                    text: 'child',
                    inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const out = applyInheritance(doc);
    if (out.content.mode !== 'slide') throw new Error('mode');
    const grp = out.content.slides[0]?.elements[0];
    if (!grp || grp.type !== 'group') throw new Error('group');
    const child = grp.children[0];
    if (!child || child.type !== 'text') throw new Error('child');
    expect(child.name).toBe('GroupChildName');
  });
});
