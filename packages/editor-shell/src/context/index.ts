// packages/editor-shell/src/context/index.ts
// Barrel for the provider + hook surface (T-121b).

export { AuthProvider, useAuth } from './auth-context';
export type { AuthContextValue, AuthUser } from './auth-context';
export {
  DocumentProvider,
  type DocumentContextValue,
  type DocumentProviderProps,
  useDocument,
  useEditorShellAtomValue,
} from './document-context';
