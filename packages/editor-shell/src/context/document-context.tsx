// packages/editor-shell/src/context/document-context.tsx
// Thin reactive facade over the editor-shell atom surface.

/**
 * Every editor subtree mounts a `<DocumentProvider>`. It creates a fresh
 * `jotai` store so multiple editor instances (main canvas, preview
 * modals, tests running in parallel) don't share state, then scopes that
 * store inside the provider. `useDocument()` returns a stable hook-level
 * snapshot of the current state plus stable mutator callbacks.
 *
 * Scope
 * -----
 * T-121b delivers the reactive plumbing, not the full mutation DSL.
 * Actions bundled here are the ones every subsequent Phase 6 port
 * needs to compile against:
 *
 *   - document read + coarse mutations (`setDocument`, `updateDocument`)
 *   - active slide read + set
 *   - selection sets (elements + slides) with replace / toggle / clear
 *   - undo stack push / pop + capacity enforcement
 *
 * Slide-level and element-level CRUD (addSlide, updateElement, etc.)
 * live closer to the ports that need them and are intentionally not in
 * this surface. T-133 (undo) and T-123..T-129 (component ports) layer
 * on top without touching this file.
 */

import type { Document } from '@stageflip/schema';
import type { Atom } from 'jotai';
import { Provider as JotaiProvider, createStore, useAtomValue, useSetAtom } from 'jotai';
import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { documentAtom } from '../atoms/document';
import {
  EMPTY_SELECTION,
  selectedElementIdAtom,
  selectedElementIdsAtom,
  selectedSlideIdsAtom,
} from '../atoms/selection';
import { activeSlideIdAtom } from '../atoms/ui';
import {
  MAX_MICRO_UNDO,
  type MicroUndo,
  canRedoAtom,
  canUndoAtom,
  redoStackAtom,
  undoStackAtom,
} from '../atoms/undo';

type JotaiStore = ReturnType<typeof createStore>;

// Context holds the per-provider store handle. Everything else flows
// through jotai hooks that resolve against the store inside JotaiProvider.
const StoreContext = createContext<JotaiStore | null>(null);

export interface DocumentContextValue {
  document: Document | null;
  setDocument: (doc: Document | null) => void;
  updateDocument: (updater: (doc: Document) => Document) => void;

  activeSlideId: string;
  setActiveSlide: (id: string) => void;

  selectedElementIds: ReadonlySet<string>;
  selectedElementId: string | null;
  selectElements: (ids: ReadonlySet<string>) => void;
  toggleElement: (id: string) => void;

  selectedSlideIds: ReadonlySet<string>;
  selectSlides: (ids: ReadonlySet<string>) => void;
  toggleSlide: (id: string) => void;

  clearSelection: () => void;

  canUndo: boolean;
  canRedo: boolean;
  pushUndoEntry: (entry: MicroUndo) => void;
  popUndoEntry: () => MicroUndo | undefined;
  pushRedoEntry: (entry: MicroUndo) => void;
  popRedoEntry: () => MicroUndo | undefined;
}

export interface DocumentProviderProps {
  children: React.ReactNode;
  /** Initial document value. Defaults to `null` (unhydrated). */
  initialDocument?: Document | null;
  /**
   * Optional external store. Pass one to share state across sibling
   * providers (rare). Omit to get a fresh isolated store per provider.
   */
  store?: JotaiStore;
}

export function DocumentProvider({
  children,
  initialDocument = null,
  store: externalStore,
}: DocumentProviderProps): React.ReactElement {
  // One store per provider instance. `useRef` + lazy init so the store
  // identity is stable across re-renders without allocating every tick.
  const storeRef = useRef<JotaiStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = externalStore ?? createStore();
    if (initialDocument !== null) {
      storeRef.current.set(documentAtom, initialDocument);
    }
  }
  const store = storeRef.current;

  return (
    <StoreContext.Provider value={store}>
      <JotaiProvider store={store}>{children}</JotaiProvider>
    </StoreContext.Provider>
  );
}

/** Read an atom value reactively. Consumers use this for fine-grained
 * subscriptions; the bundled `useDocument()` returns a coarse facade. */
export function useEditorShellAtomValue<T>(atom: Atom<T>): T {
  return useAtomValue(atom);
}

/**
 * The primary facade hook. Returns the current document state and
 * stable mutator callbacks. Must be used inside `<DocumentProvider>`.
 */
export function useDocument(): DocumentContextValue {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useDocument must be used inside <DocumentProvider>');
  }

  const document = useAtomValue(documentAtom);
  const setDocumentAtom = useSetAtom(documentAtom);

  const activeSlideId = useAtomValue(activeSlideIdAtom);
  const setActiveSlideAtom = useSetAtom(activeSlideIdAtom);

  const selectedElementIds = useAtomValue(selectedElementIdsAtom);
  const selectedElementId = useAtomValue(selectedElementIdAtom);
  const setSelectedElementIds = useSetAtom(selectedElementIdsAtom);

  const selectedSlideIds = useAtomValue(selectedSlideIdsAtom);
  const setSelectedSlideIds = useSetAtom(selectedSlideIdsAtom);

  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  const setUndoStack = useSetAtom(undoStackAtom);
  const setRedoStack = useSetAtom(redoStackAtom);

  const setDocument = useCallback<DocumentContextValue['setDocument']>(
    (doc) => setDocumentAtom(doc),
    [setDocumentAtom],
  );

  const updateDocument = useCallback<DocumentContextValue['updateDocument']>(
    (updater) => {
      setDocumentAtom((prev) => (prev === null ? prev : updater(prev)));
    },
    [setDocumentAtom],
  );

  const setActiveSlide = useCallback<DocumentContextValue['setActiveSlide']>(
    (id) => setActiveSlideAtom(id),
    [setActiveSlideAtom],
  );

  const selectElements = useCallback<DocumentContextValue['selectElements']>(
    (ids) => setSelectedElementIds(ids),
    [setSelectedElementIds],
  );

  const toggleElement = useCallback<DocumentContextValue['toggleElement']>(
    (id) => {
      setSelectedElementIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setSelectedElementIds],
  );

  const selectSlides = useCallback<DocumentContextValue['selectSlides']>(
    (ids) => setSelectedSlideIds(ids),
    [setSelectedSlideIds],
  );

  const toggleSlide = useCallback<DocumentContextValue['toggleSlide']>(
    (id) => {
      setSelectedSlideIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setSelectedSlideIds],
  );

  const clearSelection = useCallback(() => {
    setSelectedElementIds(EMPTY_SELECTION);
    setSelectedSlideIds(EMPTY_SELECTION);
  }, [setSelectedElementIds, setSelectedSlideIds]);

  const pushUndoEntry = useCallback<DocumentContextValue['pushUndoEntry']>(
    (entry) => {
      setUndoStack((prev) => {
        const trimmed = prev.length >= MAX_MICRO_UNDO ? prev.slice(-(MAX_MICRO_UNDO - 1)) : prev;
        return [...trimmed, entry];
      });
      // Any new forward mutation invalidates the redo history.
      setRedoStack([]);
    },
    [setUndoStack, setRedoStack],
  );

  // Pop helpers use a functional updater so the read-then-write against the
  // stack is atomic under Jotai's write-batch model. Capturing the popped
  // entry via a closure variable is safe because jotai executes the updater
  // synchronously; reading `captured` after `setUndoStack` returns yields
  // the value produced inside the updater.
  const popUndoEntry = useCallback<DocumentContextValue['popUndoEntry']>(() => {
    let captured: MicroUndo | undefined;
    setUndoStack((prev) => {
      if (prev.length === 0) {
        captured = undefined;
        return prev;
      }
      captured = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    return captured;
  }, [setUndoStack]);

  const pushRedoEntry = useCallback<DocumentContextValue['pushRedoEntry']>(
    (entry) => {
      setRedoStack((prev) => [...prev, entry]);
    },
    [setRedoStack],
  );

  const popRedoEntry = useCallback<DocumentContextValue['popRedoEntry']>(() => {
    let captured: MicroUndo | undefined;
    setRedoStack((prev) => {
      if (prev.length === 0) {
        captured = undefined;
        return prev;
      }
      captured = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    return captured;
  }, [setRedoStack]);

  return useMemo<DocumentContextValue>(
    () => ({
      document,
      setDocument,
      updateDocument,
      activeSlideId,
      setActiveSlide,
      selectedElementIds,
      selectedElementId,
      selectElements,
      toggleElement,
      selectedSlideIds,
      selectSlides,
      toggleSlide,
      clearSelection,
      canUndo,
      canRedo,
      pushUndoEntry,
      popUndoEntry,
      pushRedoEntry,
      popRedoEntry,
    }),
    [
      document,
      setDocument,
      updateDocument,
      activeSlideId,
      setActiveSlide,
      selectedElementIds,
      selectedElementId,
      selectElements,
      toggleElement,
      selectedSlideIds,
      selectSlides,
      toggleSlide,
      clearSelection,
      canUndo,
      canRedo,
      pushUndoEntry,
      popUndoEntry,
      pushRedoEntry,
      popRedoEntry,
    ],
  );
}
