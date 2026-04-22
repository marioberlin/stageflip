// packages/editor-shell/src/persistence/document-storage.ts
// localStorage-backed per-document persistence + recent-document index.

/**
 * Keys
 * ----
 *   stageflip:editor:doc:<docId>   → serialized Document JSON
 *   stageflip:editor:recent        → `RecentDocumentEntry[]`
 *
 * Why per-doc keys (vs. the SlideMotion single-slot approach)
 * ----------------------------------------------------------
 * The editor supports reopening an older document by id — a single
 * `stageflip:editor:document` slot would forget prior work the moment
 * a new doc opened. Per-doc keys let the editor re-hydrate any doc by
 * id and keep a bounded recent index for the onboarding / cloud panel.
 *
 * Failure handling
 * ----------------
 * `localStorage` can throw (Safari private browsing, quota exceeded,
 * SSR). Every entry point swallows errors and degrades gracefully:
 * `save*` silently no-ops, `load*` returns `null`, `list*` returns
 * `[]`. Callers that need to surface failures should subscribe to
 * the document state directly instead.
 *
 * No `JSON.parse` validation at this layer: the returned JSON is an
 * `unknown`-shaped payload; the consumer (DocumentProvider hydrator,
 * `@stageflip/storage` adapter) is expected to run it through
 * `documentSchema.parse()` before trusting the fields. Keeps the
 * storage module purely about bytes.
 */

export const MAX_RECENT_DOCUMENTS = 10;

const DOC_KEY_PREFIX = 'stageflip:editor:doc:';
const RECENT_KEY = 'stageflip:editor:recent';

export interface RecentDocumentEntry {
  id: string;
  title: string;
  slideCount: number;
  savedAtIso: string;
}

function docKeyFor(docId: string): string {
  return `${DOC_KEY_PREFIX}${docId}`;
}

function storage(): Storage | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  const candidate = (globalThis as { localStorage?: Storage }).localStorage;
  return candidate;
}

/** Persist a document (pre-serialized — no schema validation here) under
 * its id, then refresh the recent-documents index. */
export function saveDocument(
  docId: string,
  serialized: string,
  recentMeta?: Omit<RecentDocumentEntry, 'id' | 'savedAtIso'> & { savedAtIso?: string },
): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(docKeyFor(docId), serialized);
    if (recentMeta) {
      const iso = recentMeta.savedAtIso ?? new Date().toISOString();
      touchRecentEntry({
        id: docId,
        title: recentMeta.title,
        slideCount: recentMeta.slideCount,
        savedAtIso: iso,
      });
    }
  } catch {
    // localStorage full, unavailable, or SSR — degrade silently.
  }
}

/** Read the raw JSON string for a document, or `null` if absent /
 * unreadable. The caller runs schema validation; this layer just reads
 * bytes. */
export function loadDocumentSerialized(docId: string): string | null {
  const store = storage();
  if (!store) return null;
  try {
    return store.getItem(docKeyFor(docId));
  } catch {
    return null;
  }
}

export function clearDocument(docId: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(docKeyFor(docId));
    removeRecentEntry(docId);
  } catch {
    // ignore
  }
}

export function listRecentDocuments(): RecentDocumentEntry[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentEntry);
  } catch {
    return [];
  }
}

function isRecentEntry(value: unknown): value is RecentDocumentEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.slideCount === 'number' &&
    typeof v.savedAtIso === 'string'
  );
}

function touchRecentEntry(entry: RecentDocumentEntry): void {
  const store = storage();
  if (!store) return;
  const existing = listRecentDocuments().filter((r) => r.id !== entry.id);
  existing.unshift(entry);
  try {
    store.setItem(RECENT_KEY, JSON.stringify(existing.slice(0, MAX_RECENT_DOCUMENTS)));
  } catch {
    // ignore
  }
}

function removeRecentEntry(docId: string): void {
  const store = storage();
  if (!store) return;
  const next = listRecentDocuments().filter((r) => r.id !== docId);
  try {
    store.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
