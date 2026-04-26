// packages/editor-shell/src/test-fixtures/document-fixture.ts
// Deterministic Document builders for atom + context tests. Keeps test
// files short and surfaces one knob per test intent (slide count,
// elements per slide).

import type { Document, Element, Slide, TextElement } from '@stageflip/schema';

function makeTextElement(id: string): TextElement {
  return {
    id,
    transform: {
      x: 0,
      y: 0,
      width: 200,
      height: 60,
      rotation: 0,
      opacity: 1,
    },
    visible: true,
    locked: false,
    animations: [],
    type: 'text',
    text: `Text ${id}`,
    align: 'left',
  } satisfies TextElement;
}

function makeSlide(id: string, elementsPerSlide: number): Slide {
  const elements: Element[] = [];
  for (let i = 0; i < elementsPerSlide; i += 1) {
    elements.push(makeTextElement(`${id}-el-${i}`));
  }
  return { id, elements };
}

export function makeSlideDoc({
  slideCount = 1,
  elementsPerSlide = 0,
}: {
  slideCount?: number;
  elementsPerSlide?: number;
}): Document {
  const slides: Slide[] = [];
  for (let i = 0; i < slideCount; i += 1) {
    slides.push(makeSlide(`slide-${i}`, elementsPerSlide));
  }
  return {
    meta: {
      id: 'doc-test',
      version: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: { mode: 'slide', slides },
  } satisfies Document;
}
