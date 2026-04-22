// packages/editor-shell/src/shortcuts/shortcut-registry.tsx
// Provider + hooks for the single global keydown dispatcher.

/**
 * The editor mounts one `<ShortcutRegistryProvider>`. Components that want
 * shortcuts to fire register them via `useRegisterShortcuts(list)`. The
 * cheat sheet reads the live set via `useAllShortcuts()`.
 *
 * Dispatch model: one `keydown` listener on `window`. Registered shortcuts
 * are tried in registration order; the first match with a passing `when`
 * predicate wins, calls `preventDefault()`, and stops iteration. A sync
 * handler may return `false` to explicitly decline — iteration continues
 * and the browser default survives.
 *
 * Input-target suppression: when focus is inside an `<input>`, `<textarea>`,
 * or contenteditable region, only combos containing `Mod` fire. Bare-key
 * combos (arrows, Escape, Tab, Delete) would otherwise clobber typing.
 *
 * Reactivity: `useAllShortcuts()` uses `useSyncExternalStore` so the cheat
 * sheet re-renders when shortcuts register or unregister. Mutations replace
 * the internal array with a new reference so React sees snapshot identity
 * change on notify.
 */

import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { matchesKeyCombo } from './match-key-combo';
import type { Shortcut } from './types';

interface RegistryContextValue {
  register: (shortcut: Shortcut) => () => void;
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => ReadonlyArray<Shortcut>;
}

const RegistryContext = createContext<RegistryContextValue | null>(null);

const MOD_TOKEN = /\bmod\b/i;

// Elements whose native keyboard behavior we must not clobber with
// bare-key shortcuts: text-input fields, textareas, selects (arrow-key
// option navigation), and anything with `contenteditable`.
const TYPING_TAGS = new Set<string>(['INPUT', 'TEXTAREA', 'SELECT']);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (TYPING_TAGS.has(target.tagName)) return true;
  return target.isContentEditable;
}

export function ShortcutRegistryProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const shortcutsRef = useRef<ReadonlyArray<Shortcut>>([]);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const notify = useCallback((): void => {
    for (const cb of listenersRef.current) cb();
  }, []);

  const register = useCallback(
    (shortcut: Shortcut): (() => void) => {
      shortcutsRef.current = [...shortcutsRef.current, shortcut];
      notify();
      return () => {
        shortcutsRef.current = shortcutsRef.current.filter((s) => s !== shortcut);
        notify();
      };
    },
    [notify],
  );

  const subscribe = useCallback((cb: () => void): (() => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const getSnapshot = useCallback((): ReadonlyArray<Shortcut> => shortcutsRef.current, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const inTyping = isTypingTarget(event.target);
      for (const shortcut of shortcutsRef.current) {
        if (!matchesKeyCombo(event, shortcut.combo)) continue;
        if (shortcut.when && !shortcut.when()) continue;
        if (inTyping && !MOD_TOKEN.test(shortcut.combo)) continue;

        const result = shortcut.handler(event);
        if (result instanceof Promise) {
          event.preventDefault();
          return;
        }
        if (result === false) continue;
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const value: RegistryContextValue = { register, subscribe, getSnapshot };
  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

/**
 * Register a batch of shortcuts for the lifetime of the calling component.
 *
 * Handlers must be stable across renders (wrap in `useCallback`, or read
 * mutable state through refs). A new `shortcuts` array reference on every
 * render re-registers the batch — correct, but noisy on allocation.
 */
export function useRegisterShortcuts(shortcuts: Shortcut[]): void {
  const ctx = useContext(RegistryContext);
  if (!ctx) {
    throw new Error('useRegisterShortcuts must be used inside <ShortcutRegistryProvider>');
  }
  useEffect(() => {
    const disposers = shortcuts.map((s) => ctx.register(s));
    return () => {
      for (const d of disposers) d();
    };
  }, [shortcuts, ctx]);
}

/**
 * Reactive snapshot of every currently-registered shortcut. The cheat-sheet
 * modal subscribes through this hook so it stays in sync as other components
 * mount and unmount while it's open.
 */
export function useAllShortcuts(): ReadonlyArray<Shortcut> {
  const ctx = useContext(RegistryContext);
  if (!ctx) {
    throw new Error('useAllShortcuts must be used inside <ShortcutRegistryProvider>');
  }
  return useSyncExternalStore(ctx.subscribe, ctx.getSnapshot, ctx.getSnapshot);
}
