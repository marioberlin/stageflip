// apps/stageflip-slide/src/components/dialogs/import/image-upload.test.tsx

import { EditorShell, assetsAtom, useEditorShellAtomValue } from '@stageflip/editor-shell';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageUpload } from './image-upload';

afterEach(() => cleanup());

function Observer(): ReactElement {
  const list = useEditorShellAtomValue(assetsAtom);
  return (
    <span data-testid="image-upload-asset-count">
      {list.length}|{list[0]?.name ?? ''}|{list[0]?.url ?? ''}
    </span>
  );
}

function mount(overrides: Partial<React.ComponentProps<typeof ImageUpload>> = {}) {
  return render(
    <EditorShell>
      <ImageUpload
        open={overrides.open ?? true}
        onClose={overrides.onClose ?? (() => undefined)}
        createObjectUrl={overrides.createObjectUrl ?? (() => 'blob:test-url')}
        makeId={overrides.makeId ?? (() => 'id-1')}
      />
      <Observer />
    </EditorShell>,
  );
}

function makeFile(name: string, type: string, sizeBytes = 256): File {
  const data = new Uint8Array(sizeBytes);
  return new File([data], name, { type });
}

describe('<ImageUpload />', () => {
  it('rejects non-image files', () => {
    mount();
    const input = screen.getByTestId('import-image-file') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('doc.pdf', 'application/pdf')] } });
    expect(screen.getByTestId('import-image-error').textContent).toContain('Only image files');
  });

  it('rejects oversized files', () => {
    mount();
    const input = screen.getByTestId('import-image-file') as HTMLInputElement;
    // 21 MB — over the 20 MB cap.
    fireEvent.change(input, {
      target: { files: [makeFile('big.png', 'image/png', 21 * 1024 * 1024)] },
    });
    expect(screen.getByTestId('import-image-error').textContent).toContain('20');
  });

  it('appends to assetsAtom on submit', () => {
    const onClose = vi.fn();
    mount({ onClose });
    const input = screen.getByTestId('import-image-file') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('p.png', 'image/png', 100)] } });
    const form = screen.getByTestId('import-image-submit').closest('form');
    if (form) fireEvent.submit(form);
    expect(screen.getByTestId('image-upload-asset-count').textContent).toBe(
      '1|p.png|blob:test-url',
    );
    expect(onClose).toHaveBeenCalled();
  });
});
