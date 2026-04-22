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
 * Actions bundled here are the ones every subsequent Phase 6 port
 * needs to compile against:
 *
 *   - document read + coarse mutations (`setDocument`, `updateDocument`)
 *   - active slide read + set
 *   - selection sets (elements + slides) with replace / toggle / clear
 *   - undo / redo with MAX_MICRO_UNDO cap (T-133)
 *
 * Slide-level and element-level CRUD (addSlide, updateElement, etc.)
 * live closer to the ports that need them and are intentionally not in
 * this surface.
 *
 * T-133 undo model
 * ----------------
 * `updateDocument` diffs the pre/post document via `fast-json-patch` and
 * pushes a `MicroUndo` of forward + inverse `Operation[]` onto
 * `undoStackAtom`. `undo()` / `redo()` pop and apply the patches against
 * the current document; jotai owns the state transitions. `setDocument`
 * clears both stacks because inverse patches recorded against a prior
 * document cannot apply cleanly to a replaced one. Identity- and value-
 * equal updaters do not push entries; a null document short-circuits
 * `updateDocument` without touching the stack.
 */

import type { Document } from '@stageflip/schema';
import { type Operation, applyPatch, compare } from 'fast-json-patch';
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
  inTransactionAtom,
  redoStackAtom,
  transactionAtom,
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
  /** Pop the top of the undo stack, apply its inverse patches to the
   * current document, and push the entry onto the redo stack. No-op when
   * the stack is empty or the document is null. */
  undo: () => void;
  /** Mirror of `undo()` for the redo stack: forward patches applied, entry
   * restored on the undo stack. */
  redo: () => void;
  pushUndoEntry: (entry: MicroUndo) => void;
  popUndoEntry: () => MicroUndo | undefined;
  pushRedoEntry: (entry: MicroUndo) => void;
  popRedoEntry: () => MicroUndo | undefined;

  /** True while a transaction is active. Drags and other coalesced
   *  gestures read this to know whether to schedule a commit. */
  inTransaction: boolean;
  /** Open a coalescing transaction. `updateDocument` calls between here
   *  and `commitTransaction()` apply to the atom directly without pushing
   *  undo entries; a single entry diffs snapshot-vs-final on commit.
   *  No-op if the document is null or a transaction is already active. */
  beginTransaction: (label?: string) => void;
  /** Close the current transaction and push one `MicroUndo` covering
   *  every `updateDocument` call that landed while it was active.
   *  No-op if no transaction is active or the document is null. An empty
   *  net diff (drag-and-cancel-style) emits no entry. */
  commitTransaction: () => void;
  /** Close the current transaction and restore the document to the
   *  pre-transaction snapshot. Use when a gesture is aborted (pointer
   *  cancel, Escape mid-drag). No-op if no transaction is active. */
  cancelTransaction: () => void;
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
  const inTransaction = useAtomValue(inTransactionAtom);
  const setUndoStack = useSetAtom(undoStackAtom);
  const setRedoStack = useSetAtom(redoStackAtom);
  const setTransaction = useSetAtom(transactionAtom);

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
      // Same cap as pushUndoEntry: external callers that push into redo
      // (rare, but part of the public surface) must not grow the stack
      // without bound. Mirror the trim so both stacks stay symmetrically
      // sized.
      setRedoStack((prev) => {
        const trimmed = prev.length >= MAX_MICRO_UNDO ? prev.slice(-(MAX_MICRO_UNDO - 1)) : prev;
        return [...trimmed, entry];
      });
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

  const setDocument = useCallback<DocumentContextValue['setDocument']>(
    (doc) => {
      // Replacing the whole document invalidates the patch history: inverse
      // operations recorded against the old tree cannot apply cleanly to a
      // different document. Clear both stacks + any in-flight transaction
      // so the next gesture starts from a clean slate.
      setDocumentAtom(doc);
      setUndoStack([]);
      setRedoStack([]);
      setTransaction(null);
    },
    [setDocumentAtom, setUndoStack, setRedoStack, setTransaction],
  );

  const updateDocument = useCallback<DocumentContextValue['updateDocument']>(
    (updater) => {
      const prev = store.get(documentAtom);
      if (prev === null) return;
      const next = updater(prev);
      if (next === prev) return;
      // Inside a transaction: apply directly and defer undo-entry creation
      // to `commitTransaction()`. We still skip no-op diffs at the atom
      // layer below via the quick `next === prev` check above.
      if (store.get(transactionAtom) !== null) {
        setDocumentAtom(next);
        return;
      }
      const forward = compare(prev, next);
      if (forward.length === 0) {
        // Updater produced a structurally equal doc (new reference, same
        // content). Keep the new reference so consumers that key on identity
        // still see a fresh value, but don't clutter the stack with a no-op.
        setDocumentAtom(next);
        return;
      }
      const inverse = compare(next, prev);
      setDocumentAtom(next);
      pushUndoEntry({ forward, inverse });
    },
    [store, setDocumentAtom, pushUndoEntry],
  );

  const beginTransaction = useCallback<DocumentContextValue['beginTransaction']>(
    (_label) => {
      // The `_label` argument is forward-compat: a future telemetry / undo
      // cheat-sheet task may record it alongside the MicroUndo. Today we
      // drop it silently — callers can still pass a meaningful string so
      // call sites read clearly at the gesture layer.
      const current = store.get(documentAtom);
      if (current === null) return;
      // Ignore nested begins rather than stack — Phase 6 has one gesture
      // at a time; nested transactions only happen by programmer error.
      if (store.get(transactionAtom) !== null) return;
      setTransaction({ snapshot: current });
    },
    [store, setTransaction],
  );

  const commitTransaction = useCallback<DocumentContextValue['commitTransaction']>(() => {
    const txn = store.get(transactionAtom);
    if (txn === null) return;
    // Read the document BEFORE clearing the transaction atom so a subscribed
    // consumer that reacts to `inTransaction` flipping to false can't observe
    // a pre-commit document. Jotai's store.get is synchronous in practice,
    // but the in-order read + single-write keeps the happens-before clear.
    const current = store.get(documentAtom);
    setTransaction(null);
    if (current === null) return;
    const forward = compare(txn.snapshot, current);
    if (forward.length === 0) return; // net no-op gesture
    const inverse = compare(current, txn.snapshot);
    pushUndoEntry({ forward, inverse });
  }, [store, setTransaction, pushUndoEntry]);

  const cancelTransaction = useCallback<DocumentContextValue['cancelTransaction']>(() => {
    const txn = store.get(transactionAtom);
    if (txn === null) return;
    setTransaction(null);
    setDocumentAtom(txn.snapshot);
  }, [store, setTransaction, setDocumentAtom]);

  const undo = useCallback<DocumentContextValue['undo']>(() => {
    // Do not rewrite history while a gesture is mid-flight. The commit
    // path ends the transaction before any shortcut can fire in practice;
    // this guard covers synthetic undo calls from tests / tools.
    if (store.get(transactionAtom) !== null) return;
    const current = store.get(documentAtom);
    if (current === null) return;
    const entry = popUndoEntry();
    if (!entry) return;
    // `applyPatch` throws on mis-addressed paths, which happens only if the
    // document has drifted from the state the patch was recorded against
    // (e.g. a consumer bypassed `updateDocument` and mutated the atom
    // directly). Swallow the failure rather than crash the editor, but put
    // the entry back on its stack so the user can keep trying.
    try {
      const patched = applyPatch(current, entry.inverse as Operation[], false, false);
      setDocumentAtom(patched.newDocument);
      pushRedoEntry(entry);
    } catch (err) {
      console.warn('[editor-shell:undo] patch apply failed; entry restored', err);
      pushUndoEntry(entry);
    }
  }, [store, setDocumentAtom, popUndoEntry, pushRedoEntry, pushUndoEntry]);

  const redo = useCallback<DocumentContextValue['redo']>(() => {
    if (store.get(transactionAtom) !== null) return;
    const current = store.get(documentAtom);
    if (current === null) return;
    const entry = popRedoEntry();
    if (!entry) return;
    try {
      const patched = applyPatch(current, entry.forward as Operation[], false, false);
      setDocumentAtom(patched.newDocument);
      // Re-queue on the undo stack without clearing redo: we're walking the
      // history, not starting a new branch. Inline trim matches `pushUndoEntry`
      // — the two must stay in sync if `MAX_MICRO_UNDO` semantics change.
      setUndoStack((prevStack) => {
        const trimmed =
          prevStack.length >= MAX_MICRO_UNDO ? prevStack.slice(-(MAX_MICRO_UNDO - 1)) : prevStack;
        return [...trimmed, entry];
      });
    } catch (err) {
      console.warn('[editor-shell:redo] patch apply failed; entry restored', err);
      pushRedoEntry(entry);
    }
  }, [store, setDocumentAtom, popRedoEntry, setUndoStack, pushRedoEntry]);

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
      undo,
      redo,
      pushUndoEntry,
      popUndoEntry,
      pushRedoEntry,
      popRedoEntry,
      inTransaction,
      beginTransaction,
      commitTransaction,
      cancelTransaction,
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
      undo,
      redo,
      pushUndoEntry,
      popUndoEntry,
      pushRedoEntry,
      popRedoEntry,
      inTransaction,
      beginTransaction,
      commitTransaction,
      cancelTransaction,
    ],
  );
}
