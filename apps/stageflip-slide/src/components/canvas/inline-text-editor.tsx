// apps/stageflip-slide/src/components/canvas/inline-text-editor.tsx
// Contenteditable overlay that edits a text element in-canvas (T-123c).

'use client';

import { useDocument } from '@stageflip/editor-shell';
import type { Document, Element, Slide, SlideContent, TextElement } from '@stageflip/schema';
import type { CSSProperties, ReactElement, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Replaces a text element's static render with a contenteditable span
 * while it's being edited. Text round-trips through the document atom:
 *
 *   - Enter (without Shift) / blur → commit element.text from the
 *     editable's textContent.
 *   - Escape → abandon; the editable restores the pre-edit text.
 *
 * The editor mounts directly over the element's transform so the layout
 * never shifts during the edit. Font styling mirrors the text element
 * so the user sees the live-rendered output.
 *
 * Rich formatting (bold/italic/underline) is applied via
 * `<TextSelectionToolbar>`, which writes whole-element `runs[]`
 * entries through `updateDocument`. Per-range runs arrive with a later
 * inline-editor iteration.
 */

export interface InlineTextEditorProps {
  element: TextElement;
  /** Fired when the editor commits or abandons. The caller should clear
   * its editing-element-id state in response. */
  onClose: () => void;
  /** Exposes the live editor root so the toolbar can render relative to
   * it. Stable across renders. */
  editorRef?: React.MutableRefObject<HTMLElement | null>;
}

export function InlineTextEditor({
  element,
  onClose,
  editorRef,
}: InlineTextEditorProps): ReactElement {
  const { updateDocument } = useDocument();
  const localRef = useRef<HTMLSpanElement | null>(null);
  const initialTextRef = useRef<string>(element.text);

  const attach = useCallback(
    (node: HTMLSpanElement | null) => {
      localRef.current = node;
      if (editorRef) editorRef.current = node;
    },
    [editorRef],
  );

  // On mount only: write the starting text, focus the editor, and
  // select-all so the first keystroke replaces rather than inserts.
  // Deps intentionally empty — re-running on element.text change
  // would clobber the user's in-flight edit when `updateDocument`
  // fires. Mount is the only correct seam.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment.
  useLayoutEffect(() => {
    const node = localRef.current;
    if (!node) return;
    node.textContent = element.text;
    initialTextRef.current = element.text;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, []);

  const commit = useCallback(() => {
    const node = localRef.current;
    if (!node) return;
    const next = node.textContent ?? '';
    if (next !== initialTextRef.current) {
      updateDocument((doc) => updateElementText(doc, element.id, next));
    }
    onClose();
  }, [element.id, onClose, updateDocument]);

  const abandon = useCallback(() => {
    const node = localRef.current;
    if (node) node.textContent = initialTextRef.current;
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLSpanElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        commit();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        abandon();
        return;
      }
      event.stopPropagation();
    },
    [abandon, commit],
  );

  const handleBlur = useCallback(() => {
    commit();
  }, [commit]);

  // Safety: commit once on unmount if the document still has a stale
  // reference. In practice `onClose` clears the owner's state; this
  // covers tear-down from selection loss.
  useEffect(() => {
    return () => {
      // Intentionally empty — mount effect writes initial text; commit
      // goes through the blur/Enter path.
    };
  }, []);

  return (
    <span
      ref={attach}
      data-testid={`inline-text-editor-${element.id}`}
      role="textbox"
      aria-multiline="true"
      aria-label={`Edit text element ${element.id}`}
      contentEditable
      suppressContentEditableWarning
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={editorStyle(element)}
    />
  );
}

function editorStyle(element: TextElement): CSSProperties {
  const style: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    outline: '2px solid rgba(129, 174, 255, 0.6)',
    outlineOffset: 2,
    textAlign: element.align,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    padding: 0,
    margin: 0,
    background: 'rgba(15, 22, 32, 0.4)',
  };
  if (element.fontFamily) style.fontFamily = element.fontFamily;
  if (element.fontSize) style.fontSize = element.fontSize;
  if (typeof element.color === 'string') style.color = element.color;
  if (element.lineHeight) style.lineHeight = element.lineHeight;
  // If the text has any runs with formatting, reflect the first run's
  // flags across the whole element (we treat runs as whole-element
  // formatting in this iteration — see module header).
  const run = element.runs?.[0];
  if (run) {
    if (run.weight) style.fontWeight = run.weight;
    if (run.italic) style.fontStyle = 'italic';
    if (run.underline) style.textDecoration = 'underline';
  }
  return style;
}

// ---------------------------------------------------------------------------
// Mutation helper
// ---------------------------------------------------------------------------

function updateElementText(doc: Document, elementId: string, text: string): Document {
  if (doc.content.mode !== 'slide') return doc;
  const slides: Slide[] = doc.content.slides.map((slide) => ({
    ...slide,
    elements: mapElements(slide.elements, elementId, text),
  }));
  const content: SlideContent = { ...doc.content, slides };
  return { ...doc, content };
}

function mapElements(elements: Element[], elementId: string, text: string): Element[] {
  return elements.map((el) => {
    if (el.id === elementId && el.type === 'text') {
      return { ...el, text } as Element;
    }
    if (el.type === 'group') {
      return { ...el, children: mapElements(el.children, elementId, text) };
    }
    return el;
  });
}
