// packages/schema/src/components.test.ts
// T-249 schema change: slotDefinitionSchema, layoutDescriptorSchema, +
// componentDefinitionSchema.body narrowing. AC #17.

import { describe, expect, it } from 'vitest';
import { layoutDescriptorSchema, slotDefinitionSchema } from './components.js';
import { componentDefinitionSchema, documentSchema } from './document.js';

describe('slotDefinitionSchema', () => {
  it('accepts a minimal slot', () => {
    const parsed = slotDefinitionSchema.parse({
      id: 'titleSlot',
      name: 'Title',
      kind: 'text',
    });
    expect(parsed.optional).toBe(false);
  });

  it('rejects a slot with an unknown kind', () => {
    expect(() =>
      slotDefinitionSchema.parse({
        id: 'badSlot',
        name: 'bad',
        kind: 'video-stream',
      }),
    ).toThrow();
  });
});

describe('layoutDescriptorSchema', () => {
  it('accepts a layout with one cell at full size', () => {
    const parsed = layoutDescriptorSchema.parse({
      width: 1,
      height: 1,
      cells: [{ slotId: 'titleSlot', x: 0, y: 0, width: 1, height: 1 }],
    });
    expect(parsed.cells).toHaveLength(1);
  });

  it('rejects width != 1', () => {
    expect(() =>
      layoutDescriptorSchema.parse({
        width: 2,
        height: 1,
        cells: [],
      }),
    ).toThrow();
  });

  it('rejects out-of-range cell coords', () => {
    expect(() =>
      layoutDescriptorSchema.parse({
        width: 1,
        height: 1,
        cells: [{ slotId: 'a', x: -0.1, y: 0, width: 1, height: 1 }],
      }),
    ).toThrow();
  });
});

describe('componentDefinitionSchema (T-249 narrowing) — AC #17', () => {
  it('accepts a populated component body', () => {
    const parsed = componentDefinitionSchema.parse({
      id: 'c-titleBlock',
      body: {
        slots: [{ id: 'titleSlot', name: 'Title', kind: 'text' }],
        layout: {
          width: 1,
          height: 1,
          cells: [{ slotId: 'titleSlot', x: 0, y: 0, width: 1, height: 1 }],
        },
      },
    });
    expect(parsed.body.slots).toHaveLength(1);
  });

  it('rejects a body without layout', () => {
    expect(() =>
      componentDefinitionSchema.parse({
        id: 'c-bad',
        body: { slots: [] },
      }),
    ).toThrow();
  });

  it('preserves backward compat: documents with `components: {}` still parse', () => {
    const parsed = documentSchema.parse({
      meta: {
        id: 'doc1',
        version: 0,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [],
      layouts: [],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            elements: [],
          },
        ],
      },
    });
    expect(parsed.components).toEqual({});
  });
});
