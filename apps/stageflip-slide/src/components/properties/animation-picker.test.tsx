// apps/stageflip-slide/src/components/properties/animation-picker.test.tsx

import { DocumentProvider, useDocument } from '@stageflip/editor-shell';
import type { Document, Element, TextElement } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { AnimationPicker, __test } from './animation-picker';
import { Hydrate, makeDoc, makeTextElement, resetAtomCaches } from './test-helpers';

afterEach(() => {
  cleanup();
  resetAtomCaches();
});

function Snapshot({ onDoc }: { onDoc: (doc: Document | null) => void }): null {
  const { document } = useDocument();
  useEffect(() => {
    onDoc(document);
  }, [document, onDoc]);
  return null;
}

function elementAt(doc: Document | null): Element | undefined {
  if (doc?.content.mode !== 'slide') return undefined;
  return doc.content.slides[0]?.elements[0];
}

describe('<AnimationPicker> — empty state', () => {
  it('shows a "none yet" message when the element has no animations', () => {
    const element = makeTextElement('el-1');
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <AnimationPicker slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('animation-empty')).toBeTruthy();
  });

  it('renders one preset button per animation kind', () => {
    const element = makeTextElement('el-1');
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <AnimationPicker slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    // The seven kinds from `@stageflip/schema`'s AnimationKind union.
    for (const kind of ['fade', 'slide', 'scale', 'rotate', 'color']) {
      expect(screen.getByTestId(`animation-preset-${kind}`)).toBeTruthy();
    }
  });
});

describe('<AnimationPicker> — add + remove', () => {
  it('clicking a preset appends an animation with the right kind + default timing', () => {
    const element = makeTextElement('el-1', { animations: [] });
    const capture: { latest: Document | null } = { latest: null };
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot
          onDoc={(d) => {
            capture.latest = d;
          }}
        />
        <AnimationPicker slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    fireEvent.click(screen.getByTestId('animation-preset-fade'));
    const el = elementAt(capture.latest) as TextElement | undefined;
    expect(el?.animations.length).toBe(1);
    const anim = el?.animations[0];
    expect(anim?.animation.kind).toBe('fade');
    expect(anim?.timing.kind).toBe('absolute');
    expect(anim?.id).toBeTruthy();
  });

  it('remove drops the targeted animation by id', () => {
    const first = __test.buildPresetAnimation('fade');
    const second = __test.buildPresetAnimation('scale');
    const element = makeTextElement('el-1', { animations: [first, second] });
    const capture: { latest: Document | null } = { latest: null };
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot
          onDoc={(d) => {
            capture.latest = d;
          }}
        />
        <AnimationPicker slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    fireEvent.click(screen.getByTestId(`animation-remove-${first.id}`));
    const el = elementAt(capture.latest) as TextElement | undefined;
    expect(el?.animations.length).toBe(1);
    expect(el?.animations[0]?.id).toBe(second.id);
  });

  it('renders the kind label for each existing animation', () => {
    const fade = __test.buildPresetAnimation('fade');
    const rotate = __test.buildPresetAnimation('rotate');
    const element = makeTextElement('el-1', { animations: [fade, rotate] });
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <AnimationPicker slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    expect(screen.getByTestId(`animation-row-${fade.id}`).textContent).toContain('Fade');
    expect(screen.getByTestId(`animation-row-${rotate.id}`).textContent).toContain('Rotate');
  });
});

describe('<AnimationPicker> — lock', () => {
  it('disables every preset and every remove button when the element is locked', () => {
    const fade = __test.buildPresetAnimation('fade');
    const element = makeTextElement('el-1', { locked: true, animations: [fade] });
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <AnimationPicker slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    expect((screen.getByTestId('animation-preset-fade') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId(`animation-remove-${fade.id}`) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('buildPresetAnimation — pure helper', () => {
  it('mints a unique id per call', () => {
    const a = __test.buildPresetAnimation('fade');
    const b = __test.buildPresetAnimation('fade');
    expect(a.id).not.toBe(b.id);
  });

  it('every built preset validates against the schema', () => {
    for (const kind of __test.EDITOR_KINDS) {
      const anim = __test.buildPresetAnimation(kind);
      expect(__test.animationSchema.safeParse(anim).success).toBe(true);
    }
  });
});
