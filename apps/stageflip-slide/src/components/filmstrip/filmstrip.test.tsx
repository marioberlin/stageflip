// apps/stageflip-slide/src/components/filmstrip/filmstrip.test.tsx
// Click / shift-click / add-slide wiring for the T-124 filmstrip.

import {
  DocumentProvider,
  __clearElementByIdCacheForTest,
  __clearSlideByIdCacheForTest,
  useDocument,
} from '@stageflip/editor-shell';
import type { Document, Slide } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Filmstrip } from './filmstrip';

afterEach(() => {
  cleanup();
  __clearSlideByIdCacheForTest();
  __clearElementByIdCacheForTest();
});

function makeDoc(slideIds: string[]): Document {
  const slides: Slide[] = slideIds.map((id) => ({ id, elements: [] }) as Slide);
  return {
    meta: {
      id: 'doc',
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
  } as Document;
}

function Hydrate({ slideId }: { slideId: string }): null {
  const { setActiveSlide } = useDocument();
  useEffect(() => {
    setActiveSlide(slideId);
  }, [setActiveSlide, slideId]);
  return null;
}

function ActiveProbe({
  onSnapshot,
}: {
  onSnapshot: (snapshot: {
    active: string;
    selected: string[];
    slides: string[];
  }) => void;
}): null {
  const { document: doc, activeSlideId, selectedSlideIds } = useDocument();
  useEffect(() => {
    const slides = doc && doc.content.mode === 'slide' ? doc.content.slides.map((s) => s.id) : [];
    onSnapshot({
      active: activeSlideId,
      selected: [...selectedSlideIds],
      slides,
    });
  });
  return null;
}

function renderWith(
  slideIds: string[],
  onSnapshot: (s: { active: string; selected: string[]; slides: string[] }) => void,
  initialActive = slideIds[0] ?? '',
) {
  return render(
    <DocumentProvider initialDocument={makeDoc(slideIds)}>
      <Hydrate slideId={initialActive} />
      <ActiveProbe onSnapshot={onSnapshot} />
      <Filmstrip />
    </DocumentProvider>,
  );
}

describe('<Filmstrip> — rendering', () => {
  it('renders one thumbnail per slide with 1-based index labels', () => {
    renderWith(['a', 'b', 'c'], () => {});
    expect(screen.getByTestId('filmstrip')).toBeTruthy();
    for (const id of ['a', 'b', 'c']) {
      expect(screen.getByTestId(`filmstrip-slide-${id}`)).toBeTruthy();
      expect(screen.getByTestId(`slide-thumbnail-${id}`)).toBeTruthy();
    }
    // Index labels 1..3 appear alongside each slide.
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('marks the active slide with data-active + aria-current', () => {
    renderWith(['a', 'b'], () => {}, 'b');
    const active = screen.getByTestId('filmstrip-slide-b');
    expect(active.getAttribute('data-active')).toBe('true');
    expect(active.getAttribute('aria-current')).toBe('true');
  });

  it('renders nothing when the document is null', () => {
    render(
      <DocumentProvider initialDocument={null}>
        <Filmstrip />
      </DocumentProvider>,
    );
    expect(screen.queryByTestId('filmstrip')).toBeNull();
  });
});

describe('<Filmstrip> — click + select', () => {
  it('click sets the active slide and replaces the selection set', () => {
    let snapshot = { active: '', selected: [] as string[], slides: [] as string[] };
    renderWith(['a', 'b'], (s) => {
      snapshot = s;
    });
    fireEvent.click(screen.getByTestId('filmstrip-slide-b'));
    expect(snapshot.active).toBe('b');
    expect(snapshot.selected).toEqual(['b']);
  });

  it('shift-click toggles multi-select without changing the active slide', () => {
    let snapshot = { active: '', selected: [] as string[], slides: [] as string[] };
    renderWith(['a', 'b', 'c'], (s) => {
      snapshot = s;
    });
    // First: plain click on 'a' — active + selected = ['a'].
    fireEvent.click(screen.getByTestId('filmstrip-slide-a'));
    expect(snapshot.active).toBe('a');
    expect(snapshot.selected).toEqual(['a']);
    // Shift-click 'b' — 'a' stays active, selected becomes {a, b}.
    fireEvent.click(screen.getByTestId('filmstrip-slide-b'), { shiftKey: true });
    expect(snapshot.active).toBe('a');
    expect([...snapshot.selected].sort()).toEqual(['a', 'b']);
    // Shift-click 'b' again — removes it from the selection.
    fireEvent.click(screen.getByTestId('filmstrip-slide-b'), { shiftKey: true });
    expect(snapshot.selected).toEqual(['a']);
  });
});

describe('<Filmstrip> — add slide', () => {
  it('appends a new slide and activates it', () => {
    let snapshot = { active: '', selected: [] as string[], slides: [] as string[] };
    renderWith(['a'], (s) => {
      snapshot = s;
    });
    expect(snapshot.slides).toEqual(['a']);
    fireEvent.click(screen.getByTestId('filmstrip-add-slide'));
    expect(snapshot.slides.length).toBe(2);
    const addedId = snapshot.slides[1] ?? '';
    expect(addedId).not.toBe('a');
    expect(snapshot.active).toBe(addedId);
  });
});

describe('<Filmstrip> — non-slide document modes', () => {
  it('renders an empty rail for video / display documents', () => {
    const doc = {
      meta: {
        id: 'doc',
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
      content: { mode: 'video', tracks: [] as unknown[] },
    } as unknown as Document;
    render(
      <DocumentProvider initialDocument={doc}>
        <Filmstrip />
      </DocumentProvider>,
    );
    const rail = screen.getByTestId('filmstrip');
    expect(rail.querySelector('li')).toBeNull();
  });
});

// Unused react ref — keeps TS clean when the harness tightens.
function _noop(): React.ReactElement {
  return <Filmstrip />;
}
void _noop;
