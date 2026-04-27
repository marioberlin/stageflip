// packages/collab/src/binding.test.ts
// Round-trip + concurrent-merge fixtures for the Document <-> Y.Doc binding
// per ADR-006 §D1 and T-260 ACs #1–#8.

import { type Document, type TextElement, documentSchema } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  ROOT_KEY,
  buildElementMap,
  buildSlideMap,
  documentToYDoc,
  getSlideMap,
  getSlidesArray,
  readElementMap,
  readSlideMap,
  yDocToDocument,
} from './binding.js';

const nowISO = (): string => '2026-04-27T00:00:00.000Z';

const baseTransform = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
} as const;

const textElement = (id: string, text: string): TextElement => ({
  id,
  type: 'text',
  transform: { ...baseTransform },
  visible: true,
  locked: false,
  animations: [],
  text,
  align: 'left',
});

function makeDoc(): Document {
  const raw = {
    meta: {
      id: 'doc-1',
      version: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      title: 'Sample',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: {
      tokens: { 'color.primary': '#ff0000' },
    },
    variables: { greeting: 'hello' },
    components: {},
    masters: [
      {
        id: 'm1',
        name: 'Master',
        placeholders: [],
      },
    ],
    layouts: [
      {
        id: 'l1',
        name: 'Layout',
        masterId: 'm1',
        placeholders: [],
      },
    ],
    content: {
      mode: 'slide' as const,
      slides: [
        {
          id: 's1',
          title: 'Slide One',
          layoutId: 'l1',
          elements: [
            textElement('e-text-1', 'Hello world'),
            {
              id: 'e-image-1',
              type: 'image' as const,
              transform: { ...baseTransform },
              visible: true,
              locked: false,
              animations: [],
              src: 'asset:img1',
              fit: 'cover' as const,
            },
            {
              id: 'e-shape-1',
              type: 'shape' as const,
              transform: { ...baseTransform },
              visible: true,
              locked: false,
              animations: [],
              shape: 'rect' as const,
              fill: '#0000ff',
            },
            {
              id: 'e-group-1',
              type: 'group' as const,
              transform: { ...baseTransform },
              visible: true,
              locked: false,
              animations: [],
              clip: false,
              children: [textElement('e-group-child-1', 'inside group')],
            },
            {
              id: 'e-table-1',
              type: 'table' as const,
              transform: { ...baseTransform },
              visible: true,
              locked: false,
              animations: [],
              rows: 1,
              columns: 2,
              headerRow: true,
              cells: [
                { row: 0, col: 0, content: 'a', align: 'left' as const, colspan: 1, rowspan: 1 },
                { row: 0, col: 1, content: 'b', align: 'left' as const, colspan: 1, rowspan: 1 },
              ],
            },
          ],
          notes: 'Speaker notes for slide one.',
        },
      ],
    },
  };
  return documentSchema.parse(raw);
}

describe('binding — round-trip', () => {
  it('AC#1/#2 — documentToYDoc -> yDocToDocument round-trips through documentSchema', () => {
    const doc = makeDoc();
    const ydoc = documentToYDoc(doc);
    const out = yDocToDocument(ydoc);
    const parsed = documentSchema.parse(out);
    expect(parsed).toEqual(doc);
  });

  it('AC#8 — round-trip handles all 11 element types in the union', () => {
    // Build a slide carrying one element per type in ELEMENT_TYPES so the
    // round-trip path exercises every branch of buildElementMap /
    // readElementMap directly (no implicit "structural coverage").
    const slide = {
      id: 's-all',
      title: 'all-types',
      elements: [
        textElement('e-text', 'hi'),
        {
          id: 'e-image',
          type: 'image' as const,
          transform: { ...baseTransform },
          visible: true,
          locked: false,
          animations: [],
          src: 'asset:img1',
          fit: 'cover' as const,
        },
        {
          id: 'e-video',
          type: 'video' as const,
          transform: { ...baseTransform },
          visible: true,
          locked: false,
          animations: [],
          src: 'asset:vid1',
          muted: false,
          loop: false,
          playbackRate: 1,
        },
        {
          id: 'e-audio',
          type: 'audio' as const,
          transform: { ...baseTransform },
          visible: true,
          locked: false,
          animations: [],
          src: 'asset:aud1',
          loop: false,
        },
        {
          id: 'e-shape',
          type: 'shape' as const,
          transform: { ...baseTransform },
          visible: true,
          locked: false,
          animations: [],
          shape: 'rect' as const,
          fill: '#0000ff',
        },
        {
          id: 'e-group',
          type: 'group' as const,
          transform: { ...baseTransform },
          visible: true,
          locked: false,
          animations: [],
          clip: false,
          children: [textElement('e-group-child', 'inside')],
        },
        {
          id: 'e-chart',
          type: 'chart' as const,
          transform: { ...baseTransform },
          visible: true,
          locked: false,
          animations: [],
          chartKind: 'bar' as const,
          data: {
            labels: ['a', 'b'],
            series: [{ name: 's1', values: [1, 2] }],
          },
          legend: true,
          axes: true,
        },
        {
          id: 'e-table',
          type: 'table' as const,
          transform: { ...baseTransform },
          visible: true,
          locked: false,
          animations: [],
          rows: 1,
          columns: 1,
          headerRow: false,
          cells: [{ row: 0, col: 0, content: 'x', align: 'left' as const, colspan: 1, rowspan: 1 }],
        },
        {
          id: 'e-clip',
          type: 'clip' as const,
          transform: { ...baseTransform },
          visible: true,
          locked: false,
          animations: [],
          runtime: 'frame',
          clipName: 'fade',
          params: {},
        },
        {
          id: 'e-embed',
          type: 'embed' as const,
          transform: { ...baseTransform },
          visible: true,
          locked: false,
          animations: [],
          src: 'https://example.com/',
          sandbox: ['allow-scripts' as const],
          allowFullscreen: false,
        },
        {
          id: 'e-code',
          type: 'code' as const,
          transform: { ...baseTransform },
          visible: true,
          locked: false,
          animations: [],
          code: 'const x = 1;',
          language: 'typescript' as const,
          showLineNumbers: false,
          wrap: false,
        },
      ],
    };
    const doc = documentSchema.parse({
      meta: {
        id: 'doc-all',
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
      content: { mode: 'slide' as const, slides: [slide] },
    });
    // Sanity: every type literal from ELEMENT_TYPES present.
    const types =
      doc.content.mode === 'slide' ? doc.content.slides[0]?.elements.map((e) => e.type) : [];
    expect(new Set(types)).toEqual(
      new Set([
        'text',
        'image',
        'video',
        'audio',
        'shape',
        'group',
        'chart',
        'table',
        'clip',
        'embed',
        'code',
      ]),
    );
    const ydoc = documentToYDoc(doc);
    const out = documentSchema.parse(yDocToDocument(ydoc));
    expect(out).toEqual(doc);
  });
});

describe('binding — Y.Text fields', () => {
  it('AC#3 — TextElement.text lives in Y.Text; concurrent edits merge', () => {
    const doc = makeDoc();
    // Two clients hold their own Y.Doc, encode initial state, replicate.
    const a = documentToYDoc(doc);
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    const slidesA = getSlidesArray(a);
    const slidesB = getSlidesArray(b);
    expect(slidesA).toBeDefined();
    expect(slidesB).toBeDefined();
    if (!slidesA || !slidesB) return;
    const elementsA = slidesA.get(0).get('elements') as Y.Array<Y.Map<unknown>>;
    const elementsB = slidesB.get(0).get('elements') as Y.Array<Y.Map<unknown>>;
    const textA = elementsA.get(0).get('text') as Y.Text;
    const textB = elementsB.get(0).get('text') as Y.Text;
    expect(textA).toBeInstanceOf(Y.Text);
    expect(textB).toBeInstanceOf(Y.Text);

    // Concurrent edits: A inserts " A" at end, B inserts " B" at end.
    textA.insert(textA.length, ' A');
    textB.insert(textB.length, ' B');

    // Sync both directions.
    const updateA = Y.encodeStateAsUpdate(a);
    const updateB = Y.encodeStateAsUpdate(b);
    Y.applyUpdate(b, updateA);
    Y.applyUpdate(a, updateB);

    const merged = (getSlidesArray(a)?.get(0).get('elements') as Y.Array<Y.Map<unknown>>)
      .get(0)
      .get('text') as Y.Text;
    const mergedStr = merged.toString();
    // Both insertions present; original prefix preserved.
    expect(mergedStr.startsWith('Hello world')).toBe(true);
    expect(mergedStr).toContain(' A');
    expect(mergedStr).toContain(' B');
  });

  it('AC#4 — slide.notes lives in Y.Text', () => {
    const doc = makeDoc();
    const ydoc = documentToYDoc(doc);
    const slide = getSlidesArray(ydoc)?.get(0);
    expect(slide.get('notes')).toBeInstanceOf(Y.Text);
    expect((slide.get('notes') as Y.Text).toString()).toBe('Speaker notes for slide one.');
  });
});

describe('binding — Y.Array of slides/elements', () => {
  it('AC#5 — concurrent element add merges; both elements present', () => {
    const doc = makeDoc();
    const a = documentToYDoc(doc);
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    const elementsA = getSlidesArray(a)?.get(0).get('elements') as Y.Array<Y.Map<unknown>>;
    const elementsB = getSlidesArray(b)?.get(0).get('elements') as Y.Array<Y.Map<unknown>>;
    const initialLen = elementsA.length;

    elementsA.push([buildElementMap(textElement('e-from-a', 'from-a'))]);
    elementsB.push([buildElementMap(textElement('e-from-b', 'from-b'))]);

    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));

    const merged = getSlidesArray(a)?.get(0).get('elements') as Y.Array<Y.Map<unknown>>;
    expect(merged.length).toBe(initialLen + 2);
    const ids = merged.toArray().map((m) => m.get('id'));
    expect(ids).toContain('e-from-a');
    expect(ids).toContain('e-from-b');
  });
});

describe('binding — single-writer fields (LWW)', () => {
  it('AC#6 — concurrent theme.colors.primary edits resolve last-writer-wins', () => {
    const doc = makeDoc();
    const a = documentToYDoc(doc);
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    const rootA = a.getMap(ROOT_KEY);
    const rootB = b.getMap(ROOT_KEY);
    rootA.set('theme', { tokens: { 'color.primary': '#aaaaaa' } });
    rootB.set('theme', { tokens: { 'color.primary': '#bbbbbb' } });

    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));

    const themeA = (a.getMap(ROOT_KEY).get('theme') as { tokens: Record<string, string> }).tokens[
      'color.primary'
    ];
    const themeB = (b.getMap(ROOT_KEY).get('theme') as { tokens: Record<string, string> }).tokens[
      'color.primary'
    ];
    expect(themeA).toBe(themeB);
    expect(['#aaaaaa', '#bbbbbb']).toContain(themeA);
  });
});

describe('binding — meta.id immutability', () => {
  it('AC#7 — re-binding with a different meta.id throws', () => {
    const doc = makeDoc();
    const ydoc = documentToYDoc(doc);
    const altered = { ...doc, meta: { ...doc.meta, id: 'doc-XX' } };
    expect(() => documentToYDoc(altered, ydoc)).toThrow(/refusing to rebind/);
  });

  it('AC#7 — re-binding with the same meta.id is allowed (idempotent)', () => {
    const doc = makeDoc();
    const ydoc = documentToYDoc(doc);
    expect(() => documentToYDoc(doc, ydoc)).not.toThrow();
  });
});

describe('binding — getSlideMap helper', () => {
  it('returns the slide for a known id; undefined otherwise', () => {
    const doc = makeDoc();
    const ydoc = documentToYDoc(doc);
    expect(getSlideMap(ydoc, 's1')).toBeDefined();
    expect(getSlideMap(ydoc, 'missing')).toBeUndefined();
  });
});

describe('binding — slide/element build+read symmetry', () => {
  it('buildSlideMap / readSlideMap round-trip preserves structure', () => {
    const doc = makeDoc();
    if (doc.content.mode !== 'slide') throw new Error('expected slide mode');
    const slide = doc.content.slides[0];
    if (!slide) throw new Error('expected at least one slide');
    // Y.Map.forEach only works after the map is integrated into a Y.Doc.
    const ydoc = new Y.Doc();
    const arr = ydoc.getArray<Y.Map<unknown>>('test-slides');
    ydoc.transact(() => {
      arr.push([buildSlideMap(slide)]);
    });
    const out = readSlideMap(arr.get(0));
    expect(out).toEqual(slide);
  });

  it('buildElementMap / readElementMap round-trip preserves structure', () => {
    const el = textElement('e-1', 'hi');
    const ydoc = new Y.Doc();
    const arr = ydoc.getArray<Y.Map<unknown>>('test-els');
    ydoc.transact(() => {
      arr.push([buildElementMap(el)]);
    });
    expect(readElementMap(arr.get(0))).toEqual(el);
  });
});
