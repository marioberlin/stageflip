// packages/editor-shell/src/editor-shell.tsx
// One-component composition of every provider the editor needs.

/**
 * `<EditorShell>` is the tree root every editor app mounts. It composes
 * `<ShortcutRegistryProvider>` + `<DocumentProvider>` + `<AuthProvider>`
 * in a fixed order so consumers can rely on the `useDocument()`,
 * `useAuth()`, and `useRegisterShortcuts()` hooks resolving without
 * further setup.
 *
 * Provider order
 * --------------
 *   ShortcutRegistryProvider   ← outer: shortcuts keep firing even if
 *                                 the document provider remounts
 *     ContextMenuProvider      ← T-139a: right-click dispatch; sits
 *                                 outside DocumentProvider so its open
 *                                 state isn't cleared when the document
 *                                 atom is replaced
 *       DocumentProvider       ← middle: owns doc, selection, undo
 *           AuthProvider       ← inner: user state; deliberately
 *                                 narrow so `useAuth()` stays cheap
 *
 * Optional hydration
 * ------------------
 * `initialDocument` seeds `documentAtom` on mount. `initialLocale`
 * flips the i18n catalog to `pseudo` for QA runs. Both are one-shots —
 * the shell does not react to prop changes after first mount.
 *
 * Autosave
 * --------
 * Enable via `autosave={{ enabled: true, delayMs: 500 }}`. Disabled by
 * default because the walking-skeleton app (T-122) wires its own
 * storage backend and doesn't want double-writes.
 */

import type { Document } from '@stageflip/schema';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { ContextMenuProvider } from './context-menu/context-menu-provider';
import { AuthProvider } from './context/auth-context';
import { DocumentProvider, useDocument } from './context/document-context';
import { type Locale, setLocale } from './i18n/catalog';
import { type AutosaveOptions, useAutosaveDocument } from './persistence/use-autosave-document';
import { ShortcutRegistryProvider, useRegisterShortcuts } from './shortcuts/shortcut-registry';
import type { Shortcut } from './shortcuts/types';

export interface EditorShellProps {
  children: React.ReactNode;
  /** Seed value for `documentAtom`. Defaults to `null` (unhydrated). */
  initialDocument?: Document | null;
  /** Flip the i18n catalog locale once, on mount. */
  initialLocale?: Locale;
  /** Enable debounced localStorage autosave of the active document. */
  autosave?: AutosaveOptions & { enabled?: boolean };
}

export function EditorShell({
  children,
  initialDocument = null,
  initialLocale,
  autosave,
}: EditorShellProps): React.ReactElement {
  const effectsProps: React.ComponentProps<typeof EditorShellEffects> = {};
  if (initialLocale !== undefined) effectsProps.initialLocale = initialLocale;
  if (autosave !== undefined) effectsProps.autosave = autosave;

  return (
    <ShortcutRegistryProvider>
      <ContextMenuProvider>
        <DocumentProvider initialDocument={initialDocument}>
          <AuthProvider>
            <EditorShellEffects {...effectsProps} />
            {children}
          </AuthProvider>
        </DocumentProvider>
      </ContextMenuProvider>
    </ShortcutRegistryProvider>
  );
}

// Effects that need the inner-provider context (DocumentProvider → useDocument
// inside useAutosaveDocument) must render as a sibling inside the provider
// tree. Kept internal so consumers see only `<EditorShell>`.
function EditorShellEffects({
  initialLocale,
  autosave,
}: {
  initialLocale?: Locale;
  autosave?: AutosaveOptions & { enabled?: boolean };
}): null {
  useEffect(() => {
    if (initialLocale) setLocale(initialLocale);
  }, [initialLocale]);

  const autosaveEnabled = autosave?.enabled ?? false;
  const autosaveOptions: AutosaveOptions = {
    enabled: autosaveEnabled,
    ...(autosave?.delayMs !== undefined && { delayMs: autosave.delayMs }),
    ...(autosave?.serialize !== undefined && { serialize: autosave.serialize }),
  };
  useAutosaveDocument(autosaveOptions);

  useUndoShortcuts();

  return null;
}

/**
 * Register default `Mod+Z` / `Mod+Shift+Z` bindings against the document
 * context's `undo` / `redo`. Mounted inside `<DocumentProvider>` so the
 * handlers resolve to the correct store when multiple shells coexist
 * (e.g. main canvas + preview modal). T-133.
 */
function useUndoShortcuts(): void {
  const { undo, redo, canUndo, canRedo } = useDocument();
  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        id: 'essential.undo',
        combo: 'Mod+Z',
        description: 'Undo',
        category: 'essential',
        when: () => canUndo,
        handler: () => {
          undo();
          return undefined;
        },
      },
      {
        id: 'essential.redo',
        combo: 'Mod+Shift+Z',
        description: 'Redo',
        category: 'essential',
        when: () => canRedo,
        handler: () => {
          redo();
          return undefined;
        },
      },
    ],
    [undo, redo, canUndo, canRedo],
  );
  useRegisterShortcuts(shortcuts);
}
