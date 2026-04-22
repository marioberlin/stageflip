// apps/stageflip-slide/src/components/properties/slide-properties.test.tsx

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SlideProperties, __test } from './slide-properties';
import { DocProbe, Hydrate, makeDoc, resetAtomCaches, withDoc } from './test-helpers';

const { applySlideNotes, formatBackground } = __test;

afterEach(() => {
  cleanup();
  resetAtomCaches();
});

describe('<SlideProperties> — render', () => {
  it('renders id, background fallback, duration fallback, element count', () => {
    const doc = makeDoc();
    const slide = doc.content.mode === 'slide' ? doc.content.slides[0] : null;
    if (!slide) throw new Error('expected slide');
    const Wrapper = withDoc(doc);
    render(
      <Wrapper>
        <Hydrate slideId="slide-0" />
        <SlideProperties slide={slide} />
      </Wrapper>,
    );
    expect(screen.getByTestId('slide-prop-background').textContent).toMatch(/none/);
    expect(screen.getByTestId('slide-prop-duration').textContent).toMatch(/auto/);
    expect(screen.getByTestId('slide-prop-element-count').textContent).toMatch(/0/);
  });

  it('shows the slide duration in ms when set', () => {
    const doc = makeDoc({ duration: 2500 });
    const slide = doc.content.mode === 'slide' ? doc.content.slides[0] : null;
    if (!slide) throw new Error('expected slide');
    const Wrapper = withDoc(doc);
    render(
      <Wrapper>
        <SlideProperties slide={slide} />
      </Wrapper>,
    );
    expect(screen.getByTestId('slide-prop-duration').textContent).toMatch(/2500/);
  });

  it('renders a color background summary as the hex value', () => {
    const doc = makeDoc();
    if (doc.content.mode !== 'slide') throw new Error('expected slide');
    const slide = {
      ...(doc.content.slides[0] as NonNullable<(typeof doc.content.slides)[0]>),
      background: { kind: 'color' as const, value: '#081020' },
    };
    const Wrapper = withDoc({
      ...doc,
      content: { ...doc.content, slides: [slide, ...doc.content.slides.slice(1)] },
    });
    render(
      <Wrapper>
        <SlideProperties slide={slide} />
      </Wrapper>,
    );
    expect(screen.getByTestId('slide-prop-background').textContent).toMatch(/#081020/);
  });
});

describe('<SlideProperties> — notes editing', () => {
  it('commits notes to the slide via updateDocument', () => {
    const doc = makeDoc();
    const slide = doc.content.mode === 'slide' ? doc.content.slides[0] : null;
    if (!slide) throw new Error('expected slide');
    const Wrapper = withDoc(doc);
    let latest = null as ReturnType<typeof import('@stageflip/editor-shell').useDocument> | null;
    render(
      <Wrapper>
        <SlideProperties slide={slide} />
        <DocProbe
          onSnapshot={(s) => {
            latest = s;
          }}
        />
      </Wrapper>,
    );
    const notes = screen.getByTestId('slide-prop-notes') as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(notes, { target: { value: 'hello speaker' } });
    });
    const doc2 = latest?.document;
    if (doc2?.content.mode !== 'slide') throw new Error('expected slide');
    expect(doc2.content.slides[0]?.notes).toBe('hello speaker');
  });

  it('clearing the textarea removes the notes field (so "no notes" stays unset)', () => {
    const doc = makeDoc({ notes: 'existing' });
    const slide = doc.content.mode === 'slide' ? doc.content.slides[0] : null;
    if (!slide) throw new Error('expected slide');
    const Wrapper = withDoc(doc);
    let latest = null as ReturnType<typeof import('@stageflip/editor-shell').useDocument> | null;
    render(
      <Wrapper>
        <SlideProperties slide={slide} />
        <DocProbe
          onSnapshot={(s) => {
            latest = s;
          }}
        />
      </Wrapper>,
    );
    act(() => {
      fireEvent.change(screen.getByTestId('slide-prop-notes'), { target: { value: '' } });
    });
    const doc2 = latest?.document;
    if (doc2?.content.mode !== 'slide') throw new Error('expected slide');
    expect(doc2.content.slides[0]?.notes).toBeUndefined();
  });
});

describe('pure helpers', () => {
  it('applySlideNotes writes the notes field on the matching slide', () => {
    const doc = makeDoc({ slideIds: ['a', 'b'] });
    const next = applySlideNotes(doc, 'b', 'typed');
    if (next.content.mode !== 'slide') throw new Error('expected slide');
    expect(next.content.slides[0]?.notes).toBeUndefined();
    expect(next.content.slides[1]?.notes).toBe('typed');
  });

  it('formatBackground stringifies each background kind + none fallback', () => {
    const doc = makeDoc();
    const slide = doc.content.mode === 'slide' ? doc.content.slides[0] : null;
    if (!slide) throw new Error('expected slide');
    expect(formatBackground(slide)).toMatch(/none/);
    expect(formatBackground({ ...slide, background: { kind: 'color', value: '#aabbcc' } })).toBe(
      '#aabbcc',
    );
    expect(formatBackground({ ...slide, background: { kind: 'asset', value: 'asset:foo' } })).toBe(
      'asset:foo',
    );
  });
});
