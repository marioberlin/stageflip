// apps/stageflip-slide/src/components/dialogs/import/pptx-import.test.tsx

import { EditorShell } from '@stageflip/editor-shell';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PptxImport } from './pptx-import';

afterEach(() => cleanup());

function mount(overrides: Partial<React.ComponentProps<typeof PptxImport>> = {}) {
  return render(
    <EditorShell>
      <PptxImport
        open={overrides.open ?? true}
        onClose={overrides.onClose ?? (() => undefined)}
        onImport={overrides.onImport ?? (() => Promise.resolve())}
      />
    </EditorShell>,
  );
}

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe('<PptxImport />', () => {
  it('renders the stub banner so users know parse is incomplete', () => {
    mount();
    expect(screen.getByTestId('import-pptx-stub-banner')).toBeTruthy();
  });

  it('rejects non-pptx files with an invalid-type error', () => {
    mount();
    const input = screen.getByTestId('import-pptx-file') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('deck.pdf', 'application/pdf')] } });
    expect(screen.getByTestId('import-pptx-error').textContent).toContain('pptx');
  });

  it('accepts a .pptx file by extension even when mime-type is generic', () => {
    mount();
    const input = screen.getByTestId('import-pptx-file') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('deck.pptx', 'application/octet-stream')] },
    });
    expect(screen.queryByTestId('import-pptx-error')).toBeNull();
    const submit = screen.getByTestId('import-pptx-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it('disables submit until a valid file is picked', () => {
    mount();
    const submit = screen.getByTestId('import-pptx-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('dispatches onImport + onClose on submit with a valid file', async () => {
    const onImport = vi.fn(() => Promise.resolve());
    const onClose = vi.fn();
    mount({ onImport, onClose });
    const input = screen.getByTestId('import-pptx-file') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          makeFile(
            'deck.pptx',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          ),
        ],
      },
    });
    const form = screen.getByTestId('import-pptx-submit').closest('form');
    if (form) fireEvent.submit(form);
    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalled();
    });
  });
});
