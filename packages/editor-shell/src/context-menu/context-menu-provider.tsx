// packages/editor-shell/src/context-menu/context-menu-provider.tsx
// Provider + hooks for the single global contextmenu dispatcher.

/**
 * One `<ContextMenuProvider>` mounts alongside `<ShortcutRegistryProvider>`.
 * Components register a `ContextMenuDescriptor` via `useRegisterContextMenu`;
 * the provider listens once for `contextmenu` on `window`, picks the first
 * matching descriptor via `pickContextMenu`, and opens a menu at the event
 * coordinates. `ContextMenu` (sibling module) reads the open state from the
 * context and renders.
 *
 * Dispatch model: single listener, registration-order matching, winner
 * calls `preventDefault()` so the browser's native menu stays down. If no
 * descriptor claims the event the listener does nothing and the browser's
 * native menu fires — this is deliberate so right-click on the app chrome
 * (scrollbars, browser UI, URL bar) keeps working.
 *
 * Reactivity: descriptors live in a ref-backed Map keyed on id; a small
 * listener set notifies subscribers when the set changes, via a
 * `useSyncExternalStore` pattern analogous to the shortcut registry.
 *
 * Open state: a React useState — there is always at most one open menu
 * per provider. Tests drive it via the context value rather than
 * dispatching real contextmenu events.
 */

import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { pickContextMenu } from './matches-target';
import type { ContextMenuDescriptor, OpenContextMenuState } from './types';

interface ContextMenuRegistryValue {
  register: (descriptor: ContextMenuDescriptor) => () => void;
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => ReadonlyArray<ContextMenuDescriptor>;
  openState: OpenContextMenuState | null;
  open: (state: OpenContextMenuState) => void;
  close: () => void;
}

const ContextMenuRegistryContext = createContext<ContextMenuRegistryValue | null>(null);

/**
 * Provider that owns the single contextmenu listener + registry. Mount
 * once, high in the tree — typically inside `<EditorShell>` so every
 * panel can register.
 */
export function ContextMenuProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const descriptorsRef = useRef<ContextMenuDescriptor[]>([]);
  const listenersRef = useRef<Set<() => void>>(new Set());
  const [openState, setOpenState] = useState<OpenContextMenuState | null>(null);

  const notify = useCallback((): void => {
    for (const cb of listenersRef.current) cb();
  }, []);

  const register = useCallback(
    (descriptor: ContextMenuDescriptor): (() => void) => {
      // Replace any prior descriptor with the same id (re-register pattern)
      const existingIdx = descriptorsRef.current.findIndex((d) => d.id === descriptor.id);
      if (existingIdx >= 0) {
        const next = [...descriptorsRef.current];
        next[existingIdx] = descriptor;
        descriptorsRef.current = next;
      } else {
        descriptorsRef.current = [...descriptorsRef.current, descriptor];
      }
      notify();
      return () => {
        descriptorsRef.current = descriptorsRef.current.filter((d) => d !== descriptor);
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

  const getSnapshot = useCallback(
    (): ReadonlyArray<ContextMenuDescriptor> => descriptorsRef.current,
    [],
  );

  const open = useCallback((state: OpenContextMenuState): void => {
    setOpenState(state);
  }, []);

  const close = useCallback((): void => {
    setOpenState(null);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const descriptor = pickContextMenu(descriptorsRef.current, target);
      if (!descriptor) return;
      event.preventDefault();
      setOpenState({ descriptor, x: event.clientX, y: event.clientY });
    };
    window.addEventListener('contextmenu', handler);
    return () => window.removeEventListener('contextmenu', handler);
  }, []);

  // Close on Escape / outside click. The menu's own button handlers close it
  // too, but global listeners guarantee no stuck menu after an app re-render.
  useEffect(() => {
    if (!openState) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpenState(null);
      }
    };
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[data-stageflip-context-menu]')) return;
      setOpenState(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [openState]);

  const value: ContextMenuRegistryValue = {
    register,
    subscribe,
    getSnapshot,
    openState,
    open,
    close,
  };
  return (
    <ContextMenuRegistryContext.Provider value={value}>
      {children}
    </ContextMenuRegistryContext.Provider>
  );
}

/**
 * Register a context-menu descriptor for the lifetime of the calling
 * component. Stable `id` replaces any prior registration (supports
 * re-rendering with a new items list).
 */
export function useRegisterContextMenu(descriptor: ContextMenuDescriptor): void {
  const ctx = useContext(ContextMenuRegistryContext);
  if (!ctx) {
    throw new Error('useRegisterContextMenu must be used inside <ContextMenuProvider>');
  }
  useEffect(() => {
    const dispose = ctx.register(descriptor);
    return dispose;
  }, [ctx, descriptor]);
}

/**
 * Reactive snapshot of every currently-registered descriptor. Useful for
 * tests + debug tooling; production UI reads `useContextMenu()` to find
 * out which menu (if any) is open right now.
 */
export function useAllContextMenus(): ReadonlyArray<ContextMenuDescriptor> {
  const ctx = useContext(ContextMenuRegistryContext);
  if (!ctx) {
    throw new Error('useAllContextMenus must be used inside <ContextMenuProvider>');
  }
  return useSyncExternalStore(ctx.subscribe, ctx.getSnapshot, ctx.getSnapshot);
}

/**
 * Access open-menu state + imperative open/close controls. `<ContextMenu>`
 * uses this to render; tests use it to assert + drive.
 */
export function useContextMenu(): {
  openState: OpenContextMenuState | null;
  open: (state: OpenContextMenuState) => void;
  close: () => void;
} {
  const ctx = useContext(ContextMenuRegistryContext);
  if (!ctx) {
    throw new Error('useContextMenu must be used inside <ContextMenuProvider>');
  }
  return { openState: ctx.openState, open: ctx.open, close: ctx.close };
}
