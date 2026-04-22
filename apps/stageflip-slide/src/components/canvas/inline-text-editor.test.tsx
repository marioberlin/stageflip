// apps/stageflip-slide/src/components/canvas/inline-text-editor.test.tsx
// Commit-on-blur, commit-on-Enter, abandon-on-Escape for T-123c.

import { DocumentProvider, useDocument } from '@stageflip/editor-shell';
import type { Document, Slide, TextElement } from '@stageflip/schema';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineTextEditor } from './inline-text-editor';

afterEach(() => {
  cleanup();
});

function baseTextElement(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'el-text',
    type: 'text',
    transform: { x: 0, y: 0, width: 400, height: 80, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    text: 'Hello',
    align: 'left',
    ...overrides,
  } as TextElement;
}

function makeDocWith(element: TextElement): Document {
  const slide: Slide = { id: 'slide-0', elements: [element] };
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
    content: { mode: 'slide', slides: [slide] },
  } as Document;
}

function Probe({
  onText,
  elementId,
}: {
  onText: (text: string | null) => void;
  elementId: string;
}): null {
  const { document: doc } = useDocument();
  useEffect(() => {
    if (!doc || doc.content.mode !== 'slide') {
      onText(null);
      return;
    }
    for (const slide of doc.content.slides) {
      const match = slide.elements.find((el) => el.id === elementId);
      if (match && match.type === 'text') {
        onText(match.text);
        return;
      }
    }
    onText(null);
  }, [doc, elementId, onText]);
  return null;
}

describe('<InlineTextEditor>', () => {
  it('mounts a contenteditable pre-populated with the element text', () => {
    const element = baseTextElement({ text: 'Initial' });
    const onClose = vi.fn();
    render(
      <DocumentProvider initialDocument={makeDocWith(element)}>
        <InlineTextEditor element={element} onClose={onClose} />
      </DocumentProvider>,
    );
    const editor = screen.getByTestId(`inline-text-editor-${element.id}`);
    expect(editor.getAttribute('contenteditable')).toBe('true');
    expect(editor.textContent).toBe('Initial');
  });

  it('commits the edited text on Enter', () => {
    const element = baseTextElement({ text: 'before' });
    const onClose = vi.fn();
    const texts: Array<string | null> = [];
    render(
      <DocumentProvider initialDocument={makeDocWith(element)}>
        <Probe elementId={element.id} onText={(t) => texts.push(t)} />
        <InlineTextEditor element={element} onClose={onClose} />
      </DocumentProvider>,
    );
    const editor = screen.getByTestId(`inline-text-editor-${element.id}`);
    act(() => {
      editor.textContent = 'after';
    });
    act(() => {
      fireEvent.keyDown(editor, { key: 'Enter' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(texts[texts.length - 1]).toBe('after');
  });

  it('commits the edited text on blur', () => {
    const element = baseTextElement({ text: 'before' });
    const onClose = vi.fn();
    const texts: Array<string | null> = [];
    render(
      <DocumentProvider initialDocument={makeDocWith(element)}>
        <Probe elementId={element.id} onText={(t) => texts.push(t)} />
        <InlineTextEditor element={element} onClose={onClose} />
      </DocumentProvider>,
    );
    const editor = screen.getByTestId(`inline-text-editor-${element.id}`);
    act(() => {
      editor.textContent = 'blurred';
    });
    act(() => {
      fireEvent.blur(editor);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(texts[texts.length - 1]).toBe('blurred');
  });

  it('abandons on Escape without writing to the document', () => {
    const element = baseTextElement({ text: 'keep-me' });
    const onClose = vi.fn();
    const texts: Array<string | null> = [];
    render(
      <DocumentProvider initialDocument={makeDocWith(element)}>
        <Probe elementId={element.id} onText={(t) => texts.push(t)} />
        <InlineTextEditor element={element} onClose={onClose} />
      </DocumentProvider>,
    );
    const editor = screen.getByTestId(`inline-text-editor-${element.id}`);
    act(() => {
      editor.textContent = 'throwaway';
    });
    act(() => {
      fireEvent.keyDown(editor, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(texts[texts.length - 1]).toBe('keep-me');
  });

  it('does not commit when the text has not changed (document reference stays stable)', () => {
    // Track the doc reference, not just its .text — if updateDocument
    // were called with the same value, a new document object would be
    // produced and we'd see a reference change here. The guard must
    // short-circuit that call entirely.
    const element = baseTextElement({ text: 'same' });
    const initialDoc = makeDocWith(element);
    const onClose = vi.fn();
    const docRefs: Array<Document | null> = [];

    function DocRefProbe(): null {
      const { document: doc } = useDocument();
      useEffect(() => {
        docRefs.push(doc);
      }, [doc]);
      return null;
    }

    render(
      <DocumentProvider initialDocument={initialDoc}>
        <DocRefProbe />
        <InlineTextEditor element={element} onClose={onClose} />
      </DocumentProvider>,
    );
    const editor = screen.getByTestId(`inline-text-editor-${element.id}`);
    act(() => {
      fireEvent.blur(editor);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Every observed doc reference is the same instance — no new
    // updateDocument call happened.
    expect(docRefs.length).toBeGreaterThan(0);
    for (const d of docRefs) expect(d).toBe(initialDoc);
  });

  it('marks itself as contenteditable so the shortcut registry suppresses bare-key shortcuts', () => {
    // The ShortcutRegistryProvider (T-121a) filters keydowns whose target
    // is `isContentEditable`. Asserting the editor element carries that
    // flag is the real contract for "shortcuts stay off during edit" —
    // React's synthetic `stopPropagation` doesn't stop native DOM
    // bubbling, so we can't assert that directly.
    const element = baseTextElement();
    const onClose = vi.fn();
    render(
      <DocumentProvider initialDocument={makeDocWith(element)}>
        <InlineTextEditor element={element} onClose={onClose} />
      </DocumentProvider>,
    );
    const editor = screen.getByTestId(`inline-text-editor-${element.id}`);
    expect(editor.isContentEditable).toBe(true);
  });
});
