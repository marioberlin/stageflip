// apps/stageflip-slide/src/components/properties/test-helpers.tsx
// Shared test scaffolding for the properties-panel suite.

import {
  DocumentProvider,
  __clearElementByIdCacheForTest,
  __clearSlideByIdCacheForTest,
  useDocument,
} from '@stageflip/editor-shell';
import type { Document, Element, Slide, TextElement } from '@stageflip/schema';
import type React from 'react';
import { useEffect } from 'react';

export function makeTextElement(id: string, overrides: Partial<TextElement> = {}): TextElement {
  return {
    id,
    transform: {
      x: 10,
      y: 20,
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
    ...overrides,
  } satisfies TextElement;
}

export function makeDoc({
  slideIds = ['slide-0'],
  elements = [],
  notes,
  duration,
}: {
  slideIds?: string[];
  elements?: Element[];
  notes?: string;
  duration?: number;
} = {}): Document {
  const slides: Slide[] = slideIds.map((id, index) => {
    const slide: Slide = {
      id,
      elements: index === 0 ? elements : [],
    };
    if (notes !== undefined) slide.notes = notes;
    if (duration !== undefined) slide.durationMs = duration;
    return slide;
  });
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
    content: { mode: 'slide', slides },
  };
}

export function resetAtomCaches(): void {
  __clearSlideByIdCacheForTest();
  __clearElementByIdCacheForTest();
}

/**
 * Seeds the active slide + optionally a single-element selection on mount
 * so rendered properties components resolve their atoms at first paint.
 */
export function Hydrate({
  slideId,
  elementId,
}: {
  slideId: string;
  elementId?: string;
}): null {
  const { setActiveSlide, selectElements } = useDocument();
  useEffect(() => {
    setActiveSlide(slideId);
    if (elementId) selectElements(new Set([elementId]));
  }, [setActiveSlide, selectElements, slideId, elementId]);
  return null;
}

export function withDoc(doc: Document): React.ComponentType<{ children: React.ReactNode }> {
  return ({ children }) => <DocumentProvider initialDocument={doc}>{children}</DocumentProvider>;
}

export function DocProbe({
  onSnapshot,
}: {
  onSnapshot: (snapshot: ReturnType<typeof useDocument>) => void;
}): null {
  const snapshot = useDocument();
  onSnapshot(snapshot);
  return null;
}
