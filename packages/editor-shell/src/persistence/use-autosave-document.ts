// packages/editor-shell/src/persistence/use-autosave-document.ts
// Debounced autosave hook — subscribes to the documentAtom and writes
// to localStorage after the document has been idle for `delayMs`.

/**
 * Usage
 * -----
 *   function Editor() {
 *     useAutosaveDocument();
 *     // ... rest of the editor
 *   }
 *
 * Semantics
 * ---------
 * Each time the document reference changes, we schedule a save for
 * `delayMs` in the future and cancel the previous schedule. If a
 * second change arrives before the delay elapses the timer restarts —
 * so a rapid-fire sequence of edits produces a single save at the end
 * of the burst, not one per edit.
 *
 * The document is serialized via `JSON.stringify`. Consumers that need
 * non-default serialization (preflight, compression, the
 * `@stageflip/storage` adapter surface) should pass a custom
 * `serialize` function.
 *
 * `null` documents are skipped: writing `"null"` to the slot would
 * confuse hydration. Clear via `clearDocument(id)` instead.
 *
 * Determinism
 * -----------
 * `setTimeout` is used here — editor-shell is not clip / runtime code,
 * so the determinism scanner does not apply. The persistence layer
 * depends on wall-clock scheduling (IDLE CALLBACK style) by design.
 */

import type { Document } from '@stageflip/schema';
import { useEffect, useRef } from 'react';
import { useDocument } from '../context/document-context';
import { saveDocument } from './document-storage';

export interface AutosaveOptions {
  /** Quiet interval before a save fires. Default 500ms. */
  delayMs?: number;
  /** Custom serializer (default `JSON.stringify`). */
  serialize?: (doc: Document) => string;
  /** If false, the hook is a no-op — handy for disabling during tests. */
  enabled?: boolean;
}

const DEFAULT_DELAY_MS = 500;

export function useAutosaveDocument(options: AutosaveOptions = {}): void {
  const { document: doc } = useDocument();
  const { delayMs = DEFAULT_DELAY_MS, serialize = JSON.stringify, enabled = true } = options;

  // Stabilize the serializer reference. Callers that pass an inline arrow
  // function would otherwise produce a new identity every render, resetting
  // the effect's debounce timer on every render and defeating the whole
  // point of debouncing. Storing the latest function in a ref lets the
  // scheduled callback call through to the current value without depending
  // on its identity in the effect deps.
  const serializeRef = useRef(serialize);
  serializeRef.current = serialize;

  useEffect(() => {
    if (!enabled) return;
    if (!doc) return;
    const handle = setTimeout(() => {
      const slideCount = doc.content.mode === 'slide' ? doc.content.slides.length : 0;
      saveDocument(doc.meta.id, serializeRef.current(doc), {
        title: doc.meta.title ?? '',
        slideCount,
      });
    }, delayMs);
    return () => {
      clearTimeout(handle);
    };
  }, [doc, delayMs, enabled]);
}
