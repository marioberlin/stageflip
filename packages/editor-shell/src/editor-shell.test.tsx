// packages/editor-shell/src/editor-shell.test.tsx
// Smoke-level composition test: every bundled hook resolves inside the
// shell without extra setup, the i18n locale flip runs on mount, and
// autosave is off by default.

import { act, cleanup, render } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from './context/auth-context';
import { useDocument } from './context/document-context';
import { EditorShell } from './editor-shell';
import { getLocale, setLocale, t } from './i18n/catalog';
import { useRegisterShortcuts } from './shortcuts/shortcut-registry';
import { makeSlideDoc } from './test-fixtures/document-fixture';

beforeEach(() => {
  setLocale('en');
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  setLocale('en');
});

function Probe({
  onReady,
}: {
  onReady: (snapshot: {
    doc: ReturnType<typeof useDocument>['document'];
    user: ReturnType<typeof useAuth>['user'];
  }) => void;
}): null {
  useRegisterShortcuts([]);
  const { document: doc } = useDocument();
  const { user } = useAuth();
  onReady({ doc, user });
  return null;
}

describe('<EditorShell>', () => {
  it('composes every provider so hooks resolve without extra setup', () => {
    const snapshots: Array<{
      doc: ReturnType<typeof useDocument>['document'];
      user: ReturnType<typeof useAuth>['user'];
    }> = [];
    const doc = makeSlideDoc({ slideCount: 2 });
    render(
      <EditorShell initialDocument={doc}>
        <Probe onReady={(s) => snapshots.push(s)} />
      </EditorShell>,
    );
    const last = snapshots[snapshots.length - 1];
    expect(last?.doc).toBe(doc);
    expect(last?.user).toBeNull();
  });

  it('flips the i18n locale on mount when initialLocale is provided', () => {
    render(
      <EditorShell initialLocale="pseudo">
        <Probe onReady={() => {}} />
      </EditorShell>,
    );
    expect(getLocale()).toBe('pseudo');
    expect(t('nav.undo')).toBe('⟦nav.undo⟧');
  });

  it('leaves the locale alone when initialLocale is omitted', () => {
    setLocale('en');
    render(
      <EditorShell>
        <Probe onReady={() => {}} />
      </EditorShell>,
    );
    expect(getLocale()).toBe('en');
  });

  it('does not autosave by default (off to avoid double-writes in apps)', () => {
    vi.useFakeTimers();
    try {
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const doc = makeSlideDoc({ slideCount: 1 });
      render(
        <EditorShell initialDocument={doc}>
          <Probe onReady={() => {}} />
        </EditorShell>,
      );
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      const writes = setItem.mock.calls.filter(
        ([k]) => typeof k === 'string' && k.startsWith('stageflip:editor:'),
      );
      expect(writes.length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('enables autosave when explicitly configured', () => {
    vi.useFakeTimers();
    try {
      const doc = makeSlideDoc({ slideCount: 1 });
      render(
        <EditorShell initialDocument={doc} autosave={{ enabled: true, delayMs: 25 }}>
          <Probe onReady={() => {}} />
        </EditorShell>,
      );
      act(() => {
        vi.advanceTimersByTime(25);
      });
      expect(localStorage.getItem(`stageflip:editor:doc:${doc.meta.id}`)).toBe(JSON.stringify(doc));
    } finally {
      vi.useRealTimers();
    }
  });
});

function _usedInternally(): React.ReactElement {
  return <Probe onReady={() => {}} />;
}
void _usedInternally;
