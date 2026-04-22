// packages/editor-shell/src/persistence/document-storage.test.ts
// Verifies per-doc storage, recent-documents index, and graceful
// degradation when localStorage is unavailable / throws.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_RECENT_DOCUMENTS,
  type RecentDocumentEntry,
  clearDocument,
  listRecentDocuments,
  loadDocumentSerialized,
  saveDocument,
} from './document-storage';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('saveDocument / loadDocumentSerialized', () => {
  it('round-trips a raw JSON payload by docId', () => {
    saveDocument('doc-1', '{"meta":{"id":"doc-1"}}');
    expect(loadDocumentSerialized('doc-1')).toBe('{"meta":{"id":"doc-1"}}');
  });

  it('returns null when the docId has no entry', () => {
    expect(loadDocumentSerialized('never-saved')).toBeNull();
  });

  it('keeps per-doc entries isolated', () => {
    saveDocument('doc-a', 'A');
    saveDocument('doc-b', 'B');
    expect(loadDocumentSerialized('doc-a')).toBe('A');
    expect(loadDocumentSerialized('doc-b')).toBe('B');
  });
});

describe('recent documents index', () => {
  it('is empty by default', () => {
    expect(listRecentDocuments()).toEqual([]);
  });

  it('prepends the most recent save', () => {
    saveDocument('doc-1', 'A', { title: 'First', slideCount: 2 });
    saveDocument('doc-2', 'B', { title: 'Second', slideCount: 5 });
    const recent = listRecentDocuments();
    expect(recent.map((r) => r.id)).toEqual(['doc-2', 'doc-1']);
    expect(recent[0]?.title).toBe('Second');
    expect(recent[0]?.slideCount).toBe(5);
  });

  it('deduplicates — re-saving an existing id moves it to the front', () => {
    saveDocument('doc-1', 'A', { title: 'First', slideCount: 2 });
    saveDocument('doc-2', 'B', { title: 'Second', slideCount: 5 });
    saveDocument('doc-1', 'A2', { title: 'First (edited)', slideCount: 3 });
    const recent = listRecentDocuments();
    expect(recent.map((r) => r.id)).toEqual(['doc-1', 'doc-2']);
    expect(recent[0]?.title).toBe('First (edited)');
  });

  it('caps the index at MAX_RECENT_DOCUMENTS', () => {
    for (let i = 0; i < MAX_RECENT_DOCUMENTS + 5; i += 1) {
      saveDocument(`doc-${i}`, 'x', { title: `T${i}`, slideCount: 1 });
    }
    expect(listRecentDocuments().length).toBe(MAX_RECENT_DOCUMENTS);
  });

  it('accepts an explicit savedAtIso for deterministic tests', () => {
    const iso = '2026-04-22T00:00:00.000Z';
    saveDocument('doc-1', 'A', { title: 'First', slideCount: 1, savedAtIso: iso });
    expect(listRecentDocuments()[0]?.savedAtIso).toBe(iso);
  });

  it('drops malformed entries when the index is corrupted', () => {
    localStorage.setItem('stageflip:editor:recent', JSON.stringify([{ garbage: true }]));
    expect(listRecentDocuments()).toEqual([]);
  });
});

describe('clearDocument', () => {
  it('removes the per-doc entry and its recent-index row', () => {
    saveDocument('doc-1', 'A', { title: 'First', slideCount: 1 });
    saveDocument('doc-2', 'B', { title: 'Second', slideCount: 1 });
    clearDocument('doc-1');
    expect(loadDocumentSerialized('doc-1')).toBeNull();
    expect(listRecentDocuments().map((r) => r.id)).toEqual(['doc-2']);
  });
});

describe('graceful degradation', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
  });

  it('saveDocument does not throw when localStorage rejects the write', () => {
    expect(() => saveDocument('doc-1', 'A', { title: 'T', slideCount: 1 })).not.toThrow();
  });

  it('loadDocumentSerialized returns null when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadDocumentSerialized('doc-1')).toBeNull();
  });

  it('listRecentDocuments returns [] when the stored JSON is unparseable', () => {
    vi.restoreAllMocks();
    localStorage.setItem('stageflip:editor:recent', '{not-json}');
    expect(listRecentDocuments()).toEqual([]);
  });
});

// Helper so the PR reviewer can eyeball the entry shape without reading
// the test body. Not exported.
function _shapeExample(): RecentDocumentEntry {
  return { id: 'x', title: 't', slideCount: 0, savedAtIso: '2026-01-01T00:00:00.000Z' };
}
void _shapeExample;
