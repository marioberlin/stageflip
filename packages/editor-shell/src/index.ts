// packages/editor-shell/src/index.ts
// Public surface for @stageflip/editor-shell.
// T-121a: shortcut registry. T-121b: atoms + context shells.
// T-121c: <EditorShell> composition + localStorage persistence + i18n.

// T-121a — shortcuts
export type { FocusZone } from './shortcuts/focus-zone';
export { currentFocusZone, focusIsInZone } from './shortcuts/focus-zone';
export { formatCombo, matchesKeyCombo } from './shortcuts/match-key-combo';
export {
  ShortcutRegistryProvider,
  useAllShortcuts,
  useRegisterShortcuts,
} from './shortcuts/shortcut-registry';
export type { Shortcut, ShortcutCategory, ShortcutHandler } from './shortcuts/types';

// T-121b — atoms + context
export {
  __clearElementByIdCacheForTest,
  __clearSlideByIdCacheForTest,
  documentAtom,
  elementByIdAtom,
  slideByIdAtom,
} from './atoms/document';
export { activeSlideIdAtom } from './atoms/ui';
export {
  EMPTY_SELECTION,
  selectedElementIdAtom,
  selectedElementIdsAtom,
  selectedSlideIdsAtom,
} from './atoms/selection';
export {
  MAX_MICRO_UNDO,
  type ActiveTransaction,
  type MicroUndo,
  canRedoAtom,
  canUndoAtom,
  inTransactionAtom,
  redoStackAtom,
  transactionAtom,
  undoStackAtom,
} from './atoms/undo';
export { AuthProvider, useAuth } from './context/auth-context';
export type { AuthContextValue, AuthUser } from './context/auth-context';
export {
  DocumentProvider,
  type DocumentContextValue,
  type DocumentProviderProps,
  useDocument,
  useEditorShellAtomValue,
} from './context/document-context';

// T-121c — composition, persistence, i18n
export { EditorShell, type EditorShellProps } from './editor-shell';
export { type Locale, getLocale, setLocale, t } from './i18n/catalog';
export {
  MAX_RECENT_DOCUMENTS,
  type AutosaveOptions,
  type RecentDocumentEntry,
  clearDocument,
  listRecentDocuments,
  loadDocumentSerialized,
  saveDocument,
  useAutosaveDocument,
} from './persistence';

// T-125b — ZodForm auto-inspector
export {
  type DiscriminatedBranch,
  type FieldKind,
  type FieldSpec,
  introspectField,
  introspectSchema,
} from './zodform/introspect';
export { ZodForm, type ZodFormProps } from './zodform/zod-form';
