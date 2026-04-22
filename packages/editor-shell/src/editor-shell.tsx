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
import { useEffect } from 'react';
import { AuthProvider } from './context/auth-context';
import { DocumentProvider } from './context/document-context';
import { type Locale, setLocale } from './i18n/catalog';
import { type AutosaveOptions, useAutosaveDocument } from './persistence/use-autosave-document';
import { ShortcutRegistryProvider } from './shortcuts/shortcut-registry';

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
      <DocumentProvider initialDocument={initialDocument}>
        <AuthProvider>
          <EditorShellEffects {...effectsProps} />
          {children}
        </AuthProvider>
      </DocumentProvider>
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

  return null;
}
