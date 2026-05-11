// packages/export-router/src/test-fixtures.ts
// Minimal Document fixtures shared across `*.test.ts` files. Lives outside
// `*.test.ts` to satisfy biome `lint/suspicious/noExportsInTest`.
//
// The fixtures use `as unknown as Document` casts so tests stay focused on
// the routing/walker shape without rebuilding the full schema-validated
// Document. The fields the router/walker actually inspect are real:
//   - content.mode + slides[].elements[] | tracks[].elements[] | elements[]
//   - element.type + element.id + element.family + group.children

import type { Document, Element } from '@stageflip/schema';

export function textEl(id: string): Element {
  return {
    id,
    type: 'text',
    transform: { x: 0, y: 0, width: 100, height: 20, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    runs: [{ text: 'hello', style: {} }],
  } as unknown as Element;
}

export function liveClip(id: string, family: string): Element {
  return {
    id,
    type: 'interactive-clip',
    family,
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    staticFallback: [textEl(`${id}-fallback-text`)],
    liveMount: {
      component: { module: '@stageflip/runtimes-interactive/clips/shader#ShaderClip' },
      props: {},
      permissions: [],
    },
  } as unknown as Element;
}

export function group(id: string, children: Element[]): Element {
  return {
    id,
    type: 'group',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    children,
    clip: false,
  } as unknown as Element;
}

export function slideDoc(elementsPerSlide: Element[][]): Document {
  return {
    meta: {
      id: 'doc-test',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: {} as never,
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: {
      mode: 'slide',
      slides: elementsPerSlide.map((els, i) => ({
        id: `slide-${i + 1}`,
        elements: els,
      })),
    },
  } as unknown as Document;
}

export function videoDoc(tracksOfElements: Element[][]): Document {
  return {
    meta: {
      id: 'doc-video',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: {} as never,
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: {
      mode: 'video',
      tracks: tracksOfElements.map((els, i) => ({
        id: `track-${i + 1}`,
        kind: 'visual',
        muted: false,
        elements: els,
      })),
    },
  } as unknown as Document;
}

export function displayDoc(els: Element[]): Document {
  return {
    meta: {
      id: 'doc-display',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: {} as never,
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: {
      mode: 'display',
      sizes: [{ id: 'sz-1', width: 300, height: 250 }],
      durationMs: 15000,
      budget: {
        totalZipKb: 200,
        externalFontsAllowed: false,
        externalFontsKbCap: 0,
        assetsInlined: true,
      },
      elements: els,
    },
  } as unknown as Document;
}
