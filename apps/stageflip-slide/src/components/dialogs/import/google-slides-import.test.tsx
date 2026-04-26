// apps/stageflip-slide/src/components/dialogs/import/google-slides-import.test.tsx

import { EditorShell } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleSlidesImport } from './google-slides-import';

afterEach(() => cleanup());

const FAKE_DOC: Document = {
  meta: {
    id: 'imported',
    version: 0,
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
    title: 'Imported',
    locale: 'en',
    schemaVersion: 1,
  },
  theme: { tokens: {} },
  variables: {},
  components: {},
  masters: [],
  layouts: [],
  content: { mode: 'slide', slides: [] },
};

function mount(overrides: Partial<React.ComponentProps<typeof GoogleSlidesImport>> = {}) {
  return render(
    <EditorShell>
      <GoogleSlidesImport
        open={overrides.open ?? true}
        onClose={overrides.onClose ?? (() => undefined)}
        onFetchDeck={overrides.onFetchDeck ?? (() => Promise.resolve(FAKE_DOC))}
        onImported={overrides.onImported ?? (() => undefined)}
      />
    </EditorShell>,
  );
}

describe('<GoogleSlidesImport />', () => {
  it('does not render when open=false', () => {
    mount({ open: false });
    expect(screen.queryByTestId('modal-import-google')).toBeNull();
  });

  it('renders the feature-flag banner + both input fields', () => {
    mount();
    expect(screen.getByTestId('import-google-feature-flag')).toBeTruthy();
    expect(screen.getByTestId('import-google-token')).toBeTruthy();
    expect(screen.getByTestId('import-google-deck-id')).toBeTruthy();
  });

  it('blocks submit with a missing-fields error when both inputs are empty', () => {
    mount();
    const form = screen.getByTestId('import-google-submit').closest('form');
    expect(form).not.toBeNull();
    if (form) fireEvent.submit(form);
    expect(screen.getByTestId('import-google-error').textContent).toContain('required');
  });

  it('calls onFetchDeck + onImported on success', async () => {
    const onFetchDeck = vi.fn(() => Promise.resolve(FAKE_DOC));
    const onImported = vi.fn();
    const onClose = vi.fn();
    mount({ onFetchDeck, onImported, onClose });
    fireEvent.change(screen.getByTestId('import-google-token'), { target: { value: 'tok' } });
    fireEvent.change(screen.getByTestId('import-google-deck-id'), { target: { value: 'deck' } });
    const form = screen.getByTestId('import-google-submit').closest('form');
    expect(form).not.toBeNull();
    if (form) fireEvent.submit(form);
    await waitFor(() => {
      expect(onFetchDeck).toHaveBeenCalledWith('tok', 'deck');
      expect(onImported).toHaveBeenCalledWith(FAKE_DOC);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('surfaces a generic error when onFetchDeck rejects', async () => {
    const onFetchDeck = vi.fn(() => Promise.reject(new Error('boom')));
    mount({ onFetchDeck });
    fireEvent.change(screen.getByTestId('import-google-token'), { target: { value: 'tok' } });
    fireEvent.change(screen.getByTestId('import-google-deck-id'), { target: { value: 'deck' } });
    const form = screen.getByTestId('import-google-submit').closest('form');
    if (form) fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByTestId('import-google-error').textContent).toContain('Import failed');
    });
  });
});
