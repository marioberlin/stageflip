// packages/editor-shell/src/persistence/index.ts
// Barrel for the localStorage persistence surface (T-121c).

export {
  MAX_RECENT_DOCUMENTS,
  type RecentDocumentEntry,
  clearDocument,
  listRecentDocuments,
  loadDocumentSerialized,
  saveDocument,
} from './document-storage';
export { type AutosaveOptions, useAutosaveDocument } from './use-autosave-document';
