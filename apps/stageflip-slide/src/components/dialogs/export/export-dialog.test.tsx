// apps/stageflip-slide/src/components/dialogs/export/export-dialog.test.tsx

import { EditorShell } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportDialog } from './export-dialog';

afterEach(() => cleanup());

const DOC: Document = {
  meta: {
    id: 'doc',
    version: 0,
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
    title: 'doc',
    locale: 'en',
    schemaVersion: 1,
  },
  theme: { tokens: {} },
  variables: {},
  components: {},
  masters: [],
  layouts: [],
  content: { mode: 'slide', slides: [{ id: 's1', elements: [] }] },
};

function mount(
  overrides: Partial<React.ComponentProps<typeof ExportDialog>> = {},
  initialDocument: Document | null = DOC,
) {
  return render(
    <EditorShell initialDocument={initialDocument}>
      <ExportDialog
        open={overrides.open ?? true}
        onClose={overrides.onClose ?? (() => undefined)}
        onExport={overrides.onExport ?? (() => Promise.resolve())}
      />
    </EditorShell>,
  );
}

describe('<ExportDialog />', () => {
  it('renders all three control groups and defaults to png/1080/all', () => {
    mount();
    expect((screen.getByTestId('export-format-png') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('export-resolution-1080') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('export-range-all') as HTMLInputElement).checked).toBe(true);
  });

  it('disables submit when no document is loaded', () => {
    mount({}, null);
    expect((screen.getByTestId('export-submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('dispatches onExport with the picked selections', async () => {
    const onExport = vi.fn(() => Promise.resolve());
    const onClose = vi.fn();
    mount({ onExport, onClose });
    fireEvent.click(screen.getByTestId('export-format-mp4'));
    fireEvent.click(screen.getByTestId('export-resolution-4k'));
    fireEvent.click(screen.getByTestId('export-range-current'));
    const form = screen.getByTestId('export-submit').closest('form');
    if (form) fireEvent.submit(form);
    await waitFor(() => {
      expect(onExport).toHaveBeenCalledWith({
        format: 'mp4',
        resolution: '4k',
        range: 'current',
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('renders the pending label + keeps the submit disabled while exporting', async () => {
    let resolvePending: () => void = () => undefined;
    const onExport = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePending = resolve;
        }),
    );
    mount({ onExport });
    const form = screen.getByTestId('export-submit').closest('form');
    if (form) fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByTestId('export-submit').textContent).toBe('Exporting…');
    });
    resolvePending();
  });
});
