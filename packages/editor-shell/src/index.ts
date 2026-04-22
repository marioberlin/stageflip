// packages/editor-shell/src/index.ts
// Public surface for @stageflip/editor-shell.
// T-121a: shortcut registry. T-121b: atoms + context shells.

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
  type MicroUndo,
  canRedoAtom,
  canUndoAtom,
  redoStackAtom,
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
