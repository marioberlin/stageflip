// apps/stageflip-slide/src/components/properties/selected-element-properties.test.tsx

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SelectedElementProperties, __test } from './selected-element-properties';
import {
  DocProbe,
  Hydrate,
  makeDoc,
  makeTextElement,
  resetAtomCaches,
  withDoc,
} from './test-helpers';

const { applyElementPatch, removeElement, reorderElement } = __test;

afterEach(() => {
  cleanup();
  resetAtomCaches();
});

describe('<SelectedElementProperties> — render', () => {
  it('prefills the position/size/rotation/opacity fields from the element', () => {
    const element = makeTextElement('el-1', {
      transform: { x: 10, y: 20, width: 100, height: 40, rotation: 15, opacity: 0.5 },
    });
    const doc = makeDoc({ elements: [element] });
    const Wrapper = withDoc(doc);
    render(
      <Wrapper>
        <Hydrate slideId="slide-0" elementId="el-1" />
        <SelectedElementProperties slideId="slide-0" element={element} />
      </Wrapper>,
    );
    expect((screen.getByTestId('prop-x') as HTMLInputElement).value).toBe('10');
    expect((screen.getByTestId('prop-y') as HTMLInputElement).value).toBe('20');
    expect((screen.getByTestId('prop-w') as HTMLInputElement).value).toBe('100');
    expect((screen.getByTestId('prop-h') as HTMLInputElement).value).toBe('40');
    expect((screen.getByTestId('prop-rotation') as HTMLInputElement).value).toBe('15');
    expect((screen.getByTestId('prop-opacity') as HTMLInputElement).value).toBe('50');
  });

  it('disables mutating controls when the element is locked (delete too)', () => {
    const element = makeTextElement('el-1', { locked: true });
    const doc = makeDoc({ elements: [element] });
    const Wrapper = withDoc(doc);
    render(
      <Wrapper>
        <Hydrate slideId="slide-0" elementId="el-1" />
        <SelectedElementProperties slideId="slide-0" element={element} />
      </Wrapper>,
    );
    expect((screen.getByTestId('prop-x') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('prop-opacity') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('prop-delete') as HTMLButtonElement).disabled).toBe(true);
    // Lock toggle stays enabled so the user can unlock.
    expect((screen.getByTestId('prop-locked') as HTMLInputElement).disabled).toBe(false);
  });

  it('renders the deferred-editors placeholder', () => {
    const element = makeTextElement('el-1');
    const doc = makeDoc({ elements: [element] });
    const Wrapper = withDoc(doc);
    render(
      <Wrapper>
        <SelectedElementProperties slideId="slide-0" element={element} />
      </Wrapper>,
    );
    expect(screen.getByTestId('prop-type-placeholder').textContent).toMatch(/T-125b/);
  });
});

describe('<SelectedElementProperties> — mutations via updateDocument', () => {
  it('X blur commits a new transform.x to the element atom', () => {
    const element = makeTextElement('el-1');
    const doc = makeDoc({ elements: [element] });
    const Wrapper = withDoc(doc);
    let latest = null as ReturnType<typeof import('@stageflip/editor-shell').useDocument> | null;
    render(
      <Wrapper>
        <Hydrate slideId="slide-0" elementId="el-1" />
        <SelectedElementProperties slideId="slide-0" element={element} />
        <DocProbe
          onSnapshot={(s) => {
            latest = s;
          }}
        />
      </Wrapper>,
    );
    const input = screen.getByTestId('prop-x') as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: '250' } });
      fireEvent.blur(input);
    });
    const doc2 = latest?.document;
    if (doc2?.content.mode !== 'slide') throw new Error('expected slide');
    const el2 = doc2.content.slides[0]?.elements[0];
    expect(el2?.transform.x).toBe(250);
  });

  it('opacity slider writes transform.opacity in 0..1', () => {
    const element = makeTextElement('el-1');
    const doc = makeDoc({ elements: [element] });
    const Wrapper = withDoc(doc);
    let latest = null as ReturnType<typeof import('@stageflip/editor-shell').useDocument> | null;
    render(
      <Wrapper>
        <Hydrate slideId="slide-0" elementId="el-1" />
        <SelectedElementProperties slideId="slide-0" element={element} />
        <DocProbe
          onSnapshot={(s) => {
            latest = s;
          }}
        />
      </Wrapper>,
    );
    act(() => {
      fireEvent.change(screen.getByTestId('prop-opacity'), { target: { value: '25' } });
    });
    const doc2 = latest?.document;
    if (doc2?.content.mode !== 'slide') throw new Error('expected slide');
    const el2 = doc2.content.slides[0]?.elements[0];
    expect(el2?.transform.opacity).toBe(0.25);
  });

  it('visible / locked toggles flip the element flags', () => {
    const element = makeTextElement('el-1');
    const doc = makeDoc({ elements: [element] });
    const Wrapper = withDoc(doc);
    let latest = null as ReturnType<typeof import('@stageflip/editor-shell').useDocument> | null;
    render(
      <Wrapper>
        <Hydrate slideId="slide-0" elementId="el-1" />
        <SelectedElementProperties slideId="slide-0" element={element} />
        <DocProbe
          onSnapshot={(s) => {
            latest = s;
          }}
        />
      </Wrapper>,
    );
    act(() => {
      fireEvent.click(screen.getByTestId('prop-visible'));
    });
    const doc2 = latest?.document;
    if (doc2?.content.mode !== 'slide') throw new Error('expected slide');
    expect(doc2.content.slides[0]?.elements[0]?.visible).toBe(false);
    act(() => {
      fireEvent.click(screen.getByTestId('prop-locked'));
    });
    const doc3 = latest?.document;
    if (doc3?.content.mode !== 'slide') throw new Error('expected slide');
    expect(doc3.content.slides[0]?.elements[0]?.locked).toBe(true);
  });

  it('delete removes the element and clears selection', () => {
    const el1 = makeTextElement('el-1');
    const el2 = makeTextElement('el-2');
    const doc = makeDoc({ elements: [el1, el2] });
    const Wrapper = withDoc(doc);
    let latest = null as ReturnType<typeof import('@stageflip/editor-shell').useDocument> | null;
    render(
      <Wrapper>
        <Hydrate slideId="slide-0" elementId="el-1" />
        <SelectedElementProperties slideId="slide-0" element={el1} />
        <DocProbe
          onSnapshot={(s) => {
            latest = s;
          }}
        />
      </Wrapper>,
    );
    act(() => {
      fireEvent.click(screen.getByTestId('prop-delete'));
    });
    const doc2 = latest?.document;
    if (doc2?.content.mode !== 'slide') throw new Error('expected slide');
    const ids = doc2.content.slides[0]?.elements.map((e) => e.id) ?? [];
    expect(ids).toEqual(['el-2']);
    expect(latest?.selectedElementIds.size).toBe(0);
  });

  it('undo via T-133 rolls back the last transform commit', () => {
    const element = makeTextElement('el-1');
    const doc = makeDoc({ elements: [element] });
    const Wrapper = withDoc(doc);
    let latest = null as ReturnType<typeof import('@stageflip/editor-shell').useDocument> | null;
    render(
      <Wrapper>
        <Hydrate slideId="slide-0" elementId="el-1" />
        <SelectedElementProperties slideId="slide-0" element={element} />
        <DocProbe
          onSnapshot={(s) => {
            latest = s;
          }}
        />
      </Wrapper>,
    );
    const input = screen.getByTestId('prop-x') as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: '999' } });
      fireEvent.blur(input);
    });
    expect(latest?.canUndo).toBe(true);
    act(() => {
      latest?.undo();
    });
    const doc2 = latest?.document;
    if (doc2?.content.mode !== 'slide') throw new Error('expected slide');
    expect(doc2.content.slides[0]?.elements[0]?.transform.x).toBe(10);
  });
});

describe('pure mutations (applyElementPatch / removeElement / reorderElement)', () => {
  const slideId = 'slide-0';
  const el = (id: string) => makeTextElement(id);
  const baseDoc = () => makeDoc({ elements: [el('a'), el('b'), el('c')] });

  it('applyElementPatch updates the matching element in the matching slide', () => {
    const next = applyElementPatch(baseDoc(), slideId, 'b', (e) => ({ ...e, visible: false }));
    if (next.content.mode !== 'slide') throw new Error('expected slide');
    expect(next.content.slides[0]?.elements[1]?.visible).toBe(false);
    // Other elements untouched.
    expect(next.content.slides[0]?.elements[0]?.visible).toBe(true);
  });

  it('removeElement filters the matching element', () => {
    const next = removeElement(baseDoc(), slideId, 'b');
    if (next.content.mode !== 'slide') throw new Error('expected slide');
    expect(next.content.slides[0]?.elements.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it.each([
    { direction: 'front', expected: ['a', 'c', 'b'] },
    { direction: 'forward', expected: ['a', 'c', 'b'] },
    { direction: 'back', expected: ['b', 'a', 'c'] },
    { direction: 'bottom', expected: ['b', 'a', 'c'] },
  ])('reorderElement($direction) arranges z-order correctly', ({ direction, expected }) => {
    const next = reorderElement(
      baseDoc(),
      slideId,
      'b',
      direction as 'front' | 'forward' | 'back' | 'bottom',
    );
    if (next.content.mode !== 'slide') throw new Error('expected slide');
    expect(next.content.slides[0]?.elements.map((e) => e.id)).toEqual(expected);
  });

  it('reorderElement on a missing element returns the slide unchanged', () => {
    const input = baseDoc();
    const next = reorderElement(input, slideId, 'missing', 'front');
    expect(next).toEqual(input);
  });
});
