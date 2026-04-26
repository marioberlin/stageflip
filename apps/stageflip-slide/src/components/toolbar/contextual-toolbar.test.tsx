// apps/stageflip-slide/src/components/toolbar/contextual-toolbar.test.tsx

import { EditorShell, useDocument } from '@stageflip/editor-shell';
import type { Document, Element } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ContextualToolbar, __test } from './contextual-toolbar';

afterEach(() => cleanup());

const TEXT_EL: Element = {
  id: 'e-text',
  type: 'text',
  transform: { x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  text: 'Hi',
  align: 'left',
};

const SHAPE_EL: Element = {
  id: 'e-shape',
  type: 'shape',
  transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  shape: 'rect',
  fill: '#81aeff',
};

const IMAGE_EL: Element = {
  id: 'e-image',
  type: 'image',
  transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  src: 'asset:img',
  fit: 'cover',
};

function buildDoc(elements: Element[]): Document {
  return {
    meta: {
      id: 'd',
      version: 0,
      createdAt: '2026-04-23T00:00:00.000Z',
      updatedAt: '2026-04-23T00:00:00.000Z',
      title: 'T',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: {
      mode: 'slide',
      slides: [{ id: 's1', elements }],
    },
  };
}

function Select({ id }: { id: string | null }): null {
  const { selectElements } = useDocument();
  useEffect(() => {
    selectElements(id ? new Set([id]) : new Set());
  }, [id, selectElements]);
  return null;
}

function mount(doc: Document, selectedId: string | null): ReactElement {
  return (
    <EditorShell initialDocument={doc}>
      <Select id={selectedId} />
      <ContextualToolbar />
    </EditorShell>
  );
}

describe('<ContextualToolbar />', () => {
  it('renders nothing when no element is selected', () => {
    render(mount(buildDoc([TEXT_EL]), null));
    expect(screen.queryByTestId('contextual-toolbar')).toBeNull();
  });

  it('routes to the text variant for text-element selection', () => {
    render(mount(buildDoc([TEXT_EL]), TEXT_EL.id));
    const root = screen.getByTestId('contextual-toolbar');
    expect(root.getAttribute('data-element-type')).toBe('text');
    expect(screen.getByTestId('contextual-toolbar-bold')).toBeTruthy();
    expect(screen.getByTestId('contextual-toolbar-italic')).toBeTruthy();
    expect(screen.getByTestId('contextual-toolbar-underline')).toBeTruthy();
    expect(screen.getByTestId('contextual-toolbar-align-left')).toBeTruthy();
    expect(screen.getByTestId('contextual-toolbar-align-center')).toBeTruthy();
    expect(screen.getByTestId('contextual-toolbar-align-right')).toBeTruthy();
    expect(screen.getByTestId('contextual-toolbar-font-size')).toBeTruthy();
  });

  it('routes to the shape variant for shape selection', () => {
    render(mount(buildDoc([SHAPE_EL]), SHAPE_EL.id));
    expect(screen.getByTestId('contextual-toolbar-fill').textContent).toContain('#81aeff');
    expect(screen.getByTestId('contextual-toolbar-stroke')).toBeTruthy();
  });

  it('routes to the image variant for image selection', () => {
    render(mount(buildDoc([IMAGE_EL]), IMAGE_EL.id));
    expect(screen.getByTestId('contextual-toolbar-crop')).toBeTruthy();
    expect(screen.getByTestId('contextual-toolbar-filter')).toBeTruthy();
  });

  it('positions absolutely at an anchor when provided', () => {
    function Anchored(): ReactElement {
      return (
        <EditorShell initialDocument={buildDoc([TEXT_EL])}>
          <Select id={TEXT_EL.id} />
          <ContextualToolbar anchor={{ x: 123, y: 456 }} />
        </EditorShell>
      );
    }
    render(<Anchored />);
    const el = screen.getByTestId('contextual-toolbar') as HTMLElement;
    expect(el.style.position).toBe('absolute');
    expect(el.style.top).toBe('456px');
    expect(el.style.left).toBe('123px');
  });

  it('lays out inline (no absolute position) without an anchor', () => {
    render(mount(buildDoc([TEXT_EL]), TEXT_EL.id));
    const el = screen.getByTestId('contextual-toolbar') as HTMLElement;
    // Inline layout uses relative flex — top/left should be unset.
    expect(el.style.position).not.toBe('absolute');
  });

  it('toggles bold on click', () => {
    function Capture({ onDoc }: { onDoc: (doc: Document | null) => void }): null {
      const { document } = useDocument();
      useEffect(() => {
        onDoc(document);
      }, [document, onDoc]);
      return null;
    }
    const captured: Array<Document | null> = [];
    render(
      <EditorShell initialDocument={buildDoc([TEXT_EL])}>
        <Select id={TEXT_EL.id} />
        <ContextualToolbar />
        <Capture onDoc={(d) => captured.push(d)} />
      </EditorShell>,
    );
    fireEvent.click(screen.getByTestId('contextual-toolbar-bold'));
    const latest = captured.at(-1);
    const slide = latest?.content.mode === 'slide' ? latest.content.slides[0] : null;
    const element = slide?.elements[0];
    if (element?.type !== 'text') throw new Error('expected text element');
    expect(element.runs?.[0]?.weight).toBe(700);
  });

  it('sets text alignment via the variant buttons', () => {
    function Capture({ onDoc }: { onDoc: (doc: Document | null) => void }): null {
      const { document } = useDocument();
      useEffect(() => {
        onDoc(document);
      }, [document, onDoc]);
      return null;
    }
    const captured: Array<Document | null> = [];
    render(
      <EditorShell initialDocument={buildDoc([TEXT_EL])}>
        <Select id={TEXT_EL.id} />
        <ContextualToolbar />
        <Capture onDoc={(d) => captured.push(d)} />
      </EditorShell>,
    );
    fireEvent.click(screen.getByTestId('contextual-toolbar-align-center'));
    const latest = captured.at(-1);
    const slide = latest?.content.mode === 'slide' ? latest.content.slides[0] : null;
    const element = slide?.elements[0];
    if (element?.type !== 'text') throw new Error('expected text element');
    expect(element.align).toBe('center');
  });

  it('repositions when the anchor prop changes', () => {
    function AnchoredWrapper({ x, y }: { x: number; y: number }): ReactElement {
      return (
        <EditorShell initialDocument={buildDoc([TEXT_EL])}>
          <Select id={TEXT_EL.id} />
          <ContextualToolbar anchor={{ x, y }} />
        </EditorShell>
      );
    }
    const { rerender } = render(<AnchoredWrapper x={10} y={20} />);
    let el = screen.getByTestId('contextual-toolbar') as HTMLElement;
    expect(el.style.left).toBe('10px');
    rerender(<AnchoredWrapper x={100} y={200} />);
    el = screen.getByTestId('contextual-toolbar') as HTMLElement;
    expect(el.style.left).toBe('100px');
    expect(el.style.top).toBe('200px');
  });
});

describe('contextual toolbar mutators', () => {
  it('clamps weights to the schema-allowed range', () => {
    const doc = buildDoc([TEXT_EL]);
    const out = __test.patchTextRun(doc, TEXT_EL.id, { weight: 999 });
    const slide = out.content.mode === 'slide' ? out.content.slides[0] : null;
    const el = slide?.elements[0];
    if (el?.type !== 'text') throw new Error('expected text element');
    expect(el.runs?.[0]?.weight).toBe(900);
  });

  it('strips runs when no format is active', () => {
    const withRun: Document = buildDoc([
      { ...TEXT_EL, runs: [{ text: TEXT_EL.text, weight: 700 }] } as Element,
    ]);
    const out = __test.patchTextRun(withRun, TEXT_EL.id, { weight: 400 });
    const slide = out.content.mode === 'slide' ? out.content.slides[0] : null;
    const el = slide?.elements[0];
    if (el?.type !== 'text') throw new Error('expected text element');
    expect(el.runs).toBeUndefined();
  });

  it('derives bold/italic/underline from the first run', () => {
    const f = __test.deriveTextFormatting({
      ...(TEXT_EL as Extract<Element, { type: 'text' }>),
      runs: [{ text: 'x', weight: 800, italic: true, underline: true }],
    });
    expect(f).toEqual({ bold: true, italic: true, underline: true });
  });
});
