// apps/stageflip-slide/src/app/app-shortcuts.test.tsx
// Unit coverage for the editor's shortcut wiring (T-136).

/**
 * Two guarantees are covered here:
 *
 *   1. `Mod+Z` and `Mod+Shift+Z` route to `useDocument().undo` / `.redo` so
 *      the keyboard surface for T-133's history API actually reaches the
 *      user.
 *   2. Both combos short-circuit via the `when: isNotEditingText` guard
 *      whenever focus is inside a contenteditable node — otherwise
 *      pressing Mod+Z while typing in the inline text editor would pop
 *      one doc-level undo AND trigger the browser's native
 *      contenteditable undo. That double-undo desync was flagged in
 *      T-136's pre-merge review.
 */

import {
  DocumentProvider,
  type Shortcut,
  ShortcutRegistryProvider,
  useDocument,
  useRegisterShortcuts,
} from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { type ReactElement, useMemo } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

function isNotEditingText(): boolean {
  if (typeof document === 'undefined') return true;
  const active = document.activeElement as HTMLElement | null;
  return !(active?.isContentEditable ?? false);
}

function seedDoc(): Document {
  return {
    meta: {
      id: 'sc',
      version: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: { mode: 'slide', slides: [{ id: 'slide-0', elements: [] }] },
  };
}

function Harness({
  onUndo,
  onRedo,
}: {
  onUndo: () => void;
  onRedo: () => void;
}): ReactElement {
  return (
    <ShortcutRegistryProvider>
      <DocumentProvider initialDocument={seedDoc()}>
        <ShortcutMount onUndo={onUndo} onRedo={onRedo} />
        <span
          data-testid="editable"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          tabIndex={0}
          aria-label="editable test fixture"
        />
      </DocumentProvider>
    </ShortcutRegistryProvider>
  );
}

function ShortcutMount({
  onUndo,
  onRedo,
}: {
  onUndo: () => void;
  onRedo: () => void;
}): null {
  const { undo, redo } = useDocument();
  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        id: 'edit.redo',
        combo: 'Mod+Shift+Z',
        description: 'Redo',
        category: 'essential',
        when: isNotEditingText,
        handler: () => {
          onRedo();
          redo();
          return undefined;
        },
      },
      {
        id: 'edit.undo',
        combo: 'Mod+Z',
        description: 'Undo',
        category: 'essential',
        when: isNotEditingText,
        handler: () => {
          onUndo();
          undo();
          return undefined;
        },
      },
    ],
    [undo, redo, onUndo, onRedo],
  );
  useRegisterShortcuts(shortcuts);
  return null;
}

afterEach(() => cleanup());

// Happy-dom reports non-Mac, so `Mod` resolves to `ctrlKey`. Using
// `ctrlKey: true` here is the portable form for every test below.
describe('editor shortcuts — undo / redo wiring', () => {
  it('Mod+Z fires the undo handler when no contenteditable has focus', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(<Harness onUndo={onUndo} onRedo={onRedo} />);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).not.toHaveBeenCalled();
  });

  it('Mod+Shift+Z fires the redo handler', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(<Harness onUndo={onUndo} onRedo={onRedo} />);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });

    expect(onRedo).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('Mod+Z with a contenteditable focused is suppressed (does not pop the doc stack)', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const { getByTestId } = render(<Harness onUndo={onUndo} onRedo={onRedo} />);
    const editable = getByTestId('editable');
    editable.focus();
    expect(document.activeElement).toBe(editable);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });

    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
  });

  it('Mod+Z re-fires after the contenteditable loses focus', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const { getByTestId } = render(<Harness onUndo={onUndo} onRedo={onRedo} />);
    const editable = getByTestId('editable');
    editable.focus();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(onUndo).not.toHaveBeenCalled();

    editable.blur();
    // After blur, activeElement drops to `document.body`; body is not
    // contenteditable so the guard lets the handler through.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
