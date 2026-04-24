// packages/engine/src/handlers/read/handlers.test.ts

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { DocumentContext } from '../../router/types.js';
import { READ_HANDLERS } from './handlers.js';

// Build a DocumentContext fixture without paying the full Zod-validation
// cost — the handlers read a handful of fields; cast the rest.
function ctx(
  documentOverrides: Partial<Document> = {},
  selection?: DocumentContext['selection'],
): DocumentContext {
  const base = {
    meta: {
      id: 'doc-1',
      version: 1,
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      locale: 'en-US',
      schemaVersion: 1,
      title: 'Deck',
    },
    theme: {
      tokens: { 'spacing.unit': 8, 'type.body.size': '16px' },
      palette: { primary: '#ff0000', accent: '#00ff00' },
    },
    variables: {},
    components: {},
    content: {
      mode: 'slide',
      slides: [
        {
          id: 'slide-1',
          title: 'Intro',
          elements: [
            { id: 'el-a', type: 'text', visible: true, name: 'Title' },
            { id: 'el-b', type: 'shape', visible: false },
          ],
          durationMs: 5000,
          background: { kind: 'color', value: '#000000' },
          notes: 'speaker notes',
        },
        { id: 'slide-2', elements: [] },
      ],
    },
  } as unknown as Document;
  return {
    document: { ...base, ...documentOverrides } as Document,
    ...(selection ? { selection } : {}),
  };
}

function find<T extends string>(name: T) {
  const handler = READ_HANDLERS.find((h) => h.name === name);
  if (!handler) throw new Error(`handler ${name} not found`);
  return handler;
}

describe('get_document', () => {
  it('returns metadata + mode-specific count for slide mode', async () => {
    const out = await find('get_document').handle({}, ctx());
    expect(out).toEqual({
      id: 'doc-1',
      mode: 'slide',
      locale: 'en-US',
      title: 'Deck',
      slideCount: 2,
    });
  });

  it('swaps slideCount for trackCount in video mode', async () => {
    const out = await find('get_document').handle(
      {},
      ctx({
        content: {
          mode: 'video',
          tracks: [{}, {}, {}],
          durationMs: 30000,
        } as never,
      }),
    );
    expect(out).toMatchObject({ mode: 'video', trackCount: 3 });
  });

  it('swaps slideCount for sizeCount in display mode', async () => {
    const out = await find('get_document').handle(
      {},
      ctx({
        content: {
          mode: 'display',
          sizes: [{}],
          elements: [],
          durationMs: 30000,
          budget: {},
        } as never,
      }),
    );
    expect(out).toMatchObject({ mode: 'display', sizeCount: 1 });
  });
});

describe('get_slide', () => {
  it('returns a slide summary when the id exists', async () => {
    const out = await find('get_slide').handle({ slideId: 'slide-1' }, ctx());
    expect(out).toEqual({
      found: true,
      id: 'slide-1',
      title: 'Intro',
      elementCount: 2,
      durationMs: 5000,
      hasBackground: true,
      hasTransition: false,
      hasNotes: true,
    });
  });

  it('returns found:false/not_found for an unknown slide id', async () => {
    const out = await find('get_slide').handle({ slideId: 'ghost' }, ctx());
    expect(out).toEqual({ found: false, reason: 'not_found' });
  });

  it('returns found:false/wrong_mode for non-slide documents', async () => {
    const out = await find('get_slide').handle(
      { slideId: 'slide-1' },
      ctx({ content: { mode: 'video', tracks: [], durationMs: 0 } as never }),
    );
    expect(out).toEqual({ found: false, reason: 'wrong_mode' });
  });
});

describe('list_elements', () => {
  it('returns id/type/name/visible for every element on the slide', async () => {
    const out = await find('list_elements').handle({ slideId: 'slide-1' }, ctx());
    expect(out).toMatchObject({
      found: true,
      slideId: 'slide-1',
      elements: [
        { id: 'el-a', type: 'text', name: 'Title', visible: true },
        { id: 'el-b', type: 'shape', visible: false },
      ],
    });
    expect((out as { elements: Array<{ name?: string }> }).elements[1]?.name).toBeUndefined();
  });

  it('returns wrong_mode outside slide mode', async () => {
    const out = await find('list_elements').handle(
      { slideId: 's' },
      ctx({ content: { mode: 'video', tracks: [], durationMs: 1 } as never }),
    );
    expect(out).toEqual({ found: false, reason: 'wrong_mode' });
  });
});

describe('describe_selection', () => {
  it('returns empty selection when the context has no selection', async () => {
    const out = await find('describe_selection').handle({}, ctx());
    expect(out).toEqual({ selectedIds: [], elements: [] });
  });

  it('returns the selected elements from the named slide', async () => {
    const out = await find('describe_selection').handle(
      {},
      ctx(undefined, { slideId: 'slide-1', elementIds: ['el-a'] }),
    );
    expect(out).toMatchObject({
      slideId: 'slide-1',
      selectedIds: ['el-a'],
      elements: [{ id: 'el-a', type: 'text', name: 'Title', visible: true }],
    });
  });

  it('falls back to scanning every slide when no slideId is supplied', async () => {
    const out = await find('describe_selection').handle(
      {},
      ctx(undefined, { elementIds: ['el-b'] }),
    );
    expect((out as { elements: Array<{ id: string }> }).elements).toEqual([
      { id: 'el-b', type: 'shape', visible: false },
    ]);
  });

  it('returns selectedIds + empty elements in non-slide modes', async () => {
    const out = await find('describe_selection').handle(
      {},
      {
        document: { content: { mode: 'video', tracks: [], durationMs: 1 } } as Document,
        selection: { elementIds: ['x'] },
      },
    );
    expect(out).toMatchObject({ selectedIds: ['x'], elements: [] });
  });
});

describe('get_theme', () => {
  it('returns palette colours + design tokens', async () => {
    const out = await find('get_theme').handle({}, ctx());
    expect(out).toEqual({
      palette: { primary: '#ff0000', accent: '#00ff00' },
      tokens: { 'spacing.unit': 8, 'type.body.size': '16px' },
    });
  });

  it('omits palette entries that are not plain colour strings', async () => {
    const out = await find('get_theme').handle(
      {},
      ctx({
        theme: {
          tokens: {},
          palette: {
            primary: '#ff0000',
            // Simulate a legacy ref-style value that survived an import;
            // the handler should drop it rather than claim it's a colour.
            accent: undefined as unknown as string,
          },
        } as never,
      }),
    );
    expect((out as { palette: Record<string, string> }).palette).toEqual({
      primary: '#ff0000',
    });
  });
});
