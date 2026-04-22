// packages/editor-shell/src/context/document-context.test.tsx
// Verifies the DocumentProvider facade: provider isolation via a fresh
// jotai store per provider, the shape of `useDocument()`, selection
// setters, active-slide setter, and undo-stack push/pop semantics
// (including the MAX_MICRO_UNDO cap).

import type { Document } from '@stageflip/schema';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_MICRO_UNDO, type MicroUndo } from '../atoms/undo';
import { makeSlideDoc } from '../test-fixtures/document-fixture';
import { DocumentProvider, useDocument } from './document-context';

afterEach(() => {
  cleanup();
});

function wrap(initialDocument?: Document | null) {
  return ({ children }: { children: React.ReactNode }) => (
    <DocumentProvider initialDocument={initialDocument}>{children}</DocumentProvider>
  );
}

function entry(label: string): MicroUndo {
  return { label, forward: [], inverse: [] };
}

describe('DocumentProvider hydration', () => {
  it('hydrates with a null document by default', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    expect(result.current.document).toBeNull();
  });

  it('hydrates with the supplied initialDocument', () => {
    const doc = makeSlideDoc({ slideCount: 2 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    expect(result.current.document).toBe(doc);
  });
});

describe('useDocument outside a provider', () => {
  it('throws a descriptive error', () => {
    expect(() => renderHook(() => useDocument())).toThrow(/DocumentProvider/);
  });
});

describe('document mutators', () => {
  it('setDocument replaces the document atom', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(null) });
    const next = makeSlideDoc({ slideCount: 1 });
    act(() => {
      result.current.setDocument(next);
    });
    expect(result.current.document).toBe(next);
  });

  it('updateDocument applies a functional updater when the document is non-null', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      result.current.updateDocument((d) => ({
        ...d,
        meta: { ...d.meta, title: 'Renamed' },
      }));
    });
    expect(result.current.document?.meta.title).toBe('Renamed');
  });

  it('updateDocument is a no-op when the document is null (never hydrated)', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(null) });
    act(() => {
      result.current.updateDocument((d) => d);
    });
    expect(result.current.document).toBeNull();
  });

  it('updateDocument is a no-op after setDocument(null) (deliberate reset)', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      result.current.setDocument(null);
    });
    expect(result.current.document).toBeNull();
    act(() => {
      result.current.updateDocument((d) => ({
        ...d,
        meta: { ...d.meta, title: 'should not apply' },
      }));
    });
    expect(result.current.document).toBeNull();
  });
});

describe('active slide', () => {
  it('defaults to empty, then round-trips', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    expect(result.current.activeSlideId).toBe('');
    act(() => {
      result.current.setActiveSlide('slide-1');
    });
    expect(result.current.activeSlideId).toBe('slide-1');
  });
});

describe('selection', () => {
  it('replaces element selection and exposes it via selectedElementId', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    act(() => {
      result.current.selectElements(new Set(['el-1']));
    });
    expect(result.current.selectedElementIds.has('el-1')).toBe(true);
    expect(result.current.selectedElementId).toBe('el-1');
  });

  it('selectedElementId is null when multiple are selected', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    act(() => {
      result.current.selectElements(new Set(['a', 'b']));
    });
    expect(result.current.selectedElementId).toBeNull();
  });

  it('toggleElement flips membership', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    act(() => {
      result.current.toggleElement('x');
    });
    expect(result.current.selectedElementIds.has('x')).toBe(true);
    act(() => {
      result.current.toggleElement('x');
    });
    expect(result.current.selectedElementIds.has('x')).toBe(false);
  });

  it('clearSelection empties both sets', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    act(() => {
      result.current.selectElements(new Set(['a']));
      result.current.selectSlides(new Set(['s']));
      result.current.clearSelection();
    });
    expect(result.current.selectedElementIds.size).toBe(0);
    expect(result.current.selectedSlideIds.size).toBe(0);
  });

  it('toggleSlide flips membership on the slide set', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    act(() => {
      result.current.toggleSlide('slide-0');
    });
    expect(result.current.selectedSlideIds.has('slide-0')).toBe(true);
  });
});

describe('undo stacks', () => {
  it('start disabled', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('pushUndoEntry enables canUndo and clears the redo stack', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    act(() => {
      result.current.pushRedoEntry(entry('prior'));
    });
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.pushUndoEntry(entry('edit'));
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('popUndoEntry returns the top entry and disables canUndo when empty', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    const top = entry('a');
    act(() => {
      result.current.pushUndoEntry(top);
    });
    let popped: MicroUndo | undefined;
    act(() => {
      popped = result.current.popUndoEntry();
    });
    expect(popped).toBe(top);
    expect(result.current.canUndo).toBe(false);
  });

  it('pushUndoEntry caps the stack at MAX_MICRO_UNDO entries', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    act(() => {
      for (let i = 0; i < MAX_MICRO_UNDO + 5; i += 1) {
        result.current.pushUndoEntry(entry(`edit-${i}`));
      }
    });
    // Internal stack should still be bounded — probe via consecutive pops.
    let popped = 0;
    act(() => {
      while (result.current.popUndoEntry()) popped += 1;
    });
    expect(popped).toBe(MAX_MICRO_UNDO);
  });

  it('pushRedoEntry and popRedoEntry mirror the undo pair', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    const e = entry('redo-target');
    act(() => {
      result.current.pushRedoEntry(e);
    });
    expect(result.current.canRedo).toBe(true);
    let popped: MicroUndo | undefined;
    act(() => {
      popped = result.current.popRedoEntry();
    });
    expect(popped).toBe(e);
    expect(result.current.canRedo).toBe(false);
  });

  it('pushRedoEntry caps the stack at MAX_MICRO_UNDO entries', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap() });
    act(() => {
      for (let i = 0; i < MAX_MICRO_UNDO + 5; i += 1) {
        result.current.pushRedoEntry(entry(`redo-${i}`));
      }
    });
    let popped = 0;
    act(() => {
      while (result.current.popRedoEntry()) popped += 1;
    });
    expect(popped).toBe(MAX_MICRO_UNDO);
  });
});

describe('T-133 updateDocument → patch-based undo/redo', () => {
  it('records a MicroUndo with non-empty forward+inverse when the doc changes', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      result.current.updateDocument((d) => ({
        ...d,
        meta: { ...d.meta, title: 'Renamed' },
      }));
    });
    expect(result.current.canUndo).toBe(true);
    let top: MicroUndo | undefined;
    act(() => {
      top = result.current.popUndoEntry();
    });
    expect(top).toBeDefined();
    expect((top?.forward as unknown[]).length).toBeGreaterThan(0);
    expect((top?.inverse as unknown[]).length).toBeGreaterThan(0);
  });

  it('skips recording when the updater returns the same reference', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      result.current.updateDocument((d) => d);
    });
    expect(result.current.canUndo).toBe(false);
  });

  it('skips recording when the updater produces a structurally equal doc', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      // New reference, same content → empty patch, no entry pushed.
      result.current.updateDocument((d) => ({ ...d }));
    });
    expect(result.current.canUndo).toBe(false);
  });

  it('undo() restores the previous document state and moves the entry to the redo stack', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      result.current.updateDocument((d) => ({
        ...d,
        meta: { ...d.meta, title: 'Renamed' },
      }));
    });
    expect(result.current.document?.meta.title).toBe('Renamed');
    act(() => {
      result.current.undo();
    });
    expect(result.current.document?.meta.title).toBe(doc.meta.title);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo() re-applies the most recent undone entry', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      result.current.updateDocument((d) => ({
        ...d,
        meta: { ...d.meta, title: 'Renamed' },
      }));
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });
    expect(result.current.document?.meta.title).toBe('Renamed');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo() is a no-op when canUndo is false', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      result.current.undo();
    });
    expect(result.current.document).toBe(doc);
    expect(result.current.canRedo).toBe(false);
  });

  it('redo() is a no-op when canRedo is false', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      result.current.redo();
    });
    expect(result.current.document).toBe(doc);
    expect(result.current.canUndo).toBe(false);
  });

  it('a new updateDocument after undo truncates the redo stack', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      result.current.updateDocument((d) => ({
        ...d,
        meta: { ...d.meta, title: 'First' },
      }));
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.updateDocument((d) => ({
        ...d,
        meta: { ...d.meta, title: 'Second' },
      }));
    });
    expect(result.current.canRedo).toBe(false);
  });

  it('updateDocument caps the undo stack at MAX_MICRO_UNDO entries', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      for (let i = 0; i < MAX_MICRO_UNDO + 5; i += 1) {
        result.current.updateDocument((d) => ({
          ...d,
          meta: { ...d.meta, title: `edit-${i}` },
        }));
      }
    });
    let popped = 0;
    act(() => {
      while (result.current.popUndoEntry()) popped += 1;
    });
    expect(popped).toBe(MAX_MICRO_UNDO);
  });

  it('setDocument clears both undo and redo stacks', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    act(() => {
      result.current.updateDocument((d) => ({
        ...d,
        meta: { ...d.meta, title: 'Renamed' },
      }));
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);
    const replacement = makeSlideDoc({ slideCount: 2 });
    act(() => {
      result.current.setDocument(replacement);
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo() on a null document is a no-op even if the undo stack has entries', () => {
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(null) });
    act(() => {
      result.current.pushUndoEntry(entry('orphan'));
    });
    act(() => {
      result.current.undo();
    });
    // The orphan entry was pushed against a null doc; undo must not crash
    // and must not attempt to apply a patch. State is unchanged.
    expect(result.current.document).toBeNull();
  });

  it('undo() swallows apply errors and restores the entry on the undo stack', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    // Push a deliberately stale entry: the inverse patch targets an array
    // index that doesn't exist on `doc.content.slides`, so applyPatch's
    // `test` of the path fails with an Error.
    const badEntry: MicroUndo = {
      forward: [],
      inverse: [{ op: 'replace', path: '/content/slides/99/id', value: 'nope' }],
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    act(() => {
      result.current.pushUndoEntry(badEntry);
    });
    act(() => {
      result.current.undo();
    });
    // Document is untouched, entry is restored to the undo stack so the user
    // can keep trying (e.g. after a re-hydration).
    expect(result.current.document).toBe(doc);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('redo() swallows apply errors and restores the entry on the redo stack', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    const badEntry: MicroUndo = {
      forward: [{ op: 'replace', path: '/content/slides/99/id', value: 'nope' }],
      inverse: [],
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    act(() => {
      result.current.pushRedoEntry(badEntry);
    });
    act(() => {
      result.current.redo();
    });
    expect(result.current.document).toBe(doc);
    expect(result.current.canRedo).toBe(true);
    expect(result.current.canUndo).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('round-trips nested element mutations', () => {
    const doc = makeSlideDoc({ slideCount: 1, elementsPerSlide: 2 });
    const { result } = renderHook(() => useDocument(), { wrapper: wrap(doc) });
    const beforeX =
      doc.content.mode === 'slide' ? doc.content.slides[0]?.elements[0]?.transform.x : undefined;
    act(() => {
      result.current.updateDocument((d) => {
        if (d.content.mode !== 'slide') return d;
        const [first, ...rest] = d.content.slides;
        if (!first) return d;
        return {
          ...d,
          content: {
            ...d.content,
            slides: [
              {
                ...first,
                elements: first.elements.map((el, i) =>
                  i === 0 ? { ...el, transform: { ...el.transform, x: 999 } } : el,
                ),
              },
              ...rest,
            ],
          },
        };
      });
    });
    const afterUpdate = result.current.document;
    const updatedX =
      afterUpdate?.content.mode === 'slide'
        ? afterUpdate.content.slides[0]?.elements[0]?.transform.x
        : undefined;
    expect(updatedX).toBe(999);
    act(() => {
      result.current.undo();
    });
    const afterUndo = result.current.document;
    const restoredX =
      afterUndo?.content.mode === 'slide'
        ? afterUndo.content.slides[0]?.elements[0]?.transform.x
        : undefined;
    expect(restoredX).toBe(beforeX);
  });
});

describe('provider isolation', () => {
  it('two providers keep independent stores', () => {
    const docA = makeSlideDoc({ slideCount: 1 });
    const docB = makeSlideDoc({ slideCount: 3 });
    const { result: a } = renderHook(() => useDocument(), { wrapper: wrap(docA) });
    const { result: b } = renderHook(() => useDocument(), { wrapper: wrap(docB) });
    expect(a.current.document).toBe(docA);
    expect(b.current.document).toBe(docB);
    act(() => {
      a.current.setActiveSlide('slide-0');
    });
    expect(a.current.activeSlideId).toBe('slide-0');
    expect(b.current.activeSlideId).toBe('');
  });
});
