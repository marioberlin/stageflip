// packages/import-slidemotion-legacy/src/index.test.ts

import { documentSchema } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { importLegacyDocument } from './index';
import { LOSSY_LEGACY_DOC, MINIMAL_LEGACY_DOC, NESTED_GROUP_LEGACY_DOC } from './test-fixtures';

describe('importLegacyDocument — happy path', () => {
  it('produces a canonical Document that passes the strict schema', () => {
    const { document } = importLegacyDocument(MINIMAL_LEGACY_DOC);
    // The orchestrator already runs `documentSchema.parse`; this re-runs it
    // to lock in the contract and make future regressions loud.
    expect(() => documentSchema.parse(document)).not.toThrow();
  });

  it('preserves document metadata: id, title, authorId, timestamps', () => {
    const { document } = importLegacyDocument(MINIMAL_LEGACY_DOC);
    expect(document.meta.id).toBe('demo-deck');
    expect(document.meta.title).toBe('Demo Deck');
    expect(document.meta.authorId).toBe('Jane_Doe');
    expect(document.meta.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(document.meta.updatedAt).toBe('2025-06-01T12:00:00.000Z');
  });

  it('maps content to mode="slide" with at least one slide', () => {
    const { document } = importLegacyDocument(MINIMAL_LEGACY_DOC);
    expect(document.content.mode).toBe('slide');
    if (document.content.mode === 'slide') {
      expect(document.content.slides.length).toBe(1);
    }
  });

  it('maps a text element: content → text, style → color/font, opacity default', () => {
    const { document } = importLegacyDocument(MINIMAL_LEGACY_DOC);
    if (document.content.mode !== 'slide') throw new Error('expected slide mode');
    const slide = document.content.slides[0];
    const text = slide?.elements[0];
    expect(text?.type).toBe('text');
    if (text?.type === 'text') {
      expect(text.text).toBe('Hello, World');
      expect(text.color).toBe('#ffffff');
      expect(text.fontFamily).toBe('Inter');
      expect(text.fontSize).toBe(72);
      expect(text.transform.opacity).toBe(1);
    }
  });

  it('maps an image element: assetId → src with asset: prefix + sanitized id', () => {
    const { document } = importLegacyDocument(MINIMAL_LEGACY_DOC);
    if (document.content.mode !== 'slide') throw new Error('expected slide mode');
    const slide = document.content.slides[0];
    const image = slide?.elements[1];
    expect(image?.type).toBe('image');
    if (image?.type === 'image') {
      expect(image.src).toBe('asset:cover_jpg');
      expect(image.fit).toBe('cover');
    }
  });

  it('sanitizes element ids with invalid chars and warns', () => {
    const { document, warnings } = importLegacyDocument(MINIMAL_LEGACY_DOC);
    if (document.content.mode !== 'slide') throw new Error('expected slide mode');
    const slide = document.content.slides[0];
    const image = slide?.elements[1];
    // Legacy id `"hero img"` sanitizes to `"hero_img"`; warning emitted.
    expect(image?.id).toBe('hero_img');
    expect(warnings.some((w) => w.reason === 'sanitized-id' && w.path.endsWith('/id'))).toBe(true);
  });

  it('maps a solid-color slide background', () => {
    const { document } = importLegacyDocument(MINIMAL_LEGACY_DOC);
    if (document.content.mode !== 'slide') throw new Error('expected slide mode');
    const bg = document.content.slides[0]?.background;
    expect(bg).toEqual({ kind: 'color', value: '#08101f' });
  });

  it('maps slide duration when numeric', () => {
    const { document } = importLegacyDocument(MINIMAL_LEGACY_DOC);
    if (document.content.mode !== 'slide') throw new Error('expected slide mode');
    expect(document.content.slides[0]?.durationMs).toBe(3000);
  });
});

describe('importLegacyDocument — lossy / skipped features', () => {
  it('warns on unsupported element types and drops them from the output', () => {
    const { document, warnings } = importLegacyDocument(LOSSY_LEGACY_DOC);
    if (document.content.mode !== 'slide') throw new Error('expected slide mode');
    const slide = document.content.slides[0];
    // One supported element (text), three dropped (chart, bad shape, bad image).
    expect(slide?.elements.length).toBe(1);
    expect(
      warnings.some((w) => w.reason === 'unsupported-element-type' && w.detail === 'chart'),
    ).toBe(true);
    expect(
      warnings.some((w) => w.reason === 'unsupported-shape-kind' && w.detail === 'triangle'),
    ).toBe(true);
    expect(warnings.some((w) => w.reason === 'invalid-asset-reference')).toBe(true);
  });

  it('warns on gradient backgrounds and produces a slide without a background', () => {
    const { document, warnings } = importLegacyDocument(LOSSY_LEGACY_DOC);
    if (document.content.mode !== 'slide') throw new Error('expected slide mode');
    expect(document.content.slides[0]?.background).toBeUndefined();
    expect(warnings.some((w) => w.reason === 'unsupported-background-kind')).toBe(true);
  });

  it('drops the legacy `subtitle` field with a warning', () => {
    const { warnings } = importLegacyDocument({
      ...MINIMAL_LEGACY_DOC,
      subtitle: 'A Subtitle',
    });
    expect(warnings.some((w) => w.reason === 'dropped-field' && w.path === '/subtitle')).toBe(true);
  });

  it('substitutes a sentinel timestamp when created/modified are missing or bad', () => {
    const { document, warnings } = importLegacyDocument({
      ...MINIMAL_LEGACY_DOC,
      created: 'garbage',
      modified: undefined,
    });
    expect(document.meta.createdAt).toBe('2000-01-01T00:00:00.000Z');
    expect(document.meta.updatedAt).toBe('2000-01-01T00:00:00.000Z');
    expect(warnings.filter((w) => w.reason === 'invalid-timestamp').length).toBe(2);
  });
});

describe('importLegacyDocument — recursive groups', () => {
  it('maps nested groups with all descendant text elements intact', () => {
    const { document } = importLegacyDocument(NESTED_GROUP_LEGACY_DOC);
    if (document.content.mode !== 'slide') throw new Error('expected slide mode');
    const outer = document.content.slides[0]?.elements[0];
    expect(outer?.type).toBe('group');
    if (outer?.type === 'group') {
      expect(outer.children.length).toBe(2);
      const inner = outer.children[1];
      expect(inner?.type).toBe('group');
      if (inner?.type === 'group') {
        const deep = inner.children[0];
        expect(deep?.type).toBe('text');
        if (deep?.type === 'text') {
          expect(deep.text).toBe('deep');
        }
      }
    }
  });
});

describe('importLegacyDocument — input validation', () => {
  it('throws a ZodError when `id` is missing', () => {
    expect(() => importLegacyDocument({ slides: [] })).toThrow();
  });

  it('throws when the slides array is empty (canonical requires >= 1)', () => {
    expect(() =>
      importLegacyDocument({ id: 'x', slides: [], created: 'x', modified: 'x' }),
    ).toThrow();
  });

  it('does not accept a non-object input', () => {
    expect(() => importLegacyDocument('not a doc')).toThrow();
    expect(() => importLegacyDocument(null)).toThrow();
  });
});

describe('importLegacyDocument — id collision handling', () => {
  it('uniqueifies duplicate slide ids across the document', () => {
    const input = {
      id: 'dup',
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-01T00:00:00Z',
      slides: [
        { id: 'slide', elements: [] },
        { id: 'slide', elements: [] },
        { id: 'slide', elements: [] },
      ],
    };
    const { document } = importLegacyDocument(input);
    if (document.content.mode !== 'slide') throw new Error('expected slide mode');
    const ids = document.content.slides.map((s) => s.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('uniqueifies duplicate element ids within a slide', () => {
    const input = {
      id: 'dup-el',
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-01T00:00:00Z',
      slides: [
        {
          id: 'only',
          elements: [
            {
              id: 'box',
              type: 'shape',
              shape: 'rectangle',
              frame: { x: 0, y: 0, width: 10, height: 10 },
              style: {},
            },
            {
              id: 'box',
              type: 'shape',
              shape: 'rectangle',
              frame: { x: 0, y: 0, width: 10, height: 10 },
              style: {},
            },
          ],
        },
      ],
    };
    const { document } = importLegacyDocument(input);
    if (document.content.mode !== 'slide') throw new Error('expected slide mode');
    const ids = document.content.slides[0]?.elements.map((e) => e.id) ?? [];
    expect(new Set(ids).size).toBe(2);
  });
});
